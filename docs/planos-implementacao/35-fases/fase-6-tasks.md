# Fase 6 · Disparo manual pelo app (RF03, backend) — Tasks

> Ref.: breakdown SDD 35 (`C:\GIT\racha\.superpowers\sdd\35-clipes-filmaeu\breakdown.md:127-136`, Fase 6) · requisito fechado (`docs/requisito-clipes-filmaeu.md:65` RF03, `:70` RF08)
> Decisões P1–P12 do orquestrador (breakdown §5): **fechadas**. Aplicáveis a esta fase: **P1** (RPC + pg_net — `disparar_importacao_clipes` SECURITY DEFINER com gate `is_admin`, padrão `disparar_confirmacao_manual`, **sem Edge Function**) e **P10** (painel mostra só `clipes_importacoes`; `cron_execucoes` segue como ledger de transporte HTTP).
> Idioma: português. 1 passo = 1 commit. Sem testes automáticos novos (AGENTS.md). Sem libs novas. Interfaces das Fases 1–5 consumidas **exatamente como escritas** (`fase-1-tasks.md` a `fase-5-tasks.md`).

## 1. Objetivo da fase

Permitir que o admin dispare a importação de clipes **por dia específico** de dentro do app (RF03) e que o resultado fique consultável (RF08) — **só backend**: (a) RPC `disparar_importacao_clipes(p_admin_id, p_data)` SECURITY DEFINER com gate `is_admin`, lendo o PAT `github_pat_clipes` do Vault e chamando a GitHub API `workflow_dispatch` do workflow `clipes-filmaeu.yml` (Fase 2) via `disparar_e_registrar_cron_http` (padrão `disparar_confirmacao_manual`, `099:217-267`); (b) RPCs de consulta do ledger `clipes_importacoes` para o painel da Fase 8 (padrão `obter_execucoes_cron`, `099:172-211`), uma delas com filtro de falhas recentes (RF07); (c) regeneração de `database.types.ts` (as RPCs terão consumidor no frontend na Fase 8). **Exclui qualquer UI** (Fase 8).

## 2. Estado atual e interfaces vinculantes (evidências verificadas em 02/10/2026)

**Pipeline de disparo HTTP (o molde desta fase — migration 099):**

- `disparar_e_registrar_cron_http(p_job_nome, p_url, p_headers, p_body, p_timeout_ms)` — SECURITY DEFINER, dispara `net.http_post` (pg_net), **polling de `net._http_response` com fallback `net.http_collect_response`** até o timeout, classifica 2xx como sucesso, grava em `cron_execucoes` (resposta truncada a 5000 chars, erro a 2000) e retorna o id da execução (`099:34-167`). A resposta assíncrona do pg_net é resolvida **dentro dela** — o chamador não lida com `net._http_response` (padrão que `disparar_confirmacao_manual` consumia com `PERFORM`, `099:258-263`).
- `disparar_confirmacao_manual(p_admin_id, p_partida_id)` — gate `is_admin` (`099:232-235`: `SELECT is_admin ... IF v_is_admin IS NOT TRUE THEN RAISE EXCEPTION 'Acesso restrito a administradores.'`), leitura do Vault **diretamente** com `SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ...` (`099:242-245`), erro de secret nulo = INSERT em `cron_execucoes` + RAISE (`099:247-251`), headers via `jsonb_build_object` e `PERFORM disparar_e_registrar_cron_http(...)` com **URL hardcoded** (`099:253-263` — precedente de URL fixa na RPC, ex. `https://jtavmrlllyctkuxefhpc.supabase.co/functions/v1/...`), retorno `boolean`.
- `obter_execucoes_cron(p_admin_id, p_limite DEFAULT 50)` — padrão de consulta admin do ledger: gate `is_admin` (`099:193-196`), `RETURNS TABLE` tipado, `STABLE SECURITY DEFINER SET search_path = public`, `LIMIT LEAST(GREATEST(COALESCE(p_limite,50),1),200)` (`099:172-211`).
- Grants de RPCs admin: `GRANT EXECUTE ... TO anon, authenticated` + gate interno (`099:584-586`).
- `search_path` fixado em RPC DEFINER é regra do repo (`018_fix_rpc_search_path.sql:19,36,53`); o acesso a `vault.decrypted_secrets` em `099` é por **nome qualificado** (`vault.decrypted_secrets`), funcionando com `SET search_path = public` (`099:242-245`).

**Interfaces das fases anteriores (consumidas tal como escritas):**

- **Workflow (Fase 2, `fase-2-tasks.md:308-370`)**: `.github/workflows/clipes-filmaeu.yml` com `workflow_dispatch` e inputs `data` (AAAA-MM-DD, vazio = última quinta), `horario` (default `'19:00'`), `partida_id` (opcional); `permissions: contents: read`; `concurrency: clipes-filmaeu`.
- **PAT no Vault (Fase 2 Task 4, `fase-2-tasks.md:276`)**: secret `github_pat_clipes` — fine-grained PAT, só este repo, permissão mínima `actions:write`; documentado em `docs/configuracao-clipes-action.md` com a nota "registrar já; não é lida nesta fase" (esta fase passa a lê-lo).
- **RPC do Vault (Fase 2, migration 111)**: `obter_segredo_vault(p_nome)` executável **só pela `service_role`** (`fase-2-tasks.md:44-78`) — ver decisão de interação na seção 8.1.
- **Ledger (Fase 1, `fase-1-tasks.md:65-95`)**: `clipes_importacoes` com `partida_id` (NULL, `ON DELETE SET NULL`), `data_referencia date`, `origem CHECK ('automatico','manual')`, `status CHECK ('iniciado','concluido','sem_clipes','falha','limpeza')`, `sucesso`, `quantidade_clipes`, `bytes_total`, `detalhe`, `erro`, `criado_em`, `atualizado_em`; grants: **REVOKE ALL de `anon, authenticated`** e INSERT/UPDATE só `service_role` — as RPCs desta fase leem a tabela via SECURITY DEFINER (mesmo mecanismo de `obter_execucoes_cron` sobre `cron_execucoes`).
- **Semântica do ledger (Fases 2–5)**: quem grava `clipes_importacoes` é a **Action** (origem derivada de `GITHUB_EVENT_NAME` — `'manual'` no dispatch, `fase-2-tasks.md:193-206`); `'sem_clipes'` é **sucesso false / exit 0** — condição de alerta RF07 (`fase-5-tasks.md:33`).
- **Fuso**: BRT = UTC-3 fixo (`060_cron_agendar_partida_semanal.sql:7`).
- **Frontend (consumidor na Fase 8)**: RPCs admin chamadas com `p_admin_id` do jogador logado — `src/lib/notificacoes.ts:100-116` (`dispararConfirmacaoManual`/`dispararPushVotacaoAberta` via `supabase.rpc(...)`, throw de erro) e `:144-152` (`obterPainelEntregasPush` com cast de narrowing); id do admin vem de `useJogadorLogado()` → `useSessao().jogador` (`src/hooks/useJogadorLogado.ts:3-5`), usado como `jogador.id` nas rotas (`src/routes/NotificacoesTestes.tsx:109`).
- **Regeneração de types**: `npx supabase gen types typescript --project-id jtavmrlllyctkuxefhpc > src/lib/database.types.ts` (precedente documentado, `docs/plano-escolha-times-realtime.md:561`; cuidados de encoding da Fase 1 Task 3, `fase-1-tasks.md:170-172` — rodar no Git Bash).
- **Numeração de migrations**: Fases 1–5 usam 109–113 (`fase-5-tasks.md:38`) → **esta fase usa 114–115**, com a mesma ressalva de colisão da 109 (`docs/plano-escolha-times-realtime.md:560`; se deslocar, renomear só o arquivo).
- **Remote GitHub do repo**: `git remote -v` → `origin https://github.com/rdias612/racha.git` (fetch/push); branch atual/padrão: `main` (`git branch --show-current`). Owner/repo e ref podem ser fixados na RPC (ver decisão 8.2).

## 3. Pré-condições

- **Fases 1 e 2 aplicadas** (mínimo): tabelas `clipes`/`clipes_importacoes` + grants (109), RPC `obter_segredo_vault` (111), **workflow `clipes-filmaeu.yml` na branch `main`** — sem ele o `workflow_dispatch` não tem alvo (a GitHub API responde 422 se o arquivo não existir na ref). Fases 3–5 **não são pré-requisito** desta fase: o dispatch funciona com o workflow base, e a linha em `clipes_importacoes` aparece já na Fase 2 (status `concluido`, `quantidade_clipes: 0`).
- **Secret `github_pat_clipes` criado no Vault** (cadência manual da Fase 2 Task 4) com PAT fine-grained só `actions:write` deste repo.
- Supabase CLI logado/projeto linkado (`docs/MIGRATE.md:5-13`); numeração de migrations conferida (114/115).
- Um `jogador.id` real com `is_admin = true` e um com `is_admin = false` para os testes de gate.
- Decisões fechadas aplicáveis: P1, P10. **Nenhuma decisão aberta** (seção 10).

## 4. Tasks (1 passo = 1 commit)

### Task 1 — Migration 114: RPC `disparar_importacao_clipes` + grant + atualização do doc de secrets

**Arquivos a criar**: `supabase/migrations/114_rpc_disparar_importacao_clipes.sql`.
**Arquivos a tocar**: `docs/configuracao-clipes-action.md` (1 linha — a nota "(registrar já; não é lida nesta fase)" da linha `github_pat_clipes` vira "consumida pela RPC `disparar_importacao_clipes` desta migration").

**Conteúdo esboçado (SQL completo)**:

```sql
-- 114_rpc_disparar_importacao_clipes.sql
-- Fase 6 (RF03, P1): admin dispara a importação de clipes por dia específico
-- pelo app, sem Edge Function. Padrão de disparar_confirmacao_manual (099:217-267):
-- gate is_admin → leitura do segredo no Vault (099:242-245) → montagem de headers
-- jsonb → PERFORM disparar_e_registrar_cron_http (099:34-167), que resolve a
-- resposta assíncrona do pg_net e registra o TRANSPORTE em cron_execucoes (P10).
-- O ledger da feature (clipes_importacoes) é gravado pela própria Action
-- (origem 'manual' via GITHUB_EVENT_NAME, Fase 2) — esta RPC NÃO grava nele.

CREATE OR REPLACE FUNCTION disparar_importacao_clipes(
  p_admin_id bigint,
  p_data     date
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public   -- padrão 099; vault é acessado por nome qualificado
AS $$
DECLARE
  v_is_admin boolean;
  v_pat      text;
  v_headers  jsonb;
BEGIN
  -- 1) Gate is_admin (padrão 099:232-235)
  SELECT is_admin INTO v_is_admin FROM jogadores WHERE id = p_admin_id;
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso restrito a administradores.';
  END IF;

  -- 2) Validação leve do dia alvo (RF03: recuperar atraso/histórico — data passada)
  IF p_data IS NULL THEN
    RAISE EXCEPTION 'Data obrigatória (AAAA-MM-DD).';
  END IF;
  IF p_data > (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN
    RAISE EXCEPTION 'Data não pode ser futura.';
  END IF;

  -- 3) PAT do Vault — leitura direta, padrão 099:242-245 (decisão na seção 8.1)
  SELECT decrypted_secret INTO v_pat
    FROM vault.decrypted_secrets
    WHERE name = 'github_pat_clipes'
    LIMIT 1;

  IF v_pat IS NULL THEN
    INSERT INTO cron_execucoes (job_nome, sucesso, erro)
    VALUES ('disparar_importacao_clipes', false, 'Secret github_pat_clipes não encontrado no vault.');
    RAISE EXCEPTION 'Secret github_pat_clipes não configurado no vault.';
  END IF;

  -- 4) Chamada à GitHub API workflow_dispatch.
  --    Owner/repo e ref fixados (remote conferido: github.com/rdias612/racha,
  --    branch main — decisão na seção 8.2; precedentes de URL fixa: 099:260, 099:305).
  v_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Accept', 'application/vnd.github+json',
    'Authorization', 'Bearer ' || v_pat,
    'X-GitHub-Api-Version', '2022-11-28'
  );

  PERFORM disparar_e_registrar_cron_http(
    'disparar_importacao_clipes',
    'https://api.github.com/repos/rdias612/racha/actions/workflows/clipes-filmaeu.yml/dispatches',
    v_headers,
    jsonb_build_object(
      'ref', 'main',
      'inputs', jsonb_build_object(
        'data',    to_char(p_data, 'YYYY-MM-DD'),
        'horario', '19:00'
      )
    )
  );

  RETURN true;
END;
$$;

-- Padrão das RPCs admin (099:585): EXECUTE amplo + gate is_admin interno.
GRANT EXECUTE ON FUNCTION disparar_importacao_clipes(bigint, date) TO anon, authenticated;
```

**Decisões embutidas (para revisão)**:

- **Assinatura `(p_admin_id, p_data)` só** — sem `p_partida_id` e sem `p_horario`: o input `partida_id` do workflow é opcional e tem precedência sobre a data apenas para reimportação cirúrgica (Fase 2); o caso do RF03 é "dia específico", e o workflow já resolve a partida por `data_jogo` + `status` (P7). `horario` é fixo `'19:00'` (slot do Filma Eu; o input existe no workflow com esse default, `fase-2-tasks.md:331-334`). Expor parâmetros sem consumidor seria especulação (YAGNI); se um dia fizer sentido, é +1 parâmetro e +1 campo no `inputs`.
- **Validação de data futura com `AT TIME ZONE 'America/Sao_Paulo'`** (BRT = UTC-3 fixo, `060:7`): importar slot futuro é sem sentido e só geraria `falha` no ledger; erro claro cedo é mais barato.
- **Não grava em `clipes_importacoes`** (decisão estrutural, lacuna 10 do breakdown resolvida): a Action é a única escritora do ledger da feature (com a idempotência de reexecução dela, `fase-2-tasks.md:193-206`); a RPC grava o **transporte HTTP** em `cron_execucoes` via `disparar_e_registrar_cron_http`, exatamente como todo disparo pg_net do projeto (P10). Duplicar aqui criaria duas fontes de verdade para o mesmo evento.
- **`PERFORM` + `RETURN true`** (padrão `099:258-265`): o retorno `true` significa "dispatch encaminhado", não "importação concluída" — ela é assíncrona e o desfecho real fica no ledger (`clipes_importacoes`) e no transporte (`cron_execucoes.job_nome = 'disparar_importacao_clipes'`), que a Fase 8 pode exibir. Se o HTTP falhar (ex.: 422 por workflow inexistente, 401 por PAT inválido), o sucesso `false` + erro ficam registrados em `cron_execucoes` pelo pipeline (`099:124-136,140-155`).
- **O PAT nunca vira log**: só entra no header; `disparar_e_registrar_cron_http` persiste apenas `status_code`, corpo da resposta e erro (`099:140-155`) — a resposta de sucesso da GitHub API é **204 sem corpo**, então nada sensível chega ao ledger (RNF02).
- **`VOLATILE`** (faz INSERT/HTTP), divergindo do `STABLE` das consultas — mesmo critério de `salvar_configuracoes_notificacoes` (`099:320-322`).

**Validação da task**:

1. `npx supabase db push` — aplica sem erro (`docs/MIGRATE.md:13`).
2. **Não-admin recebe exceção**: com a anon key,
   `curl -s "$VITE_SUPABASE_URL/rest/v1/rpc/disparar_importacao_clipes" -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" -H "Content-Type: application/json" -d '{"p_admin_id": <id_de_nao_admin>, "p_data": "2026-09-24"}'`
   → erro `Acesso restrito a administradores.` e **nenhuma** run no GitHub.
3. **Admin dispara run visível no GitHub**: mesmo curl com `p_admin_id` de um admin real e `p_data` de uma partida publicada/fechada real (ex.: última quinta com jogo) → resposta `true`; aba Actions do repo mostra a run "Clipes Filma Eu" disparada (evento `workflow_dispatch`) com `data` do input.
4. **Linha em `cron_execucoes` (transporte, P10)**: SQL Editor —
   `SELECT job_nome, status_code, sucesso, erro, executado_em FROM cron_execucoes WHERE job_nome = 'disparar_importacao_clipes' ORDER BY id DESC LIMIT 1;`
   → `status_code 204`, `sucesso true`, `erro null`.
5. **Linha em `clipes_importacoes` (ledger da feature)**: alguns segundos/minutos depois (run assíncrona), com a service_role key —
   `curl -s "$SUPABASE_URL/rest/v1/clipes_importacoes?select=id,data_referencia,origem,status,sucesso,quantidade_clipes&order=id.desc&limit=1" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"`
   → `data_referencia` = `p_data`, `origem: manual`, `status: concluido` (workflow base da Fase 2), `sucesso: true`, `quantidade_clipes: 0`.
6. **PAT ausente**: (apenas se o secret ainda não existir) curl de admin → exceção `Secret github_pat_clipes não configurado no vault.` + linha `sucesso false` em `cron_execucoes`.
7. `npm run build`/`npm run lint` verdes (nada em `src/` tocado nesta task).

**Divergências/observações**: ver seção 8.1 (leitura do Vault), 8.2 (repo/ref fixados) e 8.3 (não-gravação no ledger).

### Task 2 — Migration 115: RPCs de consulta do ledger `clipes_importacoes` (padrão `obter_execucoes_cron`)

**Arquivos a criar**: `supabase/migrations/115_rpc_consulta_importacoes_clipes.sql`.
**Arquivos a tocar**: nenhum outro.

**Conteúdo esboçado (SQL completo)**:

```sql
-- 115_rpc_consulta_importacoes_clipes.sql
-- Fase 6 (RF08, P10): consultas admin do ledger da feature para o painel da Fase 8.
-- Padrão de obter_execucoes_cron (099:172-211): gate is_admin, RETURNS TABLE
-- tipado, STABLE SECURITY DEFINER SET search_path = public, LIMIT com clamp.
-- A tabela é inacessível ao client (REVOKE da Fase 1, fase-1-tasks.md:93) —
-- estas RPCs são o único caminho de leitura pelo app.

-- ----------------------------------------------------------------------------
-- 1. Histórico completo (mais recente primeiro) — RF08
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION obter_importacoes_clipes(
  p_admin_id bigint,
  p_limite   integer DEFAULT 50
)
RETURNS TABLE (
  id                bigint,
  partida_id        bigint,
  data_referencia   date,
  origem            text,
  status            text,
  sucesso           boolean,
  quantidade_clipes integer,
  bytes_total       bigint,
  detalhe           text,
  erro              text,
  criado_em         timestamptz,
  atualizado_em     timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT is_admin INTO v_is_admin FROM jogadores WHERE id = p_admin_id;
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso restrito a administradores.';
  END IF;

  RETURN QUERY
  SELECT
    ci.id,
    ci.partida_id,
    ci.data_referencia,
    ci.origem,
    ci.status,
    ci.sucesso,
    ci.quantidade_clipes,
    ci.bytes_total,
    ci.detalhe,
    ci.erro,
    ci.criado_em,
    ci.atualizado_em
  FROM clipes_importacoes ci
  ORDER BY ci.criado_em DESC, ci.id DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limite, 50), 1), 200);
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Falhas recentes — aviso do painel (RF07)
--    Inclui 'falha' (erro de execução) e 'sem_clipes' (sucesso false / exit 0,
--    condição de alerta definida na Fase 3/5 — fase-5-tasks.md:33). Janela de
--    1h a 720h (30 dias), default 48h.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION obter_falhas_recentes_clipes(
  p_admin_id bigint,
  p_horas    integer DEFAULT 48
)
RETURNS TABLE (
  id                bigint,
  partida_id        bigint,
  data_referencia   date,
  origem            text,
  status            text,
  sucesso           boolean,
  quantidade_clipes integer,
  bytes_total       bigint,
  detalhe           text,
  erro              text,
  criado_em         timestamptz,
  atualizado_em     timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT is_admin INTO v_is_admin FROM jogadores WHERE id = p_admin_id;
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso restrito a administradores.';
  END IF;

  RETURN QUERY
  SELECT
    ci.id,
    ci.partida_id,
    ci.data_referencia,
    ci.origem,
    ci.status,
    ci.sucesso,
    ci.quantidade_clipes,
    ci.bytes_total,
    ci.detalhe,
    ci.erro,
    ci.criado_em,
    ci.atualizado_em
  FROM clipes_importacoes ci
  WHERE ci.status IN ('falha', 'sem_clipes')
    AND ci.criado_em >= now() - make_interval(hours => LEAST(GREATEST(COALESCE(p_horas, 48), 1), 720))
  ORDER BY ci.criado_em DESC, ci.id DESC;
END;
$$;

-- Padrão das RPCs admin (099:584): EXECUTE amplo + gate is_admin interno.
GRANT EXECUTE ON FUNCTION obter_importacoes_clipes(bigint, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION obter_falhas_recentes_clipes(bigint, integer) TO anon, authenticated;
```

**Decisões embutidas**:

- **Duas RPCs em vez de um parâmetro de filtro**: o painel da Fase 8 precisa de (a) o histórico paginado (padrão `SecaoNotificacaoSaude`/`obter_painel_entregas_push`) e (b) um sinal barato de "há falha recente" para o aviso — duas funções explícitas são mais simples e legíveis que uma função com modo (KISS; segue o desdobramento `obter_execucoes_cron`/`obter_painel_entregas_push` já existente). `p_limite`/`p_horas` com clamp nos mesmos moldes de `099:209`.
- **`'sem_clipes'` entra no filtro de falhas recentes**: é `sucesso false` e condição de alerta RF07 (Fase 5 trata igual no push aos admins). Se o dono quiser separar visualmente, a coluna `status` permite — o filtro do backend continua correto.
- **`RETURN QUERY` com prefixo `ci.`** evita a ambiguidade clássica de `RETURNS TABLE` (colunas de mesmo nome) — mesmo formato de `099:198-209`.
- **Grants amplos + gate interno** (`099:584`): a RPC só é chamada pelo frontend com `p_admin_id` do jogador logado (padrão `notificacoes.ts:144-152`); o gate no corpo é a proteção real (sem RLS no `public`, `016:1-4`).

**Validação da task**:

1. `npx supabase db push` — aplica sem erro.
2. **Não-admin**: curl com anon key e `p_admin_id` de não-admin (ambas as RPCs) → `Acesso restrito a administradores.`
3. **Admin com dados reais**: curl com anon key + `p_admin_id` de admin (PostgREST exige body `{"p_admin_id": <id>}`) →
   `obter_importacoes_clipes` → linhas do ledger ordenadas por `criado_em DESC` (a linha `'manual'` da Task 1 presente), no máximo `p_limite` (clamp 200);
   `obter_falhas_recentes_clipes` → só linhas `status IN ('falha','sem_clipes')` dentro da janela; com ledger sem falhas → `[]`.
4. **Filtro de janela**: SQL Editor inserindo (via service_role) uma linha `falha` com `criado_em` antigo (`UPDATE ... SET criado_em = now() - interval '7 days'`) → some do default de 48h e aparece com `p_horas = 200`. **Reverter o UPDATE** (ou apagar a linha de teste).
5. `npm run build`/`npm run lint` verdes.

**Divergências/observações**: nenhuma estrutural — RPCs seguem `obter_execucoes_cron` (`099:172-211`) e consomem a interface da Fase 1 sem alteração (`fase-1-tasks.md:65-95`).

### Task 3 — Regeneração de `src/lib/database.types.ts` (as RPCs serão consumidas na Fase 8)

**Arquivos a tocar**: `src/lib/database.types.ts` (só regeneração, sem edição manual).
**Comando exato** (Git Bash — cuidado de encoding da Fase 1, `fase-1-tasks.md:170-172`):

```
npx supabase gen types typescript --project-id jtavmrlllyctkuxefhpc > src/lib/database.types.ts
```

**Momento certo**: DEPOIS do `db push` das Tasks 1–2 (schema remoto com as 3 funções). Commit próprio (diff grande, revisável isoladamente).

**Validação da task**:

1. `grep -c "disparar_importacao_clipes" src/lib/database.types.ts` ≥ 1 e presença de `obter_importacoes_clipes`/`obter_falhas_recentes_clipes` em `Functions`.
2. Cabeçalho do arquivo intacto (`export type Json = ...`) e objetos anteriores (`cron_execucoes`, `clipes`, `clipes_importacoes`) preservados.
3. `npm run build` e `npm run lint` passam (`src/lib/supabase.ts:2,11` consome o `Database` gerado; nenhuma chamada nova em `src/` ainda — o consumidor é a Fase 8).

**Divergências/observações**: nenhuma — mesmo procedimento da Task 3 da Fase 1 (`fase-1-tasks.md:154-172`).

## 5. Validação manual da fase (checklist para o dono)

- [ ] Migrations 114 e 115 aplicadas (`npx supabase db push` sem erro).
- [ ] RPC de disparo com **não-admin** → exceção "Acesso restrito a administradores."; nenhuma run criada.
- [ ] RPC de disparo com **admin real** → `true`; run `workflow_dispatch` visível na aba Actions do GitHub com a data passada no input.
- [ ] `cron_execucoes` tem linha `job_nome='disparar_importacao_clipes'`, `status_code=204`, `sucesso=true` (transporte).
- [ ] `clipes_importacoes` ganha/reativa a linha da data disparada com `origem='manual'` (gravada pela Action, alguns segundos após a run iniciar).
- [ ] Repetir o disparo da mesma data → a Action reusa a linha ativa do ledger (sem duplicata — idempotência da Fase 2); `cron_execucoes` acumula um registro por tentativa (histórico de transporte — comportamento esperado).
- [ ] Consultas: `obter_importacoes_clipes` com admin lista o histórico; `obter_falhas_recentes_clipes` vazio sem falhas e com `[]`/linhas coerentes quando há `falha`/`sem_clipes` na janela; não-admin recebe exceção nas duas.
- [ ] `database.types.ts` contém as 3 funções; `npm run build`/`npm run lint` passam.
- [ ] Nenhum valor de PAT em log, diff ou migration (RNF02); `git log` da fase com 3 commits, cada um revertível isoladamente.

## 6. Fora de escopo da fase

- Qualquer UI — form de disparo, histórico e aviso de falhas são a Fase 8 (`breakdown.md:152`); nenhuma função nova em `src/lib/` nesta fase (a `lib/clipes.ts` com funções admin nasce lá).
- Leitura de `cron_execucoes` pelo novo painel (P10 — permanece ledger de transporte; já legível via `obter_execucoes_cron`, `099:172-211`, se necessário).
- Gravação de `clipes_importacoes` pela RPC (a Action é a escritora — seção 8.3).
- Push de aviso de falha (RF07 já coberto pela Fase 5; o aviso **no painel** usa `obter_falhas_recentes_clipes` na Fase 8).
- Variação do `horario`/`partida_id` do dispatch (inputs existem no workflow; sem parâmetro na RPC — YAGNI).

## 7. Riscos e rollback

- **Cada task é 1 commit, revertível por `git revert` isolado** (AGENTS.md).
- **Risco principal (breakdown `:135`): PAT com escopo excessivo ou exposto**. Mitigações: PAT fine-grained limitado ao repo `rdias612/racha` com **só `actions:write`** (cadência da Fase 2 Task 4, `fase-2-tasks.md:276`); secret só no Vault (nunca em migration/diff); na RPC ele só vira header — `disparar_e_registrar_cron_http` persiste em `cron_execucoes` apenas status/corpo de resposta/erro (`099:140-155`) e o corpo de sucesso do dispatch é 204 vazio; nenhuma tabela nova expõe headers. Validado pelo item "sem PAT em log/diff" do checklist.
- **Workflow inexistente na ref** (Fase 2 não aplicada ou arquivo fora da `main`): GitHub responde **422**; `disparar_e_registrar_cron_http` registra `sucesso=false` + erro em `cron_execucoes` e a RPC ainda retorna `true` (padrão `PERFORM`). Detecção: linha vermelha no transporte + run ausente no GitHub. Pré-condição da fase cobre; se ocorrer, corrigir a Fase 2, não esta RPC.
- **PAT inválido/expirado**: GitHub responde 401 — mesmo caminho do item anterior (`cron_execucoes` com `erro`); rotação do secret no Vault (`vault.update_secret`) sem mudança de código.
- **Dispatch bem-sucedido com run que falha depois** (ex.: Filma Eu fora): a RPC reporta sucesso de **transporte** (204) — o desfecho real só aparece em `clipes_importacoes` (`status='falha'`) e nos pushs da Fase 5. Documentado no retorno `boolean` (seção 4, Task 1); a Fase 8 usa o ledger, não o retorno do disparo.
- **Rollback das migrations** (repo não usa down migrations — padrão da seção 8 da Fase 1):
  ```sql
  -- 114
  DROP FUNCTION IF EXISTS disparar_importacao_clipes(bigint, date);
  -- 115
  DROP FUNCTION IF EXISTS obter_falhas_recentes_clipes(bigint, integer);
  DROP FUNCTION IF EXISTS obter_importacoes_clipes(bigint, integer);
  ```
  Nenhum dado é criado por estas RPCs (o ledger é da Action); reverter `database.types.ts` é o `git revert` da Task 3.

## 8. Divergências e observações (vs fases anteriores e código)

1. **Leitura do Vault: leitura direta `vault.decrypted_secrets` (padrão `099:242-245`), NÃO via `obter_segredo_vault` (migration 111)**. A nova RPC é SECURITY DEFINER e roda como o dono (postgres, via `db push`), então tecmente ambos os caminhos funcionam; escolheu-se a leitura direta porque: (a) é o padrão já estabelecido para RPCs SECURITY DEFINER que precisam de segredo (`099:242-245`, `288`, `406`, `469`, `552`); (b) `obter_segredo_vault` tem EXECUTE revogado de todos e concedido **só à `service_role`** (`fase-2-tasks.md:76-78`) — consumi-la de dentro de outra RPC criaria dependência de cadeia de grants (frágil se alguém apertar aquele grant) sem ganho algum (o canal `obter_segredo_vault` existe para a **Action**, fora do banco). Zero impacto na migration 111 — intocada.
2. **Owner/repo e ref fixados na RPC**: `rdias612/racha` / `main` (conferidos agora: `git remote -v` → `https://github.com/rdias612/racha.git`; `git branch --show-current` → `main`) — o dono mencionou GitHub e **existe remote**, então não é preciso "dado a preencher" em `docs/configuracao-clipes-action.md`; a URL fica fixa no SQL com comentário, precedentes de URL hardcoded em RPC: `099:260`, `099:305`, `099:487`. Se o repo mudar de nome/dono, é 1 linha de migration corretiva. Alternativa (owner/repo em `notificacoes_config`) rejeitada: config para valor que nunca muda é especulação (YAGNI).
3. **A RPC de disparo NÃO grava em `clipes_importacoes`** — resolve a lacuna 10 do breakdown pelo caminho do P10: `cron_execucoes` = transporte (1 linha por tentativa), `clipes_importacoes` = desfecho da importação (1 linha ativa por data/partida, com idempotência própria da Action). Gravar "dispatch solicitado" no ledger da feature criaria estado (`iniciado` sem executor, se a run nunca iniciar) e duplicaria a contabilidade que a Action já mantém. O requisito RF08 ("cada importação ... registrada") continua atendido pela Action, que já marca `origem='manual'` no `workflow_dispatch` (`fase-2-tasks.md:193-206`).
4. **`obter_falhas_recentes_clipes` inclui `'sem_clipes'`** além de `'falha'` (justificado na Task 2): semântica da Fase 3/5 trata ambos como alerta RF07. Se a revisão preferir estritamente `status = 'falha'`, é 1 linha no WHERE — sem mudança de assinatura.
5. **Tipos do retorno das consultas**: `data_referencia date` e demais colunas tipadas 1:1 com a Fase 1 (`fase-1-tasks.md:65-83`) — a Fase 8 consumirá via types gerados (Task 3), com cast de narrowing só se algum campo gerado se mostrar impreciso (padrão `notificacoes.ts:149-151`).
6. **Numeração 114/115**: acompanha 109–113 das fases anteriores, com a mesma ressalva de colisão da 109 (`docs/plano-escolha-times-realtime.md:560`); se deslocar, renomear só os arquivos.
7. **Interfaces das Fases 1–5 consumidas sem incompatibilidade**: workflow com inputs `data`/`horario` (`fase-2-tasks.md:325-338`), secret `github_pat_clipes` (`fase-2-tasks.md:276`), grants/sCOLunas do ledger (`fase-1-tasks.md:86-95`), gate `is_admin` (`099:232-235`), pipeline pg_net (`099:34-167`). **Nenhuma divergence bloqueante.**

## 9. Critérios de encerramento (do breakdown `:136`, refinados)

1. **Chamada da RPC com admin real dispara a run** (visível na aba Actions do GitHub, evento `workflow_dispatch`, com a data passada).
2. **Não-admin recebe exceção** ("Acesso restrito a administradores.") nas 3 RPCs, sem efeito colateral.
3. **Execução registrada**: `cron_execucoes` com o transporte (`status_code 204`/sucesso — P10) e `clipes_importacoes` com a linha da importação (`origem='manual'`, status coerente) gravada pela Action.
4. **Consultas do painel funcionando**: histórico ordenado com clamp de limite; falhas recentes filtradas por janela com default 48h.
5. **Types regenerados e build passa**: `database.types.ts` com as 3 funções; `npm run build`/`npm run lint` verdes; 3 commits revertíveis; checklist da seção 5 completo; nenhum segredo em diff/log.

## 10. NEEDS_CONTEXT

Nenhum. (P1 e P10 — as únicas decisões da fase no breakdown `:130-132` — foram fechadas pelo orquestrador em `breakdown.md:183,192` e dirigem exatamente o desenho acima: RPC SECURITY DEFINER + pg_net no padrão `disparar_confirmacao_manual`, painel só em `clipes_importacoes`. As escolhas locais — leitura direta do Vault, owner/repo fixado, RPC sem `p_partida_id`/`p_horario`, duas RPCs de consulta, `'sem_clipes'` no filtro de falhas — estão justificadas nas seções 4 e 8 e nenhuma é estrutural nem irreversível.)
