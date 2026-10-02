# 35 · Fase 2 — Segredos + Action: workflow base com partida alvo e ledger — Registro de Execução e Validação

> Registro da execução da [fase-2-tasks.md](../35-fases/fase-2-tasks.md) do plano 35 em 2026-10-02, na branch `main`, no fluxo de três agentes: **executor**, **auditor** (read-only) e **corretor** (acionado por 1 achado Important). Veredito da auditoria: **APROVADO COM RESSALVAS** (A1 Important corrigido pelo corretor; A2/A3 Minor deferidos).

## 1. Execução

- **5 commits** (1 por task; nada pushed pelos agentes):
  - `fe5c8bc` — migration `111_rpc_obter_segredo_vault.sql`: RPC SECURITY DEFINER (`STABLE`, `search_path = public, vault`), genérica por nome, retornando null para segredo inexistente; `REVOKE` de PUBLIC/anon/authenticated + `GRANT EXECUTE` só à `service_role`. **Aplicada no remoto** (`db push`; `migration list` local=remoto=111).
  - `cec731b` — `scripts/clipes/` com `package.json` próprio (supabase-js `^2.112.2`, mesma versão da raiz), lockfile commitado, `.gitignore` local.
  - `d95b6e8` — `scripts/clipes/importar-clipes.mjs`: workflow base completo — `resolverDataAlvo` (última quinta estritamente anterior em BRT), `calcularFaixaDataBRT` (offset fixo -03:00), `buscarPartidaAlvo` (partida_id precede; faixa + `status IN ('published','closed')`, P7), `abrirRegistroImportacao` (idempotência: UPDATE do registro ativo por `data_referencia`+`partida_id`, INSERT senão; `falha` antigas não bloqueiam), `validarSegredoFilmaEu` (só existência — RNF02), `fecharRegistroImportacao`, `registrarFalhaSemPartida`, `main` (exit 1 = infra; exit 0 + ledger `falha` = partida ausente).
  - `3eba2d0` — `docs/configuracao-clipes-action.md`: cadência manual dos secrets (Vault: `filmaeu_credenciais`, `github_pat_clipes`; GitHub Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) + regra de log. Sem nenhum valor real.
  - `9cf86f6` — `.github/workflows/clipes-filmaeu.yml`: cron `0 12 * * 5` (sexta 09:00 BRT, P8), `workflow_dispatch` com inputs `data`/`horario`/`partida_id`, `permissions: contents: read`, `concurrency` (sem cancel), timeout 10min, secrets só via `env:`.
- **Validações do executor**: RPC com anon key → HTTP 401 (EXECUTE negado); `npm ci --prefix scripts/clipes` reprodutível; `node --check` ok; grep confirma nenhum log de segredo; `npm run build`/`lint` da raiz exit 0.

## 2. Auditoria (aprovado com ressalvas)

- Spec S1–S6 toda ✅ (migration exata ao esboço e aplicada; datas BRT corretas em casos de borda — sexta/quin dominance, virada de mês; idempotência cobre `partida_id IS NULL`; RNF02 respeitado em script e YAML; 5 commits limpos, nada pushed, `src/` intocado, types não regenerados).
- **A1 (Important, corrigido)**: dependência espúria `"racha-gragoata-cbo": "file:../.."` em `scripts/clipes/package.json` (não prevista na spec; acoplava o lockfile da Action ao manifesto do PWA). **Corretor**: commit `49096f1` — linha removida, lockfile regenerado do zero (remoção de `node_modules` + lockfile antes do `npm install` foi necessária; o npm mantinha o pacote raiz como `extraneous`), `grep racha-gragoata-cbo` = 0 ocorrências, `npm ci` (9 pacotes), `node --check`, build e lint todos exit 0.
- **A2/A3 (Minor, deferidos — decisão do orquestrador, sem ação)**: A2 — `resolverConfig`/`resolverDataAlvo` fora do `try` de `main`: input `data` inválido derruba a run com stack bruto (exit 1 sem linha de ledger); defensável segundo o auditor (erro de operador). A3 — se `fecharRegistroImportacao` no `catch` lançar, exceção fica não tratada (ledger pode ficar `iniciado`); probabilidade baixa.
- `npm ci` em ambiente limpo pelo auditor: só 10 pacotes (árvore supabase-js), sem deps da raiz.

## 3. Observações operacionais

- Nenhum segredo real foi criado ou manipulado por agentes (a cadência é manual e é do dono).
- Anomalia de ambiente registrada pelo corretor: escritas de arquivo em `scripts/clipes/` revertiam entre comandos; contornado via bash + verificação com `node -p`; estado final confirmado estável e commitado.

## 4. Pendente de validação humana (dono)

- [ ] Criar secrets no Vault (SQL Editor): `filmaeu_credenciais` (JSON `{"usuario":"...","senha":"..."}`) e `github_pat_clipes` (PAT fine-grained, só `actions:write`) — instruções em `docs/configuracao-clipes-action.md`.
- [ ] Criar GitHub Secrets: `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] Validar a RPC com service_role: `POST /rest/v1/rpc/obter_segredo_vault` com nome inexistente → 200 `null` (com anon key já está validado o bloqueio 401).
- [ ] Push dos 6 commits da fase → aba "Actions" lista o workflow; rodar `workflow_dispatch` com data de partida real → run verde.
- [ ] Ledger via service_role: linha com `origem: manual`, `status: concluido`, `sucesso: true`, `quantidade_clipes: 0`.
- [ ] Idempotência: reexecutar com a mesma data → UMA linha ativa (UPDATE, sem duplicata).
- [ ] Log da run sem nenhum segredo.
- [ ] Confirmar horário P8: quando os clipes de quinta aparecem no filmaeu — ajuste de 1 linha no YAML se 09:00 BRT for cedo demais.
