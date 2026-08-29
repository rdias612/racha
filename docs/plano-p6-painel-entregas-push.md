# Plano P6 — Painel Admin de Entregas Push por Jogador

> **Base**: `main` @ `5106f1e` · **Origem**: seção **P6** de
> [`docs/analise-notificacoes-push.md`](./analise-notificacoes-push.md) · **Escopo fechado**: nada
> além do item P6 (sem bônus, sem refatorações adjacentes).

---

## 1. Contexto e objetivo

A análise do pipeline de push (P6, `docs/analise-notificacoes-push.md:215-230`) conclui que os dados
de entrega **já existem** — o ledger `push_reminder_deliveries` guarda `sent_at`/`error_message` por
jogador, e `push_subscriptions` guarda cada endpoint com `created_at`/`updated_at` — mas **nada na UI
admin surfaza isso**. Não há como responder, sem query manual no banco: "quem está inscrito agora?",
"qual o último push que o Dico recebeu de verdade?", "quantos jogadores têm subscrição viva?". O
`statusPush` (`src/lib/pwa.ts:166-180`) só enxerga o aparelho do próprio admin.

Com o **P1 implementado** (re-check silencioso no boot + `sincronizar_push_subscription`, migration 103) e o **P5 resolvido** (migrations 104/105: a cron de push estava 100% falhar desde a 099 e agora
emite batimentos minuto a minuto em `cron_execucoes`), este painel se torna o **quadro de saúde do
aparelho**: "inscreveu há 3 semanas e não tem nenhuma entrega desde então" = candidato claro a
subscrição morta (rotação de token FCM, revogação no iOS, evicção de storage). O usuário prefere
explicitamente **modelos rastreáveis com drill-down itemizado por pessoa** — nada de agregados
opacos ("taxa de entrega 87%").

Objetivo: nova seção **"4. Saúde das Entregas por Atleta"** na tela admin de Notificações
(`/notificacoes`), alimentada por uma RPC de consulta administrativa (mesmo padrão da
`obter_execucoes_cron` da migration 104), exibindo por jogador: quantidade de aparelhos inscritos,
`created_at`/`updated_at` de cada endpoint, última entrega com sucesso no ledger, última chave de
lembrete entregue e último `error_message`.

---

## 2. Estado atual medido (verificado no código @ `5106f1e`)

### 2.1 Tela admin de Notificações

- **Rota**: `src/routes/Notificacoes.tsx`. Estrutura: `useAdmin()` + `useJogadorLogado()` (L34-35),
  guard `if (!isAdmin) return <Navigate to="/" replace />` **após todos os hooks** (L96), estado
  `carregando`/`erro` próprios, carregamento via `carregar()` com `Promise.all` e flag `isAtivo`
  (L59-93) — **a rota NÃO usa `useCache`** (padrão de tela admin com formulário).
- **Layout**: container `px-3 py-4 pb-20 sm:px-4 max-w-2xl mx-auto space-y-4 text-giz` (L172),
  `BotaoVoltar fallback="/"`, cabeçalho `sumula-header` com ícone `Bell`, e um `<form>` único
  (L191-219) contendo as três seções + botão "Salvar Alterações".
- **Seções existentes** (componentes **soltos em `src/components/`** — não existe diretório
  `src/components/Notificacoes/`; a menção a esse diretório no briefing não corresponde ao código):
  1. `SecaoNotificacaoConfirmacao.tsx` — "1. Confirmação de Presença Semanal"
     (título em `SecaoNotificacaoConfirmacao.tsx:44-48`); card `rounded-[4px] border border-borda
bg-superficie p-3.5 shadow-carimbo`.
  2. `SecaoNotificacaoVotacao.tsx` — "2. Lembretes de Votação Pós-Jogo" (título real em
     `SecaoNotificacaoVotacao.tsx:90`).
  3. `SecaoNotificacaoTestes.tsx` — "3. Testes & Disparos Manuais"
     (`src/components/SecaoNotificacaoTestes.tsx:24-32`), com grid de 2 sub-cards em
     `bg-superficie-2`.
- **Camada de dados**: `src/lib/notificacoes.ts` — funções `obterConfiguracoesNotificacoes`,
  `salvarConfiguracoesNotificacoes`, `dispararPushTeste`, `dispararConfirmacaoManual`, todas via
  `supabase.rpc(...)` com `p_admin_id` e tipos declarados localmente (`interface NotificacoesConfig`).
- **Skeleton de rota**: `SkeletonNotificacoes` (`src/components/Skeletons.tsx:353-414`), usado como
  fallback de Suspense no `Layout.tsx:53` (mapa por pathname). Como a página carrega tudo no
  `Promise.all` e exibe `<Carregando>` cheio (L155-161), a seção nova **não exige skeleton global
  novo**.
- **Feedback**: `MensagemEstado` (`src/components/Estado.tsx:68-89`) e `Snackbar` via `useSnackbar`.

### 2.2 Divergência importante encontrada

**A RPC `obter_execucoes_cron` não é chamada em nenhum lugar do frontend** (grep em `src/` = zero
resultados). Ela existe só no banco (criada na `099_cron_http_response_logging.sql:172`, corrigida na
`104_fix_push_cron_fire_and_forget.sql:29-68`). Ou seja: não há padrão de **consumo** de RPC admin de
leitura nesta tela a ser copiado — apenas o padrão **SQL** da 104, que este plano segue. O painel P6
será o primeiro consumidor desse padrão de consulta na UI. (Exibir as execuções da cron é outro item
— fora do escopo fechado.)

### 2.3 Schema real das tabelas (`036_create_push_notifications.sql`)

- `push_subscriptions` (L5-16): `id bigserial`, `jogador_id → jogadores ON DELETE CASCADE`,
  `endpoint text UNIQUE`, `p256dh`, `auth`, `created_at`, `updated_at`. Índice em `jogador_id`
  (L15-16). **Grants**: `SELECT, INSERT, UPDATE, DELETE TO anon, authenticated` (L31-32).
- `push_reminder_deliveries` (L18-29): PK composta `(partida_id, jogador_id, reminder_key)`,
  `claimed_at`, `sent_at` (nullable = não entregue), `error_message` (nullable). **REVOKE ALL para
  anon/authenticated** (L35) → qualquer leitura do ledger pela UI **exige RPC `SECURITY DEFINER`**.
- CHECK atual de `reminder_key` (após 045 → 057 → **077:54-62**): aceita
  `('6h','3h','1h','30m','confirmacao','reforco')` OU padrão `HH:MM` de slots. No painel,
  `reminder_key` é tratado como texto livre de exibição.
- A Edge Function apaga linhas de `push_subscriptions` em 404/410 (cleanup nas 3 functions) → a
  tabela é, na prática, o registro de **aparelhos vivos**.
- `sincronizar_push_subscription` (migration `103:14-28`) faz `UPDATE ... SET updated_at = now()` →
  `updated_at` é um proxy razoável de "última vez que o aparelho se (re)inscreveu".
- `cron_execucoes` recebe **batimento por minuto** do job de 1 min desde a 104 (cabeçalho L10-13:
  "disparo enfileirado ≠ entrega") — o painel **não** deve misturar essa tabela; a entrega real por
  jogador vive **só** no ledger.
- ** statement_timeout**: anon = 3s, authenticated = 8s (comentário da 104, L18-20) → a RPC de
  consulta precisa ser leve.
- `jogadores`: flags reais são `is_ativo`, `is_mensalista`, `is_admin` (`src/lib/database.types.ts:197-199`).
  Randoms: `username` casa `random%` (`src/lib/jogadores.ts:10`; AGENTS 8.6 — excluídos de rankings).

---

## 3. Design da solução (com justificativa)

### 3.1 RPC `obter_painel_entregas_push` — uma linha por atleta, agregados + JSONB de aparelhos

**Decisão de formato**: `RETURNS TABLE` **plano** com colunas escalares de agregado **+ uma coluna
`aparelhos jsonb`** (array itemizado por endpoint). Justificativa:

- O drill-down que o usuário pediu é **por aparelho dentro de cada jogador** — um array JSONB
  (mesma técnica das RPCs de destinatários da 090, `jsonb_agg(jsonb_build_object(...))`) resolve isso
  sem segunda query nem segunda RPC.
- Múltiplas colunas escalares (qtd, datas, último erro) mantêm a ordenação e a tipagem triviais no
  frontend, no espírito do `RETURNS TABLE` da `obter_execucoes_cron` (104:33-41).
- **Privacidade**: o endpoint FCM completo nunca sai do banco — a RPC devolve só os **últimos 16
  caracteres** do endpoint (suficiente para distinguir 1-3 aparelhos) e **jamais** `p256dh`/`auth`.

**Assinatura e semântica** (migration `108`, ver §4.1):

- `obter_painel_entregas_push(p_admin_id bigint, p_limite integer DEFAULT 200)` → uma linha por
  atleta **ativo não-random** (mesma base de elenco do AGENTS 8.6), **incluindo quem não tem
  subscrição** (linha com `qtd_aparelhos = 0` — é justamente o alerta "sem aparelho").
- Gate admin idêntico ao da 104:50-53, com a lição da armadilha 42702 já aprendida: **qualificar
  `jogadores.id`** no WHERE (colunas do `RETURNS TABLE` viram variáveis PL/pgSQL e colidem).
- `STABLE`, `SECURITY DEFINER`, `SET search_path = public`, `GRANT EXECUTE ... TO anon,
authenticated` (AGENTS 7.3). Toda referência a coluna qualificada por alias de CTE (`a.`, `e.`,
  `ue.`, `er.`, `err.`, `j.`) para evitar colisão com as variáveis do `RETURNS TABLE`.
- **Ordenação "piores primeiro"** (responde à pergunta do briefing): atletas que **nunca receberam
  nada** no topo; entre os demais, a entrega **mais antiga** primeiro; desempate alfabético:

```sql
ORDER BY
  (e.ultima_ok IS NULL) DESC,          -- nunca recebeu: topo do quadro
  e.ultima_ok ASC NULLS LAST,          -- entrega mais antiga primeiro
  j.nome;
```

- Custo: ~30-40 atletas, ledger de ~1-2 mil linhas/ano, `DISTINCT ON` com sort em memória — bem
  dentro do statement_timeout de 3s. `LIMIT` com clamp `1..500` como na 104:66.

**Esboço SQL completo** (migration `108_painel_entregas_push.sql`):

```sql
-- P6 da análise de push (docs/analise-notificacoes-push.md): visibilidade de
-- entrega por jogador. Uma linha por atleta ativo (não-random), com aparelhos
-- inscritos, última entrega real do ledger e último erro. O batimento da cron
-- (cron_execucoes, migration 104) NÃO entra aqui: "disparo enfileirado" ≠ entrega.
CREATE OR REPLACE FUNCTION obter_painel_entregas_push(
  p_admin_id bigint,
  p_limite   integer DEFAULT 200
)
RETURNS TABLE (
  jogador_id             bigint,
  nome                   text,
  username               text,
  is_mensalista          boolean,
  posicao                text,
  qtd_aparelhos          bigint,
  primeira_inscricao_em  timestamptz,
  ultima_inscricao_em    timestamptz,
  aparelhos              jsonb,
  total_entregas         bigint,
  ultima_entrega_em      timestamptz,
  ultima_entrega_key     text,
  ultima_entrega_partida bigint,
  total_erros            bigint,
  ultimo_erro            text,
  ultimo_erro_em         timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  -- Gate admin (colunas do RETURNS TABLE colidem: qualificar jogadores.id — lição da 104).
  SELECT is_admin INTO v_is_admin FROM jogadores WHERE jogadores.id = p_admin_id;
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso restrito a administradores.';
  END IF;

  RETURN QUERY
  WITH aparelhos AS (
    SELECT
      ps.jogador_id,
      count(*)::bigint   AS qtd,
      min(ps.created_at) AS primeira,
      max(ps.updated_at) AS ultima,
      jsonb_agg(
        jsonb_build_object(
          'endpoint', right(ps.endpoint, 16),   -- nunca expor o endpoint completo
          'criado_em', ps.created_at,
          'atualizado_em', ps.updated_at
        ) ORDER BY ps.updated_at DESC
      ) AS lista
    FROM push_subscriptions ps
    GROUP BY ps.jogador_id
  ),
  entregas AS (
    SELECT
      d.jogador_id,
      count(*) FILTER (WHERE d.sent_at IS NOT NULL)::bigint AS total_ok,
      max(d.sent_at)                                        AS ultima_ok
    FROM push_reminder_deliveries d
    GROUP BY d.jogador_id
  ),
  ultima_entrega AS (
    SELECT DISTINCT ON (d.jogador_id)
      d.jogador_id, d.reminder_key, d.partida_id, d.sent_at
    FROM push_reminder_deliveries d
    WHERE d.sent_at IS NOT NULL
    ORDER BY d.jogador_id, d.sent_at DESC
  ),
  erros AS (
    SELECT
      d.jogador_id,
      count(*) FILTER (WHERE d.error_message IS NOT NULL)::bigint AS total_erro
    FROM push_reminder_deliveries d
    GROUP BY d.jogador_id
  ),
  ultimo_erro AS (
    SELECT DISTINCT ON (d.jogador_id)
      d.jogador_id, d.error_message, d.claimed_at
    FROM push_reminder_deliveries d
    WHERE d.error_message IS NOT NULL
    ORDER BY d.jogador_id, d.claimed_at DESC
  )
  SELECT
    j.id,
    j.nome,
    j.username,
    j.is_mensalista,
    j.posicao,
    COALESCE(a.qtd, 0),
    a.primeira,
    a.ultima,
    COALESCE(a.lista, '[]'::jsonb),
    COALESCE(e.total_ok, 0),
    e.ultima_ok,
    ue.reminder_key,
    ue.partida_id,
    COALESCE(er.total_erro, 0),
    err.error_message,
    err.claimed_at
  FROM jogadores j
  LEFT JOIN aparelhos      a   ON a.jogador_id   = j.id
  LEFT JOIN entregas       e   ON e.jogador_id   = j.id
  LEFT JOIN ultima_entrega ue  ON ue.jogador_id  = j.id
  LEFT JOIN erros          er  ON er.jogador_id  = j.id
  LEFT JOIN ultimo_erro    err ON err.jogador_id = j.id
  WHERE j.is_ativo
    AND j.username NOT ILIKE 'random%'
  ORDER BY
    (e.ultima_ok IS NULL) DESC,
    e.ultima_ok ASC NULLS LAST,
    j.nome
  LIMIT LEAST(GREATEST(COALESCE(p_limite, 200), 1), 500);
END;
$$;

GRANT EXECUTE ON FUNCTION obter_painel_entregas_push(bigint, integer) TO anon, authenticated;
```

### 3.2 Sinalização de saúde do aparelho (regra determinística no frontend)

"Entrega real" ≠ "inscrição". O painel cruza as duas evidências de vida: **última entrega do ledger**
(`ultima_entrega_em`) e **última (re)inscrição do aparelho** (`ultima_inscricao_em`, que o P1 faz
bumpar a cada boot bem-sucedido). Regra (constantes nomeadas no componente, sem mágica):

```ts
const DIAS_OBSERVAR = 3;    // sem evidência há 3+ dias
const DIAS_VERIFICAR = 14;  // sem evidência há 2 rodadas completas

evidenciaMaisRecente = max(ultima_entrega_em, ultima_inscricao_em)
diasSemEvidencia = diasDesde(evidenciaMaisRecente)

qtd_aparelhos === 0            → badge 'Sem aparelho'        (perigo)
diasSemEvidencia < 3           → badge 'Em dia'              (ok)
3..13 dias                     → badge 'Observar'            (neutro/atenção)
>= 14 dias                     → badge 'Verificar aparelho'  (perigo)
```

Regras auxiliares de leitura (exibidas como texto, nunca só cor — a11y multimodal do design-system
§4.2):

- `total_entregas === 0` → tag mono extra **"nunca recebeu"** na linha (contexto: a cron esteve
  100% falhar de 099 até 104/105 — entregas reais só voltam a existir após 29/08/2026; a legenda da
  seção explica isso para não gerar alarme falso em massa nos primeiros dias).
- `ultimo_erro` presente → bloco vermelho `text-perigo` no detalhe com a mensagem e a data.
- Justificativa dos limiares: FCM rotaciona tokens em semanas-meses e o iOS suspende PWAs esquecidos;
  14 dias ≈ 2 rodadas do racha, período em que o jogador naturalmente abriria o app (e o P1
  re-inscreveria). Abaixo disso, falta de entrega é normal — push só sai em janelas agendadas.

### 3.3 UI — seção "4. Saúde das Entregas por Atleta"

**Posicionamento**: renderizada **fora do `<form>`** (logo após o `</form>`, antes dos diálogos em
`Notificacoes.tsx:221+`). Justificativa: as seções 1-3 são campos editáveis do formulário de config
com um único botão "Salvar"; a seção 4 é diagnóstico **somente-leitura** — fora do form evita
semântica de submissão e permite recarregar independentemente. Visualmente segue o MESMO padrão de
card de seção das irmãs (`rounded-[4px] border border-borda bg-superficie p-3.5 shadow-carimbo`),
numeração "4." mantendo a sequência editorial da tela.

**Estrutura** (tom Nível 1/2 — Oficial/Funcional; é tela administrativa):

```tsx
<div className="rounded-[4px] border border-borda bg-superficie p-3.5 shadow-carimbo space-y-4">
  {/* Cabeçalho: título + resumo mono + botão atualizar */}
  <div className="flex items-start justify-between gap-2">
    <div>
      <h3 className="font-display font-bold text-sm uppercase tracking-wider text-giz">
        4. Saúde das Entregas por Atleta
      </h3>
      <p className="text-xs text-giz-fraco mt-0.5">
        Última entrega real por jogador e aparelhos inscritos. Sem entrega recente = candidato a
        aparelho com problema.
      </p>
      <p className="font-mono text-[10px] uppercase tracking-widest text-giz-fraco tabular-nums mt-1">
        {comAparelho} de {total} atletas com inscrição ativa
      </p>
    </div>
    <button
      type="button"
      onClick={onAtualizar}
      aria-label="Atualizar quadro de entregas"
      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-[4px]
                 border border-borda bg-superficie px-3 text-giz shadow-xs transition
                 hover:bg-superficie-2 active:translate-y-px disabled:opacity-50"
    >
      <RefreshCw className={`size-4 text-destaque-texto ${carregando ? 'animate-spin' : ''}`} />
    </button>
  </div>

  {/* Legenda do contexto pós-P5 */}
  <MensagemEstado tipo="info">
    Entregas registradas desde o conserto da cron (29/08/2026). "Nunca recebeu" logo após a ativação
    é normal — os lembretes saem em janelas agendadas.
  </MensagemEstado>

  {/* Lista contínua — padrão do design-system §3.1 */}
  <div className="divide-y divide-borda/40 border-y border-borda">
    {dados.map((r) => (
      <div key={r.jogador_id}>
        {/* Linha-sumário: botão de drill-down, 44px, aria-expanded */}
        <button
          type="button"
          aria-expanded={aberto === r.jogador_id}
          onClick={() => alternar(r.jogador_id)}
          className="w-full min-h-[44px] flex items-center justify-between gap-3 py-2.5 px-1
                     text-left transition hover:bg-superficie-2/50
                     focus-visible:outline-2 focus-visible:outline-destaque-texto
                     focus-visible:outline-offset-2"
        >
          <span className="flex items-center gap-2 min-w-0">
            <Avatar nome={r.nome} username={r.username} posicao={r.posicao} size="sm" />
            <span className="font-display font-bold text-sm uppercase tracking-wide text-giz truncate">
              {r.nome}
            </span>
          </span>
          <span className="flex items-center gap-2 shrink-0">
            <span className="font-mono text-xs text-giz-fraco tabular-nums">
              {r.ultima_entrega_em ? formatarDataMobile(r.ultima_entrega_em) : '—'}
            </span>
            <Badge variante={saude(r).variante} icone={saude(r).icone}>
              {saude(r).rotulo}
            </Badge>
            <ChevronDown
              className={`size-4 text-giz-fraco transition ${aberto ? 'rotate-180' : ''}`}
            />
          </span>
        </button>

        {/* Detalhe (drill-down itemizado por pessoa) */}
        {aberto === r.jogador_id && (
          <div className="pb-3 px-1 space-y-2 text-xs text-giz-fraco">
            <p className="font-mono tabular-nums">
              {r.qtd_aparelhos} aparelho(s) · última inscrição{' '}
              {r.ultima_inscricao_em ? formatarDataMobile(r.ultima_inscricao_em) : '—'}
            </p>
            <ul className="space-y-1">
              {r.aparelhos.map((ap) => (
                <li key={ap.endpoint} className="font-mono tabular-nums flex justify-between gap-2">
                  <span className="truncate">…{ap.endpoint}</span>
                  <span>
                    {formatarDataMobile(ap.criado_em)} → {formatarDataMobile(ap.atualizado_em)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="font-mono tabular-nums">
              {r.total_entregas} entrega(s) · última:{' '}
              {r.ultima_entrega_em
                ? `${formatarDataMobile(r.ultima_entrega_em)} (${r.ultima_entrega_key ?? '?'}, partida #${r.ultima_entrega_partida ?? '?'})`
                : 'nunca recebeu'}
            </p>
            {r.ultimo_erro && (
              <p className="text-perigo break-words">
                Último erro ({r.ultimo_erro_em ? formatarDataMobile(r.ultimo_erro_em) : '—'}):{' '}
                {r.ultimo_erro}
              </p>
            )}
          </div>
        )}
      </div>
    ))}
  </div>
</div>
```

Decisões de UI e justificativas:

- **Lista contínua** (`divide-y divide-borda/40 border-y border-borda`) — padrão estrutural primário
  do design-system §3.1; o card geral é a exceção semântica coerente com as seções 1-3 da mesma tela.
- **Drill-down por toque** (linha expande/recolhe) em vez de tudo expandido: ~30 atletas × detalhe
  completo estouraria a página no mobile; o usuário pediu rastreabilidade itemizada, não poluição —
  o sumário responde "quem está com problema" e o toque abre o "por quê". `min-h-[44px]`,
  `aria-expanded`, foco visível âmbar (design-system §4.1 Nível 1).
- **Badges** reutilizam `src/components/Badge.tsx` (variantes `ok` / `perigo` / `neutro` já
  existentes, com slot `icone`) — zero componente de badge novo.
- **Datas/números em `font-mono tabular-nums`** (Chivo Mono, design-system §2.2) via
  `formatarDataMobile` (`src/lib/formatacao.ts:8-14, 38-40` — estilo pt-BR longo local, ex.
  "qui., 28 de ago., 19:30"); nomes em `font-display uppercase`. Cuidado: `formatarDataMobile`
  lança `RangeError` para `Invalid Date` (`new Date('')`) — sempre usar o ternário com `? :`
  como nos esboços acima, nunca `?? ''`.
- **Avatar** (`src/components/Avatar.tsx:6,50`): `posicao` espera o tipo `PosicaoId`
  (`keyof typeof POSICOES`, `src/lib/times.ts:54`) — tipar o campo como tal na interface (§3.4),
  nunca `string` cru (não compila sob `strict`); e passar `username` — o Avatar deriva cor e
  iniciais de `username || nome`, mantendo a paleta coerente com as demais listas do app.
- **Estados**: carregando = `Carregando compacto` do próprio componente (`Estado.tsx:10-25`) no lugar
  da lista (a página continua utilizável); erro = `MensagemEstado tipo="erro"` com
  `formatarMensagemErro` (AGENTS matriz "Erros na UI"); vazio (0 atletas) = `MensagemEstado
tipo="info"` — nunca tela em branco (design-system §3.8).
- **Skeleton CLS**: a seção carrega em efeito próprio, mas a página já tem esqueleto global
  (`SkeletonNotificacoes`) na primeira visita; o estado interno de recarga usa spin/blocos inline,
  sem trocar a altura da lista (CLS ~0). Nenhuma mudança no mapa de skeletons do `Layout`.

### 3.4 Tipos e fetch no frontend (`src/lib/notificacoes.ts`)

```ts
export interface AparelhoPush {
  endpoint: string; // últimos 16 caracteres (a RPC trunca)
  criado_em: string;
  atualizado_em: string;
}

export interface PainelEntregaJogador {
  jogador_id: number;
  nome: string;
  username: string;
  is_mensalista: boolean;
  // Valores do banco são exatamente as chaves de POSICOES (src/lib/times.ts):
  // o Avatar exige PosicaoId — não declarar como string.
  posicao: PosicaoId;
  qtd_aparelhos: number;
  primeira_inscricao_em: string | null;
  ultima_inscricao_em: string | null;
  aparelhos: AparelhoPush[];
  total_entregas: number;
  ultima_entrega_em: string | null;
  ultima_entrega_key: string | null;
  ultima_entrega_partida: number | null;
  total_erros: number;
  ultimo_erro: string | null;
  ultimo_erro_em: string | null;
}

export async function obterPainelEntregasPush(adminId: number): Promise<PainelEntregaJogador[]> {
  const { data, error } = await supabase.rpc('obter_painel_entregas_push', {
    p_admin_id: adminId,
  });
  if (error) throw error;
  return (data ?? []) as unknown as PainelEntregaJogador[];
}
```

(`PosicaoId` importado de `src/lib/times.ts`.)

Padrão idêntico às funções vizinhas do arquivo (`dispararPushTeste`, etc.). **Não usar `useCache`**:
a tela admin já carrega por `carregar()` com flag; manter coerência (AGENTS §5.2 — a exceção do
cache é para abas de leitura pública).

---

## 4. Plano de execução (arquivo a arquivo)

> **Numeração da migration**: esta sessão parte do **108** (última aplicada = 105, @ `5106f1e`).
> **ATENÇÃO**: os planos irmãos P2 (varredura de retry) e P3 (push de votação aberta) também exigem
> migration — se qualquer um for executado antes, **a numeração desloca** (108 pode virar 109+).
> Antes de criar o arquivo, rodar `ls supabase/migrations | tail -3` e usar o próximo número livre.

### 4.1 `supabase/migrations/108_painel_entregas_push.sql` (novo)

Conteúdo = esboço do §3.1 integralmente (cabeçalho comentado citando P6, gate com `jogadores.id`
qualificado, clamps de LIMIT, `GRANT EXECUTE`). Zero UUID, nomes em português, parâmetros `p_`,
`STABLE`, `SECURITY DEFINER SET search_path = public` (AGENTS §7.1-7.3).

### 4.2 `src/lib/notificacoes.ts` (editar)

Adicionar `AparelhoPush`, `PainelEntregaJogador` e `obterPainelEntregasPush` (§3.4), após as funções
existentes.

### 4.3 `src/components/SecaoNotificacaoSaude.tsx` (novo)

Componente **presentacional** (mesmo contrato das seções irmãs — recebe dados via props, não busca):

```ts
export interface SecaoNotificacaoSaudeProps {
  dados: PainelEntregaJogador[];
  carregando: boolean;
  erro: string | null;
  onAtualizar: () => void;
}
```

- Estado interno único: `const [aberto, setAberto] = useState<number | null>(null)` (accordion de um
  item por vez — hooks no topo, sem retorno condicional antes; AGENTS §5.1).
- Helpers de módulo (antes do componente, sem hooks): `saude(r): { variante, icone, rotulo }` com as
  constantes `DIAS_OBSERVAR = 3` / `DIAS_VERIFICAR = 14` (§3.2) e `calcularDiasSemEvidencia`.
- Badges via `Badge` (`variante: 'ok' | 'perigo' | 'neutro'`; ícones `CheckCircle2`, `AlertTriangle`,
  `Clock`), datas via `formatarDataMobile`.
- Estados internos: `carregando && dados.length === 0` → `Carregando compacto`; `erro` →
  `MensagemEstado tipo="erro"`; `dados.length === 0` → `MensagemEstado tipo="info"` com orientação.

### 4.4 `src/routes/Notificacoes.tsx` (editar)

1. Estado: `const [painel, setPainel] = useState<PainelEntregaJogador[]>([]);`,
   `const [carregandoPainel, setCarregandoPainel] = useState(true);`,
   `const [erroPainel, setErroPainel] = useState<string | null>(null);` — junto dos demais (topo).
2. `carregarPainel` via `useCallback` — **espelhar o guard do `carregar()` existente**
   (`Notificacoes.tsx:61,84`: `if (!jogador || !isAdmin) return;`) e usar dependências
   `[jogador, isAdmin]` (exhaustive-deps): sem o guard, um não-admin montaria a rota e dispararia a
   RPC contra o gate (exceção no log + estado de erro inútil), e sem `isAdmin` nas deps o
   linter reclama. Chamando `obterPainelEntregasPush(jogador.id)` com `formatarMensagemErro` —
   **efeito próprio** com `let ativo = true; return () => { ativo = false; };` (AGENTS §5.2).
   Separado do `Promise.all` de propósito: falha ou ausência da RPC não derruba o formulário de
   configuração (deploy do front pode preceder o `db push` sem quebrar a tela toda).
3. Renderizar `<SecaoNotificacaoSaude dados={painel} carregando={carregandoPainel}
erro={erroPainel} onAtualizar={() => carregarPainel()} />` **imediatamente após o `</form>`**
   (L219), antes dos `ConfirmDialog`/modais.
4. Nenhum hook depois do guard `if (!isAdmin)` existente (L96) — todos os novos hooks antes dele.

### 4.5 Checagens finais (checklist AGENTS §11.2)

`npm run lint` (0 erros) → `npm run format` → `npm run build` → aplicar migration
(`npx supabase db push`, ver `GUIA/MIGRACOES_AUTOMATICAS.md`) → validação em produção (§6).
Opcional: regenerar `src/lib/database.types.ts` (`npx supabase gen types typescript`) — o frontend
tipa o retorno da RPC localmente, então é dispensável para este item.

---

## 5. Casos de borda

| Caso                                                 | Tratamento                                                                                                                                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Atleta **sem subscrição**                            | Linha presente com `qtd_aparelhos = 0`, badge perigo "Sem aparelho", datas "—" — é o alerta central do painel (quem precisa ativar).                                            |
| **Ledger vazio** para o atleta (nunca recebeu)       | `ultima_entrega_em` null, tag "nunca recebeu"; se a inscrição for recente (< 3 dias) o badge segue "Em dia" — push só sai em janelas agendadas.                                 |
| **Pós-fix P5**: todo mundo com entrega antiga        | Legenda `MensagemEstado info` na seção explica que entregas só voltaram a registrar em 29/08/2026; evita alarme falso em massa nos primeiros dias.                              |
| **Volume** de atletas                                | Elenco real ~30; `LIMIT` clampado 1..500 na RPC; sem paginação (justificado: lista contínua de uma tela, drill-down sob demanda).                                               |
| **Randoms e inativos**                               | Excluídos na RPC (`is_ativo AND username NOT ILIKE 'random%'`, AGENTS 8.6); painel é do elenco ativo. Subscrição órfã de inativo fica invisível — aceitável e documentado aqui. |
| **Dados sensíveis**                                  | Gate `is_admin` dentro da RPC (não só na UI); endpoint truncado a 16 chars; `p256dh`/`auth` **nunca** retornados; ledger já tem `REVOKE ALL` do client (036:35).                |
| **Aparelho compartilhado** (2 contas, 1 endpoint)    | Visível como mesmo sufixo de endpoint em duas linhas — o painel só expõe o sintoma; correção está fora do escopo (análise §7).                                                  |
| `error_message` longo / `reminder_key` slot `HH:MM`  | Erro com `break-words`; key exibida como texto livre (CHECK da 077 aceita HH:MM).                                                                                               |
| **Colisão PL/pgSQL** (42702)                         | Todas as colunas qualificadas por alias; `jogadores.id` qualificado no gate — lição das migrations 097/104.                                                                     |
| RPC inexistente (front deployado antes do `db push`) | Seção exibe `MensagemEstado erro` isolada; form de config continua funcionando (efeito próprio, §4.4.2).                                                                        |
| **Fuso horário**                                     | RPC retorna `timestamptz`; UI formata com `Intl` pt-BR local (`formatarDataMobile`) — nunca exibir o ISO cru.                                                                   |

---

## 6. Validação em produção (sem testes automatizados — decisão do usuário; proibido script/CI)

1. **Aplicar e checar a função** no SQL Editor do Supabase:
   ```sql
   -- Sanity: colunas, ordenação (nunca-recebeu no topo), gate
   SELECT * FROM obter_painel_entregas_push(<ID_ADMIN>, 200);

   -- Cross-check 1: aparelhos por jogador (deve bater com qtd_aparelhos)
   SELECT jogador_id, count(*) FROM push_subscriptions GROUP BY 1 ORDER BY 1;

   -- Cross-check 2: entregas por jogador (deve bater com total_entregas/ultima_entrega_em)
   SELECT jogador_id,
          count(*) FILTER (WHERE sent_at IS NOT NULL) AS ok,
          max(sent_at) AS ultima
   FROM push_reminder_deliveries GROUP BY 1 ORDER BY 1;

   -- Gate: com NÃO-admin deve estourar 'Acesso restrito a administradores.'
   SELECT * FROM obter_painel_entregas_push(<ID_NAO_ADMIN>);
   ```
2. **REST/PostgREST** (gate e shape do JSON):
   ```bash
   # deve retornar erro do gate (relation/exception) — nunca dados:
   curl -s "$SUPABASE_URL/rest/v1/rpc/obter_painel_entregas_push" \
     -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
     -H "Content-Type: application/json" -d '{"p_admin_id": 999999}';
   # com um id de admin deve retornar o array JSON:
   curl -s "$SUPABASE_URL/rest/v1/rpc/obter_painel_entregas_push" \
     -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
     -H "Content-Type: application/json" -d '{"p_admin_id": <ID_ADMIN>}';
   ```
3. **UI manual** (admin logado, `/notificacoes`): seção "4." aparece após o form; contagem do topo
   bate com o cross-check; drill-down abre/fecha (um por vez) com `aria-expanded`; badges coerentes
   com a regra (§3.2) — conferir um "Em dia", um "nunca recebeu" e um "Sem aparelho" contra as
   queries acima; botão atualizar dispara `RefreshCw` girando; **tema claro e escuro**; alvos ≥ 44px;
   datas em mono pt-BR local; nenhum `window.confirm`/`alert`; erro de rede (devtools offline) mostra
   `MensagemEstado` amigável só na seção.
4. **Executar** `npm run lint`, `npm run format:check` e `npm run build` antes do deploy na Vercel.

---

## 7. Esforço, riscos e ordem

- **Esforço**: **M** (~4-6h) — migration P (0,5h), lib P (0,5h), componente M (2h), rota P (0,5h),
  validação produção (1h), revisão design-system/lint/build (0,5h).
- **Riscos** (baixos, mitigados):
  1. Colisão identificadores PL/pgSQL (42702) → tudo qualificado; validação §6.1 pega na hora.
  2. statement_timeout (3s anon) → consultas triviais (~40 atletas, ledger ~2k linhas) + LIMIT clamp.
  3. Leitura enviesada pós-P5 (entregas antigas em massa) → legenda informativa na seção (§5).
  4. Numeração da migration disputada com P2/P3 → conferir `ls supabase/migrations` antes de criar.
  5. `updated_at` de subscrição não é "recebeu push" — a regra de saúde cruza com o ledger de
     propósito (§3.2); a UI nunca rotula `updated_at` como entrega.
- **Ordem sugerida**: 4.1 (migration + push + validação SQL) → 4.2 (lib) → 4.3 (componente) →
  4.4 (rota) → 4.5 (lint/format/build) → §6 (validação UI/REST). Migration primeiro permite validar
  o gate e o shape antes de qualquer linha de UI existir.

## 8. Escopo fechado

Faz **apenas**: RPC de consulta + seção "4. Saúde das Entregas por Atleta" na tela
`/notificacoes`. **Não faz**: exibir `cron_execucoes` na UI (execuções da cron), botões de reenvio
por jogador, limpeza/REVOKE de grants de `push_subscriptions` (análise §7), ações em lote,
paginação, exportação, push novo (P2/P3) ou qualquer outra melhoria tangencial.
