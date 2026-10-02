# 35 · Fase 4 — Action: limpeza por retenção (RF09) — Registro de Execução e Validação

> Registro da execução da [fase-4-tasks.md](../35-fases/fase-4-tasks.md) do plano 35 em 02/10/2026, na branch `main`, no fluxo de três agentes: **executor**, **auditor** (read-only) e **corretor** (acionado por 1 achado Minor). Veredito da auditoria: **APROVADO** (zero Critical/Important; 1 Minor corrigido).

## 1. Execução

- **4 commits** (1 por task; nada pushed pelos agentes até a auditoria):
  - `1b52c66` — migration `112_grant_delete_clipes.sql`: `GRANT DELETE ON clipes TO service_role` (1 linha idempotente — lacuna real da interface da Fase 1 para a limpeza; grants explícitos são o padrão do repo). **Aplicada no remoto** (`migration list` local=remoto=112).
  - `46a0aec` — `scripts/clipes/retencao.mjs`: `resolverLimiteBytes` (vazio→800 MB; inválido→throw), `carregarGruposPorPartida` (SELECT + agregação em Node; `size_bytes` NULL=0 com aviso), `registrarLimpezaNoLedger` (status `'limpeza'`, origem da RUN, `data_referencia` = dia BRT do jogo deletado), `deletarPartida` (ordem crítica: Storage list+remove → DELETE de linhas → ledger por último; 'Not Found' tolerado; outro erro aborta ANTES de tocar a tabela), `limparPorRetencao` (proteção absoluta de `partidaAtualId`, guarda anti-loop, alvo menor `data_jogo` com desempate por `partida_id`).
  - `d96bd7c` — integração no `importar-clipes.mjs`: passo 5.6 — limpeza SOMENTE no ramo `concluido` (`sem_clipes`/`falha` não disparam — leitura estrita do RF09 "importação bem-sucedida"); `resultado.limpeza = {deletadas, totalRestante}`; `detalhe` do ledger com resumo de 1 linha; falha na limpeza → ledger `'falha'` + exit 1 (falha alta e visível, sem silenciamento).
  - `17cad66` — YAML: input `limite_storage_mb` + `LIMITE_STORAGE_MB: ${{ inputs.limite_storage_mb || vars.LIMITE_STORAGE_MB || '800' }}` (P11: precedência input > var > default); seção 4 em `docs/configuracao-clipes-action.md` (limite de retenção, aba Variables).
- **Validações do executor**: `resolverLimiteBytes` via `node -e` ('50'→52428800; ausente→838860800; 'abc'/'-1'/'0'→throw); `node --check` nos 2 .mjs; build/lint da raiz exit 0; zero leitura de `metadata.size` do Storage (P12); lockfile sem contaminação.

## 2. Auditoria (aprovado)

- S1–S5 toda ✅. Trace dos cenários do RF09 no código real: (a) semente antiga deletada antes da atual por `data_jogo`, a atual jamais candidata; (b) partida atual sozinha acima do limite → guarda dispara, nada deletado, run segue; (c) total == limite → nada deletado (`>` estrito — "exceder" da spec); (d) empate de `data_jogo` → desempate determinístico; (e) loop termina por construção. Falha parcial: Storage falha → linhas intactas e partida continua candidata; Storage ok + DELETE falha → reexecução segura (list vazio, remove tolera 'Not Found', DELETE reexecutado). Todos os 4 erros supabase-js checados. P11 correto no YAML (string vazia falsy encadeia até '800'; `schedule` não tem input).
- **M1 (Minor, corrigido pelo corretor)** — commit `89a6edd`: doc dizia "número inteiro de MB" mas `Number()` aceita decimais — doc ajustado para "número de MB (decimais aceitos; <= 0 ou não numérico falha a run)". Build/lint exit 0.
- Divergências do executor vs esboço, aceitas pelo auditor: `sortBy: null` omitido (opcional); `totalApos` encadeado via opções para o `detalhe` (o esboço pedia o valor sem forma de obtê-lo); MB com 1 casa decimal nos logs.

## 3. Observações operacionais

- Nesta fase o dono NÃO tinha feito push paralelo durante a execução (diferente da Fase 3) — os 5 commits estavam apenas locais ao fim da auditoria.
- Nenhuma dependência nova; nenhum arquivo em `src/` ou `database.types.ts`.

## 4. Pendente de validação humana (dono)

- [ ] Push dos 5 commits da fase (`1b52c66`..`89a6edd`).
- [ ] DELETE via PostgREST: com service_role key → 204 em linha de teste; com anon key → erro de permissão (Task 1, validações 2–3).
- [ ] **Teste do RF09 com sementes de 50 MB** (seção 5 da spec — o coração): semear partida de fevereiro (~30 MB, upload de hoje) + opcional 09/02 (~40 MB), reimportar a data da Fase 3 com `limite_storage_mb: 50` → ledger com 2 entradas `limpeza` em ordem de `data_jogo` (fevereiro antes de 09/02, embora ambas criadas hoje), prefixos vazios no bucket, 0 linhas nas partidas deletadas, **recém-importada intacta**.
- [ ] Guarda anti-loop: só a partida atual existindo e acima de 50 MB → run verde, log da guarda, zero entradas `limpeza`.
- [ ] Dispatch sem input e sem var → log mostra 800 MB; criar a Variable `LIMITE_STORAGE_MB` no GitHub (opcional).
- [ ] Log da run sem segredos; limpeza das sementes de teste ao final (`DELETE FROM partidas WHERE id IN (id_a, id_b);` — CASCADE/SET NULL preservam coerência).
