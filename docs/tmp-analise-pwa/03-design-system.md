# 03 — Design System, Tokens e Consistência Visual (ótica mobile/PWA)

> Análise do design system "Súmula de Quinta" do repositório `racha`, sob a ótica de uso **exclusivo como PWA instalado no celular**. Toda evidência citada como `caminho:linha` foi verificada no código-fonte real em 2026-09-29. Nenhum código foi alterado; nenhum draft/credito gasto no canvas superdesign.
>
> Conforme a filosofia do `AGENTS.md` (KISS/YAGNI/DRY com critério), as propostas são incrementais e preservam a arquitetura: nada de biblioteca de UI, nada de reescrita de tokens.

---

## 1. Resumo executivo (top 5 propostas)

O sistema de tokens está **saudável e acima da média**: 19 variáveis semânticas `--cor-*` cobrindo quase 100% do JSX, tema por classe `.dark` resolvido inteiramente por variáveis (apenas **1 uso** de prefixo `dark:` em todo `src/` — `Snackbar.tsx:73`), regras globais de mobile (44px, anti-zoom 16px, focus âmbar, safe-area) já aplicadas em `src/index.css`. O mecanismo `--cor-destaque-texto` (âmbar adaptativo p/ contraste) está bem adotado: 224 usos de `text-destaque-texto`/`text-destaque-tinta` contra apenas 8 usos crus de `text-destaque` — todos intencionais, sobre o fundo fixo do placar LED.

O que resta são lacunas pontuais, priorizadas:

| # | Proposta | Prioridade | Esforço |
|---|----------|-----------|---------|
| 1 | Criar token `--cor-scrim` e unificar os overlays de modal (`bg-black/70` vs `bg-black/75`) e o hover do fechar do Snackbar (único `dark:` do app) | P0 | S |
| 2 | Corrigir alvos de toque de Links/CTAs abaixo de 44px (o seletor global `button,[role=button]` não cobre `<a>`) | P0 | S |
| 3 | Criar `--cor-ok-texto` e `--cor-perigo-texto` seguindo o precedente `--cor-destaque-texto`: no tema claro, verde `#58b368` como texto tem ~2,4:1 e vermelho `#e4572e` ~3,4:1 — abaixo do WCAG AA para o tamanho de texto em que são usados | P1 | M |
| 4 | Consolidar o botão primário (32 cópias inline da mesma fórmula de classes, com drifts de sombra/padding) em constantes compartilhadas de variante (primário/secundário/perigo), no estilo `VARIANTE_CLASSES` do `Badge.tsx` | P1 | M |
| 5 | Extrair o `HeaderSumula` (cabeçalho editorial `sumula-header` + título display repetido inline em 19 telas) como componente do próprio projeto | P2 | M |

Detalhes, evidências e "o que NÃO fazer" nas seções 2–4.

---

## 2. Estado atual mapeado (com evidências)

### 2.1 Arquitetura de tokens

- **Fonte única**: `src/index.css` é ao mesmo tempo globals + "tailwind.config" (Tailwind 4 via `@tailwindcss/vite`, sem config JS). Bloco `@theme` em `src/index.css:5-32` espelha 19 variáveis `--cor-*` como utilitárias `--color-*` (ex.: `bg-fundo`, `text-giz`, `border-borda`, `bg-destaque`, `bg-led-fundo`).
- **Paleta**: `:root` em `src/index.css:34-54` (papel creme `#f3efe4`, superfícies `#faf7ee`/`#ece7d8`, tinta `#1e1c18`) e `.dark` em `src/index.css:56-76` (refletor `#12100d`, superfícies `#1b1814`/`#242019`). Âmbar `#ffb300` fixo nos dois temas (`src/index.css:43` e `:65`), com a variante adaptativa `--cor-destaque-texto`: `#92400e` no claro (`src/index.css:44`) e `#ffb300` no escuro (`src/index.css:66`).
- **Tipografia** (`src/index.css:6-8`): `--font-sans` Archivo, `--font-display` Barlow Condensed, `--font-mono` Chivo Mono. Não há escala tipográfica em tokens — a escala é convenção de classes: dominante `text-xs`, micro-rótulos `text-[10px]` (80 ocorrências), `text-[11px]` (44) e `text-[9px]` (14) em todo `src/`.
- **Espaçamento**: escala padrão do Tailwind 4, sem override. Container canônico `max-w-2xl mx-auto px-3 sm:px-4` (ex.: `src/routes/Ranking.tsx:219`, `src/routes/Layout.tsx:131`).
- **Raios**: também por classe arbitrária, com distribuição consistente: `rounded-[4px]` (234×, canônico), `rounded-[2px]` (101×, badges), `rounded-[3px]` (81×, chips/itens), `rounded-full` (8×, dots/switch), `rounded-t-[6px]` (2×, bottom-sheet do `ModalBase.tsx:82`).
- **Sombras carimbo** (offset sólido, sem blur): `shadow-carimbo` (`src/index.css:220-222`, usa `var(--cor-borda)`), `shadow-carimbo-destaque` (`src/index.css:224-226`, hex `#b37d00` hardcoded na própria utility), `shadow-carimbo-preto` (`src/index.css:228-230`).
- **Utilities editoriais**: `sumula-header` (linha pontilhada 2px dotted, `src/index.css:232-234`), `no-scrollbar` (`:178-184`), `scrollbar-sumula` (`:187-210`), `transition-fast/normal` (`:212-218`), `animate-fade-in/slide-up` (`:236-242`).

### 2.2 Regras globais de mobile/PWA (já corretas)

- Alvo de toque: `min-height: 44px` global para `button`, `[role='button']` e `input[type=range]` (`src/index.css:149-155`).
- Anti-zoom iOS: inputs/selects/textarea em `font-size: 16px` (`src/index.css:106-110`).
- Focus visível global âmbar: `outline: 2px solid var(--cor-destaque-texto)` (`src/index.css:158-165`).
- Textura de ruído global via `body::after` com `feTurbulence` (`src/index.css:95-104`).
- Safe-area no body (`src/index.css:85-87`), TabBar (`src/routes/Layout.tsx:259`), `BarraAcaoInferior` (`src/components/BarraAcaoInferior.tsx:28`), `ModalBase` (`src/components/ModalBase.tsx:85`) e `Snackbar` (`src/components/Snackbar.tsx:56`).
- `prefers-reduced-motion` respeitado (`src/index.css:167-176`).

### 2.3 Tema claro/escuro

- Default **dark**, persistência em `localStorage['racha_tema']`, classe `.dark` no `<html>`, atualização do `meta theme-color` por JS (`src/lib/tema.ts:8-49`).
- Anti-flash: script inline no `<head>` aplica a classe e o theme-color antes do primeiro paint (`index.html`), com `theme-color` inicial `#12100d`.
- Toggle no header sticky com haptics (`src/routes/Layout.tsx:137-153`, `src/lib/tema.ts:58-61`).
- **A adaptação de tema é feita por tokens, e funciona**: existe apenas 1 uso de prefixo `dark:` em todo `src/` (`src/components/Snackbar.tsx:73`, no hover do botão fechar). As cores fixas — Preto `#0d0d0e`/Branco `#f4f1e8` dos times (`src/index.css:41-42`) e o fundo LED `#0d0d0e` — são **intencionais** (identidade dos times e do painel eletrônico; o LED deve "acender" igual nos dois temas). Nenhuma tela quebra em nenhum dos temas: o mini-campo usa `var(--cor-campo)`/`var(--cor-campo-linha)` que adaptam (`src/components/CampoPartida.tsx:104-150`), e os chips de jogador usam os tokens fixos de time de forma consistente (`src/components/CampoPartida.tsx:33-37`, `src/components/BadgeTime.tsx:26-30`).
- Uso cru de `text-destaque` (8 ocorrências): todas em `src/components/PainelPlacar.tsx` (linhas 13, 48, 51, 91, 134, 137, 143) e `src/components/CampoPartida.tsx:228` — sempre sobre `bg-led-fundo` fixo escuro, ou seja, contraste garantido e efeito LED intencional. **Nenhum uso de destaque cru sobre papel/superfície que fuja do mecanismo `destaque-texto`.**

### 2.4 Duplicação e hardcodes residuais

| Ocorrência | Evidência | Avaliação |
|---|---|---|
| Overlays de modal `bg-black/70` vs `bg-black/75` | `src/components/ConfirmDialog.tsx:44`, `src/components/DialogoEvento.tsx:64` (70) vs `src/components/ModalBase.tsx:68` (75) | Drift real entre modais irmãos; hex de preto hardcoded no JSX (contraria a regra do `DESIGN.md:161`) |
| Hover do fechar do Snackbar `hover:bg-black/10 dark:hover:bg-branco-time/20` | `src/components/Snackbar.tsx:73` | Único `dark:` do app; mesma fórmula de hover já existe em tokens (`hover:bg-superficie-2`, usada em `Layout.tsx:146`) |
| Hexes no SVG do Logo | `src/components/Logo.tsx:32-46` | Aceitável — asset de marca (escudo). Recomenda-se apenas registrar como identidade |
| Hexes duplicados de fundo do tema | `src/lib/tema.ts:18-19` (`#12100d`/`#f3efe4`) + `index.html` (meta/script) + `manifest.webmanifest` | Duplicação **inevitável** (meta e script inline não aceitam `var()`), mas merece comentário cruzado para edição coordenada |
| Campo `cor` de `TIMES` não consumido | `src/lib/times.ts:16,24` | Hex morto: nenhum componente usa `TIMES[x].cor` (só `nome`/`bgClasse`/`textClasse`/`borderClasse`) |
| Tokens mortos `--cor-oliva` e `--cor-led-fundo-hover` | Definidos em `src/index.css:50,72` e `:52,74`, mapeados no `@theme` em `:27` e `:30` — **zero usos** em `src/**.tsx` | Código morto no design system |
| Text-shadow do LED com rgba hardcoded | `src/components/PainelPlacar.tsx:48,134` (`rgba(255,179,0,0.5/0.55)`) | Identidade LED; poderia virar utility `glow-led`, mas é baixo custo manter |

### 2.5 Consistência de componentes entre telas

**Cabeçalho de tela**: padrão repetido manualmente em 19 telas — `BotaoVoltar` + título `font-display font-bold text-xl uppercase tracking-wider text-giz` + `sumula-header` (evidências: `src/routes/Ranking.tsx:223-230`, `src/routes/Jogos.tsx:110-118`, `src/routes/PartidaDetalhe.tsx:173`, `src/routes/Administrador.tsx:202`, entre outras; lista completa via `grep sumula-header` = 22 arquivos). Variações menores: `Resumo.tsx:128` usa `h1 text-2xl` (correto — tela-raiz/boletim), `GestaoGoleiros.tsx:190` usa `font-black` (drift), e alguns usam `h2` em telas que não têm `h1`. O init (`.superdesign/init/extractable-components.md`, seção "HeaderSumula") já aponta como candidato a extração.

**Botões**: a fórmula do botão primário âmbar (`border-destaque bg-destaque … text-destaque-tinta`) está colada inline **~32 vezes**, com drifts pequenos porém reais:

- Sombra: `shadow-carimbo` (24×) vs `shadow-carimbo-destaque` (3×) no mesmo papel funcional;
- Hover: `hover:brightness-105` (25×) vs `brightness-110` (2×, só no tom perigo do `ConfirmDialog.tsx:81`);
- Padding: `px-4 py-3` vs `px-4 py-2.5` vs `px-3 py-2`;
- Explícito repetido: `focus-visible:outline-2 focus-visible:outline-destaque-texto` 52× (redundante com o global de `index.css:158-165`, e inofensivo; um caso usa `outline-offset-1`, `Snackbar.tsx:73`, contra o `offset-2` do resto).

Botão perigoso: não há padrão reutilizável — o `ConfirmDialog.tsx:80-83` define um (`border-perigo bg-perigo text-branco-time`), o `StepperBox.tsx:28-36` usa `bg-perigo/90`, e destrutivos inline aparecem com `hover:text-perigo hover:bg-perigo/10` (`src/routes/Jogos.tsx:167`). Todas as cores vêm de tokens; o que falta é unificar a fórmula.

**Cards e estados**: consistência alta. `Badge` com variantes em mapa (`src/components/Badge.tsx:56-63`), `MensagemEstado` com estilos por tipo (`src/components/Estado.tsx:62-66`), `ModalBase` canônico com header/rodapé em `bg-superficie-2` (`src/components/ModalBase.tsx:88-130`), `StatBox` documentando a geometria canônica (`src/components/StatBox.tsx:19-23`), cards de partida em `border-2 … shadow-carimbo` com strip `bg-superficie-2` (`src/routes/Jogos.tsx:147-150`). As listas contínuas `divide-y` exigidas pelo `DESIGN.md` (pilar 1) são respeitadas.

**Alvos de toque**: o seletor global não cobre `<a>`/`<Link>`. Encontrados CTAs-Link abaixo de 44px: "Nova partida" no mural (`src/routes/Jogos.tsx:120-126`, ≈32px) e o CTA-Link de votação (`src/routes/PartidaDetalhe.tsx:273-275`, borderline ≈42-44px). A TabBar está bem (`min-h-[3.5rem]`, `Layout.tsx:267`) e os itens de menu admin também (`min-h-[44px]`, `Layout.tsx:176`).

**Ícones**: lucide-react é o padrão, com dois desvios: chevron desenhado como SVG inline duplicando o `ChevronDown` (`src/routes/Login.tsx:168-178`) e emojis como glifos semânticos de domínio — ⚽ 🧤 📲 ⚡ ★ ✓ ✗ — em ~15 pontos (`src/components/CabecalhoTime.tsx:53`, `src/components/BotaoInstalar.tsx:35`, `src/components/EscalacaoTimesEditor.tsx:279,329,407`, `src/components/CartaoJogadorEdicao.tsx:45,53,86,102`, `src/components/ConfirmacoesPartida.tsx:99,123`, `src/routes/Layout.tsx:190`, `src/components/BannerLembrete.tsx:109`).

### 2.6 Contraste no tema claro (lacuna do mecanismo `destaque-texto`)

O app já resolveu esse problema para o âmbar com `--cor-destaque-texto`. As cores `--cor-ok` (#58b368) e `--cor-perigo` (#e4572e) **não têm contraparte adaptativa** e são usadas como cor de texto pequeno:

- `text-ok` em `text-[9px]`/badges: `src/components/LinhaJogadorGestao.tsx:72-77`, `src/components/Badge.tsx:59` (uso em `text-[10px]`), `src/components/Estado.tsx:64`; valores financeiros em `src/components/ListaReceitasAbertas.tsx:66,175`; número grande em `src/components/ResumoGestao.tsx:59`. Contraste de `#58b368` sobre superfícies claras (`#faf7ee`/`#f3efe4`): **≈2,4:1** — abaixo até do limiar de texto grande (3:1). No escuro fica ≈6,8:1 (bom).
- `text-perigo` em `text-xs`/`text-[10px]`: `src/components/ListaDespesasAbertas.tsx:29,102,111`, `src/components/ConfirmacoesPartida.tsx:68,120,131,377`, entre outros. Contraste no claro: **≈3,4:1** — passa só como texto grande; no escuro ≈4,8:1 (ok).

Como o PWA é usado à noite em modo dark (default), o impacto no dia a dia é limitado, mas qualquer sessão em tema claro deixa confirmações/receitas/erros mais fracos — exatamente o problema que o `destaque-texto` resolveu para o âmbar.

### 2.7 Documentação canônica (drift)

- O `DESIGN.md` (531 linhas, declarado canônico pelo próprio `AGENTS.md`) tem o **H1 errado**: "# ⚽ AGENTS.md — Diretrizes Canônicas…" (`DESIGN.md:1`), e a seção de design (`DESIGN.md:145-171`) **auto-referencia o próprio arquivo como fonte de tokens sem conter a tabela** ("consulte o DESIGN.md" dentro do DESIGN.md). A tabela real de tokens só existe em `src/index.css` e no mapa do init (`.superdesign/init/theme.md`).
- As regras de `DESIGN.md:161` (proibido hex/cores genéricas no JSX) estão cumpridas no essencial — os desvios são os overlays `bg-black/*` (2.4) e o asset de marca.

### 2.8 Identidade visual a preservar ("Súmula de Quinta")

Qualquer mudança futura deve manter estes padrões, que são a assinatura do app:

1. **Placar LED**: `bg-led-fundo` fixo + dígitos `text-destaque` com glow `[text-shadow:0_0_14px_rgba(255,179,0,0.55)]` quando `live`, branco quando encerrado (`src/components/PainelPlacar.tsx:46-52` e `:130-146`; faixa no mini-campo `src/components/CampoPartida.tsx:224-233`). O LED **não deve** ser temizado.
2. **Sombras carimbo secas** (offset sólido, sem blur) e proibição de sombras difusas — utilities em `src/index.css:220-230`.
3. **Linha pontilhada editorial** `sumula-header` (`src/index.css:232-234`) como marca de seção de todas as telas.
4. **Textura de ruído global** `body::after` (`src/index.css:95-104`) — dá a granulação de papel impresso nos dois temas.
5. **Âmbar `#ffb300` único** como destaque, com o par adaptativo `destaque-texto`/`destaque-tinta`.
6. **Cores fixas dos times** Preto/Branco (não-adaptativas por design), do `BadgeTime` aos chips do campo.
7. **Tríade tipográfica**: Barlow Condensed (display, sempre uppercase + tracking), Archivo (corpo), Chivo Mono (números com `tabular-nums`).
8. **Cantos duros** `rounded-[2px]`–`rounded-[6px]` e rejeição de `rounded-xl`.
9. **Glifos de domínio em emoji** (⚽ 🧤 ★) como parte do tom de voz — não são "ícones de UI".
10. **Ciclo de tema completo**: anti-flash inline (`index.html`), `theme-color` sincronizado (`src/lib/tema.ts:36-48`), manifest/splash coerentes com `#12100d`.

---

## 3. Propostas priorizadas (P0 → P3)

### P0-1 — Token de scrim e unificação dos overlays

- **Problema**: três overlays de modal com valores próximos e hardcoded (`bg-black/70`, `bg-black/75`) e um hover `hover:bg-black/10 dark:hover:bg-branco-time/20` que carrega o único `dark:` do app e um hex de preto no JSX.
- **Proposta**: criar `--cor-scrim: rgba(0, 0, 0, 0.72)` em `:root`/`.dark` (mesma cor nos dois temas; o scrim não deve mudar) + mapear no `@theme` como `--color-scrim`, e trocar os três overlays por `bg-scrim`. No Snackbar, trocar o hover do fechar por `hover:bg-superficie` (mesma fórmula já usada no botão do tema em `Layout.tsx:115-116`). Zero novo componente; 4 arquivos alterados.
- **Benefício**: elimina o drift visual entre modais, tira o último hex de UI do JSX e remove o último `dark:` — volta a garantir que tema = tokens.
- **Esforço**: S. **Risco**: baixo (diferença de 70→72% de opacidade é imperceptível; comportamento visual mantido).

### P0-2 — Alvo de toque 44px em CTAs-Link

- **Problema**: a regra global de 44px (`src/index.css:149-155`) cobre `button`/`[role=button]`/`input[type=range]`, mas não `<a>`. O CTA-Link "Nova partida" tem ≈32px de altura (`src/routes/Jogos.tsx:120-126`) e o CTA de votação está no limite (`src/routes/PartidaDetalhe.tsx:273`).
- **Proposta**: correção pontual — adicionar `min-h-[44px]` (e `justify-center`/`items-center` onde falta) aos 2 CTAs-Link identificados. Não estender o seletor global para `a` (afetaria links inline de texto, como o do e-mail em `EscalacaoTimesEditor.tsx:335`, que já é tratado caso a caso).
- **Benefício**: confere o critério de toque do `DESIGN.md` em 100% dos CTAs principais, no contexto de dedo no celular.
- **Esforço**: S. **Risco**: mínimo (mudança de padding interno visual imperceptível).

### P1-1 — Tokens de contraste `--cor-ok-texto` e `--cor-perigo-texto`

- **Problema**: verde e vermelho semânticos não adaptam entre temas; no claro, `text-ok` ≈2,4:1 e `text-perigo` ≈3,4:1 — abaixo do WCAG AA para os tamanhos usados (`text-[9px]` a `text-xs`).
- **Proposta**: replicar exatamente o mecanismo existente do âmbar: criar `--cor-ok-texto`/`--cor-perigo-texto` em `:root`/`.dark` (no escuro, iguais aos atuais; no claro, versões mais profundas — p.ex. um verde ~`#2e7d32` e um vermelho ~`#b3401e`, a validar visualmente), mapear no `@theme` e migrar **apenas os usos como cor de texto pequeno** (~15-20 pontos listados em 2.6). Manter `bg-ok`/`bg-perigo` para fundos (banner offline, Snackbar, stepper), onde o texto sobre eles é branco.
- **Benefício**: legibilidade real dos estados de sucesso/erro em tema claro (o toggle de tema existe e é usado), com precedência de padrão já consagrada no próprio codebase — sem introduzir conceito novo.
- **Esforço**: M (decidir 2 hexes + migrar usos). **Risco**: baixo-médio — a cor percebida muda um pouco no tema claro; vale validar lado a lado. Não afeta badges de fundo.

### P1-2 — Fórmula de botão consolidada (constantes de variante, não componente novo)

- **Problema**: 32 cópias inline da fórmula do botão primário com drifts de sombra/padding/brightness; botão perigoso sem fórmula única.
- **Proposta**: seguir o padrão que o próprio projeto já usa em `Badge` (`VARIANTE_CLASSES`, `src/components/Badge.tsx:56-63`): um objeto de constantes compartilhadas (p.ex. `src/components/botoes.ts` ou export de `CLASSES_BOTAO` com `primario`/`secundario`/`perigo`) consumido por template string — **sem criar um componente `<Botao>`** (muitos usos têm markup/props distintos; um componente exigiria espelhar props nativas). Migração incremental, arquivo por arquivo, começando pelos fluxos de partida. Opcionalmente padronizar na mesma passada: sombra `shadow-carimbo` para todos os primários (ou `carimbo-destaque`, escolher um) e `hover:brightness-105`.
- **Benefício**: DRY de duplicação real (não forçada), drifts desaparecem, mudanças futuras de estilo de CTA ficam em 1 lugar.
- **Esforço**: M (a migração completa toca ~20 arquivos; pode ser fatiada). **Risco**: baixo — classes idênticas, só centralizadas. Se preferir o menor passo possível: consolidar primeiro só `primario` e `perigo`.

### P2-1 — Extrair `HeaderSumula`

- **Problema**: cabeçalho editorial repetido inline em 19 telas (título display + `sumula-header` + opcional subtítulo mono/ação à direita), com drifts (`font-black` em `GestaoGoleiros.tsx:190`; mistura `h1`/`h2` sem hierarquia estável).
- **Proposta**: componente próprio no projeto (ex.: `src/components/CabecalhoSumula.tsx`) com props `titulo`, `subtitulo?`, `acao?` (slot à direita), `nivel?` (`h1`/`h2`). Reescreve os usos incrementalmente. Já sinalizado como candidato no init (`.superdesign/init/extractable-components.md`, "HeaderSumula"). Alinhar com o doc `01-componentes-reutilizaveis.md` do colega quando existir (hoje há apenas `00-superdesign-init.md` e `02-pwa-tecnico.md` em `docs/tmp-analise-pwa/`).
- **Benefício**: SRP/coesão; acessibilidade semântica (hierarquia de headings consistente); qualquer ajuste de espaçamento do cabeçalho vira 1 diff.
- **Esforço**: M. **Risco**: baixo — extração pura, comportamento mantido.

### P2-2 — Limpeza de tokens e dados mortos

- **Problema**: `--cor-oliva` e `--cor-led-fundo-hover` sem nenhum uso; campo `cor` de `TIMES` não consumido (`src/lib/times.ts:16,24`).
- **Proposta**: remover do `@theme`/`:root`/`.dark` (ou, se `oliva` for intenção de paleta futura, deixar registrado apenas no `DESIGN.md` — mas YAGNI sugere remover). Remover o campo `cor` de `TimeInfo` se não houver consumo planejado. `--cor-led-fundo-hover` só voltaria se o PainelPlacar ganhar estado de hover (não faz sentido em touch — candidato claro a remoção).
- **Benefício**: "Zero Code Slop" do manifesto do projeto; tokens do design system = tokens vivos.
- **Esforço**: S. **Risco**: trivial.

### P2-3 — Doc canônica de tokens em ordem

- **Problema**: `DESIGN.md` não contém a tabela de tokens que promete (auto-referência) e tem H1 de outro arquivo (`DESIGN.md:1`); micro-escala (9/10/11px) e raios canônicos existem só na prática.
- **Proposta**: correção de documentação — corrigir o H1, incluir a tabela `--cor-*` (copiada de `src/index.css`, com nota de que o CSS é a fonte executável), registrar a micro-escala de rótulos e a distribuição de raios como convenção canônica, e acrescentar comentário cruzado nos hexes duplicados (`src/lib/tema.ts:18-19` ↔ `index.html` ↔ `manifest.webmanifest`) avisando para editar em conjunto.
- **Benefício**: agentes/colaboradores deixam de depender de ler o CSS para conhecer o sistema; evita drift futuro entre doc e código.
- **Esforço**: S. **Risco**: nenhum (só doc).

### P3-1 — Detalhes finos de ícones e utilities

- **Propostas** (cada uma S, aplicar quando tocar nesses arquivos — não fazer passada dedicada):
  - Trocar o SVG inline do Login pelo `ChevronDown` do lucide (`src/routes/Login.tsx:168-178`), mantendo a rotação.
  - Converter o text-shadow do LED em utility `@utility glow-led` no `index.css`, centralizando os dois rgba (`PainelPlacar.tsx:48,134`) e o uso do `CampoPartida` — opcional; só se houver terceira variante de glow.
  - Tornar o offset do focus global uniforme (`outline-offset-2`; hoje `Snackbar.tsx:73` usa `offset-1`).
  - Nos hexes das sombras `shadow-carimbo-destaque` (`index.css:224-226`), mover `#b37d00` para variável `--cor-carimbo-destaque` por simetria com o `shadow-carimbo` — cosmético.

---

## 4. O que NÃO fazer

1. **Não adotar biblioteca de UI** (shadcn/MUI/radix/headless) nem "tema de terceiros". O conjunto `ModalBase`/`ConfirmDialog`/`Snackbar`/`Badge`/`Toggle`/`Estado` já cobre a camada de interação com acessibilidade própria (`useModalA11y`, `useListbox`) e a identidade visual não sobreviveria a um kit genérico.
2. **Não temizar o placar LED nem os times Preto/Branco.** `bg-led-fundo`, `bg-preto-time` e `bg-branco-time` são fixos nos dois temas por decisão de identidade. Converter `text-destaque` do `PainelPlacar` para `text-destaque-texto` seria um erro: no tema claro `destaque-texto` vira `#92400e` e o LED "apagaria".
3. **Não migrar o tema para `prefers-color-scheme`.** O mecanismo atual (classe `.dark` + localStorage + anti-flash inline + theme-color por JS) é o correto para PWA instalada e já está maduro; media query quebraria a escolha explícita do usuário e o anti-flash.
4. **Não criar tokens de espaçamento custom** (escala `space-*` própria). A escala padrão do Tailwind 4 atende; tokens de spacing aqui seriam overengineering. O que existe de convenção (container `max-w-2xl px-3 sm:px-4`) já é repetido com fidelidade.
5. **Não criar componente `<Botao>` genérico antes das constantes de classe.** Os ~32 usos têm markups distintos (com ícone, block, w-full, as/disabled); um componente exigiria espelhar a API nativa inteira. Constantes de variante resolvem o DRY com um décimo do custo (evitar abstração prematura).
6. **Não caçar os emojis em massa.** ⚽ 🧤 ★ são glifos de domínio ("súmula"), parte do tom de voz — trocá-los por ícones lucide uniformizaria o visual e mataria o charme. Regra sensata para o futuro: emoji em conteúdo/rótulo temático, lucide em controle interativo (seta, fechar, ações).
7. **Não estender o seletor global de 44px para todos os `<a>`.** Pegaria links inline de texto e inflaria áreas de clique em listas; correção pontual por CTA é o caminho.
8. **Não fazer migração "big bang"** do botão consolidado ou do `HeaderSumula` em um único PR: são ~20-22 arquivos e o risco de regressão visual não compensa. Migração incremental por módulo (partida → gestão → notificações), mantendo cada diff revisável (diretriz do `AGENTS.md`).
9. **Não mexer na textura de ruído, no `z-index: 9999` do `body::after` ou nas animações globais** sem necessidade explícita — são os elementos de "papel impresso" que sustentam a identidade e estão validados em produção.
10. **Não corrigir contraste mudando `--cor-ok`/`--cor-perigo` globais** (afetaria fundos, bordas e o Snackbar branco-sobre-verde/vermelho). A via correta é o par adaptativo `*-texto`, como o codebase já fez com o âmbar.

---

### Anexo — contagens usadas nesta análise (comando base: `grep -rI --include="*.tsx"` sobre `src/`)

- `text-destaque-texto`/`text-destaque-tinta`: 224 ocorrências · `text-destaque` cru: 8 (todas sobre fundo LED).
- Fórmula primária `bg-destaque … text-destaque-tinta`: ~32; `shadow-carimbo` pré-hover: 24 vs `shadow-carimbo-destaque`: 3; `hover:brightness-105`: 25 vs `-110`: 2.
- `rounded-[4px]`: 234 · `rounded-[2px]`: 101 · `rounded-[3px]`: 81 · `rounded-full`: 8 · `rounded-t-[6px]`: 2.
- `text-[10px]`: 80 · `text-[11px]`: 44 · `text-[9px]`: 14.
- `focus-visible:outline-2 … outline-destaque-texto` explícito: 52 (global já cobre).
- Prefixo `dark:`: 1 (Snackbar). Hexes em `src/**`: Logo (marca), `times.ts` (morto), `tema.ts` (duplicação inevitável).
