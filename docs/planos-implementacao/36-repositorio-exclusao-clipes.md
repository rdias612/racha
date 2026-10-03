# 36 · Repositório e exclusão manual de clipes — Plano de Implementação

> Ref.: `AGENTS.md` (passos pequenos, DRY com critério, validação manual) · Precedente de domínio: **plano 35** (`35-clipes-filmaeu.md`) — a exclusão manual de clipes ficou explicitamente de fora do escopo dele (§6 Fora de escopo) e este plano a entrega como complemento do painel `/clipes/admin` · Fora do ranking anti-slop (feature nova, como o 35)
> Esforço estimado: **M** (4 passos — **todos executados**, ver seção 4) · Risco: **destrutivo — mitigado** (exclusão permanente de objetos no bucket; gate server-side, validação de payload, diálogo de confirmação e ordem de deleção da retenção)

## 1. Objetivo

Dar ao admin visão do acervo de clipes por partida — aba **Repositório** em `/clipes/admin/repositorio`, ao lado da aba Importação existente — e permitir a **exclusão manual de 1 ou vários clipes** de uma partida (checkbox por clipe + exclusão em lote). A exclusão remove o objeto do bucket `clipes` no Storage, a linha na tabela `clipes` e grava entrada de limpeza (`origem='manual'`, `status='limpeza'`) no ledger `clipes_importacoes`, na mesma ordem de deleção da limpeza automática por retenção (RF09 do plano 35). Motivação: a retenção só apaga por `data_jogo` (partida mais antiga primeiro); a exclusão manual existe para corrigir importação errada com seleção fina.

## 2. Estado atual (evidências verificadas)

Verificado no código em **02/10/2026**, antes da execução (estado `a155911^`):

- **O painel `/clipes/admin` (fase 8 do plano 35) não listava clipes individuais** — só importações e falhas recentes: `ClipesAdmin.tsx` consumia `obterImportacoesClipes`/`obterFalhasRecentesClipes`, e `src/lib/clipes.ts` (`a155911^`) exportava apenas leitura/disparo (`carregarClipesDaPartida`, `obterUltimaPartidaComClipes`, `dispararImportacaoClipes`) — nenhuma função de exclusão nem listagem de partidas com clipes.
- **Grants da migration 109** (`supabase/migrations/109_clipes_tabelas.sql:48-55`): `clipes` com só `SELECT` a `anon`/`authenticated`; `clipes_importacoes` com `REVOKE ALL` a `anon`/`authenticated` e `SELECT/INSERT/UPDATE` só a `service_role`. O único `DELETE` explícito é o da migration 112 (`112_grant_delete_clipes.sql:12`), concedido a `service_role` — não há caminho de deleção pelo app sem privilégio elevado, logo a exclusão precisa de Edge Function com service key.
- **Ordem de deleção da retenção** (`scripts/clipes/retencao.mjs:89` — comentário "ORDEM IMPORTA: Storage primeiro, linhas depois, ledger por último"; remove do bucket `:111`; `delete` na tabela `:127-128`): exclusão que respeita essa ordem não deixa objeto órfão nem apaga linha antes de garantir o remove.
- **Edge functions existentes sem CORS** (`supabase/functions/notificar-clipes/`, `send-confirmation-requests/`, `send-test-push/`, `send-voting-reminders/` — zero ocorrências de `Access-Control-Allow`): todas são chamadas server→server (cron/GitHub Action) e dispensam preflight. A função nova seria a **primeira chamada DO BROWSER** via `supabase.functions.invoke` e precisa de CORS completo.
- **App sem JWT do Supabase** (login próprio): modelo de confiança da migration 066 (`066_rpc_excluir_partida.sql:34` — gate `is_admin` em `jogadores` validado server-side, a credencial vai no corpo da chamada); deploy de função com `--no-verify-jwt` tem precedente em `notificar-clipes`.

## 3. Pré-condições e dependências

- Plano 35 executado: tabelas `clipes`/`clipes_importacoes`, bucket `clipes`, ledger, painel `/clipes/admin` e `GradeClipesPartida` existem (registros `35-fase-1` a `35-fase-8`).
- **Deploy da edge function pelo dono**: `npx supabase functions deploy admin-excluir-clipes --no-verify-jwt` — pré-condição de qualquer E2E de exclusão (no repositório ela não existe no Supabase).
- **Nenhuma migration de banco**: reusa os grants da 109/112 (a função roda com service key) e os valores do CHECK já presentes na 109 (`origem='manual'`, `status='limpeza'`).
- Janela: exclusão é operação manual pontual do admin; sem restrição de partida ao vivo (não toca no ciclo de partida).

## 4. Plano de execução (1 passo = 1 commit) — como executado

Todos os passos executados e validados em 02/10/2026, no fluxo de três agentes (executor → revisor read-only → corretor/registrador); registros em `registros/36-passo-*.md`:

- [x] **Passo 1 — Edge Function `admin-excluir-clipes`** · commit `a155911` (registro: [36-passo-1-edge-function.md](registros/36-passo-1-edge-function.md); ressalva documentada `125bd8f`). POST com **CORS completo** (primeira função do projeto chamada do browser); **validação 400** (`admin_id` inteiro > 0, `clipes_ids` array 1–500, dedupe por `Set`); **gate de admin server-side** (`jogadores.is_admin` → 403, modelo 066); carga por `IN` com ids inexistentes ignorados (idempotência); **ordem de deleção da retenção** (Storage → linhas → ledger, 'Not Found' tolerado item a item); **ledger manual/limpeza por partida** em `clipes_importacoes`; resposta `{ excluidos, bytes_liberados }`.
- [x] **Passo 2 — Lib `clipes.ts`** · commit `7980edf` (registro: [36-passo-2-lib-clipes.md](registros/36-passo-2-lib-clipes.md); correção `ac4a016`). `obterPartidasComClipes()` (join sem filtro de status — admin enxerga tudo; dedupe por `partida_id` em JS) e `excluirClipes(adminId, ids)` (primeira chamada client-side de Edge Function do app; unwrap de `FunctionsHttpError` via `error.context.json()` para o snackbar mostrar a mensagem real da função; correção: mensagem de rede amigável para falha de conexão).
- [x] **Passo 3 — UI do Repositório** · commit `7a9247c` (registro: [36-passo-3-ui-repositorio.md](registros/36-passo-3-ui-repositorio.md); correções `603e669`). `AbasClipesAdmin` (NavLink com `end` na Importação — `/clipes/admin` é prefixo da rota do Repositório); `ClipesRepositorio` (guarda admin com redirecionamento, seleção em `Set` zerada na troca de partida, `BarraAcaoInferior` + `ConfirmDialog` `tomConfirmar="perigo"`, recarga pós-exclusão com partida esvaziada saindo do seletor); `GradeClipesPartida` com props opcionais de seleção (sem as props, DOM bit-a-bit igual — compatibilidade com os demais usos); rota lazy com prefetch específico antes da genérica + rota em `App.tsx`. Correções: refetch de clipes em erro de recarga, mensagem de vazio diferenciada e guarda `excluindo`.
- [x] **Passo 4 — Documentação** (este commit). Consolidação deste plano como executado, dois débitos em [34-debitos-registrados.md](34-debitos-registrados.md) (Passos 6 e 7), linha no índice do [README.md](README.md) e registro [36-passo-4-documentacao.md](registros/36-passo-4-documentacao.md).

## 5. Validação manual (dono)

Sem testes automáticos (AGENTS.md). Checklist E2E no dispositivo:

- [ ] **Deploy**: `npx supabase functions deploy admin-excluir-clipes --no-verify-jwt` (pré-requisito de todo o resto).
- [ ] Aba **Repositório** → selecionar partida → marcar **1 clipe** → excluir → `ConfirmDialog` de perigo → grade atualiza, objeto some do bucket `clipes` (conferir no painel do Supabase) e ledger ganha entrada `limpeza`/`manual` com os bytes liberados.
- [ ] Repetir marcando **vários clipes** — exclusão em lote; a partida que ficar sem clipes sai do seletor.
- [ ] Aba **Importação inalterada**: disparo, histórico e falhas funcionam como antes.
- [ ] **Não-admin** redirecionado ao tentar acessar `/clipes/admin/repositorio`.
- [ ] **Payload inválido** → 400 com mensagem (ex.: array de ids vazio).

## 6. Fora de escopo

- Mudanças de **auth**: sem JWT do Supabase e sem policies RLS novas — mantido o modelo da credencial no corpo com gate server-side (066).
- **Exclusão em cascata** de outros dados: só linhas de `clipes` + objetos do bucket + ledger; partidas e importações (runs) permanecem.
- **UI de repositório/exclusão para não-admins** — o acervo é visão de admin (a visão do jogador por partida continua sendo `GradeClipesPartida` no detalhe).
- **Testes automatizados** — regra do AGENTS.md: validação manual pelo dono.
- **Restauração/undo** de exclusão — recuperação é reimportar a data (RF03 do plano 35), enquanto o Filma Eu mantiver os clipes.

## 7. Riscos e rollback

- **Operação destrutiva** (exclusão permanente de objetos do bucket): mitigada por `ConfirmDialog` com tom de perigo, gate server-side (`is_admin` → 403), validação de payload com teto de 500 itens e ordem de deleção da retenção (falha no Storage aborta ANTES de tocar a tabela; 'Not Found' tolerado item a item). Ressalva documentada no registro do passo 1: se o INSERT no ledger falha após a exclusão, a exclusão já aconteceu e o retry devolve `{ excluidos: 0 }` — gap herdado da retenção, aceito por ser operação manual pontual e rara.
- **Edge function exposta sem JWT**: modelo de confiança documentado (066 — o corpo da chamada é a credencial, gate `is_admin` server-side, `--no-verify-jwt` com precedente nas irmãs); logs sem segredos.
- **Rollback de código**: `git revert` dos commits da seção 4 — nenhum dado é migrado (sem migration no banco), então o revert é limpo; alternativa menor: não fazer (ou desfazer) o deploy da função — toda exclusão falha com erro amigável na UI, sem tocar dados. Ledger gerado por exclusões reais permanece e é histórico legítimo.
