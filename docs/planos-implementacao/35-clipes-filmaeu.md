# 35 · Clipes do Filma Eu — Plano de Implementação (esqueleto)

> **STATUS: ESQUELETO** — requisito fechado em `docs/requisito-clipes-filmaeu.md`; este plano precisa ser detalhado (evidências `caminho:linha` conferidas e passos expandidos) antes de executar.
> Esforço estimado: **G** · Risco: **médio** · Prioridade global: a definir
> Fonte: requisito novo fechado com o dono em 02/10/2026 (não é item do ranking anti-slop).

## 1. Objetivo

Importar automaticamente os clipes de ~30s das partidas do racha publicados no filmaeu.com.br e exibi-los dentro do app: bloco de vídeos no detalhe da partida e link na home acima dos cards de destaque. Automatização via GitHub Action com Playwright; armazenamento em bucket novo no Supabase Storage com limpeza automática por tamanho, deletando as partidas mais antigas primeiro pela **data do jogo** (RF09 do requisito).

## 2. Estado atual (a conferir antes de executar)

- [ ] Confirmar padrão atual de Edge Function em `supabase/functions/send-confirmation-requests/index.ts` (segredo de cron, resposta, log).
- [ ] Confirmar estrutura de `cron_execucoes` e `push_reminder_deliveries` para espelhar o ledger de importações.
- [ ] Confirmar como o painel `Administrador.tsx` organiza seções hoje (onde entra a gestão de importação).
- [ ] Confirmar layout do `Resumo.tsx` (posição exata dos cards de destaque dos jogadores).
- [ ] Mapear manualmente (uma vez, logado) as rotas/DOM do filmaeu.com.br: login, busca por quadra/data, slot de horário, URLs de download dos clipes.

## 3. Pré-condições e dependências

- Conta do Filma Eu do dono funcionando no site e a quadra **Society Gragoatá** aparecendo na busca.
- Acesso admin ao repo GitHub (para o workflow) e ao Supabase (migrations, Vault, Storage).
- Decisão pendente do plano: bucket de leitura pública vs URLs assinadas (RNF03 do requisito).
- Decisão pendente do plano: valor do limite de retenção (RF09) — default proposto **800 MB** via variável do workflow (folga sob o free tier de 1 GB).
- Executar fora de janela de partida ao vivo (deploy de migrations toca tabelas de partida).

## 4. Plano de execução (esqueleto — 1 passo = 1 commit)

1. **Migration: tabela `clipes` + `clipes_importacoes`** — modelo conforme requisito §6; idempotência por `(partida_id, caminho)`; a tabela `clipes` carrega `data_jogo` (ou join por `partida_id`) para ordenar a limpeza pela **data da partida**.
2. **Migration: bucket `clipes` + policies** — escrita só service key; leitura conforme decisão (RNF03).
3. **Segredos no Vault** — credenciais Filma Eu + PAT do GitHub (procedimento manual documentado no passo).
4. **Action: workflow base agendado** — cron semanal; busca partida alvo no Supabase; ledger de execução.
5. **Action: script Playwright de download** — login → quadra → data → slot 19:00 → baixa clipes; upload no Storage; idempotência.
6. **Action: limpeza por retenção (RF09)** — ao final de cada importação bem-sucedida: somar tamanho por partida (Storage/tabela), e enquanto total > limite configurável, deletar **a partida mais antiga inteira por `data_jogo`** (prefixo `clipes/{partida_id}/` + linhas em `clipes` + entrada no ledger tipo "limpeza"); nunca deletar a partida recém-importada.
7. **Action: notificações de resultado** — push "clipes prontos" para participantes; aviso de falha para admins (RF06/RF07).
8. **Edge Function `disparar-importacao-clipes`** — valida admin, chama GitHub API `workflow_dispatch` com inputs (data, horário).
9. **Frontend: `src/lib/clipes.ts`** — listar clipes por partida; carregar status de importações (admin).
10. **Frontend: bloco de clipes no `PartidaDetalhe`** — grade de `<video>` nativo, download/compartilhar.
11. **Frontend: link no `Resumo`** — acima dos cards de destaque, condicional à partida mais recente ter clipes.
12. **Frontend: gestão admin em `Administrador`** — disparar importação por dia específico + histórico de importações (RF03/RF08), incluindo entradas de limpeza.
13. **Validação end-to-end** — checklist do requisito §5 e do passo 5.5 (validação manual) executado no aparelho.

## 5. Validação manual (a detalhar)

- [ ] Sexta após o cron: clipes da partida de quinta aparecem no detalhe da partida.
- [ ] Link na home aparece/some corretamente conforme existência de clipes.
- [ ] Importação manual por dia específico (admin) funciona e registra no ledger.
- [ ] Reexecutar a mesma data não duplica clipes (idempotência).
- [ ] Push de "clipes prontos" chega nos participantes; falha simulada avisa admins.
- [ ] Credenciais nunca aparecem em logs da Action nem no client.
- [ ] **Retenção**: com limite baixo de teste (ex.: 50 MB), a importação deleta primeiro a partida com `data_jogo` mais antiga (independente da data de upload), remove os arquivos do bucket e as linhas da tabela, e registra no ledger; a partida recém-importada nunca é deletada.

## 6. Fora de escopo

Conforme requisito §8: sem backfill automático, sem multi-conta/multi-quadra, sem edição de clipes, sem HLS/transcodificação, sem compartilhamento para não-logados.

## 7. Riscos e rollback

- Risco principal: **mudança de layout no Filma Eu** quebra o Playwright — mitigado por log + aviso admin + correção pontual.
- Risco da limpeza (RF09): deletar conteúdo que o grupo ainda quer rever — mitigado por folga do limite (default 800 MB), execução por partida inteira, registro no ledger e ordem estrita por `data_jogo` (nunca pela data de upload).
- Migrations e frontend são revertíveis por `git revert` isolado (passos independentes).
- Workflow da Action: reverter = desabilitar/disparar delete do workflow; bucket e tabelas podem ser recriados sem perda de dados do app existente (nenhuma tabela atual é alterada). Clipes deletados pela retenção são recuperáveis só reimportando a data via gestão admin (RF03), enquanto o Filma Eu os mantiver disponíveis.
