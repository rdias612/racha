# 37 · Correção da importação de clipes em produção — Plano de Implementação

> Ref.: diagnóstico de **03/10/2026** da falha da Action "Clipes Filma Eu" disparada de `/clipes/admin` (run vermelha com `falha: [object Object]` + aviso `notificar-clipes HTTP 401`) · Precedentes de domínio: [plano 35](35-clipes-filmaeu.md) (feature) e [plano 36](36-repositorio-exclusao-clipes.md) (repositório) · Fora do ranking anti-slop (bugfix de produção)
> Esforço estimado: **S** (3 passos) · Risco: **baixo** (grant a role interna + config de deploy + log; nenhum dado migrado ou destruído) · Prioridade: **P0** — a importação de clipes está 100% quebrada em produção (2 runs falhas no ledger, ids 1 e 2)

## 1. Objetivo

Restaurar a importação de clipes via GitHub Action. O diagnóstico apurou **duas causas raiz independentes**, ambas confirmadas com evidência direta em produção (MCP Supabase, projeto `jtavmrlllyctkuxefhpc`):

1. **`service_role` não tem `SELECT` nem `INSERT` na tabela `clipes`** — a primeira query da importação (`caminhosExistentes`) falha com permission denied (42501 do PostgREST) e derruba a run.
2. **Edge Function `notificar-clipes` deployada com `verify_jwt=true`** — o gateway da Supabase rejeita a chamada da Action (que só envia `x-push-cron-secret`, sem `Authorization`) com HTTP 401 antes de o código da função rodar. Hoje é aviso best-effort, mas bloqueia todo o push de resultado (RF06/RF07 do plano 35).

Este plano também corrige a **legibilidade do erro** (`[object Object]` no log e no ledger) para que a próxima falha real deixe rastro utilizável.

## 2. Estado atual (evidências verificadas)

Verificado em **03/10/2026** (HEAD `f408eb6`), com queries direto da produção:

- **Grants em produção** (`has_table_privilege`): `service_role` em `clipes` → SELECT **false**, INSERT **false**, DELETE **true**; em `clipes_importacoes` → SELECT **true**. Por isso a run passa por `partidas` e pelo ledger e morre exatamente na primeira query de `clipes` — no log da run falta justamente a linha `[clipes] N clipe(s) já registrados na tabela...` (`scripts/clipes/importar-clipes.mjs:222`), que viria logo após `caminhosExistentes` (`scripts/clipes/armazenamento.mjs:22-26`).
- **Origem da grant faltante**: a migration 109 (`supabase/migrations/109_clipes_tabelas.sql:48-49`) concede SELECT em `clipes` a `anon`/`authenticated` e ao `service_role` só o GRANT de *sequence*; a 112 (`112_grant_delete_clipes.sql:9`) completa apenas DELETE, assumindo default privileges da plataforma que não se concretizaram neste banco (o próprio comentário da 112 registra a aposta).
- **Ledger**: `clipes_importacoes` ids 1 e 2 (partida 40, `data_referencia` 2026-10-01, 03/10 00:19 e 00:21 UTC) com `status='falha'` e `erro='[object Object]'`.
- **`verify_jwt` em produção** (`list_edge_functions`): `notificar-clipes` = **true** (v1); irmãs `send-confirmation-requests`, `send-test-push`, `send-voting-reminders` = **false**. A Action chama a função sem `Authorization` (`scripts/clipes/notificacoes.mjs:43-51`) → 401 do gateway, antes da validação do secret (`supabase/functions/notificar-clipes/index.ts:146-148`). Nota: `supabase/functions/admin-excluir-clipes/index.ts:19` cita `notificar-clipes` como "precedente de `--no-verify-jwt`" — **premissa falsa em produção** até este plano corrigi-la.
- **`falha: [object Object]`**: o catch principal (`scripts/clipes/importar-clipes.mjs:362`) só extrai `.message` de `instanceof Error`; o erro do supabase-js (`PostgrestError`) é objeto plano `{message, code, details, hint}` → `String(erro)` = `[object Object]`, que é o que vai para o log e para a coluna `erro` do ledger.
- **Efeito colateral da grant faltante além da Action**: `notificar-clipes` também lê `clipes` com service key (count para o título do push, `index.ts:192-196`) — mesmo resolvido o 401, falharia com 500 sem este plano.

## 3. Pré-condições e dependências

- Planos 35 e 36 já aplicados (tabelas, bucket, Action, painel, repositório) — são o estado vigente.
- **Aplicação da migration 118 em produção** (pelo agente via MCP `apply_migration` com aprovação, ou SQL Editor pelo dono). Verificar com `has_table_privilege` após aplicar.
- **Redeploy de `notificar-clipes`**: pelo agente via MCP (`deploy_edge_function` com `verify_jwt=false`) ou pelo dono via CLI (`npx supabase functions deploy notificar-clipes --no-verify-jwt`).
- Os passos 1 e 2 são **independentes entre si** (um não depende do outro); o passo 3 é independente dos dois.
- Janela: sem restrição (não toca no ciclo de partida; a Action tem concurrency própria `clipes-filmaeu`).

## 4. Plano de execução (1 passo = 1 commit)

- [ ] **Passo 1 — Migration 118: grants de SELECT/INSERT** · arquivo `supabase/migrations/118_grant_select_insert_clipes.sql`, conteúdo:
  ```sql
  -- 118_grant_select_insert_clipes.sql
  -- Correção do plano 37: a 109 concedeu SELECT em clipes a anon/authenticated e só a
  -- sequence ao service_role; a 112 completou apenas DELETE. Sem SELECT/INSERT, a
  -- GitHub Action (service key) falha com 42501 na primeira query (caminhosExistentes)
  -- e o notificar-clipes falha no count do título do push. UPDATE não é concedido: a
  -- Action nunca atualiza linhas de clipes (ler/gravar/deletar apenas). Padrão de
  -- grants explícitos: 016, 099:582-587, 109:48-55, 112:9. GRANT é idempotente.
  GRANT SELECT, INSERT ON clipes TO service_role;
  ```
  Aplicar em produção e confirmar `has_table_privilege('service_role','clipes','SELECT'/'INSERT')` = true.
- [ ] **Passo 2 — Redeploy de `notificar-clipes` com `verify_jwt=false`** (sem mudança de código; é configuração de deploy, alinhando com as três irmãs de push). No mesmo commit, corrigir o comentário de precedente em `supabase/functions/admin-excluir-clipes/index.ts:19-22` para refletir o estado real pós-fix (a função irmã agora efetivamente roda sem verify_jwt). Verificar via API que `notificar-clipes` ficou `verify_jwt=false`.
- [ ] **Passo 3 — Mensagem de erro legível no catch principal** · `scripts/clipes/importar-clipes.mjs:362`: extrair `.message` também de erros de objeto plano do supabase-js (PostgrestError/StorageError), mantendo fallback:
  ```js
  const mensagem =
    erro instanceof Error ? erro.message
    : erro && typeof erro === 'object' && typeof erro.message === 'string' ? erro.message
    : String(erro);
  ```
  Isso alimenta o `console.error` e a coluna `erro` do ledger — a próxima falha real registrarão `permission denied for table clipes` em vez de `[object Object]`. Escopo restrito ao catch principal (os avisos best-effort de `notificacoes.mjs` seguem como estão).

## 5. Validação manual (dono)

Sem testes automáticos (AGENTS.md). Após os 3 passos:

- [ ] Rodar a Action de novo pela tela `/clipes/admin` (botão de disparo): run **verde**, com as linhas `[clipes] N clipe(s) já registrados...` → download → `[clipes] ledger ... fechado como 'concluido'` e `[clipes] notificação: resultado=concluido targets=N claimed=M` (confirma 401 resolvido).
- [ ] Aba **Repositório** em `/clipes/admin/repositorio`: partida de 01/10 com os clipes importados; visível também no app (`/partida/40`).
- [ ] Push recebido no aparelho ("⚽ Clipes da partida disponíveis").
- [ ] **Reexecutar** a Action na mesma data (idempotência RF02): 0 downloads novos, ledger segue `concluido`, push não duplicado (claims).
- [ ] SQL pós-migration: `select has_table_privilege('service_role','clipes','SELECT'), has_table_privilege('service_role','clipes','INSERT');` → ambos `true`.

## 6. Fora de escopo

- **`GRANT UPDATE`** em `clipes` — nenhum fluxo atualiza linhas (ler/gravar/deletar); conceder "por via das dúvidas" contraria o padrão de grants mínimos do repo.
- **RLS em `clipes`** — a tabela segue o modelo sem RLS do plano 35 (leitura pública, escrita só service); revisitar é decisão de outro escopo.
- **Reescrever o ledger antigo** (ids 1 e 2 com `erro='[object Object]'`) — histórico legítimo de tentativa; o painel segue mostrando as falhas reais.
- **Mudanças na automação do Filma Eu** (seletores, login, download) e no mecanismo de push/claims — intocados.
- **`notificacoes.mjs`** (logs best-effort) — não fazem parte do caminho que derruba a run.

## 7. Riscos e rollback

- **Grant a `service_role`**: risco baixo — a service key existe apenas nos GitHub Secrets e nas envs das Edge Functions; a tabela já é publicamente legível (SELECT a anon), então o grant não amplia exposição, só habilita quem já era o escritor previsto pela Fase 1 do plano 35. Rollback: `REVOKE SELECT, INSERT ON clipes FROM service_role;` em migration revertível (`git revert` do passo 1 + REVOKE).
- **`verify_jwt=false`**: a função mantém gate próprio (`x-push-cron-secret` → 401) e validação de payload (400), idêntico ao modelo das três irmãs em produção. Rollback: redeploy com `verify_jwt=true`.
- **Passo 3** (só log): risco nulo; `git revert` limpo.
- Os três passos são revertíveis isoladamente por `git revert` (a migration exige o REVOKE complementar em produção, anotado acima).
