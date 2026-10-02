# 35 · Clipes do Filma Eu — Plano de Implementação (esqueleto)

> **STATUS: ESQUELETO** — requisito fechado em `docs/requisito-clipes-filmaeu.md`; este plano precisa ser detalhado (evidências `caminho:linha` conferidas e passos expandidos) antes de executar.
> Esforço estimado: **G** · Risco: **médio** · Prioridade global: a definir
> Fonte: requisito novo fechado com o dono em 02/10/2026 (não é item do ranking anti-slop).

## 1. Objetivo

Importar automaticamente os clipes de ~30s das partidas do racha publicados no filmaeu.com.br e exibi-los dentro do app: bloco de vídeos no detalhe da partida e link na home acima dos cards de destaque. Automatização via GitHub Action com Playwright; armazenamento em bucket novo no Supabase Storage.

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
- Executar fora de janela de partida ao vivo (deploy de migrations toca tabelas de partida).

## 4. Plano de execução (esqueleto — 1 passo = 1 commit)

1. **Migration: tabela `clipes` + `clipes_importacoes`** — modelo conforme requisito §6; idempotência por `(partida_id, caminho)`.
2. **Migration: bucket `clipes` + policies** — escrita só service key; leitura conforme decisão (RNF03).
3. **Segredos no Vault** — credenciais Filma Eu + PAT do GitHub (procedimento manual documentado no passo).
4. **Action: workflow base agendado** — cron semanal; busca partida alvo no Supabase; ledger de execução.
5. **Action: script Playwright de download** — login → quadra → data → slot 19:00 → baixa clipes; upload no Storage; idempotência.
6. **Action: notificações de resultado** — push "clipes prontos" para participantes; aviso de falha para admins (RF06/RF07).
7. **Edge Function `disparar-importacao-clipes`** — valida admin, chama GitHub API `workflow_dispatch` com inputs (data, horário).
8. **Frontend: `src/lib/clipes.ts`** — listar clipes por partida; carregar status de importações (admin).
9. **Frontend: bloco de clipes no `PartidaDetalhe`** — grade de `<video>` nativo, download/compartilhar.
10. **Frontend: link no `Resumo`** — acima dos cards de destaque, condicional à partida mais recente ter clipes.
11. **Frontend: gestão admin em `Administrador`** — disparar importação por dia específico + histórico de importações (RF03/RF08).
12. **Validação end-to-end** — checklist do requisito §5 e do passo 5.5 (validação manual) executado no aparelho.

## 5. Validação manual (a detalhar)

- [ ] Sexta após o cron: clipes da partida de quinta aparecem no detalhe da partida.
- [ ] Link na home aparece/some corretamente conforme existência de clipes.
- [ ] Importação manual por dia específico (admin) funciona e registra no ledger.
- [ ] Reexecutar a mesma data não duplica clipes (idempotência).
- [ ] Push de "clipes prontos" chega nos participantes; falha simulada avisa admins.
- [ ] Credenciais nunca aparecem em logs da Action nem no client.

## 6. Fora de escopo

Conforme requisito §8: sem backfill automático, sem multi-conta/multi-quadra, sem edição de clipes, sem HLS/transcodificação, sem compartilhamento para não-logados.

## 7. Riscos e rollback

- Risco principal: **mudança de layout no Filma Eu** quebra o Playwright — mitigado por log + aviso admin + correção pontual.
- Migrations e frontend são revertíveis por `git revert` isolado (passos independentes).
- Workflow da Action: reverter = desabilitar/disparar delete do workflow; bucket e tabelas podem ser recriados sem perda de dados do app existente (nenhuma tabela atual é alterada).
