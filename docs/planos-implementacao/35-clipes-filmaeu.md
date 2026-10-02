# 35 · Clipes do Filma Eu — Plano de Implementação

> Requisito fechado em 02/10/2026: `docs/requisito-clipes-filmaeu.md` (decisões D1–D9, RF01–RF09).
> Plano detalhado por **8 fases** (subagentes de arquitetura/detalhamento SDD, 02/10/2026), cada uma validada contra o código real com evidências `caminho:linha`.
> Esforço estimado: **G** (~30 tasks de 1 commit) · Risco: **médio** (automação frágil por depender do DOM do Filma Eu — RNF04)

## 1. Objetivo

Importar automaticamente os clipes de ~30s das partidas do racha publicados no filmaeu.com.br (GitHub Action com Playwright, logando com a conta do dono) e exibi-los dentro do app: grade de vídeos no detalhe da partida e link na home acima dos cards de destaque. Armazenamento em bucket novo no Supabase Storage com limpeza por retenção deletando as partidas mais antigas primeiro **pela data do jogo** (RF09). Disparo manual pelo painel admin para data específica. Push de "clipes prontos" e aviso de falha aos admins.

## 2. Decisões técnicas fechadas (P1–P12)

Validação do breakdown contra o código gerou 12 perguntas; decisões registradas em `35-fases/` (seção 5 de `breakdown.md`, copiada abaixo como referência canônica):

| P | Decisão |
|---|---------|
| P1 | Disparo manual = **RPC `disparar_importacao_clipes` + pg_net** (padrão `disparar_confirmacao_manual`, migration 099) — requisito §6 corrigido de Edge Function para RPC |
| P2 | Push = **Edge Function nova `notificar-clipes`** (padrão `send-confirmation-requests`), chamada pela Action via `x-push-cron-secret`; falha = push aos admins **+** ledger/painel |
| P3 | Action lê Vault via **RPC SECURITY DEFINER `obter_segredo_vault`**, executável só pela `service_role` |
| P4 | Bucket **público de leitura**; escrita só `service_role` |
| P5 | Bucket criado **por migration** (`INSERT INTO storage.buckets` + policies) |
| P6 | Gestão admin = **rota própria `/clipes/admin`** no bloco admin (precedente `/notificacoes`), não dentro do Administrador financeiro |
| P7 | "Partida com clipes" = `status IN ('published','closed')` |
| P8 | Cron **sexta 09:00 BRT (12:00 UTC)** — *confirmar com o dono quando os clipes aparecem no site; ajuste de 1 linha no YAML* |
| P9 | Link no Resumo **independe dos destaques** (aparece também no empty state) |
| P10 | Painel admin mostra só `clipes_importacoes`; `cron_execucoes` = ledger de transporte HTTP |
| P11 | Limite de retenção = **var do workflow (default 800 MB)** com override por input do dispatch |
| P12 | **`size_bytes` denormalizado na tabela `clipes`** no upload (limpeza não consulta metadados do Storage) |

## 3. Fases (ordem de execução)

Cada fase é um doc próprio com tasks detalhadas (1 passo = 1 commit, conteúdo esboçado, validação por passo, divergências e rollback). Executar na ordem; dentro da fase, na ordem das tasks.

| Fase | Doc | Tasks | Entrega | Migrações |
|------|-----|-------|---------|-----------|
| 1 — Banco: tabelas, bucket, grants, types | [fase-1-tasks.md](35-fases/fase-1-tasks.md) | 3 | Tabelas `clipes`/`clipes_importacoes` + bucket + `database.types.ts` | 109, 110 |
| 2 — Segredos + Action base | [fase-2-tasks.md](35-fases/fase-2-tasks.md) | 5 | Workflow YAML (cron+dispatch), RPC `obter_segredo_vault`, script esqueleto com partida alvo e ledger, doc de secrets | 111 |
| 3 — Playwright: login → download → upload | [fase-3-tasks.md](35-fases/fase-3-tasks.md) | 6 | Automação completa idempotente; seletores isolados (`filmaeu/seletores.mjs`); **pré-requisito do dono: mapeamento DOM** | — |
| 4 — Limpeza por retenção (RF09) | [fase-4-tasks.md](35-fases/fase-4-tasks.md) | 4 | `retencao.mjs` (mais antiga por `data_jogo`, protege a recém-importada), input `limite_storage_mb` | 112 |
| 5 — Notificações (RF06/RF07) | [fase-5-tasks.md](35-fases/fase-5-tasks.md) | 3 | Edge Function `notificar-clipes`, RPC de destinatários, integração best-effort na Action | 113 |
| 6 — Disparo manual backend (RF03/RF08) | [fase-6-tasks.md](35-fases/fase-6-tasks.md) | 3 | RPCs `disparar_importacao_clipes`, `obter_importacoes_clipes`, `obter_falhas_recentes_clipes` + types | 114, 115 |
| 7 — Frontend jogador (RF04/RF05) | [fase-7-tasks.md](35-fases/fase-7-tasks.md) | 5 | `lib/clipes.ts`, `GradeClipesPartida.tsx`, bloco no detalhe, link no Resumo | — |
| 8 — Frontend admin + E2E (RF03/RF07/RF08) | [fase-8-tasks.md](35-fases/fase-8-tasks.md) | 5 | `/clipes/admin` (disparo, histórico, falhas), menu admin, **roteiro E2E do dono** | — |

**Ressalva de numeração**: as migrations 109–115 podem colidir com `109_draft_times_ao_vivo.sql` reservado por `docs/plano-escolha-times-realtime.md` (não executado). Antes de iniciar, confirmar qual plano roda primeiro e renumerar em bloco se preciso.

**Divergências entre fases**: cada fase documenta as que encontrou (ex.: F4 corrigiu grant `DELETE` faltante da F1 com a migration 112; F5 ajustou CHECK de `reminder_key` na 113). Elas são parte do plano — o executor deve aplicá-las, não a versão original da fase anterior.

## 4. Pré-condições globais

- Conta do Filma Eu do dono válida; quadra **Society Gragoatá** na busca; **mapeamento DOM do Filma Eu preenchido pelo dono** (`docs/filmaeu-mapeamento-dom.md`, task 3.1 — bloqueante para Fase 3).
- Acesso admin ao GitHub (`rdias612/racha`, conferido) e ao Supabase (migrations, Vault, Storage, Edge Functions).
- Executar fora de janela de partida ao vivo (migrations tocam o ciclo de partida).
- Secrets: Vault (`filmaeu_credenciais`, `github_pat_clipes`, `push_cron_secret` já existe) e GitHub Secrets (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) — cadência documentada na task 2.4 / `docs/configuracao-clipes-action.md`.

## 5. Validação end-to-end (dono)

O roteiro único consolidado (7 blocos, valida RF01–RF09) está na task 5 da **Fase 8**. Pendências do dono após execução ficam registradas conforme o processo do `README.md`.

## 6. Fora de escopo

Conforme requisito §8: sem backfill automático, sem multi-conta/multi-quadra, sem edição de clipes, sem HLS/transcodificação, sem compartilhamento para não-logados. Também fora: templates editáveis de push no painel de notificações; deleção manual de clipes no frontend.

## 7. Riscos e rollback

- **Mudança de layout no Filma Eu** quebra o Playwright — seletores isolados num único arquivo (RNF04), log rico, aviso aos admins; correção pontual no `seletores.mjs`.
- **Limpeza deletar partida que o grupo quer rever** — folga do limite (800 MB), ordem estrita por `data_jogo`, registro no ledger; clipes deletados são recuperáveis reimportando a data (RF03) enquanto o Filma Eu os mantiver.
- **Credenciais/PAT** — Vault-only; PAT fine-grained, só `actions:write` do repo; nunca em logs (RNF02).
- Cada task é revertível por `git revert` isolado; migrations sem alterar nenhuma tabela existente do app. Edge Function: revert = redeploy da versão anterior.
