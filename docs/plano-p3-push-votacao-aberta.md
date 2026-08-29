# Plano P3 — Push imediato de "Votação Aberta"

> **Base**: `main` @ `5106f1e` · **Origem**: [P3 da análise de notificações push](./analise-notificacoes-push.md)
> **Escopo fechado**: apenas o item P3. Não cobre P2 (retry do push semanal) nem P6 (painel de entregas).
> **Numeração de migrations**: este plano usa **107**. Se os planos irmãos (P2, P6) forem executados
> primeiro, cada um consumirá pelo menos um número — renumerar para o próximo livre (108, 109…),
> mantendo a sequência de 3 dígitos (AGENTS.md §7.2).

---

## 1. Contexto e objetivo

A análise (seção P3, `docs/analise-notificacoes-push.md:141-157`) registra que, quando o admin
finaliza/publica a partida, **nenhum push é enviado**: o primeiro lembrete de voto só chega ~18h
depois, com o bucket "6 horas" antes do fechamento das 24h. O próprio app promete o contrário — o
`CardNotificacoes` exibe "convocação de presença e **abertura da votação**"
(`src/components/CardNotificacoes.tsx:95-99`), texto que o backend não cumpre hoje. O impacto é duplo:
percepção de "notificação que não chegou" no momento de maior engajamento (fim do jogo, quintas à
noite) e uma janela ociosa de ~18h em que quem votaria cedo não é lembrado.

O objetivo é disparar um **push imediato no ato da publicação**, para todos os participantes de
linha aptos a votar, seguindo a infraestrutura de push que já existe e está saudável: ledger de
idempotência `push_reminder_deliveries`, RPCs de listagem sem N+1 (migration 090), Edge Function
`send-voting-reminders` com limpeza de endpoints 404/410 e TTL/urgency por envio (P4, migrations
não exigidas — já deployado), e o padrão de disparo manual do admin com coleta curta de resposta
(migrations 104/105, que resolveram o P5 e estão validadas em produção).

A análise **sugere** (não prescreve): RPC `disparar_push_votacao_aberta(p_admin_id, p_partida_id)`
no padrão da 099, novo modo da `send-voting-reminders` (`{partida_id, abertura: true}`), template
próprio na `notificacoes_config` e ledger com `reminder_key='votacao-aberta'`. Este plano confirma
essas escolhas contra o código real e completa os detalhes que faltavam — sobretudo **onde** a
partida transita para `published` (há **dois** caminhos, ver §2.3) e a necessidade de uma **nova RPC
de listagem** (a existente não serve, ver §2.4).

---

## 2. Estado atual medido (código real)

### 2.1 O pipeline de push de votação que existe hoje

| Elemento                                  | Referência                                                | Fato verificado                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Buckets 6h/3h/1h/30m com janela de 10 min | `supabase/functions/send-voting-reminders/index.ts:24-31` | Modo único da function: varre janela `remaining ∈ (offset−10min, offset]`. **Não aceita `partida_id` no body** — o body é ignorado (`{}` do cron).                                                                                                                                                                                                                                         |
| Claim idempotente no ledger (catch 23505) | `index.ts:107-119`                                        | PK `(partida_id, jogador_id, reminder_key)` em `push_reminder_deliveries` (`036_create_push_notifications.sql:18-26`).                                                                                                                                                                                                                                                                     |
| TTL/urgency por envio (P4)                | `index.ts:141-144`                                        | `TTL = offset do bucket`, `urgency: 'high'`; cleanup 404/410 em `index.ts:147-151`.                                                                                                                                                                                                                                                                                                        |
| Templates com fallback hardcoded          | `index.ts:197-227`                                        | Lê `votacao_template_*_titulo/msg` da `notificacoes_config`; gate `votacao_ativo === false` em `index.ts:179-181`.                                                                                                                                                                                                                                                                         |
| CHECK do ledger                           | `077_configuracoes_notificacoes.sql:54-63`                | Aceita `('6h','3h','1h','30m','confirmacao','reforco')` + slots `HH:MM`. **`'votacao-aberta'` precisa ser adicionado** (padrão já usado 2×: 057 e 077).                                                                                                                                                                                                                                    |
| `listar_pendentes_votacao`                | `090_otimizacao_placar_e_rpcs_notificacoes.sql:48-92`     | Elegibilidade correta (§2.4), porém **filtra `voting_closes_at <= now() + 6h10m`** — uma partida recém-publicada (fecha em +24h) **nunca** seria retornada.                                                                                                                                                                                                                                |
| Disparo manual admin (padrão P5)          | `104_fix_push_cron_fire_and_forget.sql:74-171`            | `disparar_confirmacao_manual`/`disparar_push_teste` chamam `disparar_e_registrar_cron_http(..., 2000)`; jobs de cron são fire-and-forget (`104:323-378`); coleta assíncrona não bloqueante na `105_coleta_nao_bloqueante_cron_http.sql:19-136`. Timeout de 2s cabe no `statement_timeout` de 3s do role anon; "Timeout" em cold start é falso-negativo conhecido (o push sai mesmo assim). |
| Contrato de payload do `sw.js`            | `public/sw.js:75-85`                                      | `{title, body, url, partida_id, tag}` — o `sw.js` já faz fallback de `url`/`tag` a partir de `partida_id`; nada a mudar no SW.                                                                                                                                                                                                                                                             |

### 2.2 Onde `published` acontece — DIVERGÊNCIA do fluxo único implícito na análise

A análise fala em "o fluxo de publicação" no singular. O código tem **dois caminhos** que gravam
`status = 'published'`, e o plano precisa cobrir ambos:

1. **Ao vivo → publicada**: RPC `finalizar_partida` (`079_eventos_financeiros_automaticos.sql:305-330`)
   exige `status = 'live'`, sincroniza contadores, gera avulsos/diárias e grava
   `status='published', voting_closes_at = now() + interval '24 hours'`. Chamada pelo frontend em
   **`src/routes/PartidaAoVivo.tsx:216`** (`confirmarFinalizar`, linhas 211-231), via
   `finalizarPartida()` de `src/lib/partidas.ts:319-325`. É o fluxo canônico da quinta.
2. **Draft → publicada (publicação direta)**: RPC `salvar_edicao_partida` com
   `p_primeira_vez = true` (definição **viva** em
   `097_fix_elem_ambiguo_salvar_edicao.sql:116-124` — a versão da 079 foi substituída por CREATE
   OR REPLACE) delega à RPC interna `publicar_partida` (`079:332-356`, definição viva), que exige
   `status = 'draft'` e grava o mesmo `voting_closes_at = now()+24h`.
   Chamada pelo frontend em **`src/routes/PartidaEditar.tsx:199`** (`salvar`, linhas 192-220, com
   `primeiraVez = partida.status === 'draft'` calculado na linha 134), via
   `salvarEdicaoCompletaPartida()` de `src/lib/partidas.ts:420-447`.
   - Nota: `publicar_partida` existe como RPC standalone, mas **nenhum código de `src/` a chama
     diretamente** (verificado por grep) — apenas `salvar_edicao_partida` a invoca internamente.
3. **Re-edição de partida já publicada** (`primeiraVez = false`) **não** transita de status — não
   deve disparar push (e não disparará, pelo desenho do §3.1).

### 2.3 A promessa não cumprida

`src/components/CardNotificacoes.tsx:95-99`: "Você receberá avisos de convocação de presença e
**abertura da votação** neste aparelho." — Confirmado integralmente como na análise.

### 2.4 Elegibilidade "apto a votar" e por que falta uma RPC de listagem

A regra canônica de quem é lembrado para votar está em `listar_pendentes_votacao` (090:62-89):
partida `published` com `voting_closes_at > now()`, participante de linha
(`pp.posicao <> 'goleiro'`), jogador ativo, não-random (`posicao <> 'random'` e
`username NOT ILIKE 'random%'`), que **ainda não votou** (`NOT EXISTS votes`) e com INNER JOIN em
`push_subscriptions` (quem não tem inscrição nem entra). Tudo em 1 round-trip.

Para a abertura, essa RPC **não pode ser reaproveitada** com a janela padrão: a partida recém-
publicada tem `voting_closes_at ≈ now()+24h`, fora do teto de 6h10m do parâmetro. O desenho (§3.3)
cria uma RPC irmã dedicada `listar_pendentes_votacao_abertura(p_partida_id)`, espelhando exatamente
a mesma elegibilidade, filtrada por partida e **sem** janela de fechamento (apenas `> now()`).

---

## 3. Design da solução (com justificativa)

### 3.1 Quem dispara: RPC chamada pelo frontend, no ato da publicação (fire-and-forget)

**Decisão**: nova RPC `disparar_push_votacao_aberta(p_admin_id bigint, p_partida_id bigint)`, no
exato padrão dos disparos manuais da 104 (`disparar_confirmacao_manual`), chamada pelo frontend
imediatamente após a publicação bem-sucedida **nos dois caminhos** (AoVivo e Editar/primeiraVez),
**sem `await` bloqueante** (`void ... .catch(() => {})`): a navegação pós-publicação não espera
nem os 2s de coleta.

Justificativa e alternativas avaliadas:

- **Trigger no banco** (`AFTER UPDATE OF status ON partidas WHEN NEW.status='published'` +
  `pg_net`): automática e independente do cliente, mas foi **rejeitada** — (a) esconde a ação
  dentro de um mecanismo que dispararia em _qualquer_ futuro UPDATE de status (o cron de fechamento
  `published→closed` já existe e qualquer migration de correção que religue status viraria fonte de
  push fantasma); (b) não há gate de admin/operador no contexto de trigger, fugindo do padrão de
  "ações sensíveis validam operador" (AGENTS.md §9.4); (c) impossibilita o dry-run controlado da
  validação (§6); (d) o padrão funcionando hoje para "disparar push agora" é exatamente a RPC manual.
- **Frontend chama a Edge Function direto**: impossível sem expor o `PUSH_CRON_SECRET` no bundle.
- **Cron de 1 min detecta partida publicada há < N min sem ledger** (estilo P2): funcionaria, mas
  introduz latência de até 1 min e mais um ramo no job que acabou de ser consertado (P5). O push
  "imediato" no ato da publicação é o requisito — RPC no clique é mais direto e auditável.

**Tratamento de falha sem travar a publicação**: a chamada é void/catch-silencioso. Se falhar
(rede, secret ausente, cold start), a partida **já está publicada** e nada muda para o admin; a
evidência fica em `cron_execucoes` (`job_nome='disparar_push_votacao_aberta'`) e a rede de segurança
são os buckets 6h/3h/1h/30m existentes. Não mostrar erro na UI: falha de push não pode sujar o
feedback de "Resultado publicado com sucesso".

### 3.2 A RPC disparadora (esboço SQL — migration 107)

```sql
CREATE OR REPLACE FUNCTION disparar_push_votacao_aberta(
  p_admin_id   bigint,
  p_partida_id bigint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_status   text;
  v_secret   text;
  v_headers  jsonb;
BEGIN
  SELECT is_admin INTO v_is_admin FROM jogadores WHERE jogadores.id = p_admin_id;
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso restrito a administradores.';
  END IF;

  -- Só faz sentido para partida recém-publicada e com urna ainda aberta.
  SELECT status INTO v_status FROM partidas WHERE partidas.id = p_partida_id;
  IF v_status IS NULL OR v_status <> 'published' THEN
    RAISE EXCEPTION 'Partida inválida ou não está publicada (votação aberta).';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM partidas
    WHERE id = p_partida_id AND voting_closes_at > now()
  ) THEN
    RAISE EXCEPTION 'A votação desta partida já está fechada.';
  END IF;

  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
    WHERE name = 'push_cron_secret'
    LIMIT 1;
  IF v_secret IS NULL THEN
    INSERT INTO cron_execucoes (job_nome, sucesso, erro)
    VALUES ('disparar_push_votacao_aberta', false, 'Secret push_cron_secret não encontrado no vault.');
    RAISE EXCEPTION 'Secret push_cron_secret não configurado no vault.';
  END IF;

  v_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-push-cron-secret', v_secret
  );

  PERFORM disparar_e_registrar_cron_http(
    'disparar_push_votacao_aberta',
    'https://jtavmrlllyctkuxefhpc.supabase.co/functions/v1/send-voting-reminders',
    v_headers,
    jsonb_build_object('partida_id', p_partida_id, 'abertura', true),
    2000  -- mesmo orçamento dos disparos manuais da 104 (statement_timeout anon = 3s)
  );

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION disparar_push_votacao_aberta(bigint, bigint) TO anon, authenticated;
```

Permissões: gate `is_admin` **dentro** da função (padrão do projeto — a RPC é executável por
anon/authenticated, mas só age para admin); `SECURITY DEFINER SET search_path = public`; a partida
publicada é pré-requisito, então quem tentar disparar para partida alheia não-publicada toma
exceção. O duplo-tap do admin é inofensivo: a function do §3.4 dedupa pelo ledger.

### 3.3 Nova RPC de listagem `listar_pendentes_votacao_abertura(p_partida_id)` (esboço SQL)

Irmã da `listar_pendentes_votacao` (090), mesma elegibilidade, filtrada por partida e sem janela:

```sql
CREATE OR REPLACE FUNCTION listar_pendentes_votacao_abertura(
  p_partida_id bigint
)
RETURNS TABLE (
  partida_id       bigint,
  jogador_id       bigint,
  voting_closes_at timestamptz,
  subscriptions    jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id          AS partida_id,
    pp.jogador_id AS jogador_id,
    p.voting_closes_at,
    jsonb_agg(jsonb_build_object('endpoint', ps.endpoint, 'p256dh', ps.p256dh, 'auth', ps.auth)) AS subscriptions
  FROM partidas p
  JOIN partidas_participantes pp ON pp.partida_id = p.id
  JOIN jogadores j ON j.id = pp.jogador_id
  JOIN push_subscriptions ps ON ps.jogador_id = pp.jogador_id
  WHERE p.id = p_partida_id
    AND p.status = 'published'
    AND p.voting_closes_at > now()
    AND pp.posicao <> 'goleiro'
    AND j.is_ativo = true
    AND j.posicao <> 'random'
    AND j.username NOT ILIKE 'random%'
    AND NOT EXISTS (
      SELECT 1 FROM votes v
      WHERE v.partida_id = pp.partida_id AND v.voter_id = pp.jogador_id
    )
  GROUP BY p.id, pp.jogador_id, p.voting_closes_at;
$$;

GRANT EXECUTE ON FUNCTION listar_pendentes_votacao_abertura(bigint) TO anon, authenticated;
```

Justificativa para RPC nova em vez de parametrizar a existente: (a) `CREATE OR REPLACE` com
parâmetro novo mudaria a assinatura usada pela Edge Function em produção (risco desnecessário numa
função quente que roda a cada minuto); (b) a semântica é distinta (janela de bucket vs. snapshot de
abertura) e nomes distintos mantêm o histórico das migrations legível.

### 3.4 Novo modo `abertura` na Edge Function `send-voting-reminders`

Modo aditivo tratado **antes** da lógica de buckets; `{}` (cron) segue intocado:

```ts
// Após o gate votacao_ativo e ANTES de filtrar buckets ativos:
let bodyData: { partida_id?: unknown; abertura?: boolean } = {};
try {
  bodyData = await request.json().catch(() => ({}));
} catch {
  /* vazio */
}
const partidaAbertura =
  typeof bodyData.partida_id === 'number'
    ? bodyData.partida_id
    : typeof bodyData.partida_id === 'string' && bodyData.partida_id.trim() !== ''
      ? Number(bodyData.partida_id)
      : null;

if (bodyData.abertura === true && partidaAbertura !== null) {
  if (config?.votacao_ativo === false)
    return json({ ok: true, skipped: true, motivo: 'votacao_ativo=false' }, 200);
  if (config?.votacao_abertura_ativo === false)
    return json({ ok: true, skipped: true, motivo: 'votacao_abertura_ativo=false' }, 200);

  const { data, error } = await supabase.rpc('listar_pendentes_votacao_abertura', {
    p_partida_id: partidaAbertura,
  });
  if (error) throw error;

  const template = {
    title:
      config?.votacao_template_abertura_titulo?.trim() ||
      'A urna está aberta: vote na súmula de hoje!',
    body:
      config?.votacao_template_abertura_msg?.trim() ||
      'Apito final na partida de hoje. Dê suas notas, eleja o Craque e ajude o ranking — a urna fecha em 24 horas.',
  };

  let claimed = 0;
  for (const item of data ?? []) {
    const candidate: Candidate = {
      partida_id: item.partida_id,
      jogador_id: item.jogador_id,
      voting_closes_at: item.voting_closes_at,
      reminder_key: 'votacao-aberta',
      label: 'abertura',
      ttl: 24 * 60 * 60, // ver justificativa de TTL abaixo
      subscriptions: Array.isArray(item.subscriptions) ? item.subscriptions : [],
    };
    if (candidate.subscriptions.length === 0) continue;
    if (await claim(candidate)) {
      claimed++;
      await send(candidate, { 'votacao-aberta': template });
    }
  }
  return json({
    modo: 'votacao_abertura',
    partida_id: partidaAbertura,
    targets: (data ?? []).length,
    claimed,
  });
}
```

Ajustes de tipo internos (**necessários** — sem eles o `type-check` do deploy quebra):

- `type ReminderKey` passa a incluir `'votacao-aberta'`: renomear o tipo atual das chaves de bucket
  para `BucketKey` (`type BucketKey = (typeof allReminders)[number]['key']`) e definir
  `type ReminderKey = BucketKey | 'votacao-aberta'`.
- Os templates dos buckets (`index.ts:197`) estão anotados como `Record<ReminderKey, ...>` — com o
  widening, passariam a **exigir** uma chave `'votacao-aberta'`. Reanotar como
  `Record<BucketKey, ...>`.
- `send(candidate, templates)` (`index.ts:123`) recebe `Record<ReminderKey, { title; body }>`: com
  o widening, a chamada `send(candidate, { 'votacao-aberta': template })` do esboço **não**
  satisfaria a assinatura (um `Record` da união exige todas as chaves). Duas opções equivalentes:
  mudar a assinatura para `Partial<Record<ReminderKey, { title; body }>>` (o lookup por
  `candidate.reminder_key` já funciona) ou passar o template resolvido como parâmetro na chamada.
- `claim()` já é genérico o suficiente (`index.ts:107-119`) — nada a mudar.

O payload mantém `url: /partida/:id/votar` e `tag: votar-partida-:id` (mesma cédula; `sw.js` já
trata).

**TTL = 86400s (24h) e `urgency: 'high'`**: a informação "votação aberta" vale exatamente até a
urna fechar (`voting_closes_at = now()+24h` na publicação); um TTL maior só entrega ruído depois do
prazo, e um menor perde entregas de aparelhos que demoram a despertar. É a mesma régua já adotada
no P4 para o push de confirmação (`TTL_CONFIRMACAO_SEGUNDOS = 24 * 60 * 60`,
`supabase/functions/send-confirmation-requests/index.ts:36-39`). `urgency: 'high'` segue o padrão
de todos os envios.

**Template na `notificacoes_config`** (3 colunas novas na migration 107):

```sql
ALTER TABLE notificacoes_config
  ADD COLUMN votacao_abertura_ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN votacao_template_abertura_titulo text CHECK (char_length(votacao_template_abertura_titulo) <= 120),
  ADD COLUMN votacao_template_abertura_msg    text CHECK (char_length(votacao_template_abertura_msg) <= 500);
```

Valores iniciais **propostos** (NULL na config = fallback hardcoded na function; tom de resenha
nível 3 do design-system, na linha dos buckets existentes):

- Título: **"A urna está aberta: vote na súmula de hoje!"**
- Mensagem: **"Apito final na partida de hoje. Dê suas notas, eleja o Craque e ajude o ranking — a urna fecha em 24 horas."**

`votacao_abertura_ativo` (default true) segue o padrão `confirmacao_ativo`/`reforco_ativo`:
permite desligar só a abertura sem matar os buckets. `salvar_configuracoes_notificacoes` é recriada
(CREATE OR REPLACE) com o mesmo corpo da 104 acrescido das 3 linhas no `UPDATE ... SET`
(`votacao_abertura_ativo` via `COALESCE`, templates via `CASE WHEN p_config ? ...`).

### 3.5 Ledger: `reminder_key='votacao-aberta'`

```sql
ALTER TABLE push_reminder_deliveries
  DROP CONSTRAINT IF EXISTS push_reminder_deliveries_reminder_key_check;
ALTER TABLE push_reminder_deliveries
  ADD CONSTRAINT push_reminder_deliveries_reminder_key_check
  CHECK (
    reminder_key IN ('6h','3h','1h','30m','confirmacao','reforco','votacao-aberta')
    OR reminder_key ~ '^([01][0-9]|2[0-3]):(00|15|30|45)$'
  );
```

Mesmo mecanismo das relaxas de 057 e 077 (drop + re-add com lista ampliada).

### 3.6 Duplicidade e idempotência

- **Admin re-publicar?** Não existe: `finalizar_partida` exige `live` e `publicar_partida` exige
  `draft` — a transição para `published` acontece uma única vez por partida. Re-editar partida
  publicada (`primeiraVez=false`) não publica nada e não chama a RPC.
- **RPC chamada 2×** (double-tap, retry do front): o POST repetido bate no modo abertura, e o
  `claim()` por jogador ignora 23505 → segunda execução retorna `"claimed": 0` sem reenviar. (A
  micro-janela de corrida entre dois claims simultâneos é a mesma já aceita e documentada na
  análise, §6: "ledger com PK + catch do 23505".)
- **Sobreposição com o bucket 6h**: na abertura restam ~24h; o bucket 6h só captura em
  `remaining ≤ 6h`. Nenhum jogador recebe abertura + 6h no mesmo instante, e as `reminder_key`
  são distintas no ledger.

### 3.7 Quando não há aptos ou inscritos

- **Nenhum elegível com inscrição** (ex.: partida só com goleiros/randoms, ou ninguém com push
  ativo): a RPC de listagem retorna 0 linhas; a function responde
  `{ modo: 'votacao_abertura', targets: 0, claimed: 0 }` com HTTP 200; a coleta de 2s registra o
  corpo em `cron_execucoes`. Não é erro, não há retry nem fallback (fora de escopo).
- **Jogador sem inscrição push**: excluído pelo INNER JOIN da listagem (comportamento idêntico aos
  buckets; auto-cura do P1 repara a inscrição na próxima visita).

---

## 4. Plano de execução passo a passo

### Passo 1 — Migration `supabase/migrations/107_push_votacao_aberta.sql` (única migration)

1. Relaxa o CHECK do ledger para incluir `'votacao-aberta'` (§3.5).
2. Adiciona as 3 colunas em `notificacoes_config` (§3.4).
3. Cria `listar_pendentes_votacao_abertura(bigint)` + `GRANT EXECUTE` (§3.3).
4. Cria `disparar_push_votacao_aberta(bigint, bigint)` + `GRANT EXECUTE` (§3.2).
5. Recria `salvar_configuracoes_notificacoes` (corpo da 104 + 3 campos novos) + `GRANT EXECUTE`.

Aplicar com `npx supabase db push` (fluxo do `GUIA/MIGRACOES_AUTOMATICAS.md`). Se os planos irmãos
consumirem o 107 antes, renumerar.

### Passo 2 — Edge Function `supabase/functions/send-voting-reminders/index.ts`

1. Parsear o body uma vez no `Deno.serve` (hoje não é lido).
2. Widening dos tipos (`ReminderKey` inclui `'votacao-aberta'`).
3. Inserir o ramo `abertura === true && partida_id != null` **antes** do filtro de buckets ativos
   (para o gate `votacao_ativo` continuar valendo; novo gate `votacao_abertura_ativo`).
4. Reaproveitar `claim`/`send` existentes (já cobrem ledger `sent_at`/`error_message` e cleanup 404/410).

Deploy (obrigatório, AGENTS/GUIA):

```bash
npx supabase functions deploy send-voting-reminders
```

Ordem migration → deploy: se o deploy atrasar, a RPC dispara para a function antiga, que ignora o
body e responde `candidates: 0` — inofensivo. O inverso (deploy sem migration) também é inofensivo
(ramo nunca chamado). Não há janela de quebra; recommenda-se migrar primeiro.

### Passo 3 — Frontend

1. `src/lib/notificacoes.ts`:
   - Adicionar a `NotificacoesConfig`: `votacao_abertura_ativo: boolean`,
     `votacao_template_abertura_titulo: string | null`, `votacao_template_abertura_msg: string | null`
     (+ defaults no objeto fallback da linha 41-65).
   - Nova helper ao lado de `dispararConfirmacaoManual` (linha 91):

     ```ts
     export async function dispararPushVotacaoAberta(
       adminId: number,
       partidaId: number
     ): Promise<void> {
       const { error } = await supabase.rpc('disparar_push_votacao_aberta', {
         p_admin_id: adminId,
         p_partida_id: partidaId,
       });
       if (error) throw error;
     }
     ```

2. `src/lib/database.types.ts`: incluir as assinaturas das 2 RPCs novas (padrão das existentes em
   `951-955`) e as 3 colunas novas em `notificacoes_config` — na tabela `Row` (`234`) **e também**
   nos sub-objetos `Insert`/`Update` (a partir de `262`), que repetem as colunas da tabela.
3. `src/routes/PartidaAoVivo.tsx` (caminho live → published): dentro de `confirmarFinalizar`
   (linhas 211-231), após o `invalidarCache` e **antes** do `navigate`:

   ```ts
   if (jogadorLogado) {
     void dispararPushVotacaoAberta(jogadorLogado.id, partida.id).catch(() => {
       /* push é best-effort: evidência em cron_execucoes; buckets 6h/3h/1h/30m são a rede */
     });
   }
   ```

   (`jogadorLogado` já existe no componente, linha 45.)

4. `src/routes/PartidaEditar.tsx` (caminho draft → published): dentro de `salvar()` (linhas
   192-220), após `salvarEdicaoCompletaPartida(...)` bem-sucedido, apenas quando `primeiraVez`:

   ```ts
   if (primeiraVez && jogadorLogado) {
     void dispararPushVotacaoAberta(jogadorLogado.id, partidaId).catch(() => {});
   }
   ```

   **Atenção**: `useJogadorLogado` **não** está importado nesta tela hoje (só `useAdmin`, linha 4) —
   importar e chamar no topo (Rules of Hooks: antes de qualquer retorno condicional; os guards
   `if (!isAdmin)`/`Navigate` das linhas 118-132 ficam depois de todos os hooks, como já é o padrão
   do arquivo).

5. Tela admin (`src/routes/Notificacoes.tsx` + `src/components/SecaoNotificacaoVotacao.tsx`):
   adicionar o toggle "Votação aberta" (`votacao_abertura_ativo`) junto aos toggles de buckets e um
   item "Abertura da Votação" no acordeão `TEMPLATES_VOTACAO` (padrão das entradas existentes,
   linhas 37-70, com os placeholders = textos default do §3.4). **Atenção aos tipos**: as
   interfaces `BucketVotacaoItem.field` e `TemplateVotacaoItem.titField/msgField`
   (`SecaoNotificacaoVotacao.tsx:6-35`) são uniões literais **fechadas** — as novas chaves de
   campo precisam ser acrescentadas a elas, senão o type-check falha. Este passo é o único
   "opcional por baixo do capô": a function tem fallback hardcoded, então a feature funciona sem a
   UI — mas incluir mantém o contrato de que TODO template da config é editável pelo admin (a
   tabela tem `REVOKE` de escrita; sem UI não há como trocar o texto). Recomendado incluir.

Checklist obrigatório do AGENTS.md §11.2: `npm run lint` (0 erros), `npm run format`, `npm run build`.

---

## 5. Casos de borda e estados de erro

| Caso                                                                                     | Comportamento desenhado                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Partida sem votação elegível (só goleiros/randoms confirmados, ou ninguém com inscrição) | Listagem retorna 0 linhas → `targets: 0, claimed: 0`, HTTP 200, log honesto em `cron_execucoes`. Sem erro, sem retry.                                                                                             |
| Publicação via edição (`PartidaEditar`, `primeiraVez=true`)                              | Coberta: gancho após `salvarEdicaoCompletaPartida` (§4 passo 3.4). A RPC do disparo valida `status='published'` no banco — se a edição foi de partida já publicada (`primeiraVez=false`), a chamada nem acontece. |
| Admin fecha o app/navega antes do POST sair                                              | Push da abertura perdido para aquela semana (fire-and-forget). Aceito: buckets 6h/3h/1h/30m permanecem como rede; mitigação estilo P2 (varredura no cron) fora de escopo.                                         |
| `disparar_e_registrar_cron_http` registra "Timeout após 2000 ms"                         | Falso-negativo conhecido em cold start (104/105): o push é entregue mesmo assim. Validar entrega pelo ledger/aparelho, não só pelo log.                                                                           |
| `votacao_ativo=false` ou `votacao_abertura_ativo=false`                                  | Modo abertura responde `skipped` com motivo; buckets seguem regra própria.                                                                                                                                        |
| Partida publicada há > 24h (urna já fechada pelo cron)                                   | RPC do disparo nega (`voting_closes_at > now()` no gate) — protege o reuso indevido da RPC como "reenvio" tardio.                                                                                                 |
| Goleiros e randoms                                                                       | Excluídos na SQL da listagem (`pp.posicao <> 'goleiro'`, `posicao <> 'random'`, `NOT ILIKE 'random%'`) — espelha `listar_pendentes_votacao` e as regras de §8.4 do AGENTS.md.                                     |
| Jogador que votou entre a publicação e o disparo (~segundos)                             | Excluído pelo `NOT EXISTS votes` — mesmo critério dos buckets; sem push inútil.                                                                                                                                   |
| Partida excluída após publicação (`excluir_partida`)                                     | Ledger cai por CASCADE (`036:19` FK); nada órfão.                                                                                                                                                                 |
| Secret `push_cron_secret` ausente no vault                                               | RPC grava falha em `cron_execucoes` e lança exceção — exceção capturada em silêncio pelo front; diagnóstico pelo log.                                                                                             |

---

## 6. Estratégia de validação em produção (sem scripts de teste — decisão do usuário)

O projeto não possui testes automatizados e este plano não propõe nenhum. Validação por inspeção
SQL (Supabase SQL Editor / `psql`) e REST:

1. **Pós-migration (integridade)**:
   ```sql
   SELECT pg_get_constraintdef(oid) FROM pg_constraint
    WHERE conrelid = 'push_reminder_deliveries'::regclass
      AND conname = 'push_reminder_deliveries_reminder_key_check';
   -- deve conter 'votacao-aberta'

   SELECT column_name FROM information_schema.columns
    WHERE table_name = 'notificacoes_config' AND column_name LIKE '%abertura%';
   -- deve retornar as 3 colunas novas

   SELECT has_function_privilege('anon', 'disparar_push_votacao_aberta(bigint,bigint)', 'EXECUTE'),
          has_function_privilege('anon', 'listar_pendentes_votacao_abertura(bigint)', 'EXECUTE');
   ```
2. **Smoke do modo abertura sem esperar a quinta**: escolher uma partida `published` com urna
   aberta (a própria da semana em andamento) e chamar a RPC via REST:
   ```bash
   curl -X POST 'https://jtavmrlllyctkuxefhpc.supabase.co/rest/v1/rpc/disparar_push_votacao_aberta' \
     -H 'apikey: <ANON_KEY>' -H 'Authorization: Bearer <JWT anon>' \
     -H 'Content-Type: application/json' \
     -d '{"p_admin_id": <id de admin>, "p_partida_id": <partida published>}'
   ```
   **Atenção**: dispara push real para os elegíveis daquela partida. Executar logo após a
   publicação real de um jogo (contexto natural) ou aceitar um push tardio único. Para testar a
   tubulação sem spam, ligar `votacao_abertura_ativo=false`, chamar e conferir o `skipped`, depois
   reativar.
3. **Evidências pós-disparo**:
   ```sql
   SELECT job_nome, sucesso, status_code, resposta, erro, executado_em
     FROM cron_execucoes WHERE job_nome = 'disparar_push_votacao_aberta'
    ORDER BY executado_em DESC LIMIT 5;
   -- espera: sucesso=true e resposta com "modo":"votacao_abertura" e "claimed":N
   -- ("Timeout após 2000 ms" em cold start = falso-negativo conhecido; conferir ledger)

   SELECT partida_id, jogador_id, sent_at, error_message
     FROM push_reminder_deliveries
    WHERE reminder_key = 'votacao-aberta' ORDER BY claimed_at DESC LIMIT 20;
   -- espera: sent_at preenchido, error_message NULL
   ```
4. **Idempotência**: chamar a RPC 2× seguidas — a segunda deve retornar `"claimed":0`.
5. **E2E na quinta**: publicar pelo AoVivo (e, noutra semana ou após reabrir draft, pelo Editar)
   e validar itens 3-4 + recebimento no aparelho do admin e de ao menos um mensalista com push
   ativo (iOS exige PWA instalado — ver notas de ambiente da análise).
6. **Frontend**: fluxo manual pós-build (publicar → navegação imediata sem travar; sem erro na UI
   mesmo com push falho).

---

## 7. Esforço, riscos e ordem de execução

**Esforço**: médio (~0,5–1 dev-day). Migration única com 5 objetos (baixa complexidade, todos em
padrões já Shipping em produção); ~60-80 linhas na Edge Function; ~30 linhas de frontend nos dois
pontos de publicação; ~40 linhas na tela admin.

**Riscos**:

| Risco                                                                       | Severidade    | Mitigação                                                                                                          |
| --------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------ |
| ALTER do CHECK do ledger em tabela quente (crons escrevem nela todo minuto) | Baixa         | Padrão idêntico às migrations 057/077 já aplicadas em produção; ALTER de CHECK é metadado + validação rápida.      |
| Cold start do Deno → "Timeout" falso no log                                 | Baixa (ruído) | Documentado (§5); entrega real aferida pelo ledger.                                                                |
| Push não dispara se o app for fechado no intervalo publicação→POST          | Baixa         | Fire-and-forget é a decisão consciente (§3.1); buckets são a rede; retry automático é escopo P2.                   |
| Disparo duplicado em condição de corrida                                    | Muito baixa   | Ledger PK + catch 23505 (§3.6), mesmo padrão auditado na análise §6.                                               |
| Function nova em produção com bug no ramo abertura                          | Baixa         | Ramo aditivo atrás de gate booleano; buckets intocados; rollback = `votacao_abertura_ativo=false` sem novo deploy. |
| Conflito de numeração com planos irmãos (P2/P6)                             | Baixa         | Nota no topo; renumerar sequencialmente.                                                                           |

**Ordem sugerida**: Passo 1 (migration 107 + `db push`) → Passo 2 (function + `functions deploy`)
→ Passo 3 (frontend: types → lib → telas → lint/format/build) → §6 (validação) no primeiro jogo
real após o deploy.

---

## 8. Fora de escopo (explicitamente)

- Retry automático do push semanal de convocação (P2) e varredura ledger-based no cron de 1 min.
- Painel admin de entregas por jogador (P6).
- Paralelização de envios na Edge Function, revisão de grants de `push_subscriptions` (§7 da
  análise), mudanças no `sw.js`, e qualquer alteração nos buckets 6h/3h/1h/30m existentes.
