# Plano Central de Melhorias do Frontend PWA — Racha Gragoatá CBO

> Documento consolidado e validado do dossiê de análise do frontend (2026-09-29/30).
> Fontes: 5 análises temáticas + registro do init Superdesign, todos em `docs/tmp-analise-pwa/`, **revalidados contra o código-fonte real** por um consolidador (toda evidência `caminho:linha` abaixo foi conferida; números divergentes entre docs foram recontados — ver seção **Validação**).
> Filosofia: `AGENTS.md` — KISS/YAGNI/DRY com critério, sem novas bibliotecas sem necessidade clara, mudanças pequenas e incrementais, preservar a arquitetura, nada de refactor cosmético amplo.

---

## 1. Sumário executivo

O app é um **PWA React 19 + Vite + TypeScript + Tailwind 4 + Supabase**, usado **exclusivamente como app instalado no celular** (Android/Chrome, portrait). Não há biblioteca de componentes: tudo próprio, em português, sobre o design system "Súmula de Quinta" (`DESIGN.md`, tokens em `src/index.css`). A fundação está **sólida**: service worker manual com estratégias corretas por tipo de recurso, cache SWR caseiro (`useCache`) com invalidação por geração, 22 rotas lazy com prefetch, primitivas acessíveis próprias (`ModalBase`, `ConfirmDialog`, `Snackbar`, `Estado`, `useModalA11y`, `useListbox`), regras globais de mobile já aplicadas (44px, anti-zoom 16px, safe-areas, focus âmbar).

**Metodologia**: 5 subagentes analisaram o frontend por ótica (componentes, PWA técnico, design system, camada de dados, UX funcional) sobre o mapa do init Superdesign (doc 00). Cada um produziu um doc com evidências `caminho:linha`. Um consolidador revalidou **todas as propostas P0/P1 e as afirmações estruturais** contra o código, recontou os números divergentes, deduplicou sobreposições e rebaixou o que contraria a filosofia do repositório ou decisões já tomadas pelo dono.

### Top 10 propostas (ordem de prioridade global)

| # | Proposta | Tema | Prioridade | Esforço | Risco |
|---|----------|------|------------|---------|-------|
| 1 | Revalidar dados ao voltar online (`invalidarCache()` no evento `online`) | PWA | **P0** | S | baixo |
| 2 | `interactive-widget=resizes-content` no viewport (teclado Android vs barras fixas) | PWA | **P0** | S | baixo-médio (validar no aparelho) |
| 3 | Helper único de invalidação pós-mutação de partida | Dados | **P0** | S | mínimo |
| 4 | Extrair `CabecalhoSumula` (cabeçalho editorial repetido em 21 telas) | Componentes | **P0** | M | baixo |
| 5 | Extrair `Botao` com variantes (ou constantes de variante — decisão do dono) | Componentes | **P1** | M | baixo-médio |
| 6 | Aviso "nova versão disponível" do service worker | PWA | **P1** | S | baixo |
| 7 | Cédula de votação: sinal honesto de progresso (contador nasce 100%) | UX | **P1** | S | baixo |
| 8 | Retry + pull-to-refresh + haptics consistentes nas telas de partida | UX | **P1** | S–M | baixo |
| 9 | Painel da Semana: confirmar presença em 1 toque na home | UX | **P1** | S–M | baixo (decisão do dono) |
| 10 | Servir elenco/derivados pelo cache SWR existente (10 arquivos re-buscam a rede) | Dados | **P1** | M | baixo-moderado |

P1 de esforço mínimo imediato (ficaram fora do top 10 por impacto menor, mas cabem na Fase 1 do roadmap): **alvos de toque 44px nos CTAs-Link** (C1) e **`CampoTexto`/`CampoTextoLongo`** (A3).

---

## 2. Estado atual — o que NÃO deve ser tocado

Pontos fortes verificados que sustentam o produto e **não entram em nenhum escopo de mudança**:

- **Fundação PWA**: `public/sw.js` (NetworkFirst p/ API Supabase e same-origin, CacheFirst p/ fontes, `offline.html` de reserva — `sw.js:175-243`), caches `racha-static-v3`/`racha-api-v2`, push resiliente com auto-cura (`pwa.ts:199-347`, `sw.js:112-160`), detecção de instalado correta pós-commit 589d75f (`pwa.ts:22-114`).
- **Shell e navegação**: `Layout.tsx` com header sticky, TabBar de 5 abas com prefetch por `onTouchStart` (`Layout.tsx:63-77, 255-334`), boundary do Outlet com skeleton por rota (CLS=0), regex de fluxo focado (`Layout.tsx:106`). Não trocar abas nem desenhar a TabBar.
- **Camada de dados**: `useCache` (`src/hooks/useCache.ts`, 188 linhas: cache de módulo, dedupe em voo, gerações anti-obsolência, ouvintes de invalidação), chaves centralizadas em `lib/chavesCache.ts`, módulos de domínio em `src/lib/*.ts` (39 RPCs, cada uma chamada em exatamente 1 lugar), `erros.ts` e `formatacao.ts` adotados transversalmente.
- **Primitivas existentes**: `Estado` (31 importadores), `BotaoVoltar` (14), `ConfirmDialog` (10), `Skeletons` (10), `Snackbar` (9), `PullToRefresh` (7), `Badge` (7), `ModalBase` (6), `CampoBusca` (5), `BarraAcaoInferior` (5), hooks `useModalA11y`/`useListbox`/`useSwipeTabs`/`useSnackbar`, `lib/haptics.ts` (5 padrões).
- **Identidade visual "Súmula de Quinta"** (preservar integralmente): placar LED com fundo fixo e dígitos `text-destaque` com glow (`PainelPlacar.tsx:46-52,130-146`) — **não temizar**; sombras carimbo secas (`index.css:220-230`); linha pontilhada `sumula-header` (`index.css:232-234`); textura de ruído `body::after` (`index.css:95-104`); âmbar `#ffb300` único com par adaptativo `destaque-texto/destaque-tinta`; cores fixas dos times Preto/Branco; tríade tipográfica Barlow Condensed/Archivo/Chivo Mono; cantos duros `rounded-[2px]`–`rounded-[6px]`; emojis de domínio (⚽ 🧤 ★) como tom de voz.

---

## 3. Propostas consolidadas por tema

> Cada proposta aparece **uma única vez** (deduplicação entre docs). Origem = doc(s) de onde veio. Prioridade = global consolidada.

### Tema A — Componentes reutilizáveis

#### A1 · P0 — Extrair `CabecalhoSumula`
- **Problema**: o bloco de cabeçalho editorial (kicker mono + título `font-display` + `sumula-header`) está copiado inline em **18 rotas + 3 componentes de seção** (`ListaReceitasAbertas.tsx:62`, `ListaDespesasAbertas.tsx:25`, `EscalacaoTimesEditor.tsx:231`), ~200 LOC repetidas; `Skeletons.tsx` espelha a geometria em 7 pontos (linhas 17, 60, 100, 145, 189, 362, 413). Total: 22 arquivos contêm `sumula-header`. As 4 telas do módulo notificações carregam cópias byte-idênticas entre si (`NotificacoesConfirmacao.tsx:136`, `NotificacoesVotacao.tsx:103`, `NotificacoesTestes.tsx:124`, `NotificacoesSaude.tsx:70`). Drifts já visíveis: `font-black` só em `GestaoGoleiros.tsx:190`; mistura de `h1 text-2xl` (Resumo) e `h2 text-xl` sem hierarquia estável.
- **Proposta**: `src/components/CabecalhoSumula.tsx` com props `titulo`, `kicker?` (abaixo do título — caso de 16/18 rotas), `icone?`, `acao?` (slot à direita: meta "Oficial CBO", contador, countdown), `tamanho?` (`md`/`lg`), `nivel?` (`h1`/`h2`/`h3`). O `BotaoVoltar` **continua fora** (hoje fica separado — preservar layout). Migração mecânica rota por rota, sem mudança visual. **Skeletons não migram** (são formas neutras para CLS=0; acoplar criaria dependência bidirecional).
- **Benefício**: 1 ponto de mudança para o elemento visual mais recorrente do app; hierarquia de headings consistente; ~200 LOC a menos nas rotas.
- **Esforço**: M (componente é S; tocar 21 arquivos é o custo) · **Risco**: baixo (markup puro, sem estado) · **Origem**: 01 (P0-1) + 03 (P2-1, elevada após validação).

#### A2 · P1 — Extrair `Botao` com variantes
- **Problema**: **131 `<button>`** estilizados à mão (39 em `src/routes/`, 92 em `src/components/` — contagem revalidada). A fórmula do primário âmbar está colada em **25 `<button>` de 21 arquivos + 4 CTAs-Link** (`Jogos.tsx:121-127` "Nova partida", `PartidaDetalhe.tsx:273-275` "Editar votos"). Os docs de origem diziam ~31/32 cópias — contagem por linha superestima (captura `Badge`/abas e classNames multilinha); o número recontado é ~29 usos. Par cancelar/confirmar reimplementado em `ConfirmDialog.tsx:67-86`, `ModalFiltrosRanking.tsx:90-113`, `FormLancamentoFinanceiro.tsx:221-236` (com drifts: `disabled:opacity-40` vs `-50`, `shadow-carimbo` vs `-destaque` vs `font-black` no mesmo papel). Rodapé "Fechar" repetido em 3 modais + 1 "Cancelar" (`ModalSelecionarOpcao.tsx:50-58`, `ModalSelecionarGoleiro.tsx:67-75`, `ModalEscalarJogador.tsx:52-62`, `ModalSelecionarAgendamento.tsx:78-82`).
- **Proposta**: `src/components/Botao.tsx` com `variante?: 'primario' | 'secundario' | 'perigo'` (default `primario`), `larguraCompleta?` e spread de props nativas de `<button>`; classes = assinatura comum atual (44px, `rounded-[4px]`, `font-display uppercase tracking-wider text-xs`, `active:translate-y-px`). **Alternativa menor** (doc 03): apenas constantes de classe no estilo `VARIANTE_CLASSES` do `Badge.tsx:56-63`, sem componente novo. **Decisão do dono** entre as duas — as duas eliminam os mesmos drifts; o componente captura o par cancelar/confirmar e os rodapés de forma mais completa, as constantes espelham menos API. Migração incremental: primeiro os 3 pares duplicados + 4 rodapés, depois o resto conforme os arquivos forem tocados. **Sem big-bang**.
- **Benefício**: elimina a maior duplicação em volume; alvo 44px e focus âmbar viram invariantes; reduz risco de divergência visual.
- **Esforço**: M (incremental) · **Risco**: baixo-médio (aceitar a variante canônica; `className` de escape para casos raros) · **Origem**: 01 (P0-2) + 03 (P1-2, unificadas).

#### A3 · P1 — Extrair `CampoTexto` e `CampoTextoLongo`
- **Problema**: par `label + input/textarea` repetido **26×** em 5 arquivos (`FormEventoAutomatico.tsx` 9, `FormLancamentoFinanceiro.tsx` 7, `SecaoNotificacaoConfirmacao.tsx` 6, `SecaoNotificacaoVotacao.tsx` 2, `SecaoExportacaoFinanceira.tsx` 2); 3 `<textarea>` com a mesma receita. `FormEventoAutomatico.tsx:20` já define constante local `INPUT_CLASS` — o próprio código sinalizou a duplicação.
- **Proposta**: `CampoTexto` (`rotulo`, `valor`, `aoMudar`, `tipo`, `placeholder`, `maxLength`, `fonteMono?`, `obrigatorio?`, `className`) e `CampoTextoLongo` (`linhas`). Reutiliza os tokens anti-zoom (`text-base sm:text-sm`) e o foco âmbar. `CampoBusca` permanece separado.
- **Benefício**: ~120 LOC a menos; comportamento anti-zoom do teclado garantido num lugar (relevante nos formulários push, os mais editados).
- **Esforço**: S–M · **Risco**: baixo (inputs controlados simples) · **Origem**: 01 (P1-3).

#### A4 · P1 — Higiene de nomenclatura (mudança pequena)
- **Problema**: aliases bilíngues mortos em `CampoBusca.tsx:4-22` (`valor`/`value`, `aoMudar`/`onChange`, `desabilitado`/`disabled` — os 5 chamadores usam só pt-BR, revalidado); `linhasComparador.tsx` em minúsculas (2 importadores: `SecaoJuntosComparador.tsx:3`, `SecaoAdversosComparador.tsx:3`); `SeletorNota.tsx:17` usa `variant` enquanto `Badge`/`CabecalhoTime`/`CampoBusca`/`PainelPlacar` usam `variante`.
- **Proposta**: (a) remover os aliases de `CampoBusca` (zero mudança nos chamadores); (b) renomear `linhasComparador.tsx` → `LinhasComparador.tsx`; (c) `variant` → `variante` em `SeletorNota`; (d) documentar a convenção (props de dado em pt-BR, handlers `ao*`, APIs nativas do DOM em inglês) para código novo. **Fora de escopo**: padronizar retroativamente APIs já estabelecidas (`open/onClose` do ModalBase, `checked/onChange` do Toggle) — refactor cosmético amplo.
- **Esforço**: S · **Risco**: mínimo · **Origem**: 01 (P1-4).

#### A5 · P2 — Migrar `DialogoEvento` para `ModalBase`
- **Problema**: terceira implementação do shell de modal (`DialogoEvento.tsx:59-76` duplica portal, overlay, focus trap e ARIA de `ModalBase.tsx:63-85`); correção de a11y num shell não chega aos outros.
- **Proposta**: reescrever `DialogoEvento` sobre `ModalBase` com `mostrarBotaoFechar={false}`, `tamanhoMaximo="sm"`, `posicao="bottom-sheet"` (API confirmada em `ModalBase.tsx:13-15`). O fluxo de 2 etapas se mantém. `ConfirmDialog` **fica como está** (10 usos; unificá-lo adicionaria props de exceção ao canônico). Executar fora de janela de partida ao vivo.
- **Esforço**: S–M · **Risco**: médio (tela crítica de gols ao vivo; validar fluxo completo manualmente) · **Origem**: 01 (P2-5).

#### A6 · P2 — Peças das listas financeiras
- **Problema**: `COR_TIPO` é constante de domínio exportada de um componente de UI e importada por outro (`ListaReceitasAbertas.tsx:15` → `ListaDespesasAbertas.tsx:4`); linha de metadados de lançamento duplicada (`ListaReceitasAbertas.tsx:148-163` vs `ListaDespesasAbertas.tsx:48-63`).
- **Proposta**: mover `COR_TIPO`/`ChipTipoLancamento` para `src/lib/dividas.ts` (ou componente único) e extrair `LinhaMetaLancamento`. O rodapé "Fechar" cai naturalmente no A2.
- **Esforço**: S · **Risco**: baixo · **Origem**: 01 (P2-6).

#### A7 · P2 — `PilulaFiltro`
- **Problema**: mesmo ternário de pílula ativa/inativa em 3 lugares (`GestaoJogadores.tsx:322-360`, `ModalEscalarJogador.tsx:74-97`, `ModalFiltrosRanking.tsx:121-149`).
- **Proposta**: `src/components/PilulaFiltro.tsx` (`ativo`, `children`, handlers). Só se houver 4º uso ou evolução visual — teto em um componente.
- **Esforço**: S · **Risco**: baixo · **Origem**: 01 (P2-7).

#### A8 · P2 — Chip "mini" no `Badge`
- **Problema**: chips de 9px (`text-[9px]`) recriam manualmente a assinatura que `Badge.tsx:86-87` já encapsula em 10px (~10 ocorrências em `LinhaJogadorGestao`, listas financeiras).
- **Proposta**: prop `densidade?: 'normal' | 'mini'` no `Badge`; **não** criar componente `Chip` separado (duas abstrações para o mesmo papel).
- **Esforço**: S · **Risco**: baixo · **Origem**: 01 (P2-8).

#### A9 · P3 — Pasta `ui/` para novas primitivas (adoção por toque)
- **Problema**: 63 arquivos planos em `src/components/` misturam primitivas, navegação e seções de tela; a raiz vai inchar com as extrações A1–A3.
- **Proposta**: novas primitivas (`CabecalhoSumula`, `Botao`, `CampoTexto`...) nascem em `src/components/ui/`. **Não mover** os 63 existentes; migração só quando o arquivo for tocado por mudança funcional, um por commit.
- **Esforço**: S · **Risco**: mínimo · **Origem**: 01 (P3-9).

#### A10 · P3 — Débitos registrados (corrigir só ao tocar os arquivos)
- 6 `<select>` nativos estilizados inline (`DialogoEvento.tsx:94`, `SeletorAtletasComparador.tsx:30,52`, `Estatisticas.tsx:183`, `NovoJogador.tsx:156,180` — contagem corrigida; doc 01 dizia 5 listando 6): migrar para `SelectSumula` **só se** ele ganhar suporte a `optgroup` (necessário em `DialogoEvento.tsx:102-120`, "Time Preto/Branco").
- Sufixos de card inconsistentes (`DueloCard`/`CardCraquePartida`/`CartaoJogadorEdicao`) e labels "Assists" em inglês (`Estatisticas.tsx:207`, `Perfil.tsx:189`, `CartaoJogadorEdicao.tsx:95`).
- Comentário no topo de `Skeletons.tsx` apontando `CabecalhoSumula` como referência de geometria (mitigação barata de drift).
- **Origem**: 01 (P3-10).

### Tema B — PWA & performance

#### B1 · P0 — Revalidar dados ao voltar online
- **Problema**: o `handleOnline` do `Layout.tsx:90-92` só desliga o banner offline; `invalidarCache()` não é chamado. Telas montadas continuam com dado do cache de memória até um PullToRefresh, troca de rota ou remount — o usuário que voltou do campo/subsolo vê dado velho **sem perceber**.
- **Proposta**: dentro do `handleOnline` existente, chamar `invalidarCache()` (sem argumento — `useCache.ts:39-58`); os ouvintes montados disparam `revalidar` na rede automaticamente. ~2 linhas, zero abstração nova.
- **Benefício**: telas se atualizam sozinhas ao reconectar, reusando a API de invalidação existente.
- **Esforço**: S · **Risco**: baixo (validar manualmente: online → offline → online, conferindo Resumo/Jogos revalidando sem skeleton) · **Origem**: 02 (P0-1).

#### B2 · P0 — Teclado Android vs barras fixas (`interactive-widget`)
- **Problema**: `index.html:5` não tem `interactive-widget`. No Chrome Android ≥108 (default `resizes-visual`), elementos `fixed bottom-0` ficam **atrás do teclado**: `BarraAcaoInferior` e `BarraRascunhoGestao` somem durante busca/edição nas telas de admin usadas em campo (`PartidaNova.tsx:205-210+237-279`, `GestaoJogadores.tsx` + `BarraRascunhoGestao.tsx:12-13`, `GestaoGoleiros.tsx` + `ModalNovoGoleiro`, `Administrador.tsx` + `FormLancamentoFinanceiro.tsx:167-208`).
- **Proposta**: `content="width=device-width, initial-scale=1.0, viewport-fit=cover, interactive-widget=resizes-content"` — **uma linha, só teclado**. Não toca em scale/zoom (ver "O que NÃO fazer" item 1: fix de zoom/escala via viewport é proibido — o caso "Versão para desktop" do Chrome foi inocentado).
- **Benefício**: o layout encolhe com o teclado; barras fixas sobem e a lista rola até o fim durante a digitação, em todas as telas afetadas de uma vez.
- **Esforço**: S · **Risco**: baixo-médio — **validação manual no aparelho obrigatória** (TabBar acima do teclado; `main` como scroll container encolhendo; safe-areas; `PullToRefresh.getScrollTop` achando o scrollTop do `main`).
- **Origem**: 02 (P0-2).

#### B3 · P1 — Aviso "nova versão disponível"
- **Problema**: `skipWaiting()` incondicional (`sw.js:55`) + `clients.claim()` (`sw.js:66`) e **nenhuma UI de atualização** (registro silencioso em `pwa.ts:66-74`; grep confirma zero `controllerchange`). No fluxo normal a versão nova chega no próximo cold start; a janela residual é o SPA quente em memória rodando contra um backend que evolui por migrations (108 até hoje) — telas podem falhar até o próximo restart.
- **Proposta**: em `initPWA`, listener `controllerchange` com guard "só se já existia controller antes" (o primeiro `claim` pós-instalação dispara o evento e não é update) + estado reativo no padrão dos ouvintes já existentes (`pwa.ts:44-55`); o `Layout` mostra "Nova versão disponível — Recarregar" que faz `window.location.reload()`. ~15 linhas, sem postMessage.
- **Esforço**: S · **Risco**: baixo (o guard do primeiro controller é o ponto de atenção: testar instalação limpa vs update real) · **Origem**: 02 (P1-1).

#### B4 · P2 — Poda de `/assets/*` antigos no `CACHE_STATIC`
- **Problema**: o `activate` só apaga caches com nome fora da lista (`sw.js:58-68`); entradas internas nunca são removidas. O handler same-origin cacheia toda resposta 200 (`sw.js:220-243`, verificado), e `vercel.json:45-49` marca `/assets/(.*)` como immutable — chunks hasheados de todos os deploys passados se acumulam (~500 KB–1 MB por deploy) num storage persistente no Android.
- **Proposta**: no `activate`, listar chaves do `CACHE_STATIC` e deletar as que começam com `/assets/` (imutáveis e re-baixáveis; HTML cacheado permanece como linha de defesa offline). ~8 linhas no `sw.js`.
- **Esforço**: S · **Risco**: baixo (janela rara offline entre ativação e primeira navegação → degrada para `offline.html`, sempre precacheada) · **Origem**: 02 (P2-1).

#### B5 · P3 — Manifest `shortcuts`
- **Problema**: `public/manifest.webmanifest` sem `shortcuts` (grep vazio, verificado) — toque longo no ícone não oferece atalhos.
- **Proposta**: 2 atalhos estáticos ("Jogos" → `/jogos`, "Ranking" → `/ranking/pontos`) reutilizando `icon.svg`. ~12 linhas de JSON.
- **Esforço**: S · **Risco**: baixo · **Origem**: 02 (P3-1).

#### B6 · P3 — Fontes self-host (condicional)
- Cold start depende de `fonts.googleapis/gstatic` (`index.html:27-32`); o SW mitiga a partir da 2ª execução (`sw.js:199-217`). Só fazer (`@font-face` locais, **sem** fontsource/dependências) se "primeira execução offline" virar queixa real. **Origem**: 02 (P3-2).

#### B7 · P3 — Bundle inicial: registrar e não mexer
- Medição revalidada no `dist/`: entry `index-*.js` 232,3 KB + chunk compartilhado `createLucideIcon-*.js` 256,3 KB (ícones lucide + módulos Storage/Realtime do supabase-js, eager porque o shell importa ícones estaticamente) ≈ **139 KB gzip** + 10 KB CSS. Para PWA instalado com SW é custo de 1ª execução apenas. `manualChunks`/subpaths seriam complexidade sem ganho nesta escala (~25 usuários). Reavaliar só se "primeira abertura em rede lenta" virar reclamação. **Origem**: 02 (P3-3).

### Tema C — Design system

#### C1 · P1 — Alvos de toque 44px nos CTAs-Link
- **Problema**: a regra global de 44px (`index.css:149-155`, verificado: `button, [role='button'], input[type=range]`) **não cobre `<a>`**. O CTA-Link "Nova partida" (`Jogos.tsx:121-127`, `px-3 py-1.5`) tem ≈32px de altura; o CTA de votação (`PartidaDetalhe.tsx:273-275`, `px-4 py-3`) fica no limite ≈42-44px. TabBar e menu admin estão OK.
- **Proposta**: correção pontual nos 2 CTAs-Link (`min-h-[44px]` + centralização). **Não** estender o seletor global para `a` (inflaria links inline de texto, como o e-mail em `EscalacaoTimesEditor.tsx:335`).
- **Esforço**: S · **Risco**: mínimo · **Origem**: 03 (P0-2; global P1 por impacto pontual, mas esforço mínimo — cabe na Fase 1).

#### C2 · P1 — Tokens de contraste `--cor-ok-texto` e `--cor-perigo-texto`
- **Problema**: verde `#58b368` e vermelho `#e4572e` não têm contraparte adaptativa. Contraste recalculado pelo consolidador: `text-ok` sobre superfícies claras ≈ **2,4:1** (abaixo até do limiar de texto grande 3:1) e `text-perigo` ≈ **3,4:1** — ambos usados como texto pequeno (`text-[9px]`–`text-xs`): `LinhaJogadorGestao.tsx:72-77`, `Badge.tsx:59`, `Estado.tsx:64`, `ListaReceitasAbertas.tsx:66,175`, `ListaDespesasAbertas.tsx:29,102,111`, `ConfirmacoesPartida.tsx:68,120,131,377`. No escuro (default) ficam ≈6,8:1 e ≈4,8:1 (bons) — o impacto é limitado às sessões em tema claro.
- **Proposta**: replicar o mecanismo consagrado do âmbar: `--cor-ok-texto`/`--cor-perigo-texto` em `:root`/`.dark` (escuro = valores atuais; claro = versões mais profundas, p.ex. verde ~`#2e7d32` e vermelho ~`#b3401e`, a validar visualmente), mapear no `@theme` e migrar **só os usos como texto pequeno** (~15-20 pontos). Manter `bg-ok`/`bg-perigo` para fundos.
- **Esforço**: M · **Risco**: baixo-médio (cor percebida muda um pouco no claro; validar lado a lado) · **Origem**: 03 (P1-1).

#### C3 · P2 — Token `--cor-scrim` e unificação dos overlays
- **Problema**: três overlays próximos e hardcoded — `ModalBase.tsx:68` usa `bg-black/75`; `ConfirmDialog.tsx:44` e `DialogoEvento.tsx:64` usam `bg-black/70` (hex de preto no JSX contraria `DESIGN.md:162`); hover do fechar do `Snackbar.tsx:73` carrega o **único `dark:` do app** (revalidado: exatamente 1).
- **Proposta**: `--cor-scrim: rgba(0,0,0,0.72)` (igual nos dois temas) + `--color-scrim` no `@theme`; trocar os 3 overlays por `bg-scrim`; hover do Snackbar → `hover:bg-superficie`. 4 arquivos.
- **Esforço**: S · **Risco**: baixo (diferença de opacidade imperceptível) · **Origem**: 03 (P0-1; global P2 — higiene real, impacto visual ínfimo).

#### C4 · P2 — Limpeza de tokens e dados mortos
- **Problema** (revalidado): `--cor-oliva` e `--cor-led-fundo-hover` definidos em `index.css:50,52` (`:root`) e `:72,74` (`.dark`), mapeados no `@theme` (`:27,:30`) — **zero usos** em `src/**.tsx`; campo `cor` de `TIMES` em `src/lib/times.ts:6,16,24` — zero consumo.
- **Proposta**: remover do CSS e de `TimeInfo` (YAGNI). Se `oliva` for intenção de paleta futura, registrar só no `DESIGN.md`.
- **Esforço**: S · **Risco**: trivial · **Origem**: 03 (P2-2).

#### C5 · P2 — Doc canônica de tokens em ordem
- **Problema**: `DESIGN.md:1` tem o H1 errado ("# ⚽ AGENTS.md — Diretrizes Canônicas…" — verificado) e a seção de design auto-referencia o próprio arquivo sem conter a tabela de tokens.
- **Proposta**: corrigir o H1, incluir a tabela `--cor-*` (nota: o CSS é a fonte executável), registrar a micro-escala de rótulos (9/10/11px) e os raios canônicos, e acrescentar comentário cruzado nos hexes duplicados (`tema.ts:18-19` ↔ `index.html` ↔ `manifest.webmanifest`) para edição coordenada.
- **Esforço**: S · **Risco**: nenhum (só doc) · **Origem**: 03 (P2-3).

#### C6 · P3 — Detalhes finos (aplicar ao tocar os arquivos)
- Chevron desenhado como SVG inline no Login (`Login.tsx:168-178`) → usar o `ChevronDown` do lucide.
- Text-shadow do LED (`PainelPlacar.tsx:48,134`) → virar utility `@utility glow-led` só se surgir 3ª variante.
- Uniformizar `outline-offset` do focus (`Snackbar.tsx:73` usa `offset-1` contra o `offset-2` global).
- Mover `#b37d00` de `shadow-carimbo-destaque` (`index.css:224-226`) para variável — cosmético.
- **Origem**: 03 (P3-1).

### Tema D — Camada de dados

#### D1 · P0 — Helper único de invalidação pós-mutação de partida
- **Problema** (linhas revalidadas uma a uma): o par `invalidarCache(CHAVE_JOGOS); invalidarCache(chaveResumo(new Date().getFullYear()))` está copiado em **7 sites de 6 rotas**: `Jogos.tsx:86-87`, `PartidaDetalhe.tsx:151-152`, `PartidaAoVivo.tsx:136-137` e `:223-224`, `PartidaEditar.tsx:204-205`, `PartidaTimes.tsx:210-211`, `PartidaNova.tsx:173-174`. Chave nova que dependa de partidas exige tocar 7 arquivos; esquecer um gera tela obsoleta silenciosa.
- **Proposta**: exportar de `lib/chavesCache.ts` (fonte única das chaves) `invalidarCachesDependentesDePartida(): void` (ou constante `CHAVES_PARTIDA_MUTADA` + loop) e substituir os 7 sites.
- **Benefício**: ponto único de manutenção; prepara terreno para chaves futuras (elenco, realtime).
- **Esforço**: S · **Risco**: mínimo (comportamento idêntico) · **Origem**: 02 (§2.4, como "6 rotas") + 04 (P0-1, "7 sites") — números compatíveis: 7 call sites em 6 rotas.

#### D2 · P1 — Servir elenco e derivados pelo cache SWR existente
- **Problema** (contagem corrigida: doc 04 dizia 9 telas; o real é **10 arquivos / ~15 call sites**): `listarJogadoresAtivos()` re-buscado sem cache em `Administrador.tsx:55`, `PartidaEditar.tsx:68`, `PartidaNova.tsx:67`, `PartidaTimes.tsx:102`, `ConfirmacoesPartida.tsx:249`; `listarTodosJogadores()` em `Comparador.tsx:71`, `GestaoJogadores.tsx:60`; `listarJogadoresAtivosSemRandom()` em `Estatisticas.tsx:57`; `listarGoleiros()` em `GestaoGoleiros.tsx:63` (+refetches `:91,130,148`), `PartidaTimes.tsx:103`; `listarUsernames()` em `Login.tsx:39`. Derivados idem: `obterMediasNotasJogadores` (`Comparador.tsx:96`, `PartidaTimes.tsx:104`), `obterPartidasRecentesJogadores` (`PartidaNova.tsx:67`, `ConfirmacoesPartida.tsx:250`), `carregarStatsJogador` (`Perfil.tsx:48`, `Estatisticas.tsx:86`). Navegar Resumo → Jogos → Nova partida → Detalhe dispara 4+ fetches do elenco na mesma sessão.
- **Proposta**: **sem novo mecanismo** — usar o `useCache` existente: (1) chaves novas em `lib/chavesCache.ts` (`CHAVE_ELENCO_ATIVO`, `CHAVE_ELENCO_TODOS`, `CHAVE_GOLEIROS`, `CHAVE_MEDIAS_NOTAS`); (2) trocar o `useEffect`+`useState` por `useCache(chave, fetcherDaLib)` nas telas leitoras; (3) invalidar nas mutações de elenco (`NovoJogador.tsx`, `GestaoJogadores.tsx`, `GestaoGoleiros.tsx` — os mesmos pontos onde hoje elas refazem a listagem local).
- **Benefício**: navegação serve o elenco instantaneamente do cache; menos requisições em rede móvel; menos boilerplate duplicado.
- **Esforço**: M · **Risco**: baixo-moderado (dado levemente obsoleto se mutação esquecer invalidação — mitigado pelo passo 3; telas que editam PIX/telefone mantêm refetch local) · **Origem**: 04 (P1-2).

#### D3 · P1 — Migrar telas leitoras simples para `useCache` (aposentar `geracaoRef` manual)
- **Problema** (revalidado): proteção contra resposta obsoleta reimplementada à mão em `EstatisticasRacha.tsx` (5 refs), `Estatisticas.tsx` (5 refs) e `BannerLembrete.tsx` (4 refs) — exatamente o que `useCache.ts:70-77,131-139` já faz. `EstatisticasRacha` é o caso mais claro: leitura única, sem mutação nem polling.
- **Proposta**: migrar `EstatisticasRacha` primeiro (S): `useCache(chaveParesRacha(MIN_PARTIDAS), buscar)`. Depois `Estatisticas` (M): chave por `jogadorSelecionadoId`. `BannerLembrete` fica como exceção legítima (polling próprio). **Não migrar** telas de partida (estado interdependente, mutação-pesada).
- **Esforço**: S → M · **Risco**: baixo · **Origem**: 04 (P1-3).

#### D4 · P2 — Derivar tipos de `database.types.ts` (incremental)
- **Problema** (revalidado): o arquivo gerado é completo e atual, mas o único consumidor é `lib/supabase.ts:2` (grep confirmado). As leituras já retornam tipos do gerador e o código os sobrescreve com casts nas libs (`partidas.ts`, `jogadores.ts`, `dividas.ts`, `notificacoes.ts`, `eventosFinanceirosAutomaticos.ts`); tipos de query moram em rotas (`LinhaRanking` em `Ranking.tsx:47-59`, `Partida`/`Placar` locais em `Jogos.tsx:21-31`). Drift de migration compila sem erro.
- **Proposta**: derivar onde o mapeamento é 1:1, um módulo por vez — ex.: `type ParRacha = Database['public']['Functions']['pares_racha']['Returns'][number]` (elimina a interface em `partidas.ts:137-148` + cast). **Manter** os casts de narrowing onde views são nullable/`string` (estratégia correta, só comentar). Sem big-bang; `tsc -b` valida.
- **Esforço**: S por módulo · **Risco**: baixo (type-level) · **Origem**: 04 (P2-4).

#### D5 · P2 — Consolidar as últimas queries fora da `lib`
- **Problema** (revalidado — 4 sites fora do `SessaoContext`): `Jogos.tsx:51-54` (view `partidas_com_placar`), `Ranking.tsx:108-118` (view `ranking`), `BannerLembrete.tsx:37-41` (partidas com votação aberta), `PartidaNova.tsx:158` (RPC `criar_partida` — única mutação fora da lib). O `SessaoContext.tsx:50-54` é aceitável (dono do estado de sessão).
- **Proposta**: mover cada query para função pura em `lib/`: `carregarMuralJogos()`, `carregarPartidasComVotacaoAberta()`, `carregarRanking(filtro)`, `criarPartida(dados)`. Transposição literal; polling/geração/countdown permanecem no componente.
- **Benefício**: consistência total do padrão "tela → lib → supabase"; a função de votação aberta já tem segunda demanda (lembrete); queries de tela viram cacheáveis (pré-requisito do D2).
- **Esforço**: S cada · **Risco**: mínimo · **Origem**: 04 (P2-5).

### Tema E — UX funcional

#### E1 · P1 — Cédula de votação: sinal honesto
- **Problema** (revalidado): as notas nascem pré-preenchidas com 6 (`PartidaVotar.tsx:~176-180`), então `avaliadosCount === alvos.length` no mount (`:222-223`), a barra "Progresso da cédula" nasce em 100% e o rótulo alternativo do botão, "Avalie todos (n restantes)" (`:378-380`), é **código morto** — o jogador não entende o atalho de votar só em quem se destacou.
- **Proposta mínima** (sem mexer no `SeletorNota` acessível): rastrear notas realmente *tocadas* e exibir "Você ajustou 3 de 12 — as demais ficam com 6"; o botão continua habilitado e o rótulo comunica a economia ("Enviar votos — 3 ajustes"); `vibrateSuccess` ao enviar. Opcional (M): botões −/+ junto ao gatilho do `SeletorNota` compacto.
- **Esforço**: S (estado derivado + rótulos) · **Risco**: baixo · **Origem**: 05 (P0-2).

#### E2 · P1 — Painel da Semana: confirmar presença em 1 toque na home
- **Problema** (revalidado): o card "PRÓXIMA QUINTA" diz "Toque para confirmar presença ou consultar a súmula" (`Resumo.tsx:217-219`) mas leva ao detalhe, onde o "Vou jogar" vive no fim da lista de confirmações (`ConfirmacoesPartida.tsx:36-75`) — 3 toques + scroll para a tarefa que todo jogador faz toda semana.
- **Proposta**: o card vira um *Painel da Semana* contextual: estado do próprio jogador (confirmado/pendente/recusado/não convocado), vagas `x/14` e botão inline **"Vou jogar"** que chama `confirmarPresenca` direto da home — reuso total do haptics + atualização otimista já implementados (`ConfirmacoesPartida.tsx:181-211`, verificado). Quando a votação está aberta, o painel assume o CTA "Votar no Craque" (complementa o `BannerLembrete`, sem duplicar). Usar os mesmos guards de vaga/prazo (`podeConfirmar`) e revalidar na confirmação para não exibir estado mentiroso com cache velho.
- **Esforço**: S–M · **Risco**: baixo · **Decisão do dono antes de executar** (é o único item que adiciona UI nova; 3 drafts já existem no canvas — Apêndice) · **Origem**: 05 (P0-1).

#### E3 · P1 — Recuperação de erro e consistência de feedback nas telas de partida
- **Problema** (revalidado): `MensagemEstado` não tem ação de retry (`Estado.tsx:68-89`); Detalhe/Ao Vivo/Votar carregam sempre da rede e não têm PullToRefresh (grep confirmado: PTR presente só em 7 rotas — Resumo, Jogos, Ranking, Estatisticas, EstatisticasRacha, Comparador, Administrador) — sem sinal no campo, o usuário fica preso numa mensagem morta. `PartidaNova.tsx:197` renderiza o erro **no topo** da página enquanto o dedo está na `BarraAcaoInferior`. Sucesso alterna entre `Snackbar` e `MensagemEstado` no mesmo fluxo; não há `vibrateSuccess` ao finalizar partida nem ao enviar votos.
- **Proposta**: (1) prop opcional `acao` ("Tentar novamente") em `MensagemEstado`; (2) envolver `PartidaDetalhe`, `PartidaAoVivo` e `PartidaVotar` no `PullToRefresh` existente (cuidado para o pull não brigar com o polling de 10s do AoVivo — `PartidaAoVivo.tsx:90-96`); (3) padronizar sucesso do fluxo de partida em `Snackbar` + `vibrateSuccess`; (4) mover o erro de `PartidaNova` para junto da barra de ação.
- **Esforço**: S–M · **Risco**: baixo (todas as primitivas já existem) · **Origem**: 05 (P1-3).

#### E4 · P1 — Ranking: "sua posição" com jump
- **Problema**: com 30+ atletas, achar a própria linha exige rolar tabela com scroll horizontal (`Ranking.tsx:429-504`); a linha do jogador já é destacada (`:471-480`).
- **Proposta**: chip fixo acima da tabela "Você: 8º · 21 pts" com `scrollIntoView` na linha destacada ao toque (respeitar `data-no-swipe`).
- **Esforço**: S · **Risco**: baixo · **Origem**: 05 (P1-4).

#### E5 · P2 — Perfil reordenado + "Minhas Dívidas" (ideia #1 do roadmap do dono)
- **Problema** (revalidado): formulários de acesso dominam o `Perfil.tsx`; o jogador não vê nada do financeiro. O roadmap do dono (`docs/ideias-novas-funcionalidades.md`, ideia #1) já prioriza o extrato "Minhas Dívidas".
- **Proposta**: **apoiar a ideia #1, não duplicá-la** — `listarDividasEmAberto` filtrado por `jogador_id` como seção do Perfil (total devido em `font-mono` visível sem tocar), e mover username/senha para um bloco "Acesso" abaixo das estatísticas. Não criar tela `/financas` nesta fase; não duplicar CTA de pagamento.
- **Esforço**: S · **Risco**: baixo · **Origem**: 05 (P2-5).

#### E6 · P2 — Jogos: filtro por status
- **Problema**: mural único cresce sem filtro (`Jogos.tsx:50-72`); ao vivo se perde no histórico.
- **Proposta**: chips de status (Ao vivo · Encerradas · Rascunho) no cabeçalho, padrão idêntico aos chips do Ranking. Temporada fica para o roadmap #2 do dono — não antecipar.
- **Esforço**: S–M · **Risco**: baixo · **Origem**: 05 (P2-6).

#### E7 · P3 — Micro-ajustes de feedback (junto de qualquer P0/P1 que toque a área)
- `vibrateLight` no toque de aba da TabBar (`Layout.tsx:261-334`); skeleton dedicado para os fluxos focados (hoje `CarregandoGeral`); ajustar o texto do banner offline quando a tela não usa cache ("sem conexão — tente novamente" vs "dados locais salvos" — ressalva honesta: em Detalhe/Ao Vivo/Votar offline é erro, não dado local).
- **Origem**: 05 (P3).

---

## 4. Roadmap incremental sugerido

Fases de escopo pequeno e revisável; **cada item é um commit próprio e revisável isoladamente** (nada de misturar refactor estrutural com regra de negócio no mesmo PR). Nenhum item cria testes automáticos (diretriz atual do AGENTS.md); as validações indicadas são manuais no aparelho.

**Fase 1 — Infra e quick wins (sem tocar UI de negócio)**
1. D1 (helper de invalidação — meio dia, remove o maior copy-paste).
2. B1 (revalidar ao voltar online) + validação manual online/offline/online.
3. B2 (`interactive-widget`) + **validação manual obrigatória no aparelho**.
4. C1 (alvos de toque nos 2 CTAs-Link).
5. B3 (aviso de nova versão) — testar instalação limpa vs update real.

**Fase 2 — Duplicação estrutural (extrações incrementais)**
1. A1 `CabecalhoSumula` — criar componente e migrar rota por rota (começar pelas 4 cópias idênticas do módulo notificações).
2. A2 `Botao` — **decisão do dono: componente vs constantes de classe** — depois migrar os 3 pares duplicados + 4 rodapés.
3. A3 `CampoTexto`/`CampoTextoLongo` — junto da próxima evolução dos formulários admin.
4. A4 higiene de nomenclatura (qualquer momento).

**Fase 3 — Camada de dados (preparação e cache)**
1. D5 (queries fora da lib → lib; transposições mecânicas) — precede o D2.
2. D2 (elenco/derivados via useCache) — chaves + migração de call-sites + invalidações.
3. D3 (EstatisticasRacha → Estatisticas).
4. D4 (tipos derivados — por oportunidade, a cada módulo tocado).

**Fase 4 — UX funcional (regra de negócio/fluxo)**
1. E1 (cédula sinal honesto).
2. E3 (retry/ptr/haptics nas telas de partida) — fora de janela de partidas ao vivo.
3. E2 (Painel da Semana) — **exige decisão/aprovação do dono**; usar os drafts do canvas como referência.
4. E4 (ranking "sua posição"), E6 (filtro de status do mural), E5 (Perfil + Minhas Dívidas — em coordenação com o roadmap do dono).

**Fase 5 — Higiene P2/P3 (junto das mudanças que tocarem os arquivos)**
A5 (DialogoEvento → ModalBase, fora de partida ao vivo) · C2 (tokens ok/perigo-texto, validar lado a lado) · C3 (scrim) · C4 (tokens mortos) · C5 (DESIGN.md) · B4 (poda de cache) · B5/B6/B7, A6–A10, C6, E7.

**Decisões do dono antes de executar**: A2 (componente vs constantes); E2 (aprovar escopo/draft do Painel da Semana); E5 (sincronizar com o plano "Minhas Dívidas" já priorizado); A5 (janela fora de ao-vivo). **Fora de discussão**: realtime segue o plano próprio (`docs/plano-escolha-times-realtime.md`, migration 109 reservada — nenhum item deste plano implementa Realtime); zoom/escala via viewport nunca.

---

## 5. Itens avaliados e descartados/rebaixados

**Descartados (propostas de origem ou ideias recorrentes que violam a filosofia do repo):**
- **Workbox / vite-plugin-pwa**: o SW manual de 245 linhas cobre exatamente as 3 estratégias necessárias e é entendido por quem mantém (02 §4).
- **React Query / TanStack / SWR / Zustand**: o `useCache` caseiro já implementa o essencial; migrar 9+ consumidores por zero ganho (04 §4).
- **Biblioteca de UI (Radix/shadcn/MUI/headless) ou react-hook-form**: primitivas próprias funcionais + identidade visual não sobrevive a kit genérico (01/03 §4).
- **Virtualização de listas**: escala real (~35 jogadores, ~100 partidas/ano) não justifica (02 §4).
- **Componente `Cartao` genérico** para os 138 shells de card: coincidência de tokens, não de comportamento; geraria props-bandeira (01 §4).
- **Unificar `ConfirmDialog` no `ModalBase`**: canônico na função, 10 usos, refactor cosmético (01 §4).
- **Migrar Skeletons para componentes reais**: quebraria CLS=0 e criaria dependência bidirecional (01 §4).
- **Padronização retroativa de APIs de props pt-BR**: refactor cosmético amplo (01 §4).
- **Fix de zoom/escala via viewport** (`user-scalable`, `maximum-scale`, `touch-action` global, escala manual): **proibido** — o caso "Versão para desktop" do Chrome foi inocentado ponto a ponto; o único ajuste de viewport defendido (B2) trata teclado, não escala (02 §4; memória do projeto).
- **`prefers-color-scheme` no tema**: quebraria a escolha explícita + anti-flash (03 §4).
- **Tokens de espaçamento custom**: overengineering (03 §4).
- **Caçar emojis de domínio**: parte do tom de voz (03 §4).
- **Estender o seletor global de 44px para todos os `<a>`**: inflaria links inline (03 §4).
- **Persistir cache SWR em localStorage / cross-tab**: subsistema novo sem ganho nesta escala (04 §4).
- **Camada "ApiService/Repository" genérica**: os módulos `lib/*.ts` já são a camada de dados (04 §4).
- **Contexto global de snackbar/erro**: padrão local atual é simples e previsível (04 §4).
- **Realtime fora do plano próprio**: duplicaria decisão de arquitetura já tomada (04/05 §4; plano em `docs/plano-escolha-times-realtime.md`).
- **Trocar o `SeletorNota` por slider/control novo, redesenhar TabBar, "dashboard" com widgets na home, mover toggle de tema, filtros avançados no Ranking, `/financas` como tela nova agora**: YAGNI / contra o roadmap do dono (05 §4).
- **Fundir nota da urna (6) com `NOTA_PADRAO`**: domínios distintos — acoplamento perigoso (04 §4).

**Rebaixados (com motivo):**
- **Scrim/overlays** (doc 03 P0 → global **P2**): higiene real de tokens, mas impacto visual imperceptível (70% → 72%); não bloqueia nada.
- **Alvos de toque CTAs-Link** (doc 03 P0 → global **P1**): impacto pontual (2 CTAs), porém esforço mínimo — encaixa na Fase 1.
- **Higiene de nomenclatura** (doc 01 P1 → mantida P1, fora do top 10): zero risco, mas zero impacto funcional.
- **EstatisticasRacha/Estatisticas → useCache** (doc 04 P1 → mantida P1, fora do top 10): ganho de conveniência (stale-while-revalidate nas abas), não de fluxo crítico.
- **Doc 01 "rodapés Fechar em 4 modais"**: verificado — são 3 "Fechar" + 1 "Cancelar" (`ModalSelecionarAgendamento.tsx:82`); mesma proposta, contagem ajustada.
- **Doc 01 "5 selects nativos"**: são **6** (o doc listava 6 referências); proposta mantida como P3.

---

## 6. Apêndice

### Canvas Superdesign
- **Projeto**: https://superdesign.dev/teams/26ebda17-47af-4cfd-ab18-99fcd594ac6a/projects/ea171285-6b2c-422c-8bfc-5b82c4209ffc
- Draft 1 — **Resumo · Painel da Semana** (E2/P0-1): confirmação em 1 toque na home — https://p.superdesign.dev/draft/a95e261a-f89f-404a-845c-fdb2c87ea68e
- Draft 2 — **Cédula de Votação · Sinal Honesto** (E1/P0-2): contador "ajustou x de y" + −/+ rápido — https://p.superdesign.dev/draft/6a14a50a-3612-4cf1-ba61-0ac5cd5ea21a
- Draft 3 — **Partida · Hub com Próxima Ação** (E3/P1-3): trilha de etapas + CTA único + retry em erro — https://p.superdesign.dev/draft/744921f5-5eb9-4066-a527-b3d2a89e1003

Contexto do init (mapa de componentes, layouts, rotas, tema, páginas): `.superdesign/init/` — 6 arquivos verificados existentes (`components.md`, `extractable-components.md`, `layouts.md`, `pages.md`, `routes.md`, `theme.md`); resumo em `docs/tmp-analise-pwa/00-superdesign-init.md`.

### Docs de origem
| Doc | Tema |
|---|---|
| `docs/tmp-analise-pwa/00-superdesign-init.md` | Init da skill Superdesign (mapa de stack, primitivas, tokens, rotas) |
| `docs/tmp-analise-pwa/01-componentes-reutilizaveis.md` | Componentes reutilizáveis e duplicação de UI |
| `docs/tmp-analise-pwa/02-pwa-tecnico.md` | PWA técnico e performance mobile |
| `docs/tmp-analise-pwa/03-design-system.md` | Design system, tokens e consistência visual |
| `docs/tmp-analise-pwa/04-camada-dados.md` | Camada de dados, estado e serviços |
| `docs/tmp-analise-pwa/05-ux-funcional.md` | UX funcional e produto (+ drafts do canvas) |

Docs relacionados citados e respeitados: `docs/ideias-novas-funcionalidades.md` (roadmap do dono — ideia #1 Minhas Dívidas apoiada, não duplicada), `docs/plano-escolha-times-realtime.md` (realtime tem plano próprio, migration 109 — nada aqui antecipa), `DESIGN.md` (canônico de identidade), `AGENTS.md` (filosofia).

---

## 7. Validação (o que o consolidador conferiu)

**Método**: leitura dos 6 docs de origem + `AGENTS.md`; recontagem independente de cada número divergente via grep/script sobre `src/`; verificação de caminho:linha das evidências P0/P1; conferência de compatibilidade de cada proposta com a arquitetura (lib de domínio + hooks + contexto + primitivas próprias) e com o AGENTS.md.

**Conferido e confirmado sem divergência (amostra)**:
- 131 `<button>` (39 rotas + 92 componentes) — doc 01 exato.
- Par de invalidação: 7 sites/6 rotas, linhas exatas conforme doc 04 (Jogos:86-87, Detalhe:151-152, AoVivo:136-137 e 223-224, Editar:204-205, Times:210-211, Nova:173-174).
- PWA: viewport sem `interactive-widget` (`index.html:5`); `skipWaiting` (`sw.js:55`)/`claim` (`sw.js:66`) sem poda de entradas; fallback `offline.html` (`sw.js:233-237`); registro silencioso sem `controllerchange` (`pwa.ts:66-74`); manifest sem `shortcuts`; `vercel.json:45-49` immutable; sem `controllerchange`/`updatefound` em `src/`.
- Dados: 39 RPCs com 1 chamada cada; `database.types.ts` consumido só por `supabase.ts`; 4 queries fora da lib (Jogos, Ranking, BannerLembrete, PartidaNova:158); `geracaoRef` manual em Estatisticas/EstatisticasRacha/BannerLembrete; Realtime zero (`grep .channel(` vazio).
- Design: `dark:` exatamente 1 (`Snackbar.tsx:73`); `text-destaque` cru exatamente 8 (PainelPlacar 7 + CampoPartida 1); tokens `oliva`/`led-fundo-hover` e `TIMES.cor` com zero usos; overlays 75/70/70; seletor de 44px sem `<a>`; CTA "Nova partida" ≈32px; contraste recalculado: 2,4:1 (ok) e 3,4:1 (perigo) — bate com o doc 03; `DESIGN.md:1` com H1 errado.
- UX: prefill 6 e barra nascendo 100% + rótulo morto em `PartidaVotar`; `MensagemEstado` sem retry (`Estado.tsx:68-89`); erro no topo em `PartidaNova.tsx:197`; PullToRefresh em exatamente 7 rotas e ausente nas de partida + Perfil; confirmação otimista + `vibrateSuccess` em `ConfirmacoesPartida.tsx:181-211`; card da home com texto/caminho conforme doc 05; polling de 10s em `PartidaAoVivo.tsx:90-96`; 5 padrões em `haptics.ts`.
- Viabilidades: API do `ModalBase` (`tamanhoMaximo`/`posicao`/`mostrarBotaoFechar`) suporta a migração do `DialogoEvento`; `DialogoEvento` usa `optgroup` (`:102-120`) — confirma a cautela de não migrar selects sem suporte; `.superdesign/init/` com 6 arquivos; bundle raw conferido no `dist/` (232,3 KB + 256,3 KB).

**Números corrigidos na consolidação**:
1. **Cabeçalho editorial**: doc 01 dizia "18 rotas", doc 03 dizia "19 telas" → correto: **18 rotas + 3 componentes de seção** (+7 espelhos em `Skeletons.tsx`; 22 arquivos contêm `sumula-header`).
2. **Botão primário**: doc 01 dizia ~31 em 21 arquivos, doc 03 ~32 → recontado com script (abertura de tag): **25 `<button>` em 21 arquivos + 4 CTAs-Link**; as contagens por linha superestimavam (capturavam `Badge`, abas e classNames multilinha). A proposta não muda.
3. **Elenco re-buscado**: doc 04 dizia "9 telas/componentes" → são **10 arquivos** (`Login.tsx` também), ~15 call sites contando refetches de `GestaoGoleiros`/`PartidaTimes`.
4. **Selects nativos**: 5 → **6**. **Rodapés "Fechar"**: 4 → **3 "Fechar" + 1 "Cancelar"**.

**Rejeitado/rebaixado**: ver seção 5 — nenhum item do plano introduz biblioteca nova, camada nova ou redesign; realtime e zoom/escala explicitamente fora; itens que contradizem o roadmap do dono foram alinhados (E5 apoia a ideia #1 sem duplicá-la; E6 não antecipa temporadas).

**Não alterado**: nenhum doc de origem, nenhum código, nenhum commit. Este documento é o único artefato criado.
