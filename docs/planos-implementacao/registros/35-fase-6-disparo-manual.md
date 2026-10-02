# 35 · Fase 6 — Disparo manual pelo app (RF03/RF08, backend) — Registro de Execução e Validação

> Registro da execução da [fase-6-tasks.md](../35-fases/fase-6-tasks.md) do plano 35 em 02/10/2026, na branch `main`, no fluxo de três agentes: **executor** e **auditor** (read-only) — **sem corretor** (auditoria APROVADA, zero achados de código). Renumeração aplicada: spec falava em migrations 114/115, mas a 114 foi ocupada pela corretiva da Fase 5 → **115/116** (regra da própria spec, seção 8.6).

## 1. Execução

- **3 commits** (1 por task; `7044bd0` → `9ccad2c`):
  - `7044bd0` — migration `115_rpc_disparar_importacao_clipes.sql`: RPC `disparar_importacao_clipes(p_admin_id, p_data)` — gate `is_admin` (padrão `099:232-235`), validação de data não-futura em BRT, leitura DIRETA de `vault.decrypted_secrets` (decisão 8.1 — sem depender do grant da `obter_segredo_vault`, que é canal da Action), PAT só no header, `PERFORM disparar_e_registrar_cron_http` com URL fixa da GitHub API (`repos/rdias612/racha/.../clipes-filmaeu.yml/dispatches`, inputs `data`+`horario: '19:00'`), `RETURN true` (sucesso de TRANSPORTE, não de importação). **Não grava em `clipes_importacoes`** (P10/8.3 — a Action é a única escritora do ledger da feature). + 1 linha em `docs/configuracao-clipes-action.md`.
  - `822fe24` — migration `116_rpc_consulta_importacoes_clipes.sql`: `obter_importacoes_clipes(p_admin_id, p_limite DEFAULT 50)` (histórico, clamp 1–200) e `obter_falhas_recentes_clipes(p_admin_id, p_horas DEFAULT 48)` (janela 1–720h, inclui `'sem_clipes'` como alerta RF07); `RETURNS TABLE` tipado 1:1 com a Fase 1; grants amplos + gate interno (padrão `099:584`).
  - `9ccad2c` — `src/lib/database.types.ts` regenerado (Git Bash): 3 funções novas presentes, diff 100% adições (objetos antigos preservados).
- **Validações do executor**: migrations local=remoto (até 116); gate `is_admin` provado por curl/anon key nas 3 RPCs; build/lint exit 0; nenhum valor de PAT em diff/migration (só o nome do secret).

## 2. Correção vs esboço da spec (feita pelo executor, validada pela auditoria)

**Gate da 116 com coluna ambígua (42702)**: o esboço SQL da spec usava `WHERE id = p_admin_id` dentro de uma função com `RETURNS TABLE (id, partida_id, ...)` — as colunas OUT colidem com as da tabela e o Postgres rejeita em runtime (`42702 column reference "id" is ambiguous`), provado por curl antes do commit. Correção: `WHERE jogadores.id = p_admin_id`, padrão já estabelecido no repo (lição documentada nas migrations **104** e **106**; o próprio molde `099` já tinha sido corrigido assim). A 115 não precisava (retorna `boolean`, sem OUT params) — também provado por curl. Documentado no cabeçalho dos arquivos.

## 3. Auditoria (aprovado)

- S1–S4 ✅ (comparação bloco a bloco com os esboços; correção da 116 conferida contra o precedente 104/106).
- Q1: os 3 curls de gate com anon key reproduzidos pelo auditor (id inexistente) → `P0001 "Acesso restrito a administradores."` nas três RPCs — sem 42702, sem vazamento.
- Q2 (segurança do PAT — risco principal da fase): gate ANTES da leitura do secret/chamada externa; PAT só no header; pipeline `099:140-155` persiste só status/corpo/erro (dispatch da GitHub = 204 sem corpo); diff sem segredos.
- Q5: build/lint exit 0 reexecutados; `migration list` 115/116 local=remoto.
- **Achados**: zero Critical/Important. Dois Minor informativos (estacionados, sem ação): **M1** — relatório do executor não listou `obter_segredo_vault` entre as funções adicionadas ao types pela regeneração (falta da Fase 2; inofensivo, o schema remoto real agora refletido); **M2** — estado de push divergente do relatório (`origin/main == 9ccad2c` no momento da auditoria — push paralelo do dono, anotado).

## 4. Observações operacionais

- Terceira fase consecutiva em que o dono empurra commits durante/antes da auditoria — o relatório do executor dizia "sem push". Anotação de processo: nada empurrado pelos agentes.
- O frontend desta fase é zero por desenho (os consumidores das 3 RPCs nascem na Fase 8, em `src/lib/clipes.ts`).

## 5. Pendente de validação humana (dono)

- [ ] **`github_pat_clipes` criado no Vault** (PAT fine-grained, só este repo, só `actions:write` — cadência em `docs/configuracao-clipes-action.md`).
- [ ] **Disparo com admin real**: RPC com `p_admin_id` de admin e `p_data` de uma partida publicada/fechada → `true`; run `workflow_dispatch` visível na aba Actions do GitHub.
- [ ] Transporte: linha em `cron_execucoes` (`job_nome='disparar_importacao_clipes'`, `status_code=204`, `sucesso=true`).
- [ ] Desfecho: linha em `clipes_importacoes` com `origem='manual'` (gravada pela Action segundos depois da run iniciar).
- [ ] Repetir o disparo da mesma data → ledger reusado sem duplicata; `cron_execucoes` acumula uma linha por tentativa (esperado).
- [ ] Consultas com admin real: histórico ordenado com clamp; falhas recentes vazias sem falhas e coerentes quando há `falha`/`sem_clipes`.
- [ ] Gate com **não-admin real** (a auditoria validou com id inexistente — mesmo caminho de código).
- [ ] PAT sem escopo além de `actions:write`; nenhum PAT em log/diff.
