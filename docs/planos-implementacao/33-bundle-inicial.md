# 33 · Bundle inicial: registrar e não mexer — Plano de Implementação

> Ref.: item **B7** do `docs/plano-melhorias-frontend-pwa.md` · Ranking anti-slop: **#33 (nota 0,0)**, Tier 4 (`docs/rank-melhorias-reuso-codigo.md`)
> Esforço estimado: S · Risco: baixo (risco de execução zero — não há mudança de código) · Prioridade global do plano: P3 (Fase 5 — Higiene P2/P3)

## 1. Objetivo

**Este plano não implementa nada.** É um registro de decisão: o bundle inicial atual (entry + chunk compartilhado de ícones ≈ 97 KB gzip com CSS) é aceito como está. A medição foi revalidada no `dist/` e ficou **menor** do que a citada no plano de origem, reforçando a decisão. Introduzir `manualChunks` ou importações por subpath hoje seria complexidade sem ganho nesta escala (~25 usuários), contrariando o KISS/YAGNI do AGENTS.md. O plano fixa o **critério objetivo de reavaliação** para o caso de a decisão precisar ser revisitada.

## 2. Estado atual (evidências verificadas)

Medição e código conferidos em **30/09/2026**. O `dist/` local é o build de 22/09/2026 (59 arquivos em `dist/assets/`, ~800 KB no total):

- **Entry** `dist/assets/index-DtuCt3xL.js` — **232,3 KB brutos / 67,7 KB gzip** (conferido; igual ao valor do doc de origem).
- **Chunk compartilhado** `dist/assets/createLucideIcon-D16Cz4M6.js` — **55,4 KB brutos / 19,6 KB gzip**. ⚠️ **Divergência do doc de origem**, que cita 256,3 KB: o build atual mede 55,4 KB. É eager porque o shell (`src/routes/Layout.tsx:3-17`) importa ícones de `lucide-react` estaticamente; o chunk também carrega os módulos Storage/Realtime do supabase-js. A divergência é a favor da decisão — o custo real é menor que o documentado.
- **CSS** `dist/assets/index-B0wgQseg.css` — 55,9 KB brutos / 10,0 KB gzip.
- **Total de primeira carga**: ≈ 287,7 KB brutos de JS (~87,3 KB gzip) + 10,0 KB gzip de CSS ≈ **~97 KB gzip** (doc de origem citava ≈ 139 KB gzip).
- `vite.config.ts:32-38` — **sem `manualChunks`** (grep confirmado): o code splitting vem exclusivamente dos pontos de entrada dinâmicos de rota.
- **22 rotas lazy**: 22 carregadores com `import()` dinâmico em `src/lib/rotas.ts:14-35`, expostos via `lazy()` em `:38-89`.
- **Prefetch de chunks cobre as 22 rotas**: `TABELA_PRE_CARREGAMENTO` em `src/lib/rotas.ts:98-122` (22 entradas), consumida por `preCarregarRota` (`:135-142`), acionada por handlers de toque/hover/foco na TabBar (`src/routes/Layout.tsx:63`). A navegação típica raramente espera um chunk.
- Contexto de execução: PWA instalado com service worker precacheando o shell (`public/sw.js:7,35-44`) — após a 1ª execução bem-sucedida, o bundle inicial vem do cache, sem rede.

## 3. Pré-condições e dependências

- **Planos pré-requisitos**: nenhum.
- **Decisão do dono exigida antes de executar**: nenhuma a tomar agora — a decisão já está tomada e é "não mexer". Este documento apenas a registra com data e critério de reavaliação.
- **Restrição de janela**: nenhuma (não há janela: nada será executado).

## 4. Plano de execução (1 passo = 1 commit)

**Nenhum passo de código.** O único artefato é este documento (1 commit de doc). Em particular, fica explicitamente **fora** de execução futura sem o gatilho da seção 5:

- `manualChunks` no `vite.config.ts`;
- importações por subpath / árvore reduzida de ícones no shell;
- qualquer mudança no padrão de rotas lazy/prefetch, que já está correto.

## 5. Validação manual

**Nada a validar** — não há mudança de código, build ou comportamento. Se um dia o critério de reavaliação disparar, a primeira validação será reabrir esta medição (tamanhos no `dist/` +gzip) e reproduzir a queixa real em rede lenta antes de propor qualquer plano novo.

### Critério de reavaliação (o conteúdo principal deste registro)

Reavaliar **somente se** "primeira abertura em rede lenta" virar reclamação real dos usuários (relato espontâneo, não hipótese). Nenhum outro gatilho (tamanho de arquivo, auditoria Lighthouse, migração de dependência) reabre a decisão.

Se o critério disparar, o caminho provável — registrado aqui de propósito **sem detalhar** (YAGNI: desenhar agora seria especulação) — é, em ordem de custo crescente:

1. Tornar eager→lazy os ícones do shell (`lucide-react`), eliminando ou encolhendo o chunk `createLucideIcon-*` da primeira carga.
2. Um `manualChunks` mínimo para separar o que é vendor estável (supabase-js), aproveitando o cache entre deploys.
3. Revisar o precache do SW para a 1ª execução não competir com a navegação.

A escolha entre eles dependeria de nova medição na data; nada disso é prometido nem agendado.

## 6. Fora de escopo

- Qualquer alteração em `vite.config.ts`, `src/lib/rotas.ts`, `src/routes/Layout.tsx` ou nos imports do shell.
- Migração de biblioteca de ícones ou redução de subpath de `lucide-react`.
- Otimizações de CSS ou fontes (a última é o item B6, plano 32, também condicional a queixa real).
- Corrigir o número divergente no `docs/plano-melhorias-frontend-pwa.md` (a correção fica registrada aqui, seção 2; atualizar o doc de origem é decisão separada do dono).

## 7. Riscos e rollback

- **Risco de execução**: zero — não há commit de código; o único commit é este documento, reversível por `git revert` isolado.
- **Risco de decisão**: baixo — o pior cenário é o gatilho disparar mais tarde do que o ideal; a seção 5 já deixa o caminho de reavaliação mapeado, então o custo de "ter decidido não mexer" é só o atraso até a primeira reclamação real, sem lock-in técnico (`manualChunks` e imports por subpath são reversíveis e independentes entre si).
