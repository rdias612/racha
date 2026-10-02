# Fase 5 · Notificações de resultado (RF06/RF07) — Tasks

> Ref.: breakdown SDD 35 (`C:\GIT\racha\.superpowers\sdd\35-clipes-filmaeu\breakdown.md:116-125`, Fase 5) · requisito fechado (`docs/requisito-clipes-filmaeu.md:68-69`, RF06/RF07; D8 em `:31`)
> Decisões P1–P12 do orquestrador (breakdown §5): **fechadas**. Aplicáveis a esta fase: **P2** (Edge Function nova no padrão `send-confirmation-requests`, chamada pela Action via `x-push-cron-secret`; aviso de falha = **push aos admins + registro no ledger/painel, ambos** — `breakdown.md:184`), **P3** (RPC `obter_segredo_vault` é o canal Action→Vault, reusado aqui para o secret de push).
> Idioma: português. 1 passo = 1 commit. Sem testes automáticos novos (AGENTS.md). Sem libs novas (web-push e supabase-js já são as dependências das Edge Functions existentes). Interfaces das Fases 1–4 consumidas **exatamente como escritas** (`fase-1-tasks.md` a `fase-4-tasks.md`).

## 1. Objetivo da fase

Fechar o fluxo do requisito D8: ao final de cada run da Action, os **participantes da partida** recebem um **push único** "clipes da partida de {data} disponíveis" (RF06), e em **falha ou ausência de clipes** os **admins** recebem um push de aviso (RF07) — além do registro no ledger `clipes_importacoes`, que já é gravado pelas Fases 2–4 e alimenta o painel da Fase 8. Mecanismo (P2): **Edge Function nova `notificar-clipes`**, no padrão de `send-confirmation-requests` (segredos, header `x-push-cron-secret`, `json()`, claim idempotente em `push_reminder_deliveries`), chamada pela Action ao fim do `main()` via fetch HTTP. Reexecução não reenvia (claim por `(partida_id, jogador_id, reminder_key)`).

## 2. Estado atual e interfaces vinculantes (evidências verificadas em 02/10/2026)

**Padrão de Edge Function de push (o molde desta fase):**

- `supabase/functions/send-confirmation-requests/index.ts` (385 linhas): segredos lidos de env — `SUPABASE_URL`, `PUSH_SUPABASE_KEY ?? SUPABASE_SERVICE_ROLE_KEY`, `PUSH_CRON_SECRET`, `VAPID_SUBJECT/PUBLIC_KEY/PRIVATE_KEY` (`:18-28`, com throw se faltar); `webpush.setVapidDetails` no topo (`:30`); helper `json()` (`:55-60`); autenticação por `x-push-cron-secret` comparado a `Deno.env.get('PUSH_CRON_SECRET')` (`:203-207`); RPC de destinatários em 1 round-trip (`:120-141`); **claim idempotente** = INSERT em `push_reminder_deliveries` tolerando `23505` (`:144-156`); loop de envio com payload `{ title, body, url: '/partida/{id}', partida_id, tag }` (`:165-171`), limpeza de endpoint expirado em 404/410 (`:187-189`) e UPDATE de `sent_at`/`error_message` no ledger (`:193-200`).
- `supabase/functions/send-test-push/index.ts` (112 linhas): **referência de teste manual** — doc de uso no próprio cabeçalho (`:1-9`: POST com header `x-push-cron-secret`, body opcional), TTL curto de diagnóstico (`:81-83`).
- `supabase/functions/send-voting-reminders/index.ts`: variação com modo disparado por body (`{ partida_id, abertura: true }`, `:190-226`) — precedente de função com "modo por payload" e de nota de cold start (o disparador pode registrar timeout falso-negativo com o push entregue mesmo assim — `107:88-93`).
- **Os segredos de Edge Function são por projeto** (mesmo `PUSH_CRON_SECRET`/VAPID usados pelas 3 funções existentes) → **nenhum segredo novo a cadastrar** nesta fase.

**Ledger de entregas e CHECK de `reminder_key` (o que a migration desta fase altera):**

- `push_reminder_deliveries`: PK `(partida_id, jogador_id, reminder_key)`, `partida_id`/`jogador_id` **NOT NULL** com FK a `partidas`/`jogadores` (`036:18-26`; grants de REVOKE ao client em `:35`). **Colunas NOT NULL ⇒ todo claim precisa de `partida_id` real** (relevante para a divergência 8.3).
- O CHECK de `reminder_key` já foi relaxado 3 vezes no mesmo formato — precedente mais recente: `107:18-26` (DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT com a lista ampliada + regex de slots HH:MM preservada). Histórico: `036:21` → `045:18-24` → `057:41-46` → `077:58-63` → `107:21-26`.

**RPCs de destinatários (irmãs da nova):**

- `listar_pendentes_confirmacao` (`090:95-155`): partidas_participantes ⋈ jogadores ⋈ push_subscriptions com `jsonb_agg` de `{endpoint,p256dh,auth}` (`:135-141`), filtros de elegibilidade `pp.posicao <> 'goleiro'` / `j.is_ativo` / `j.posicao <> 'random'` / `username NOT ILIKE 'random%'` (`:148-152`), `SECURITY DEFINER SET search_path = public` (`:105-108`), `GRANT EXECUTE ... TO anon, authenticated` (`:157`).
- `listar_pendentes_votacao_abertura(p_partida_id)` (`107:42-86`): **precedente mais próximo** — push por partida específica, sem janela de bucket, mesmo join/filters (`:68-77`).
- `jogadores.is_admin boolean NOT NULL DEFAULT false` (`001_create_jogadores.sql:15`); gate admin canônico `SELECT is_admin ... IF NOT TRUE RAISE` (`077:77-80`).

**Chamador externo (a Action):**

- `scripts/clipes/importar-clipes.mjs` pós-Fases 2–4, `main()` com passos numerados: 5.5 importação (Fase 3), 5.6 limpeza (Fase 4), 6 `fecharRegistroImportacao` e — para o caminho de erro — catch que fecha o ledger como `'falha'` e `process.exit(1)`; "partida não encontrada" = `registrarFalhaSemPartida` + `exit 0` (`fase-2-tasks.md:215-224,237-240`; integrações em `fase-3-tasks.md:394-407` e `fase-4-tasks.md:196-215`). Semântica fechada: `'concluido'` (sucesso true), `'sem_clipes'` (**sucesso false, exit 0** — condição de alerta RF07, `fase-3-tasks.md:471`) e `'falha'`.
- RPC do Vault `obter_segredo_vault(p_nome)` SECURITY DEFINER, executável **só pela `service_role`** (migration 111, `fase-2-tasks.md:44-79`) — a Action já a usa para `filmaeu_credenciais`; **o secret `push_cron_secret` já existe no Vault** (padrão `077:171-174`) e passa a ser lido por ela também — **nenhum segredo novo em GitHub ou Vault**.
- Env do step da Action já tem `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (`fase-2-tasks.md:363-369`) — a URL da Edge Function deriva de `SUPABASE_URL` (`/functions/v1/notificar-clipes`).
- Partida: `partidas.id/data_jogo/status` (`004:10-18`); participantes = `partidas_participantes` (com `status_confirmacao` desde `057:31-32`); `clipes` tem `partida_id` + contagem consultável (Fase 1, `fase-1-tasks.md:48-62`).
- Deploy: `npx supabase functions deploy` (`docs/MIGRATE.md:16-20`); migrations via `npx supabase db push` (`:13`).
- Numeração de migrations: Fases 1–4 usam 109–112 → **esta fase usa 113** (mesma ressalva de colisão da Fase 1, seção 9.1 de lá).

## 3. Pré-condições

- **Fases 1–4 aplicadas**: tabelas/bucket (109/110), RPC `obter_segredo_vault` (111), Action rodando verde com idempotência (Fase 3) e limpeza (Fase 4) — em particular, **ao menos uma partida real com clipes importados** e participantes com `push_subscriptions` para testar o RF06.
- **Secrets da Fase 2** criados; secret `push_cron_secret` já presente no Vault (usado pelas funções existentes — verificar com `SELECT name FROM vault.decrypted_secrets;`).
- Edge Functions de push já deployadas com os segredos de projeto (VAPID etc.) configurados — nenhuma variável nova nesta fase.
- Decisões fechadas aplicáveis: P2, P3. **Nenhuma decisão aberta** (ver NEEDS_CONTEXT, seção 10).

## 4. Tasks (1 passo = 1 commit)

### Task 1 — Migration 113: CHECK de `reminder_key` + RPC `listar_destinatarios_clipes`

**Arquivos a criar**: `supabase/migrations/113_notificar_clipes.sql`.
**Arquivos a tocar**: nenhum outro.

**Conteúdo esboçado (SQL completo)**:

```sql
-- 113_notificar_clipes.sql
-- Fase 5 (RF06/RF07): push de resultado das importações de clipes.
-- 1. Ledger push_reminder_deliveries aceita as 3 chaves novas (mesmo mecanismo
--    das relaxas 045/057/077/107:18-26 — a de 107 é o precedente imediato).
-- 2. RPC listar_destinatarios_clipes: destinatários do push em 1 round-trip
--    (padrão listar_pendentes_votacao_abertura, 107:42-86), com modo
--    participantes (RF06) ou admins (RF07).

-- ----------------------------------------------------------------------------
-- 1. Ledger aceita as chaves da feature Clipes
-- ----------------------------------------------------------------------------
ALTER TABLE push_reminder_deliveries
  DROP CONSTRAINT IF EXISTS push_reminder_deliveries_reminder_key_check;

ALTER TABLE push_reminder_deliveries
  ADD CONSTRAINT push_reminder_deliveries_reminder_key_check
  CHECK (
    reminder_key IN ('6h','3h','1h','30m','confirmacao','reforco','votacao-aberta',
                     'clipes-prontos','clipes-sem-clipes','clipes-falha')
    OR reminder_key ~ '^([01][0-9]|2[0-3]):(00|15|30|45)$'
  );

-- ----------------------------------------------------------------------------
-- 2. RPC de destinatários — irmã de listar_pendentes_votacao_abertura (107:42-86)
--    p_apenas_admins = false → participantes da partida com inscrição push (RF06)
--    p_apenas_admins = true  → admins ativos com inscrição push (RF07)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION listar_destinatarios_clipes(
  p_partida_id    bigint,
  p_apenas_admins boolean DEFAULT false
)
RETURNS TABLE (
  jogador_id    bigint,
  subscriptions jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    j.id   AS jogador_id,
    jsonb_agg(
      jsonb_build_object(
        'endpoint', ps.endpoint,
        'p256dh', ps.p256dh,
        'auth', ps.auth
      )
    )      AS subscriptions
  FROM push_subscriptions ps
  JOIN jogadores j ON j.id = ps.jogador_id
  WHERE j.is_ativo = true
    AND (
      p_apenas_admins
      OR (
        EXISTS (
          SELECT 1 FROM partidas_participantes pp
          WHERE pp.partida_id = p_partida_id
            AND pp.jogador_id = j.id
        )
      )
    )
    AND CASE WHEN p_apenas_admins THEN j.is_admin = true ELSE true END
  GROUP BY j.id;
$$;

-- Executável EXCLUSIVAMENTE pela service_role (só a Edge Function chama):
REVOKE ALL ON FUNCTION listar_destinatarios_clipes(bigint, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION listar_destinatarios_clipes(bigint, boolean)
  FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION listar_destinatarios_clipes(bigint, boolean)
  TO service_role;
```

**Decisões embutidas**:
- **Três chaves novas** — `'clipes-prontos'` (participantes), `'clipes-sem-clipes'` e `'clipes-falha'` (admins): claims distintos por desfecho, então um aviso `sem_clipes` de manhã e um `falha` de uma tentativa posterior **não se anulam mutuamente**; e uma reexecução do **mesmo** desfecho não reenvia (mesma PK).
- **Goleiros INCLUÍDOS entre os participantes** (diferente das irmãs `090:148-152` e `107:74`, que excluem `posicao <> 'goleiro'`): ali a exclusão é específica de confirmação de presença/votação — o goleiro participou da partida e quer ver os clipes. `status_confirmacao` também **não** filtra: quem está em `partidas_participantes` daquela partida é destinatário ( RF06 diz "os participantes", `requisito:68`).
- **Exclusão de `random%` herdada**: jogadores fantasma sem login no app não têm `push_subscriptions` de qualquer forma (JOIN já elimina) — mantido implícito pelo join, sem filtro extra (KISS; a exclusão explícita das irmãs existe porque elas também alimentam outras superfícies).
- **Grant só à `service_role`** (padrão `obter_segredo_vault`, `fase-2-tasks.md:76-78`), divergindo de `090:157`/`107:86` que liberam `anon/authenticated`: nenhuma RPC de destinatários de clipes é chamada pelo frontend (Fases 7–8 não precisam — elas leem `clipes`, não subscriptions). Menor superfície, mesma justificativa do P3.

**Validação da task**:
1. `npx supabase db push` aplica sem erro (`docs/MIGRATE.md:13`).
2. SQL Editor (como postgres): com uma partida real com clipes (Fase 3) e um admin inscrito —
   `SELECT jogador_id, jsonb_array_length(subscriptions) FROM listar_destinatarios_clipes(<partida_id_real>, false);` → **1 linha por participante inscrito**, ≥1 subscription cada.
   `SELECT ... FROM listar_destinatarios_clipes(<partida_id_real>, true);` → só linhas de `is_admin = true`.
3. Com a **anon key**: `curl -s "$SUPABASE_URL/rest/v1/rpc/listar_destinatarios_clipes" -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" -H "Content-Type: application/json" -d '{"p_partida_id":1,"p_apenas_admins":false}'` → **erro de permissão** (EXECUTE negado).
4. Claim da nova chave aceito: SQL Editor `INSERT INTO push_reminder_deliveries (partida_id, jogador_id, reminder_key) VALUES (<id_real>, <jog_real>, 'clipes-prontos');` → ok; repetir → violação de PK (23505). **Apagar a linha de teste** em seguida.
5. `npm run build`/`npm run lint` (raiz) verdes — nada em `src/` foi tocado (a RPC não entra em `database.types.ts` desta fase; ver divergência 8.7).

**Divergências/observações**: ver 8.1 (goleiros), 8.2 (grant) e 8.7 (types).

### Task 2 — Edge Function `supabase/functions/notificar-clipes/index.ts`

**Arquivos a criar**: `supabase/functions/notificar-clipes/index.ts`.
**Arquivos a tocar**: nenhum outro.

**Conteúdo esboçado (estrutura completa, no padrão de `send-confirmation-requests`)**:

```ts
// Edge Function: notificar-clipes (Fase 5 — RF06/RF07, breakdown SDD 35).
// Chamada pela GitHub Action ao fim de cada importação (body único, sem modos):
//   { "partida_id": X, "resultado": "concluido" | "sem_clipes" | "falha" }
// - concluido   → push a CADA participante inscrito da partida (claim
//                 'clipes-prontos' — reexecução não reenvia).
// - sem_clipes  → push aos ADMINIS (claim 'clipes-sem-clipes').
// - falha       → push aos ADMINIS (claim 'clipes-falha').
// O desfecho já está no ledger clipes_importacoes (gravado pela Action nas
// Fases 2–4) — o painel da Fase 8 lê de lá (P2: aviso = push + ledger, ambos).
// data_jogo e contagem são lidos do BANCO (fonte da verdade), não do payload.

import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

// Bloco de segredos IDÊNTICO a send-confirmation-requests/index.ts:18-28
// (mesmas envs de projeto — nenhuma variável nova):
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey =
  Deno.env.get('PUSH_SUPABASE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const cronSecret = Deno.env.get('PUSH_CRON_SECRET');
const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com';
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

if (!supabaseUrl || !serviceRoleKey || !cronSecret || !vapidPublicKey || !vapidPrivateKey) {
  throw new Error('Missing notification function secrets.');
}

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

// Não é tempo-crítico (contrário do lembrete de confirmação, :39): o clipe
// continua lá. 3 dias cobre quem só abre o app no fim de semana.
const TTL_CLIPES_SEGUNDOS = 3 * 24 * 60 * 60;

type SubscriptionData = { endpoint: string; p256dh: string; auth: string };
type Destinatario = { jogador_id: number; subscriptions: SubscriptionData[] };
type Resultado = 'concluido' | 'sem_clipes' | 'falha';

function json(body: unknown, status = 200) { /* idêntico a :55-60 */ }
function errorMessage(error: unknown) { /* idêntico a :62-66 */ }

function formatarDataJogo(dataStr: string): string {
  // 'quinta-feira, 2 de outubro' — Intl pt-BR America/Sao_Paulo, mesma
  // técnica de formatarDataJogo de send-confirmation-requests:68-87 (o repo
  // duplica helpers entre funções — sem módulo compartilhado hoje; seguir).
}

// idêntico a send-confirmation-requests:144-156 (claim + 23505), com o
// reminderKey vindo do resultado:
async function claim(
  partidaId: number,
  jogadorId: number,
  reminderKey: 'clipes-prontos' | 'clipes-sem-clipes' | 'clipes-falha'
): Promise<boolean> { /* insert em push_reminder_deliveries; 23505 → false */ }

// idêntico a send-confirmation-requests:158-201, sem templates de config:
async function enviarPara(
  destinatarios: Destinatario[],
  payload: { title: string; body: string; url: string; partida_id: number; tag: string },
  reminderKey: 'clipes-prontos' | 'clipes-sem-clipes' | 'clipes-falha'
) {
  // para cada destinatário: webpush.sendNotification por subscription
  //   (TTL_CLIPES_SEGUNDOS, urgency 'normal'); 404/410 → delete em
  //   push_subscriptions (:187-189); depois UPDATE sent_at/error_message
  //   no ledger por (partida_id, jogador_id, reminderKey) (:193-200).
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (request.headers.get('x-push-cron-secret') !== cronSecret) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let bodyData: { partida_id?: unknown; resultado?: unknown } = {};
  try {
    bodyData = await request.json().catch(() => ({}));
  } catch {
    /* body vazio */
  }

  // Validação do payload (único modo — sem os 3 modos da irmã):
  const rawId = bodyData.partida_id;
  const partidaId =
    typeof rawId === 'number' ? rawId
    : typeof rawId === 'string' && rawId.trim() !== '' ? Number(rawId) : null;
  const resultado = bodyData.resultado;
  const resultadosValidos: Resultado[] = ['concluido', 'sem_clipes', 'falha'];
  if (partidaId === null || !Number.isInteger(partidaId) ||
      typeof resultado !== 'string' || !resultadosValidos.includes(resultado as Resultado)) {
    return json({ error: 'Payload inválido: partida_id e resultado são obrigatórios' }, 400);
  }

  try {
    // Partida + contagem do BANCO (fonte da verdade — o payload não traz contagem):
    const { data: partida, error: pErr } = await supabase
      .from('partidas')
      .select('id, data_jogo')
      .eq('id', partidaId)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!partida) {
      return json({ error: 'Partida não encontrada' }, 400); // padrão :246/:294
    }

    const dia = formatarDataJogo(String(partida.data_jogo));
    const reminderKey = resultado === 'concluido'
      ? 'clipes-prontos'
      : resultado === 'sem_clipes' ? 'clipes-sem-clipes' : 'clipes-falha';

    let titulo: string;
    let mensagem: string;
    if (resultado === 'concluido') {
      const { count, error: cErr } = await supabase
        .from('clipes')
        .select('caminho', { count: 'exact', head: true })
        .eq('partida_id', partidaId);
      if (cErr) throw cErr;
      const quantidade = count ?? 0;
      titulo = '⚽ Clipes da partida disponíveis';
      mensagem =
        quantidade > 0
          ? `Os ${quantidade} clipes da partida de ${dia} já estão no app.`
          : `Os clipes da partida de ${dia} já estão no app.`;
    } else {
      titulo = '⚠️ Falha na importação de clipes';
      mensagem =
        resultado === 'sem_clipes'
          ? `A importação da partida de ${dia} concluiu sem encontrar clipes no Filma Eu.`
          : `A importação de clipes da partida de ${dia} falhou. Veja o detalhe no painel e reexecute.`;
    }

    const ehParaParticipantes = resultado === 'concluido';
    const { data: destinatarios, error: dErr } = await supabase.rpc(
      'listar_destinatarios_clipes',
      { p_partida_id: partidaId, p_apenas_admins: !ehParaParticipantes }
    );
    if (dErr) throw dErr;

    const alvos = (destinatarios ?? []).map(
      (row: { jogador_id: number | string; subscriptions: SubscriptionData[] }) => ({
        jogador_id: Number(row.jogador_id),
        subscriptions: Array.isArray(row.subscriptions) ? row.subscriptions : [],
      })
    );

    const payload = {
      title: titulo,
      body: mensagem,
      url: `/partida/${partidaId}`,           // mesma rota da irmã, :168
      partida_id: partidaId,
      tag: `clipes-${partidaId}`,             // substitui pushes antigos da mesma partida
    };

    // claim → envio na mesma ordem do loop confirmacao_semanal (:317-322):
    let claimed = 0;
    const claimedIds: number[] = [];
    for (const alvo of alvos) {
      if (await claim(partidaId, alvo.jogador_id, reminderKey)) {
        claimed++;
        claimedIds.push(alvo.jogador_id);
      }
    }
    if (claimed > 0) {
      await enviarPara(
        alvos.filter((a) => claimedIds.includes(a.jogador_id)),
        payload,
        reminderKey
      );
    }

    return json({
      modo: 'clipes',
      partida_id: partidaId,
      resultado,
      targets: alvos.length,
      claimed,
    });
  } catch (error) {
    console.error(error);
    return json({ error: errorMessage(error) }, 500);
  }
});
```

**Decisões embutidas**:
- **Payload mínimo `{ partida_id, resultado }`**: `data_jogo` e a contagem de clipes são lidos do banco pela função — a Action não é fonte de verdade de nada que o push exibe, e o payload não cresce com campos que podem divergir do ledger. `resultado` é o mesmo literal do `status` do ledger (interface das Fases 2–4), sem tradução.
- **Templates hardcoded** (não em `notificacoes_config`): o escopo da fase exclui templates editáveis no painel (`breakdown.md:120`); se um dia virarem editáveis, o precedente é a 107:32-35 (colunas de template + fallback hardcoded na função). Nenhum gate on/off nesta fase (YAGNI — RF06/RF07 não pedem).
- **Claim separado do envio, na ordem claim → envio** (idêntico ao loop `:317-322` da irmã): a PK `(partida_id, jogador_id, reminder_key)` garante que reexecução/resposta repetida devolve `claimed: 0` e nenhum envio — critério de encerramento "reexecução não reenvia".
- **`urgency: 'normal'` + TTL de 3 dias**: notificação de conteúdo disponível, não de prazo (o contraste com `TTL_CONFIRMACAO_SEGUNDOS` de 24h, `:39`, é deliberado e comentado no código).
- **404/410 limpam a subscription** e o resultado por destinatário vai para `sent_at`/`error_message` — mesmo comportamento observável no painel de entregas push (`106_painel_entregas_push.sql`).
- Sem novos segredos, sem `notificacoes_config`, sem colunas novas: a função só consome o que as Tasks 1 e 2 criam/lemvam.

**Validação da task**:
1. **Deploy**: `npx supabase functions deploy notificar-clipes` (`docs/MIGRATE.md:19`) — conclui sem erro; a função aparece no dashboard (Edge Functions).
2. **Teste de envio real** (referência de procedimento: `send-test-push/index.ts:1-9`): obter o valor de `push_cron_secret` no SQL Editor (`SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'push_cron_secret';` — padrão `077:171-174`; **não colar em arquivo/log**, RNF02) e:
   `curl -s -X POST "$SUPABASE_URL/functions/v1/notificar-clipes" -H "x-push-cron-secret: <secret>" -H "Content-Type: application/json" -d '{"partida_id": <partida_real_com_clipes>, "resultado": "concluido"}'` → **200** com `{ modo: 'clipes', claimed: N, targets: N }` e o push chega no aparelho dos inscritos da partida de teste.
3. **Falha simulada**: `curl` com `{"partida_id": X, "resultado": "falha"}` → admins inscritos recebem o push de aviso; `SELECT jogador_id, reminder_key FROM push_reminder_deliveries WHERE partida_id = X AND reminder_key LIKE 'clipes-%';` mostra as linhas `clipes-falha`.
4. **Sem-clipes simulado**: `curl` com `{"partida_id": X, "resultado": "sem_clipes"}` → push de aviso aos admins com mensagem própria.
5. **Idempotência**: repetir qualquer um dos curls acima → `claimed: 0` e **nenhum push novo** nos aparelhos.
6. **Negativos**: sem header de secret → 401; payload sem `resultado`/com valor inválido → 400; `partida_id` inexistente → 400 `Partida não encontrada`.

**Divergências/observações**: nenhuma estrutural — a função é o padrão da irmã com um modo só (payload único), que é mais simples que os 3 modos de `send-confirmation-requests` porque não há cron de reforço nem reenvio manual aqui (o reprocesso é reexecutar a Action, RF03).

### Task 3 — Integração na Action: `scripts/clipes/notificacoes.mjs` + passo 7 no `main()`

**Arquivos a criar**: `scripts/clipes/notificacoes.mjs`.
**Arquivos a tocar**: `scripts/clipes/importar-clipes.mjs` (import + chamada nos dois caminhos de desfecho), `docs/configuracao-clipes-action.md` (1 linha de doc).
**Arquivos NÃO tocados**: workflow YAML (**nenhum segredo/env novo** — ver decisão abaixo), migrations, Edge Function, `src/`.

**Conteúdo esboçado**:

```js
// scripts/clipes/notificacoes.mjs — Fase 5 (RF06/RF07, P2/P3).
// Notificação de resultado é BEST-EFFORT: o desfecho da importação já está no
// ledger (fonte da verdade, painel da Fase 8) — falha de push não derruba a
// run; é logada (RNF04) e a reexecução re-tenta (claims impedem duplicata).
const TIMEOUT_MS = 15_000; // cold start da Edge Function pode demorar (nota 107:88-93)

export async function notificarResultado(client, { partidaId, resultado, supabaseUrl }) {
  // 1. secret = await client.rpc('obter_segredo_vault', { p_nome: 'push_cron_secret' })
  //    null/vazio → return { notificado: false, motivo: 'secret ausente' } com log
  //    (NUNCA logar o valor — RNF02; só existência, padrão da Fase 2/3).
  // 2. fetch(`${supabaseUrl}/functions/v1/notificar-clipes`, {
  //      method: 'POST',
  //      headers: { 'content-type': 'application/json',
  //                 'x-push-cron-secret': secret },   // secret SÓ no header
  //      body: JSON.stringify({ partida_id: partidaId, resultado }),
  //      signal: AbortSignal.timeout(TIMEOUT_MS),
  //    })
  //    → não-2xx ou timeout/erro de rede → log '[clipes] aviso de push não
  //      enviado: <resumo>' e return { notificado: false } (NÃO throw).
  // 3. body da resposta → log '[clipes] notificação: resultado=<r>
  //    targets=<n> claimed=<n>'; return { notificado: true, ...corpo }.
}
```

Ajustes no `main()` de `importar-clipes.mjs` (pós-Fase 4):

```js
// (topo) import { notificarResultado } from './notificacoes.mjs'
//
// Caminho de SUCESSO (passo 7 — NOVO, após o passo 6 fecharRegistroImportacao):
// 7. if (partida) {  // só há o que notificar com partida alvo (divergência 8.3)
//      await notificarResultado(client, {
//        partidaId: partida.id,
//        resultado: resultado.status,   // 'concluido' | 'sem_clipes' — literais
//        supabaseUrl: config.supabaseUrl,
//      });
//    }
//
// Caminho de ERRO (no catch existente da Fase 2, entre fecharRegistroImportacao
// com status 'falha' e o process.exit(1)):
//    if (partida) {
//      await notificarResultado(client, { partidaId: partida.id,
//        resultado: 'falha', supabaseUrl: config.supabaseUrl });
//    }
//    process.exit(1);  // comportamento da Fase 2 mantido
```

`docs/configuracao-clipes-action.md` — acréscimo na tabela do Vault (seção 1):

> | `push_cron_secret` | Secret **já existente** das Edge Functions de push (`077:171-174`); não criar | Action Fase 5 via RPC `obter_segredo_vault`, usado como header `x-push-cron-secret` |

**Decisões embutidas**:
- **`x-push-cron-secret` vem do Vault pela RPC `obter_segredo_vault`** (P3, migration 111 `fase-2-tasks.md:44-79`) — o secret `push_cron_secret` é o **mesmo** que as funções de push já usam (`077:171-174`); a Action não precisa de nenhum segredo novo no GitHub, e o YAML da Fase 2 fica intocado (`SUPABASE_URL` já está no env do step, `fase-2-tasks.md:363-369`).
- **Passo 7 DEPOIS do fechamento do ledger**: se o push falhar, o ledger já reflete o desfecho correto (painel da Fase 8 não é afetado) e a run termina com o status coerente. Alternativa considerada (falhar a run quando o push falha) foi rejeitada: transformaria um problema de entrega (reversível por reexecução, sem perda de dados) em run vermelha com ledger já correto — e o RF07 já é atendido pelo registro no ledger (P2: "ambos").
- **`resultado` = literal do `status` do ledger** (`'concluido' | 'sem_clipes' | 'falha'`): zero mapeamento, e o CHECK da Task 2 valida.
- **`partida_id` null não notifica** (divergência 8.3): o caminho "partida não encontrada" da Fase 2 (`registrarFalhaSemPartida`, `fase-2-tasks.md:221-224,239`) fica só no ledger — o schema de claims não permite partida nula (`036:19-20`) e o painel da Fase 8 exibe essas linhas.
- **Ordem no catch**: ledger primeiro, push depois, `exit(1)` por último — se o próprio push do aviso de falha falhar, a run continua vermelha (a infra está quebrada de fato) e o ledger tem o erro.

**Validação da task**:
1. `node --check scripts/clipes/importar-clipes.mjs scripts/clipes/notificacoes.mjs` + `npm run build`/`npm run lint` (raiz) — PWA intocado.
2. Revisão do diff: **nenhum `console.log` recebe o valor do secret** (grep por `obter_segredo_vault` — o valor só entra no header); nenhum `throw` novo propagando falha de push; YAML sem diff.
3. **Run ponta a ponta**: `workflow_dispatch` reimportando a MESMA data da validação da Fase 3/4 (idempotência: 0 downloads, status `concluido`) → run verde; log do passo 7 mostra `claimed: N` na PRIMEIRA execução após o deploy e `claimed: 0` nas seguintes (participantes já notificados pela validação da Task 2 **ou** por esta run — conferir que o push chegou 1 vez por aparelho no total, somando Task 2 + Task 3).
4. **Falha simulada end-to-end**: dispatch com `data` sem partida não notifica (sem `partida_id`); para simular `falha` com partida, basta reexecutar a validação do curl da Task 2 (a Action usa a mesma função) — ou inverter temporariamente um seletor em `seletores.mjs` em branch de teste (caminho de `ErroFilmaeu` → catch → `resultado: 'falha'`) — e reverter.

## 5. Validação manual da fase (checklist para o dono)

- [ ] Migration 113 aplicada (`npx supabase db push`); RPC inacessível a anon/authenticated (curl com erro de permissão).
- [ ] `npx supabase functions deploy notificar-clipes` concluído; função listada no dashboard.
- [ ] **RF06**: partida com clipes importada (run da Fase 3) → cada participante inscrito recebe **um** push "Os N clipes da partida de {dia}..." abrindo `/partida/{id}`; `push_reminder_deliveries` tem 1 linha `clipes-prontos` por jogador da partida.
- [ ] **RF07 — falha**: curl/`resultado: 'falha'` → cada admin inscrito recebe push de aviso; linhas `clipes-falha` no ledger de entregas; o desfecho também está em `clipes_importacoes` (gravado pelas Fases 2–4) para o painel da Fase 8.
- [ ] **RF07 — sem clipes**: `resultado: 'sem_clipes'` → push de aviso com mensagem distinta; linha `clipes-sem-clipes`.
- [ ] **Reexecução não reenvia**: repetir o disparo (curl ou run da Action) → resposta `claimed: 0`, nenhum push novo nos aparelhos.
- [ ] Payload inválido (sem `resultado`, partida inexistente, header errado) → 400/401, sem push e sem linha no ledger.
- [ ] Negativo RF06: jogador participante **sem** inscrição push não gera linha nem erro (`targets` só conta inscritos).
- [ ] Log da run e do curl sem o valor de `push_cron_secret` (RNF02).
- [ ] `npm run build`/`npm run lint` verdes; `git log` da fase com 3 commits (Tasks 1–3), cada um revertível isoladamente; nenhum arquivo em `src/` alterado.

## 6. Fora de escopo da fase

- Templates editáveis no painel de notificações e gate on/off em `notificacoes_config` (excluído no breakdown, `breakdown.md:120`).
- Qualquer UI — painel admin de importações/entregas é a Fase 8 (a RPC de leitura do ledger com `is_admin` é a Fase 6).
- Disparo manual pelo app (Fase 6); frontend jogador (Fase 7).
- Push para participantes de partida sem clipes históricos (D9/backfill) e múltiplas quadras (§8).
- Novos canais de aviso (e-mail, webhook) — RF07 é push + painel (P2).

## 7. Riscos e rollback

- **Cada task é 1 commit, revertível por `git revert` isolado** (AGENTS.md). Reverter a Task 3 volta a Action ao comportamento da Fase 4 (sem notificação); a Task 2 removida do repo não desfaz o deploy — para retirar a função do ar, deploy do estado anterior (`npx supabase functions deploy`) ou exclusão pelo dashboard (decisão do dono); a Task 1 tem rollback por migration corretiva no padrão do repo (`077`/`107` fazem o inverse DROP+ADD):
  ```sql
  ALTER TABLE push_reminder_deliveries
    DROP CONSTRAINT IF EXISTS push_reminder_deliveries_reminder_key_check;
  ALTER TABLE push_reminder_deliveries
    ADD CONSTRAINT push_reminder_deliveries_reminder_key_check
    CHECK (reminder_key IN ('6h','3h','1h','30m','confirmacao','reforco','votacao-aberta')
      OR reminder_key ~ '^([01][0-9]|2[0-3]):(00|15|30|45)$');
  DROP FUNCTION IF EXISTS listar_destinatarios_clipes(bigint, boolean);
  ```
  (só executável após garantir que não há linhas `clipes-*` no ledger — apagá-las antes, service_role).
- **Risco principal (breakdown `:124`): duplicação de push em reexecução** — mitigado pelo claim idempotente por `(partida_id, jogador_id, reminder_key)` (Task 2, padrão `:144-156`), validado em curl e em run repetida (seções 4.2.5 e 5). Resíduo: um push `concluido` cujo envio falhou após o claim não é reenviado por reexecução (claim já gravado) — o dono pode apagar as linhas do jogador no ledger e reexecutar (procedimento de 1 SQL; mesmo tratamento do painel de entregas da 106).
- **Cold start/timeout na chamada da Action**: fetch com `AbortSignal.timeout(15s)` e log claro; se a entrega passar do timeout, o push pode chegar mesmo com `notificado: false` no log (falso-negativo conhecido, `107:88-93`) — irrelevante porque o claim da função já protegeu a duplicidade.
- **Secret compartilhado**: `push_cron_secret` já é o segredo de todas as funções de push; expor a nova função ao mesmo header não amplia o alcance (quem tem o secret já chama as outras três).
- **Muitos destinatários/inscrições** (crescimento futuro): 1 round-trip de RPC + loop de envio é o padrão atual das 3 funções; se um dia escalar (multi-quadra, §8), a evolução natural é batching — anotado, não construído (YAGNI).
- **Ledger inconsistente** (claim sem envio, ou status errado): correção por SQL com service_role, igual às Fases 2–4.

## 8. Divergências e observações (vs Fases 1–4 e código)

1. **Goleiros incluídos como destinatários do RF06**: as RPCs irmãs (`090:148-152`, `107:74`) excluem `posicao <> 'goleiro'` por serem sobre confirmação/votação; o push de clipes é para "os participantes" (`requisito:68`) — o goleiro participou. Mudança deliberada e local, sem tocar as irmãs.
2. **Grant da RPC só à `service_role`** (vs `090:157`/`107:86`, que concedem EXECUTE a `anon, authenticated`): nenhuma RPC desta fase é chamada pelo frontend (Fases 7–8 não precisam de lista de destinatários); segue o padrão de `obter_segredo_vault` (`fase-2-tasks.md:76-78`) para funções exclusivas de backend. Se a Fase 6/8 quiser expor entregas de push, será por RPC própria com gate `is_admin` (padrão `106`), não por esta.
3. **Falha sem partida ("partida não encontrada", Fase 2) não gera push**: `push_reminder_deliveries` exige `partida_id`/`jogador_id` NOT NULL (`036:19-20`), e um claim sem partida exigiria tabela nova ou coluna nula — camada sem necessidade (KISS). O desfecho fica no ledger (`partida_id` NULL) e no painel da Fase 8; RF07 continua atendido pelo registro (P2: "ambos").
4. **Notificação best-effort na Action** (erro de push não derruba a run): o breakdown não define o comportamento; decisão justificada na Task 3 com a alternativa anotada. A ordem ledger → push → exit mantém a fonte de verdade coerente em todos os caminhos.
5. **Contagem e data lidas do banco pela Edge Function**, não enviadas pela Action — o payload é `{ partida_id, resultado }`. O orquestrador mencionou "contagem" como parte do payload possível; optou-se por derivar do banco (fonte única, payload mínimo). Se a revisão preferir o payload completo, é +1 campo e -1 query, sem mudança estrutural.
6. **`urgency: 'normal'` e TTL de 3 dias** diferem dos lembretes (`'high'`/24h) — notificação de conteúdo, não de prazo; comentado no código.
7. **`database.types.ts` NÃO é regenerado nesta fase**: a RPC `listar_destinatarios_clipes` só é chamada pela Edge Function (que não usa types gerados — padrão `send-confirmation-requests`, `supabase-js` cru) e nenhuma superfície de `src/` muda. Se a Fase 6/8 precisar dela pelo app, regenera lá (mesma regra da Fase 2, `fase-2-tasks.md:430`).
8. **Numeração 113**: acompanha 109–112 das fases anteriores, com a mesma ressalva de colisão da Fase 1 (seção 9.1 de lá — `docs/plano-escolha-times-realtime.md:560`); se deslocar, renomear só o arquivo.
9. **Interfaces das Fases 1–4 consumidas sem incompatibilidade**: `resultado` da Action (= `status` do ledger, Fases 2–4) casa 1:1 com os valores do payload; `obter_segredo_vault` (111) é reusada sem alteração; o `main()` pós-Fase 4 recebe o passo 7 como acréscimo puro (nada dos passos 5.5/5.6/6 muda); nenhuma migration da Fase 1 precisa de ajuste (o ledger de entregas é o de push, `036`, não o `clipes_importacoes`).
10. **Correção da auditoria (A1): admin-participante incluído no modo participantes** — o esboço SQL acima originalmente tinha `j.is_admin = false` na branch de participantes, o que excluía um admin que jogou a partida do push 'clipes-prontos' (contradizia o RF06 e a própria justificativa da divergência 8.1: "quem está em `partidas_participantes` daquela partida é destinatário"). Corrigido na fonte e aplicado via migration corretiva `114_rpc_destinatarios_clipes_admin_participantes.sql` (a condição do modo admins continua na cláusula `CASE`, que não muda).

## 9. Critérios de encerramento (do breakdown `:125`, refinados)

1. **Importação de teste gera um push único por participante inscrido**: run com partida real → 1 push por jogador inscrito da partida, linha `clipes-prontos` por jogador no ledger de entregas, payload abrindo `/partida/{id}`.
2. **Falha simulada avisa admins (push + ledger)**: `resultado: 'falha'` (e `'sem_clipes'`) → push a cada admin inscrito **e** desfecho visível em `clipes_importacoes` para o painel da Fase 8 (P2: ambos).
3. **Reexecução não reenvia**: repetir o disparo do mesmo desfecho (curl ou run da Action) → `claimed: 0`, nenhum push novo; desfecho diferente (ex.: `sem_clipes` → depois `concluido`) notifica normalmente (chaves distintas).
4. Deploy da função documentado pelo fluxo existente (`docs/MIGRATE.md:16-20`), sem segredos novos em Vault/GitHub (P3 via `obter_segredo_vault`); Action sem mudança de YAML.
5. `npm run build`/`npm run lint` verdes; nada em `src/` alterado; 3 commits (Tasks 1–3) revertíveis isoladamente; checklist da seção 5 completo.

## 10. NEEDS_CONTEXT

Nenhum. (P2 e P3 — as únicas decisões abertas da fase no breakdown `:123` — foram fechadas pelo orquestrador em `breakdown.md:184-185` e dirigem exatamente o desenho acima: Edge Function nova no padrão `send-confirmation-requests`, chamada via `x-push-cron-secret`, aviso de falha = push aos admins + ledger. As escolhas locais — nomes das chaves, inclusão de goleiros, payload mínimo, best-effort — estão todas justificadas nas seções 4 e 8 e nenhuma é estrutural nem irreversível.)
