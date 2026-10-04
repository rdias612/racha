# 22 · Poda de `/assets/*` antigos no `CACHE_STATIC` — Registro de Execução e Validação

> Registro da execução do plano 22 em **04/10/2026**, na branch `main`. Veredito da auditoria: **aprovado com ressalvas** — 2 Minor; o trivial corrigido em commit próprio, o segundo registrado como débito documental (sem correção necessária). Ciclo executor → auditor → corretor fechado.

## 1. Contexto

Item B4: o `activate` do service worker passa a podar as entradas `/assets/*` antigas dentro de `CACHE_STATIC` (além da limpeza de caches inteiros que já existia), corrigindo o acúmulo de chunks hasheados de deploys passados no storage do Android. Sem bump de versão de cache — decisão embutida da seção 4 do plano. BASE: `ea99ceb`. Plano de 1 passo.

## 2. Execução

- **Passo 1 — poda no `activate`** · commit `291b3f4` · `Poda entradas /assets/ antigas do cache estático no activate do SW`
  - `public/sw.js:66-77` — encadeado no `event.waitUntil` do handler `activate` existente, entre a limpeza de caches fora de `[CACHE_STATIC, CACHE_API]` e `clients.claim()`: abre `CACHE_STATIC`, lista `cache.keys()`, filtra `pathname.startsWith('/assets/')` e deleta via `Promise.all`.
  - Log `[SW]` condicional (só quando há entradas a remover) com a contagem — a única diferença do esboço de 8 linhas do plano (o esboço não trazia log; o executor incluiu por ser estilo do arquivo e ajudar o checklist de DevTools). Sem bump (`racha-static-v3` intacto), sem handler adicional, `vercel.json`/`pwa.ts`/handlers de push/fetch intocados.
  - Build e lint com exit 0 (o lint cobre `public/sw.js` explicitamente).
- **Correção de auditoria** · commit `2b8d4be` · `Ajustar mensagem de log da poda de assets no service worker`
  - Único ajuste: texto do log trocado de "…entradas /assets/ antigas do cache estático" para "…entradas /assets/ do cache estático" — a poda remove qualquer entrada sob `/assets/`, não só "antigas". 1 linha, commit próprio, só `public/sw.js`.

Superfície total: só `public/sw.js`.

## 3. Auditoria

Auditor read-only com review package em `.superpowers/sdd/22-poda-assets-cache/etapa-1-review-package.md`. **Veredito: aprovado com ressalvas** (2 Minor, nenhum Critical/Important).

- Fidelidade à seção 4: PASS — encadeamento, filtro, sem bump, handler único, fora de escopo respeitado (NetworkFirst do bloco same-origin inalterado, precache sem `/assets/` não afetado).
- Divergência do executor (variável `antigas` + log condicional + early-return): validada — o early-return não impede `clients.claim()` (retorna `undefined` e a cadeia prossegue); o log expõe só a contagem; o modo de falha em exceção é idêntico ao pré-existente.
- Análise própria do auditor: `new URL(req.url)` não pode lançar na prática (Cache API só guarda URLs absolutas; padrão já usado no handler fetch, `sw.js:182`); entradas cross-origin do `CACHE_STATIC` (fontes Google, pathnames `/css2`, `/s/…woff2`) não casam com o filtro — não são podadas; `cache.delete(req)` com `Request` é válido pela spec (chave exata).

## 4. Divergências plano × código real / decisões

1. **Log condicional incluído** (não estava no esboço): decisão do executor, validada pela auditoria — estilo do arquivo + auxilia a validação em DevTools.
2. **Minor corrigido**: texto impreciso do log ("antigas") — commit próprio `2b8d4be`.
3. **Minor deferido como observação (sem correção)**: `new URL` sem guarda no filtro — inalcançável na prática (Cache API garante URLs absolutas válidas) e um try/catch aqui seria overengineering contra o KISS do AGENTS.md. Registrado, nenhuma ação.
4. Nenhuma imprecisão no doc do plano a corrigir na fonte.

## 5. Observações operacionais

- Nenhum push indevido nesta etapa: a `main` local está à frente de `origin/main` com os commits dos planos 16-22 aguardando o dono. A poda só surtirá efeito nos clientes após o push/deploy (`sw.js` é servido com `no-cache` — `vercel.json:5-15`).
- A modificação pendente do dono em `src/index.css` foi preservada intacta no working tree.
- Débito fora de escopo (já previsto na seção 6 do plano): dentro de um mesmo deploy, o cache ainda cresce sem limite (LRU/`workbox-expiration` segue sem demanda nesta escala).

## 6. Pendente de validação humana (dono)

Checklist da seção 5 do plano (requer 2 deploys + DevTools/Android):

- [ ] Deploy 1: navegar 2-3 rotas online e anotar as entradas `/assets/` em `racha-static-v3` (DevTools → Application → Cache Storage).
- [ ] Deploy 2: segundo build/deploy, recarregar até o SW novo ativar → entradas `/assets/` do deploy 1 desaparecem; permanecem só `/offline.html`, manifest, ícones e `/splash/*`.
- [ ] Offline pós-poda: modo avião com app fechado → abre via cache/`/offline.html`, sem tela branca.
- [ ] Online pós-poda: chunks do deploy 2 re-cacheados (entradas `/assets/` reaparecem).
- [ ] Smoke test de push (fluxo não tocado, só confirmar).
