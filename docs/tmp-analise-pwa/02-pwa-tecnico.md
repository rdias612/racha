# Análise PWA Técnico e Performance Mobile — Racha Gragoatá CBO

> Análise estática do código-fonte (nada foi alterado no projeto; nenhum draft/projeto criado no canvas Superdesign). Build de medição executado em 2026-09-29 (`npm run build`, 627 ms). Ótica: **PWA instalado no Android/Chrome** — uso exclusivo mobile; desktop irrelevante.

---

## 1. Resumo executivo (top 5)

A fundação PWA está **sólida e bem engenheirada**: SW manual com estratégias corretas por tipo de recurso, cache cross-session que faz o app abrir offline com o último dado conhecido, instalação sem bugs de estado, push resiliente com auto-cura, e code splitting com prefetch que já cobre os casos de navegação. As lacunas reais são pequenas e de baixo esforço:

| # | Proposta | Prioridade | Esforço |
|---|----------|------------|---------|
| 1 | **Revalidar dados ao voltar online** — chamar `invalidarCache()` no evento `online` do Layout; hoje o banner offline some, mas a tela continua com dado velho até um PullToRefresh | P0 | S |
| 2 | **Teclado Android vs barras fixas** — adicionar `interactive-widget=resizes-content` ao viewport meta; hoje a `BarraAcaoInferior` e a barra de rascunho ficam atrás do teclado durante busca/edição nas telas de admin usadas em campo | P0 | S |
| 3 | **Aviso "nova versão disponível"** — Snackbar global via `controllerchange` (com guard de controller pré-existente); hoje o SPA em memória pode rodar velho contra um backend que evolui por migrations | P1 | S |
| 4 | **Poda de `/assets/*` antigos no `CACHE_STATIC` no `activate`** — hoje o cache estático só cresce (chunks hasheados de todos os deploys passados); PWA instalado tem storage persistente no Android | P2 | S |
| 5 | **Manifest: `shortcuts`** — toque longo no ícone com atalhos Jogos/Ranking usando ícones já existentes | P3 | S |

**Não identificamos P0 de risco crítico** (nada quebra hoje de forma blocker): os dois itens P0 são correções de UX/correude com altíssima relação benefício/esforço. Bundle inicial (~139 KB gzip JS + 10 KB gzip CSS) é adequado para PWA instalado com cache do SW — **sem ação recomendada** (ver P3-3).

---

## 2. Estado atual mapeado (evidências)

### 2.1 Service worker (`public/sw.js`)

**Estratégias por tipo de recurso** — desenho correto e bem documentado no cabeçalho (`public/sw.js:1-5`):

| Recurso | Estratégia | Evidência |
|---|---|---|
| API Supabase (GET `/rest/v1/`) | NetworkFirst + fallback cache offline; só cacheia status 200; não-GET passa direto | `sw.js:175-196`, `sw.js:166-168` |
| Google Fonts (CSS + WOFF2) | CacheFirst com rede de reserva | `sw.js:199-217` |
| Same-origin (HTML, JS, CSS, ícones) | NetworkFirst + fallback cache + `offline.html` para navegações sem cache | `sw.js:220-243` (fallback em 233-237) |

**Versionamento e ciclo de vida:**

- Dois caches nomeados: `racha-static-v3` e `racha-api-v2` (`sw.js:7-8`). Bump manual por edição do arquivo.
- `install`: precache de 8 assets (offline.html, manifest, ícones, splash — `sw.js:35-44`) com falha tolerada (`sw.js:51-53`), seguido de **`skipWaiting()` incondicional** (`sw.js:55`).
- `activate`: apaga caches cujo **nome** saiu da lista permitida e faz `clients.claim()` (`sw.js:58-68`, claim em 66).
- **Lacuna real: nenhuma poda de entradas internas.** O branch same-origin cacheia **toda** resposta 200 (`sw.js:225-227`), incluindo cada versão de `index.html`, `manifest.webmanifest` e todos os chunks `/assets/*.js` já servidos. O `activate` só remove caches inteiros com nome antigo — nunca entradas de dentro do `CACHE_STATIC`. Como `vercel.json` marca `/assets/(.*)` como immutable (`vercel.json:44-53`) e o PWA instalado recebe storage persistente no Android, o cache cresce a cada deploy (~500 KB–1 MB por deploy, entre chunks e HTML) sem limite temporal.
- `CACHE_API` também nunca é podado (respostas JSON antigas se acumulam), embora em volume menor.

**Fluxo de atualização ("nova versão disponível"):**

- **Não existe.** O registro do SW é silencioso e trata só falha (`src/lib/pwa.ts:67-74`); não há listener `updatefound`/`controllerchange`, nem canal de mensagem, nem UI de recarregar.
- Consequência prática: com `skipWaiting` + `claim` imediatos, o novo SW assume o controle **na hora**, e o HTML/JS network-first garante que o **próximo cold start** já roda a versão nova. O usuário **não fica preso em versão velha** no fluxo normal (abre/fecha o app com frequência). A janela residual: SPA mantida **quente em memória** pelo Android por horas/dias enquanto deploys trocam RPCs no backend (o projeto evolui por migrations — 108 até hoje) → telas podem falhar até o próximo cold start. É o único cenário em que um aviso de recarga agrega valor.

**Offline de navegação:** `offline.html` precacheada com estética própria da súmula (`sw.js:36`, `public/offline.html`), servida apenas quando não há nada em cache para a navegação (`sw.js:233-237`).

**Web Push no SW (mapeamento):** handlers `push` (deep-link por `partida_id`, `tag` + `renotify`, vibração — `sw.js:70-90`), `notificationclick` com foco da janela existente ou abertura nova (`sw.js:92-105`), e `pushsubscriptionchange` com re-inscrição via RPC `sincronizar_push_subscription` (`sw.js:112-160`). A config (URL, anon key, VAPID) é injetada no build por placeholders `__SUPABASE_URL__` etc. via plugin no `vite.config.ts:12-30` — var ausente mantém o push em no-op (`sw.js:20-24`).

### 2.2 Manifest + instalação

**`public/manifest.webmanifest`:** `id: "/"` + `start_url: "/"` + `scope: "/"` (5-7), `display: standalone` (8), `orientation: portrait` (9 — coerente com o produto, todas as telas são portrait), `theme_color`/`background_color` `#12100d` batendo com o tema dark default (10-11), `lang: pt-BR` (12). Ícones: SVG 512 `any` + SVG 512 `maskable` + PNG 192/512 `any` + PNG 512 `maskable` (14-44) — **atende installability do Chrome** com folga (maskable PNG presente). **Sem `shortcuts` e sem `screenshots`** (sem instalação rica/atalhos — melhoria opcional P3).

**Detecção de instalado (validação do commit 589d75f):**

- `isStandalone()` cobre os 4 display-modes + `navigator.standalone` (iOS) + referrer `android-app://` (`src/lib/pwa.ts:22-35`).
- O estado `instalado` é **só memória de módulo** (`pwa.ts:41-44`): `beforeinstallprompt` (que o Chrome só dispara quando o app NÃO está instalado) força `instalado = false` (`pwa.ts:101-109`); `appinstalled` força `true` (`pwa.ts:110-114`); `getInstalledRelatedApps` cobre detecção no boot (`pwa.ts:87-99`). Nenhuma chave `racha_pwa_instalado` existe no código (grep em `src/` — as chaves localStorage são `racha_tema`, `racha_sessao`, `racha_push_desativado`, `racha_nova_partida`).
- **Veredito: o desenho atual está correto** — resolve o problema do estado preso em "instalado" após desinstalação sem introduzir flag persistida. Nenhuma melhoria necessária. Observação menor: `getInstalledRelatedApps` roda sem `related_applications` no manifest — é um no-op inofensivo (`pwa.ts:87-99`).
- `initPWA()` é chamado no boot (`src/main.tsx:22`) com guard anti-duplo-registro para HMR (`pwa.ts:59, 81-82`); o registro do SW acontece no `load` (`pwa.ts:69-73`).
- `BotaoInstalar` (cartão Android prompt nativo / iOS passo a passo — `src/components/BotaoInstalar.tsx:38-83`) aparece só no Resumo (`src/routes/Resumo.tsx:137`) e some quando instalado (`BotaoInstalar.tsx:17`).

### 2.3 Meta tags mobile (`index.html`)

- **Viewport** `width=device-width, initial-scale=1.0, viewport-fit=cover` (`index.html:5`) — sem restrições de zoom (correto; ver "O que NÃO fazer" item 1). O parâmetro `interactive-widget` está ausente — é a base da proposta P0-2 (teclado, **não** escala).
- **theme-color**: meta única `#12100d` sincronizada por script anti-flash inline no `<head>` (`index.html:8-22`) e re-sincronizada ao alternar tema por `aplicarTema` (`src/lib/tema.ts:35-48`). Correto para o seletor claro/escuro do app.
- **apple-\* tags**: `apple-mobile-web-app-capable`, `status-bar-style black-translucent`, `apple-mobile-web-app-title`, `apple-touch-icon` e 2 splash SVGs (`index.html:24-26, 36-47`). Irrelevantes para Android-only, custo zero — registrar e manter.
- **Safe-area (cobertura completa):** `body` com padding nos 4 insets (`src/index.css:84-93`); TabBar com `paddingBottom: env(safe-area-inset-bottom)` (`src/routes/Layout.tsx:259`); `BarraAcaoInferior` com `calc(0.75rem + env(...))` (`src/components/BarraAcaoInferior.tsx:28`); `ModalBase` bottom-sheet (`src/components/ModalBase.tsx:85`); `Snackbar` (`src/components/Snackbar.tsx:56`). Não falta em nenhum elemento fixo.

### 2.4 UX offline / instalado

- **Banner offline global**: estado `isOffline` via listeners `online`/`offline` (`Layout.tsx:85-102`), banner vermelho "Modo offline — exibindo dados locais salvos" acima do header (`Layout.tsx:117-127`). **Lacuna (P0-1): ao voltar o online, o banner some e nada mais acontece** — `invalidarCache()` não é chamado (grep: só 6 rotas o chamam, sempre pós-mutação), então as telas montadas continuam exibindo o dado do cache de memória até um PullToRefresh, troca de rota ou remount.
- **Cold start offline funciona bem**: HTML e JS vêm do `CACHE_STATIC` (network-first → cache), e os GETs Supabase caem no `CACHE_API` (network-first → cache) — o app abre com o último dado conhecido. `offline.html` só entra quando não há NADA cacheado (primeira execução offline). Arquitetura de duas camadas coerente: cache SWR **em memória** para a sessão (`src/hooks/useCache.ts:4-13`) + cache HTTP do SW como reserva cross-session (documentado em `sw.js:1-5`).
- **Stale data controlado pós-mutação**: invalidação por geração + notificação de ouvintes (`useCache.ts:39-58, 127-162`); chaves centralizadas em `src/lib/chavesCache.ts` (usadas por Jogos, Resumo, Ranking, Comparador).
- **PullToRefresh próprio** em 7 rotas (Resumo, Jogos, Ranking, Estatisticas, EstatisticasRacha, Comparador, Administrador — grep), indicador manipulado por refs para não re-renderizar no touchmove (`src/components/PullToRefresh.tsx:31-43, 130`); integra com `recarregar` do `useCache` (`useCache.ts:166-179`).
- **BannerLembrete** (polling de urna aberta) pausa em background via `visibilitychange` e alterna 30 s/5 min (`src/components/BannerLembrete.tsx:74-87`) — bom para bateria/quota.

### 2.5 Performance mobile

**Code splitting — bem executado:**

- 22 rotas lazy com carregadores únicos em `src/lib/rotas.ts:14-91` (comentário do arquivo proíbe duplicar specifiers — DRY correto) e prefetch por regex em `rotas.ts:98-124`.
- Prefetch da TabBar em **onTouchStart** (ideal para mobile) + hover/focus (`Layout.tsx:63-77`); skeleton por rota no `Suspense` do Outlet com CLS=0 (`Layout.tsx:44-61, 246-248`).

**Bundle inicial (medido no build de 2026-09-29):**

| Chunk | Bruto | Gzip | Conteúdo verificado |
|---|---|---|---|
| `index-*.js` (entry) | 232,3 KB | 68,6 KB | react 19 + react-dom + react-router 7 + núcleo supabase-js |
| `createLucideIcon-*.js` (compartilhado) | 256,3 KB | 70,7 KB | **ícones lucide + módulos Storage/Realtime do supabase-js** (grep: 130 ocorrências "storage", `RealtimeClient`) |
| CSS único | 55,9 KB | 10,2 KB | tokens + utilitários |
| **Total no arranque** | ~489 KB JS | **~139 KB gzip** + 10 KB CSS | `dist/index.html` faz `modulepreload` dos dois chunks JS |

- O chunk compartilhado é **eager** (pré-carregado) porque o shell (Layout) importa ícones lucide estaticamente — todos os ícones usados em qualquer rota (mesmo de telas admin/notificações) caem no mesmo chunk. Tree-shaking do lucide funciona (imports nomeados em 44 arquivos); o efeito colateral é o agrupamento.
- **Avaliação honesta: aceitável.** Para PWA instalado, o custo é da 1ª execução/pós-deploy; depois tudo vem do SW (assets immutable + fontes cacheadas). O supabase-js não permite podar Storage/Realtime por configuração — qualquer intervenção (manualChunks, submódulos) violaria KISS sem ganho percebível para a escala do app (~25 usuários). Detalhe em P3-3.
- **Fontes**: Google Fonts com `preconnect` + `display=swap` (`index.html:27-32`); SW cacheia CSS/WOFF2 (`sw.js:199-217`). FOUT aceitável; dependência de terceiros só afeta a 1ª execução offline (P3-2).
- **Acessibilidade/mobilidade já resolvida**: `prefers-reduced-motion` global (`index.css:167-176`), alvos de toque 44 px (`index.css:149-156`), inputs 16 px anti-zoom (`index.css:106-110`), foco visível âmbar (`index.css:158-165`).
- **Listas longas (Jogos/Ranking)**: renderização direta sem virtualização. Escala real (~20-35 jogadores por temporada; partidas ~52/ano com placares simples) não justifica virtualização — DOM leve e queries únicas (view `partidas_com_placar` em `src/routes/Jogos.tsx:50-72`). `useSwipeTabs` cede o scroll vertical cedo (`src/hooks/useSwipeTabs.ts:85-95`) e ignora toques em inputs/sliders (`useSwipeTabs.ts:54-59`).
- **Custos de composição teóricos (só registrar)**: textura de ruído `body::after` fixed fullscreen com `mix-blend-mode: overlay` (`index.css:95-104`) e `backdrop-blur` no header/TabBar/barras (`Layout.tsx:130, 255`; `BarraAcaoInferior.tsx:27`) são fontes conhecidas de custo de GPU em Android de entrada — são identidade visual ("Súmula de Quinta"); mexer só com evidência de jank medido.
- **Imagens**: nenhuma imagem de conteúdo (tudo SVG/ícones/emoji) — não há pipeline de imagem a otimizar.

### 2.6 Push notifications (mapeamento do frontend; backend fora do escopo)

- **Config/inscrição**: `statusPush`, `ativarPush` (requestPermission + `subscribe` VAPID + upsert `onConflict: endpoint`), `desativarPush` (delete + unsubscribe + flag local) em `src/lib/pwa.ts:199-252`; validação rigorosa da chave VAPID (`pwa.ts:154-177`).
- **Auto-cura no boot/login**: `sincronizarPush(jogadorId)` chamado pelo `SessaoContext` quando há jogador (`src/context/SessaoContext.tsx:93-96`); dedupe em voo (`pwa.ts:280-297`); descarta inscrição com chave VAPID antiga (`pwa.ts:309-313, 337-347`); opt-out respeitado pela flag `racha_push_desativado` (`pwa.ts:259-276`). Complemento do lado SW: `pushsubscriptionchange` re-inscreve e casa a linha pela RPC `sincronizar_push_subscription` (migration 103) — `sw.js:112-160`.
- **UI**: `CardNotificacoes` com 4 estados (`indisponivel`/`negado`/`desativado`/`ativado`) — no Resumo com `ocultarQuandoAtivo` (`Resumo.tsx:138`) e completo no Perfil (`src/routes/Perfil.tsx:229`); diagnóstico em `NotificacoesTestes.tsx:59`; painel de entregas por jogador em `NotificacoesSaude.tsx` (migration 106); disparo manual de votação aberta em `PartidaAoVivo.tsx:17` (migration 107). Configurações admin (migrations 104-105 são de cron/entrega — backend).
- **Veredito: frontend completo e resiliente, sem lacuna crítica.** Micro-observação (sem proposta): `statusPush` faz uma query ao banco a cada mount do card — custo trivial e aceitável.

### 2.7 Teclado virtual Android

- **Não há nenhum tratamento**: zero usos de `visualViewport`, `scrollIntoView` em foco de input, ou `interactive-widget` (grep em `src/` e `index.html`).
- **Telas com input de texto + barra fixa simultâneas** (o cenário problemático):
  - `PartidaNova`: `CampoBusca` (busca de atleta) + input date + `BarraAcaoInferior` fixa com o CTA (`src/routes/PartidaNova.tsx:205-210, 237-242, 263-279`).
  - `GestaoJogadores`: `CampoBusca` + `BarraRascunhoGestao` (`fixed bottom-20` — `src/components/BarraRascunhoGestao.tsx:12-13`).
  - `GestaoGoleiros`: `CampoBusca` + `ModalNovoGoleiro` (inputs de texto em modal).
  - `Administrador`: `FormLancamentoFinanceiro` (inputs number/text com `inputMode="decimal"` — `src/components/FormLancamentoFinanceiro.tsx:167-208`).
- **Comportamento do Chrome Android pós-v108**: default `resizes-visual` — o layout viewport **não** encolhe quando o teclado abre; elementos `fixed bottom-0` ficam **atrás do teclado** e o fim da lista fica inalcançável enquanto se digita. Exatamente o caso da busca de atletas na criação de partida (fluxo de admin usado em campo).
- O `input { font-size: 16px }` (`index.css:106-110`) é anti-zoom-iOS e não interfere no Android.

---

## 3. Propostas priorizadas (P0 → P3)

### P0-1 — Revalidar dados ao voltar online

- **Problema**: o banner offline desaparece quando a rede volta (`Layout.tsx:90-92`), mas os dados em tela continuam sendo os do cache de memória. O `useCache` só revalida em mount, troca de chave ou invalidação pós-mutação — e o cache HTTP do SW só é consultado quando a rede falha. Usuário que abriu o app offline (cenario real: campo/subsolo) vê dado velho mesmo online, sem perceber.
- **Proposta**: dentro do `handleOnline` já existente (`Layout.tsx:90-92`), chamar `invalidarCache()` (sem argumento — `useCache.ts:49-57`) + importar de `../hooks/useCache`. Os ouvintes montados disparam `revalidar(true)` (rede) automaticamente (`useCache.ts:152-156`).
- **Benefício**: telas montadas se atualizam sozinhas ao reconectar, reutilizando a API de invalidação existente — ~2 linhas, zero abstração nova.
- **Esforço**: **S**.
- **Risco**: baixo. Poucas chaves ativas por sessão; dedupe de buscas em voo já existe (`useCache.ts:8-9, 64-68`). Validação manual: online → offline → online e conferir Recumo/Jogos revalidando sem skeleton (a revalidação forçada não seta `carregando`).

### P0-2 — Teclado Android vs barras fixas (`interactive-widget`)

- **Problema**: em telas de admin usadas em campo, abrir o teclado cobre a `BarraAcaoInferior`/`BarraRascunhoGestao` e impede rolar a lista até o fim enquanto digita (Chrome Android ≥108, default `resizes-visual` — ver 2.7).
- **Proposta**: mudar o meta viewport para `width=device-width, initial-scale=1.0, viewport-fit=cover, interactive-widget=resizes-content` (`index.html:5`). Uma linha, efeito só no Android/Chrome. **Não toca em scale/zoom** — nada a ver com o episódio "Versão para desktop" (ver "O que NÃO fazer").
- **Benefício**: o ICB encolhe com o teclado → barras fixas sobem acima dele e a lista rola até o fim durante a digitação; atinge de uma vez todas as telas afetadas sem tocar em componente algum.
- **Esforço**: **S**.
- **Risco**: baixo-moderado, **validação manual no aparelho obrigatória**: (a) TabBar fica visível acima do teclado (comportamento comum/aceitável); (b) `html,body,#root { height:100% }` + `main` como scroll container (`index.css:78-82`, `Layout.tsx:242`) se encolhem corretamente; (c) safe-areas dos elementos fixos e `ModalBase` bottom-sheet continuam corretos; (d) `PullToRefresh.getScrollTop` continua achando o scrollTop do `main` (`PullToRefresh.tsx:10-19`).

### P1-1 — Aviso "nova versão disponível"

- **Problema**: `skipWaiting` + `claim` imediatos (`sw.js:55, 66`) e nenhuma UI de atualização. No fluxo normal (cold start frequente) a versão nova chega sozinha; a janela residual é o SPA quente em memória rodando contra um backend que muda por migrations (assinaturas de RPC evoluem — 108 migrations), onde telas podem falhar até o próximo cold start.
- **Proposta**: em `initPWA` (`pwa.ts:80-115`), registrar `navigator.serviceWorker.addEventListener('controllerchange', ...)` com guard "só se já existia um controller antes" (o primeiro `claim` pós-instalação dispara o evento e não é atualização) e expor um estado reativo no mesmo padrão de ouvintes já usado para instalação (`pwa.ts:44-55`). O `Layout` mostra um aviso fixo "Nova versão disponível — Recarregar" que faz `window.location.reload()`. Sem `postMessage`, sem canal entre SW e página.
- **Benefício**: usuário nunca fica em versão velha; atualização vira 1 toque; custo de código ~15 linhas.
- **Esforço**: **S**.
- **Risco**: baixo. O guard do primeiro controller é o ponto de atenção (testar instalação limpa vs update real).

### P2-1 — Poda de `/assets/*` antigos no `CACHE_STATIC` no `activate`

- **Problema**: o `activate` só remove caches com nome fora da lista (`sw.js:58-68`); entradas internas nunca são apagadas. Cada deploy acumula no aparelho os chunks hasheados antigos + novas versões de HTML/manifest (~500 KB–1 MB por deploy; dezenas de MB em um ano). PWA instalado tem storage persistente no Android → o Chrome não evita: cresce sem limite.
- **Proposta**: no `activate` (`sw.js:58-68`), além da limpeza atual, listar as chaves do `CACHE_STATIC` e deletar as que começam com `/assets/` (chunks hasheados são imutáveis e re-baixáveis; o HTML cacheado — linha de defesa offline — permanece). ~8 linhas no próprio `sw.js`, sem nova infra.
- **Benefício**: storage limitado ao precache + assets atuais; sem mudança de estratégia de cache; sem bump manual de versão.
- **Esforço**: **S**.
- **Risco**: baixo. Janela rara: usuário offline exatamente entre a ativação do SW novo e a primeira navegação online — degrada graciosamente para `offline.html` (sempre precacheada). Alternativa descartada por complexidade: extrair URLs de assets do `index.html` no activate.

### P3-1 — Manifest: `shortcuts`

- **Problema**: toque longo no ícone não oferece atalhos (`manifest.webmanifest` sem `shortcuts`).
- **Proposta**: 2 atalhos estáticos ("Jogos" → `/jogos`, "Ranking" → `/ranking/pontos`) reutilizando `icon.svg`. ~12 linhas de JSON.
- **Benefício**: acesso direto às duas telas mais usadas a partir do launcher.
- **Esforço**: **S**. **Risco**: baixo. (Instalação rica com `screenshots` exige produzir imagens — deixar para quando houver vontade de caprichar no onboarding.)

### P3-2 — Fontes self-host (apenas se houver queixa real)

- **Problema**: cold start depende de `fonts.googleapis/gstatic` (`index.html:27-32`); na 1ª execução offline a fonte cai no fallback. O SW mitiga a partir da 2ª execução (`sw.js:199-217`).
- **Proposta (se um dia valer a pena)**: baixar os WOFF2 efetivamente usados para `public/fonts/` e substituir o link por `@font-face` locais mantendo `display: swap`. **Sem biblioteca nova** (fontsource/autoprefixer seriam dependências — evitar).
- **Esforço**: **M**. **Risco**: baixo (troca de assets; conferir subconjuntos de pesos/itálicos usados no CSS). KISS: não fazer agora sem dor demonstrada.

### P3-3 — Bundle inicial: registrar e não mexer (por ora)

- **Medição**: arranque ≈ 139 KB gzip JS (entry 68,6 + chunk compartilhado 70,7 — ícones lucide + Storage/Realtime do supabase-js) + 10 KB CSS. Para PWA instalado com SW, é custo de 1ª execução apenas.
- **Proposta**: **nenhuma intervenção agora.** O supabase-js não permite podar Storage/Realtime por config; `manualChunks`/subpaths de ícones seriam complexidade sem ganho percebível nesta escala. Reavaliar apenas se "primeira abertura em rede lenta" virar reclamação real. Registrar como débito observado.

---

## 4. O que NÃO fazer

1. **NÃO propor nenhum "fix de zoom/escala" via viewport ou CSS** (`user-scalable`, `maximum-scale`, `touch-action` global, escala manual etc.). O problema de escala que motivou o pedido foi causado pelo **"Versão para desktop" do próprio Chrome** (comportamento por-site do usuário, já inocentado ponto a ponto). Qualquer "correção" de viewport para isso é proibida e pioraria a acessibilidade. O único ajuste de viewport defendido nesta análise (`interactive-widget`, P0-2) trata **teclado**, não escala — e não altera zoom.
2. **NÃO migrar para Workbox / vite-plugin-pwa.** O SW manual de 245 linhas cobre exatamente as 3 estratégias necessárias e é entendido por quem mantém; a migração seria reescrever risco sem ganho (viola AGENTS.md: sem novas dependências sem necessidade clara).
3. **NÃO adicionar React Query/SWR/TanStack.** O `useCache` já implementa stale-while-revalidate com invalidação por geração, dedupe em voo e chaves centralizadas (`chavesCache.ts`) — trocar seria reescrever 6 rotas por zero ganho.
4. **NÃO virtualizar listas** (react-window etc.). A escala real (~35 jogadores, ~100 partidas) não justifica; adicionaria dependência e complexidade para um DOM que já roda liso.
5. **NÃO voltar a persistir flag `racha_pwa_instalado`.** O desenho pós-589d75f (estado em memória + `beforeinstallprompt` como evidência autoritativa de desinstalação + `getInstalledRelatedApps` no boot) está correto — validado em 2.2.
6. **NÃO trocar NetworkFirst do HTTP por SWR no HTTP.** O comentário do próprio `sw.js:1-5` documenta o motivo: servir resposta HTTP atrasada quebraria a consistência pós-mutação (ex.: quitar dívida e a lista não atualizar). O SWR pertence ao `useCache`, onde está.
7. **NÃO mexer na identidade visual de performance sem medição**: textura de ruído (`body::after`, `index.css:95-104`) e `backdrop-blur` do shell são parte da metáfora "Súmula de Quinta". Só mexer com jank comprovado em aparelho de entrada (e nesse caso, começar pelo backdrop-blur, não pela textura).
8. **NÃO remover as tags/splash `apple-*`** — custo zero, Android-only hoje, mas são o caminho mais barato caso alguém do racha use iPhone.
9. **NÃO introduzir biblioteca nova para qualquer item desta análise** (push, update prompt, poda de cache, shortcuts): tudo é viável com as estruturas existentes (`pwa.ts`, `sw.js`, `useCache`, `manifest.webmanifest`).
10. **NÃO criar testes automatizados agora** (AGENTS.md: "no momento, não criar novos testes automaticamente"). As validações indicadas (P0-1, P0-2, P1-1) são manuais, no aparelho Android com o PWA instalado.

---

## Apêndice — Débitos/observações menores (registro, sem ação)

- `getInstalledRelatedApps` roda sem `related_applications` no manifest — no-op inofensivo (`pwa.ts:87-99`).
- `CACHE_API` também cresce sem poda (respostas JSON antigas) — volume menor; a poda proposta em P2-1 cobre o grosso (`/assets/`). Se um dia medir, o mesmo padrão de poda por prefixo se aplica.
- `BannerLembrete` faz polling mesmo offline (falha silenciosa no catch, `BannerLembrete.tsx:62-64`) — custo trivial de bateria/rede, tolerável.
- `CardNotificacoes` consulta `statusPush` (DB) a cada mount — trivial.
- `sw.js` aceita qualquer resposta 200 same-origin no cache, inclusive `/sw.js`-adjacentes inofensivos e HTML de navegações — comportamento desejado para o fallback offline; a poda P2-1 mantém o HTML e remove só os assets.
