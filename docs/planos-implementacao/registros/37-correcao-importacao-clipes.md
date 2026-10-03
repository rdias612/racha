# 37 · Correção da importação de clipes em produção — Registro de Execução e Validação

> Registro da execução do plano 37 em **03/10/2026**, na branch `main`. Bugfix de produção (fora do ranking anti-slop): duas causas raiz corrigidas direto na produção (grant + config de deploy) e uma melhoria de log no código. As alterações de produção foram aplicadas pelo executor via MCP Supabase no ato de cada passo.

## 1. Contexto

A Action "Clipes FilmaEu" disparada de `/clipes/admin` falhava 100% das vezes (ledger ids 1 e 2, `status='falha'`, `erro='[object Object]'`). Diagnóstico de 03/10/2026 (seção 2 do plano) apurou duas causas independentes, ambas confirmadas com query/API direto da produção antes da execução: `service_role` sem `SELECT`/`INSERT` em `clipes` (42501 na primeira query) e `notificar-clipes` deployada com `verify_jwt=true` (401 do gateway antes do gate próprio). Detalhe completo e evidências: [`37-correcao-importacao-clipes.md`](../37-correcao-importacao-clipes.md).

## 2. Implementação (1 passo = 1 commit)

- **Passo 1 — Migration 118: grants de SELECT/INSERT** · commit `3eb4997` · `fix: concede select e insert em clipes ao service_role (plano 37)`
  - `supabase/migrations/118_grant_select_insert_clipes.sql` (novo) com o SQL exato da seção 4 do plano — `GRANT SELECT, INSERT ON clipes TO service_role;` + comentário de justificativa (sem `UPDATE`, padrão de grants mínimos).
  - **Aplicado em produção** via MCP `apply_migration` (projeto `jtavmrlllyctkuxefhpc`, name `grant_select_insert_clipes`) — sucesso.
- **Passo 2 — Redeploy de `notificar-clipes` com `verify_jwt=false`** · commit `4e6e5b3` · `fix: redeploy de notificar-clipes sem verify_jwt e comentario de precedente (plano 37)`
  - Redeploy via MCP `deploy_edge_function` com o conteúdo atual do arquivo local (sem mudança de código — v2, ACTIVE, `verify_jwt=false`). Legítimo: a função tem gate próprio (`x-push-cron-secret` → 401, `index.ts:146-148`), idêntico ao modelo das três irmãs `send-*` que já rodavam com `verify_jwt=false`.
  - `supabase/functions/admin-excluir-clipes/index.ts` (editado) — comentário de precedente corrigido: citava `notificar-clipes` como precedente de `--no-verify-jwt` (premissa falsa em produção até este passo); agora cita as irmãs `send-*` e `notificar-clipes` como precedentes efetivos. Só o comentário mudou.
- **Passo 3 — Mensagem de erro legível no catch principal** · commit `13e220e` · `fix: mensagem de erro legivel no catch da importacao de clipes (plano 37)`
  - `scripts/clipes/importar-clipes.mjs` (catch principal, ~:362): extração de `.message` agora cobre erros de objeto plano do supabase-js (PostgrestError/StorageError), com fallback `String(erro)` — a próxima falha real registra `permission denied for table clipes` em vez de `[object Object]` no log e na coluna `erro` do ledger. Escopo restrito ao catch principal; `notificacoes.mjs` intocado.
  - Validado: `node --check` OK e `npm run build` verde (680ms, sem erros).
- **Documentação** (este commit) — este registro + linha do plano 37 no índice do `README.md` marcada como executada.

## 3. Confirmações de produção (executor, via MCP)

- **Grants** (`execute_sql`, após a migration): `has_table_privilege('service_role','clipes','SELECT')` = **true**, `('service_role','clipes','INSERT')` = **true**.
- **Deploy** (`list_edge_functions`, após o redeploy): `notificar-clipes` **v2, ACTIVE, `verify_jwt=false`**; irmãs `send-confirmation-requests`, `send-test-push`, `send-voting-reminders` seguem `false` (todas juntas agora, como previsto).
- Observação (pré-existente, fora do escopo): `admin-excluir-clipes` **não consta** nas funções do projeto — deploy pendente do dono, como já registrado no [plano 36](36-repositorio-exclusao-clipes.md).

## 4. Divergências plano × código real

1. **Arquivo do plano e linha do índice não commitados**: `37-correcao-importacao-clipes.md` (inédito no git) e a linha 37 do `README.md` (status "planejado") estavam no working tree sem commit, herança da fase de planejamento. Foram incluídos **sem alteração de conteúdo** neste commit de documentação, seguindo o precedente do plano 36 (commit `f408eb6` consolidou plano + registro + índice juntos).
2. **Comentário do passo 2** (`admin-excluir-clipes`): a reescrita ocupou 3 linhas em vez das 2 originais para citar as irmãs `send-*` além de `notificar-clipes` (o plano pedia apenas "refletir o estado real", exemplo sugeria exatamente essas referências).
3. **Comentário do passo 3**: acrescentadas 2 linhas de comentário acima da nova expressão (o snippet do plano trazia só a expressão) explicando por que objetos planos do supabase-js precisam do degrau extra — dentro do catch principal, escopo preservado.
4. Nenhuma divergência de conteúdo ou linha nos alvos principais: o catch estava em `importar-clipes.mjs:362` e o gate em `index.ts:146-148`, exatamente como referenciado no plano.

## 5. Validação

Validação do executor: `node --check` e `npm run build` (passo 3) + confirmações de produção da seção 3 (passos 1 e 2). O ciclo de auditoria read-only do processo padrão (README, etapa 2) não foi executado por este agente — se disparado a seguir, o veredito deve ser anexado aqui. Sem testes automáticos (AGENTS.md).

## 6. Pendente de validação humana (dono)

- [ ] Rodar a Action de novo pela tela `/clipes/admin` (botão de disparo): run **verde**, com as linhas `[clipes] N clipe(s) já registrados...` → download → `[clipes] ledger ... fechado como 'concluido'` e `[clipes] notificação: resultado=concluido targets=N claimed=M` (confirma 401 resolvido).
- [ ] Aba **Repositório** em `/clipes/admin/repositorio`: partida de 01/10 com os clipes importados; visível também no app (`/partida/40`).
- [ ] Push recebido no aparelho ("⚽ Clipes da partida disponíveis").
- [ ] **Reexecutar** a Action na mesma data (idempotência RF02): 0 downloads novos, ledger segue `concluido`, push não duplicado (claims).
- [ ] SQL pós-migration: `select has_table_privilege('service_role','clipes','SELECT'), has_table_privilege('service_role','clipes','INSERT');` → ambos `true` *(já confirmado pelo executor em 03/10/2026 — item fica para recheck do dono se desejado)*.
- [ ] Push dos commits do plano: `3eb4997` (passo 1), `4e6e5b3` (passo 2), `13e220e` (passo 3) e este (documentação).
