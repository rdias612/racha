# 22 · Poda de `/assets/*` antigos no `CACHE_STATIC` — Plano de Implementação

> Ref.: item **B4** do `docs/plano-melhorias-frontend-pwa.md` · Ranking anti-slop: **#22 (nota 1,0)**, Tier 4 (`docs/rank-melhorias-reuso-codigo.md`)
> Esforço estimado: S · Risco: baixo · Prioridade global do plano: P2 (Fase 5 — Higiene P2/P3, "junto das mudanças que tocarem os arquivos")

## 1. Objetivo

Fazer o `activate` do service worker podar as entradas `/assets/*` antigas dentro do `CACHE_STATIC` existente (`racha-static-v3`), além da limpeza de caches inteiros que já faz hoje. Como `vercel.json` marca `/assets/(.*)` como `immutable` e o handler same-origin cacheia toda resposta 200, chunks hasheados de todos os deploys passados se acumulam (~500 KB–1 MB por deploy) num storage persistente no Android. São ~8 linhas novas no `sw.js` — o item corrige **acumulação**, não duplicação de código (por isso a nota baixa no ranking anti-slop; o valor aqui é de manutenção de storage, não de deduplicação).

## 2. Estado atual (evidências verificadas)

Verificado no código em **30/09/2026**; linhas do doc de origem conferidas:

- `public/sw.js:58-68` — o handler `activate` lista `caches.keys()` e apaga apenas caches cujo **nome** está fora de `[CACHE_STATIC, CACHE_API]`; **nenhuma entrada interna** de `CACHE_STATIC` é removida. O doc de origem cita `sw.js:58-68` — confere.
- `public/sw.js:220-243` — o handler same-origin (bloco 3 do `fetch`) cacheia **toda** resposta `status === 200 && type === 'basic'` em `CACHE_STATIC` (`sw.js:225-227`), sem limite de quantidade nem política de expiração. O doc de origem cita `sw.js:220-243` — confere.
- `vercel.json:45-49` — header `Cache-Control: public, max-age=31536000, immutable` para `/assets/(.*)`. Chunks hasheados são imutáveis: uma entrada cacheada nunca precisa de revalidação, mas também nunca é re-baixada se podada sem necessidade.
- `public/sw.js:35-44` — `ASSETS_PRECACHE` **não contém nenhum caminho sob `/assets/`** (só `/offline.html`, manifest, ícones e `/splash/*`). Podar chaves com pathname `/assets/*` não toca o precache.
- `public/sw.js:229-237` — no mesmo handler same-origin, o fallback offline: sem rede e sem cache, se `request.mode === 'navigate'`, entrega `OFFLINE_URL` (`/offline.html`), sempre precacheada (`sw.js:36`). O doc de origem cita `sw.js:233-237` — confere.
- `public/sw.js:7` — `CACHE_STATIC = 'racha-static-v3'`; `public/sw.js:46-56` — `install` com `addAll(ASSETS_PRECACHE)` e `skipWaiting()`.
- Intersecção com o plano 20 (B3): aquele plano só toca `src/lib/pwa.ts` e `Layout.tsx`; este toca só `public/sw.js`. Nenhum conflito de arquivo.

## 3. Pré-condições e dependências

- **Planos pré-requisitos**: nenhum. O plano 20 (B3, aviso de nova versão) é independente em arquivos, mas é **complementar** — com o banner de reload, o usuário sai do estado "página antiga em memória" mais rápido, reduzindo a janela de risco descrita na seção 7.
- **Decisão do dono exigida antes de executar**: nenhuma — a proposta do plano de origem está fechada (poda por prefixo `/assets/` no `activate`; sem Workbox, sem `workbox-expiration`, sem contagem máxima de entradas — YAGNI nesta escala de ~25 usuários).
- **Restrição de janela**: nenhuma (não toca telas nem fluxo de partida ao vivo).

## 4. Plano de execução (1 passo = 1 commit)

### Passo 1 — Poda de `/assets/*` no `activate` · 1 commit

**Arquivo tocado**: `public/sw.js` (único). Nenhum arquivo novo, nenhuma biblioteca nova.

**Mudança**: encadear, após o `.then()` de limpeza de caches fora da lista (e antes de `self.clients.claim()`), uma etapa que abre `CACHE_STATIC`, lista `cache.keys()` e deleta as requisições cujo `pathname` começa com `/assets/`. Esboço (~8 linhas, estilo do arquivo — promises encadeadas, mensagens de log `[SW]`):

```js
.then(() =>
  caches.open(CACHE_STATIC).then((cache) =>
    cache.keys().then((requisicoes) =>
      Promise.all(
        requisicoes
          .filter((req) => new URL(req.url).pathname.startsWith('/assets/'))
          .map((req) => cache.delete(req))
      )
    )
  )
)
```

**Decisão embutida — sem bump de versão de cache** (`racha-static-v3` permanece): a poda não altera o formato nem o conteúdo esperado do cache — as entradas removidas são re-baixadas sob demanda pelo handler same-origin NetworkFirst na próxima visita online. Um bump forçaria re-precache completo e re-download de tudo na 1ª execução (pior offline-first), sem ganho algum: a poda no `activate` alcança o mesmo estado com custo zero para o usuário.

**Ordem de execução**: a poda roda antes de `clients.claim()` (o `waitUntil` mantém o activate vivo até concluir). Manter o encadeamento dentro do `event.waitUntil` existente — não criar handler `activate` adicional.

**Reversibilidade**: o passo é um único commit; `git revert` restaura o activate original. Entradas podadas voltam a se acumular apenas até o próximo deploy — sem perda de dados.

## 5. Validação manual

Sem testes automáticos, conforme AGENTS.md. Checklist objetivo (Chrome DevTools, Android real se possível):

- [ ] **Deploy 1**: build/ deploy da versão com o SW podador; abrir o app online, navegar por 2–3 rotas (gera chunks lazy em cache). Em DevTools → Application → Cache Storage → `racha-static-v3`: anotar as entradas `/assets/` presentes.
- [ ] **Deploy 2**: gerar um segundo build (os hashes de `/assets/*` mudam); deploy; recarregar o app online e aguardar o SW novo ativar (watch em `application`/DevTools ou ao menos 2 recargas). Conferir que as entradas `/assets/` do deploy 1 **desapareceram** de `racha-static-v3` e permanecem apenas `/offline.html`, manifest, ícones e `/splash/*`.
- [ ] Conferir que `/splash/*`, ícones e `/offline.html` **não foram** podados (precache intacto).
- [ ] **Offline após a poda**: com o app fechado, ativar modo avião e abrir o PWA → deve abrir via cache/`offline.html` de reserva, sem tela branca de erro.
- [ ] **Online pós-poda**: navegar pelas mesmas rotas e confirmar que os chunks novos são baixados e re-cacheados (as entradas `/assets/` do deploy 2 reaparecem em `racha-static-v3`).
- [ ] Push não afetado: enviar/verificar que o fluxo de push não mudou (a mudança não toca os handlers de push — smoke test de notificação se houver ambiente).

## 6. Fora de escopo

- **Não** trocar a estratégia do handler same-origin (NetworkFirst permanece; LRU/`workbox-expiration`/limite de entradas é abordagem nova sem demanda — o plano de origem explicitamente propõe só a poda por prefixo).
- **Não** criar bump de `CACHE_STATIC`/`CACHE_API` (justificado na seção 4).
- **Não** podar `/splash/*`, ícones, manifest ou `/offline.html` — só `/assets/*` (imutáveis e re-baixáveis).
- **Não** tocar `vercel.json` (o `immutable` de `/assets/(.*)` está correto e é o que torna a poda segura).
- **Não** implementar o aviso de nova versão (plano 20) nem mexer em `pwa.ts`.
- **Não** criar testes automáticos para o SW (AGENTS.md: validação manual apenas).

## 7. Riscos e rollback

- **Risco principal — janela rara offline entre a ativação e a primeira navegação**: se o usuário ficar offline logo após o SW podador assumir e antes de qualquer navegação online, os chunks da versão corrente podem não estar mais em cache; navegações então degradam para `offline.html` (sempre precacheada em `sw.js:36`) em vez de tela branca. Mitigação: é exatamente o fallback existente (`sw.js:233-237`); a janela é de segundos e se fecha na primeira navegação online. Risco aceito no plano de origem.
- **Risco secundário — página antiga em memória**: com `skipWaiting` incondicional (`sw.js:55`), um SPA do deploy anterior ainda aberto pode tentar carregar um chunk antigo já podado; online o fetch devolve 404 do servidor (chunk não existe mais no deploy novo) — comportamento idêntico ao de hoje sem poda (o 404 já ocorre na rede); offline a falha do chunk é degradada pelo boundary de rota. O plano 20 (banner "Recarregar") reduz essa exposição; não é pré-requisito.
- **Rollback**: `git revert` do commit único restaura o `activate` original na próxima publicação do `sw.js` (servido com `no-cache, no-store` — `vercel.json:5-15`, o SW novo assume no próximo cold start). Não há migração de dados: as entradas voltam a se acumular, sem estado residual a limpar.
