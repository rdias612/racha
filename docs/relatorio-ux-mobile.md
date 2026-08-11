# Relatorio de UX Mobile-First - Racha Gragoata CBO

> Tipo: Validacao (somente analise, sem codigo)
> Alvo: PWA React 19 + TypeScript + Vite + Supabase
> Data: 2026-08-11
> Idioma: Portugues (BR)

---

## 1. Resumo executivo

- **Diagnostico em uma frase:** o app tem uma base tecnica solida (PWA funcional, dark mode nativo, touch targets globais de 44px e reducao de movimento respeitada), mas visualmente continua parecendo um "template firebase demo" porque usa a cor default do Tailwind, fontes do sistema, icones de emoji e cards neutros sem marca propria.
- **Triagem de prioridades:** o P0 esta em tres frentes: (a) identidade visual (paleta + tipografia + icones SVG), (b) safe-area e CTA de votacao quebradas, (c) tabela de ranking ilegivel em 375px.
- **Nao e necessario reescrever:** todas as melhorias sao incrementais, em ate 4 sprints de 2 semanas, sem trocar framework nem adicion ar bibliotecas pesadas.
- **Contexto de uso respeitado:** o relatorio assume usuario em pe, uma mao ocupada, sol/piscina, conexao instavel -todas as propostas priorizam contrasts altos, alvos grandes e feedback imediato.
- **Risco principal:** manter `--cor-destaque: #2563eb` (azul Tailwind) mantiene a sensacao de "clone de qualquer SaaS" e prejudica o reconhecimento do app na tela inicial do celular.

---

## 2. Diagnostico do estado atual

### 2.1 O que funciona bem (nao mexer)

| Aspecto | Onde | Por que esta OK |
|---|---|---|
| Touch target minimo | `src/index.css` (regra global `button, [role=button] { min-height: 44px }`) | Garante 44px em todo o app sem depender de cada componente lembrar |
| Dark mode default | `src/lib/tema.ts:14` (default `'dark'`) + class `.dark` no `<html>` | Coerente com uso em campo (sol) e com PWA instalado (OLED) |
| Safe area base | `src/index.css` (`body` com `env(safe-area-inset-*)`) + bottom nav `pb-[env(safe-area-inset-bottom)]` em `Layout.tsx:107` | Notch e home indicator tratados no nivel mais externo |
| Acessibilidade starter | outline 3px focus, `prefers-reduced-motion`, `aria-current`, `aria-pressed` em varios lugares | Base solida, so precisa ser consistente |
| Auth gate + sessao persistente | `src/context/SessaoContext.tsx` + `Layout.tsx:18-20` | Login -> localStorage -> redirect funciona sem flickr |
| Votacao com edicao | `PartidaVotar.tsx` pre-carrega votos existentes | Permite corrigir na janela de 24h (alinha com a regra de negocio) |
| `ConfirmDialog` acessivel | `src/components/ConfirmDialog.tsx` | role dialog, Esc, focus trap inicial, body scroll lock |
| `SeletorNota` acessivel | `src/components/SeletorNota.tsx` | combobox + listbox completo (teclado, Home/End, fechar fora) |

### 2.2 O que parece "template / firebase demo"

| Sinal | Onde | Diagnostico |
|---|---|---|
| Cor unica `--cor-destaque: #2563eb` | `src/index.css:6-12` | Azul moderno padrao, mesmo do Tailwind. Nao remete a futebol, grama, Bahia/Gragoata, nem a nenhum time |
| Fonte `system-ui` sem display proprio | `src/index.css:18` | Funciona mas e anonima. Falta hierarquia visual - todos os titulos parecem a mesma familia |
| Icones de emoji na nav inferior | `src/routes/Layout.tsx:111-189` (emojis de bola, trofeu, etc.) | Renderizam diferente em iOS/Android e passam imagem de placeholder. Quebra a unidade visual |
| Header sem logo | `Layout.tsx:32-34` so texto "Racha Gragoata" | Parece barra de admin generica |
| Cards neutros | `Perfil.tsx:128` (`StatBox`), `Resumo.tsx:108-121` (Destaque) | Bordas `neutral-200`, fundo `white`/`neutral-950` - o "card Tailwind default" |
| Status por cor unica | `Jogos.tsx:64` e `PartidaDetalhe.tsx` | "Votacao aberta" so muda cor de texto, sem icone SVG nem badge preenchido |
| Splash nao existe | `public/manifest.webmanifest:9` `background_color: #0a0a0a` | Tela de abertura branca/preta pura |
| Icones de app PNG estaticos | `public/manifest.webmanifest:11-31` | Sem branding verificavel, maskable OK mas generico |
| SW so instala, nao e offline-first | `public/sw.js:1-3` (comentario explicito: "nao em offline-first") | Em campo com 3G instavel a home fica em branco; perde a unica vantagem de um PWA sobre um site |
| Servico de push bem costurado | `src/lib/pwa.ts` + `supabase/functions/send-voting-reminders` | Funcional mas sem interface rica (sem canais, sem preferencias) |

### 2.3 O que quebra no mobile (especifico por arquivo)

#### `src/routes/Layout.tsx`
- **L32-50:** Botoes "+ Jogador" (admin) e toggle de tema usam `px-2 py-1 text-xs`. Apesar do `min-height: 44px` global, o **alvo visual** fica pequeno e isolado no canto, dificil de acertar com uma mao.
- **L58:** `<main>` tem `pb-16` mas a bottom nav tem `pb-[env(safe-area-inset-bottom)]` - o `pb-16` nao inclui a safe-area em iPhone com home indicator, gerando overlap em telas longas (ex.: `Perfil.tsx` na secao de senha).
- **L111:** Nav inferior usa `flex-1` em 5 itens - em 320px o label "Estatisticas" corta em telas muito estreitas (nao tem `truncate`, nao ha `text-[10px]` consistente).

#### `src/routes/Login.tsx`
- **L65-79:** `username` e um `<select>` - em mobile abre o picker nativo iOS/Android com letra minuscula, e o `autocomplete="username"` em `<select>` e ignorado pelos gerenciadores de senha. Quem usa 1Password/Bitwarden nao consegue preencher.
- **L95-105:** Input de **senha** nao tem `enterKeyHint="go"` nem `inputMode`. O teclado mostra "Enter" generico; deveria mostrar "Ir" / "Entrar".
- **L121-125:** Botao de submit tem `py-2` - o `min-height: 44px` salva, mas o botao parece fino.
- **Sem logo/hero:** a unica marca na tela e o `<h1>` "Racha Gragoata CBO" textual.

#### `src/routes/Resumo.tsx`
- **L99:** Bento (grid-cols-2 sm:grid-cols-3) - bons cards, mas todos identicos (sem hierarquia entre "Artilheiro" e "Maior seca" - deveria ter tamanho/destaque diferente).
- **L92:** `BotaoInstalar` entra no meio do feed - desloca o conteudo principal; deveria ser disparado por evento ("voce abriu 3x, instalar?") ou em modal.

#### `src/routes/Jogos.tsx`
- **L74-91:** Card minimalista, o placar `2 x 1` e texto puro em `text-lg` -sem hierarquia, sem cor do time, sem status visual.
- **L102:** `text-[10px]` para status (`statusCor`/`statusLabel`) - abaixo do minimo WCAG para texto (12px equvale a ~16px no CSS default, mas 10px e abaixo do tipico body).
- **Sem pull-to-refresh** - padrao esperado em toda lista mobile.
- **Sem empty state ilustrado** - so `<p>` textual quando `partidas.length === 0`.

#### `src/routes/PartidaNova.tsx`
- **L97-130 (`GrupoJogadores`):** Lista linear sem busca, sem filtro por nome. Com 30+ jogadores ativos, rolar e lento; selecionar os ultimos exige scroll longo.
- **L181-185:** Aviso de jogadores insuficientes e `text-amber-600` - status so por cor (sem icone SVG nem banner destacado).
- **L196-202:** CTA fixo em `bottom: calc(4rem + env(safe-area-inset-bottom))` - **correto**, mas o`active:scale-95` e o unico feedback.
- **Sem haptic** ao atingir o limite de cota (14 linha / 2 goleiros).

#### `src/routes/PartidaNovaTimes.tsx`
- **L161-200:** Cada linha tem 2 botoes Preto/Branco - bom, mas o estado "Preenchido" so muda cor de fundo + check; sem haptic nem animacao ao chegar a 8.
- **L97:** Salvar como draft dispara `setTimeout` 800ms para navegar - sem feedbackvisual do sucesso, so `MensagemEstado` por 800ms.

#### `src/routes/PartidaConfirma.tsx`
- **L74-90:** Tags dos jogadores (`rounded-full bg-neutral-100`) sao faceis de clicar mas nao levam a lugar nenhum - poderiam abrir mini-bio/posicao.
- Sem preview visual dos 2 times separados (Preto x Branco) - so lista por categoria.

#### `src/routes/PartidaVotar.tsx` (fluxo mais quente do app)
- **L228-238:** CTA de envio usa `fixed inset-x-0 bottom-16` **SEM `env(safe-area-inset-bottom)`** nem `pb-[...]` - em iPhone com home indicator, o botao fica colado na barra. Contrasta com `PartidaNova.tsx` e `PartidaEditar.tsx` que fizeram certo (`calc(4rem + env(safe-area-inset-bottom))`). **Bug de safe-area.**
- **Sem `min-h-[44px]` garantido nesse botao** - depende so do `min-height: 44px` global do CSS.
- **L104-109:** "Fecha em Xh Ymin" em `text-xs` azul -contraste fraco em sol; sem barra de progresso visual (faltam N de 15 avalia-dos).
- **Sem prevencao de saida** com avaliacoes em andamento (documentado em `docs/melhorias-futuras.md:39`).
- **L201-216:** Lista densa: 15 linhas, cada uma com compact dropdown -facil de rolar mas dificil de comparar notas (sem nr nightlife).

#### `src/routes/PartidaDetalhe.tsx`
- **L113-140:** Placar principal (`Preto | 2 x 1 | Branco`) em `border-neutral-200` - bom tamanho mas desaponta visualmente; o placar e o coracao do app.
- **L93-102 (grid-cols-2 dos times):** Cards de time lado a lado em 375px ficam em ~165px cada - nomes com `truncate`, gols/assistencias em `text-[11px]`. Apertado.
- **L142-154:** Craque da partida em cartao azul claro com estrela emoji - bom destaque, mas o icone e emoji e o card nao tem avatar/silueta do jogador.
- **Sem animacao de revelacao** quando votacao fecha - momento alto do produto, deveria ter transicao.

#### `src/routes/PartidaEditar.tsx`
- **L308+ (`Stepper`):** Stepper de gols/assistencias/gols-contra em botao - cada um `min-w-[3rem]` minimo. Em 320px com 3 steppers por linha (gols + assists + GC) ficam apertados nas bordas.
- **`window.location.href = ...` L113-115:** Apos salvar, faz full reload - perde contexto de navegacao e causa flash branco. Deveria usar `navigate()` do router.
- **Sem haptic** ao incrementar gol (momento de comemoracao em campo).

#### `src/routes/Ranking.tsx`
- **Tabela completa de 8 colunas** (`Nome | pts | Media | %vit | P | V | E | D`) - em 375px gera scroll horizontal ou colunas comprimidas. Ja esta documentado em `docs/melhorias-futuras.md:13-22` como nao feito.
- **Filtro de posicao** (`<select>` `Ranking.tsx` ~L240) - picker nativo, sem visual inline.
- **Sem destaque visual** ao proprio jogador logado na lista.
- **Sem podio** (top 3) - apenas numeracao.

#### `src/routes/Estatisticas.tsx`
- **`StatBox` grid-cols-5** (~L200, `Perfil.tsx:227` tem o mesmo) - 5 boxes lado a lado em 375px: ~70px cada, numero em `text-2xl` corta em valores de 3+ digitos. Documentado em `docs/melhorias-futuras.md:43`.
- Dropdown jogador em `<select>` - sem busca, dificil com 30+ nomes.

#### `src/routes/EstatisticasRacha.tsx`
- Lista `Top 5` e `Bottom 5` em `<ol>` - bom, mas sem silhuetas de dupla, sem avatar de jogadores (poderia ser inicial em circulo colorido).

#### `src/routes/Perfil.tsx`
- **L141-156 (grid-cols-5):** Mesmo problema de `StatBox` que `Estatisticas.tsx`.
- **L158-189 (notificacoes):** Bom controle, mas o botao "Ativar/Desativar" e iconico-textual, sem toggle visual (switch seria mais natural).
- **L191-247 (trocar senha):** 3 inputs em sequencia sem agrupamento visual - especialmente o botao de submit repetitivo.
- **L248-260 (logout):** Botao solto no final, sem confirmacao - poderia ser menu de conta.

#### `src/routes/NovoJogador.tsx`
- **L100-130:** `autoCapitalize="none" autoCorrect="off"` no username - otimo. Mas `nome` nao tem `autoCapitalize="words"`.
- Senha default exibida em `<code>` - so texto, sem opcao de copiar.
- Formulario longo sem stepper/wizard para mobile.

#### `src/components/BannerLembrete.tsx`
- **L60-69:** Banner discreto (`text-xs`) no topo - bom mas facil de perder na pressa; sem haptic/push quando votacao esta prestes a fechar.

#### `public/sw.js`
- **L1-3:** SW explicitamente nao offline-first. Estrategia `stale-while-revalidate` em tudo. Para PWA em campo, vale um cache app-shell + NetworkFirst para dados.

---

## 3. Identidade visual ("cara menos generica")

### 3.1 Paleta proposta

Sair do azul `#2563eb` (default Tailwind). Proposta orientada ao contexto (futebol, campo, Bahamas/Bahia/Gragoata):

| Token | Light | Dark | Uso |
|---|---|---|---|
| `--cor-primaria` (campo) | `#15803d` (verde-600) | `#22c55e` (verde-500) | Headers, CTAs primarios, "Votacao aberta" |
| `--cor-destaque` (energia) | `#f59e0b` (amber-500) | `#fbbf24` (amber-400) | Craque da partida, FAB, gol marcado |
| `--cor-preto` (Time A) | `#0f172a` (slate-900) | `#000000` (OLED true black) | Ja existe em `times.ts:8`, so promote a token |
| `--cor-branco` (Time B) | `#f8fafc` (slate-50) | `#e2e8f0` (slate-200) | Ja existe em `times.ts:9`, melhorar contraste em dark |
| `--cor-perigo` | `#dc2626` (red-600) | `#ef4444` (red-500) | GC, votacao encerrada |
| `--bg` | `#fafafa` (neutro) | `#000000` (OLED) | Fundo principal |

Justificativa: verde evoca grama/campo, amber universalmente le "vitoria/premiacao", o contraste e forte em sol. Manter Preto/Branco dos times preserva a tradicao do produto.

Aplicar em: `src/index.css`, `src/lib/tema.ts` (estender map de tokens), `public/manifest.webmanifest` (`theme_color`, `background_color`), `tailwind` via `@theme`.

### 3.2 Tipografia

- **Display (titulos/numeros grandes):** custom font para momento de marca - `Plus Jakarta Sans` ou `Sora` (open-source, futurista mas legivel). Carregar via `@fontsource` ou self-host em `public/fonts/`.
- **UI (corpo):** manter `system-ui` (zero custo, robe do SO) ou `Inter` para consistencia cross-platform.
- **Numeros (placar, ranking):** `tabular-nums` (ja usado em `PartidaNova.tsx:144`) - extender para todos os placares.
- **Escala:** definir `--text-display`, `--text-titulo`, `--text-corpo`, `--text-legenda` no `@theme` para sair de `text-lg`/`text-xs` hardcoded.

Hierarquia proposta:
- Placar central: `text-5xl` display bold tabular-nums (`PartidaDetalhe.tsx:115`, hoje `text-2xl sm:text-3xl`)
- Craque: `text-3xl` display
- Titulos de tela: `text-xl` UI semibold
- Body: `text-base`
- Legendas/status: `text-xs` no min 12px (hoje varios `text-[10px]`)

### 3.3 Icones

Substituir emojis da bottom nav e header por **lucide-react** (open-source, tree-shakeable, um unico pacote) ou **Phosphor Icons**:
- Resumo: `Home` ou `LayoutGrid`
- Jogos: `Trophy` ou `Shield`
- Ranking: `BarChart3` ou `Medal`
- Estatisticas: `TrendingUp`
- Perfil: `User` (cinza) / `Settings` (gear)
- Tema: `Sun` / `Moon`
- Craque: `Crown` / `Star` preenchido

Evita render inconsistente iOS/Android e ganha peso/estilo controlavel (regular/bold/fill).

### 3.4 Microinteracoes e voz

- **Haptics (Vibration API):** light no toggle de time, medium ao finalizar partida, success pattern (curto-curto-longo) ao registrar votos. Wrap em `src/lib/haptics.ts` com fallback sem Vibration.
- **Snackbar global:** hoje `MensagemEstado` e inline - melhor um portal unificado para feedbacks curtos ("Voto registrado", "Gol adicionado").
- **Transicao de paginas:** slide-in / fade entre rotas (CSS transitions, sem dependencia).
- **Reveal do craque:** quando `status` muda published -> closed, animacao `scale + fade` no card de craque (`PartidaDetalhe.tsx:142`).
- **Voz consistente:** o app ja tem tom colloquial ("Botar o resultado", "Revisar escalacao") - formalizar: CTAs no imperativo do dia-a-dia, microcopy curto, girias so em momentos de comemoracao ("Craque!", "Sumidade!").

---

## 4. Heuristicas mobile

### 4.1 Toque

| Req | Status | Onde corrigir |
|---|---|---|
| Minimo 44px | OK global em `src/index.css:36-38` | - |
| Gap minimo 8px entre alvos | **Parcial** | `Layout.tsx:110` nav (gap-0 entre itens), `Perfil.tsx:140` (grid-cols-5 gap-2) |
| Alvo visual cheio | **Falha** | `Layout.tsx:36-47` botoes `px-2 py-1` pequenos; `Jogos.tsx:101` `+ Nova partida` `py-1.5` |
| enterKeyHint | **Faltante** | `Login.tsx:95`, `NovoJogador.tsx`, `Perfil.tsx:191-220` |

### 4.2 Safe areas

| Area | Status | Onde |
|---|---|---|
| Notch / status bar (top) | OK via body padding | `src/index.css:20-22` |
| Home indicator (bottom) | OK na bottom nav | `Layout.tsx:107` |
| CTA fixo inferior | **Bug em `PartidaVotar.tsx:228`** (`bottom-16` sem safe-area); OK em `PartidaNova.tsx:199`, `PartidaConfirma.tsx:97`, `PartidaEditar.tsx:172` | Corrigir P0 |
| Landscape | **Nao tratado** | Sem adaptacao para notch lateral em landscape (paid layouts quebram) |

### 4.3 Gestos

- **Sem swipe** para voltar (iOS nativo ja faz tramite router, mas sem indicador visual).
- **Sem pull-to-refresh** em listas (`Jogos`, `Ranking`, `Estatisticas`).
- **Sem swipe horizontal** em `Jogos` para navegar entre semanas ou em `Resumo` entre anos.

### 4.4 Feedback

| Evento | Feedback atual | Proposta |
|---|---|---|
| Toggle de time (`PartidaNovaTimes`) | `active:scale-95` | + haptic light + cor animada |
| Publicar resultado (`PartidaEditar`) | Reload completo + `MensagemEstado` | Snackbar + haptic success + fade da lista |
| Registrar votos (`PartidaVotar`) | `setFeedback` por 900ms | Snackbar full-screen confirmation + route transition |
| Atingir cota (`PartidaNova`) | Cor verde no card | + haptic medium |
| Craque revelado | Card estatico | Scale + fade + haptic long |

### 4.5 Uso com uma mao

- Bottom nav bem posicionada (topico acertado).
- CTAs primarios todos em bottom-sheet fixed - bom padrao.
- **Header atual:** acoes de admin ("+ Jogador") e toggle de tema no topo direito - fora do alcance do polegar em telas grandes. Proposta: mover "Conta" (`Perfil`, tema, logout, admin) para um **bottom sheet / menu flutuante**, liberar o header so para branding.

### 4.6 Sol / piscina / ambiencia ruidosa

- **Contraste:** `--cor-destaque: #2563eb` em fundo claro passa WCAG AA mas em sol forte desmaia. Verde `#15803d` ou amber `#f59e0b` tem contraste maior.
- **Numeros grandes:** placar em `text-2xl` (`PartidaDetalhe.tsx:115`) - deveria ser `text-5xl` display.
- **Texto pequeno `text-[10px]`:** `Jogos.tsx:101`, `Layout.tsx:120`, `PartidaDetalhe.tsx` varias vezes - ilegivel em sol. Minimo `text-xs` (12px).

### 4.7 Offline / PWA

| Aspecto | Atual | Proposta |
|---|---|---|
| SW strategy | `stale-while-revalidate` (`sw.js:41-58`) | Cache app-shell (HTML/JS/CSS/fonts)(NetworkFirst para dados Supabase) |
| Cache de fontes | Faz (GET, same-origin) | OK se self-hosted |
| Pagina offline | Nao ha | `offline.html` com tema + botao "tentar de novo" |
| Splash | `background_color: #0a0a0a` | Adicionar logo / mark de marca (`docs/relatorio-...`:icons-maskable com branding forte) |
| Reconnection | Sem listener | Snackbar quando voltar online: "Voce esta online - sincronizando" |

---

## 5. Priorizacao (P0 / P1 / P2)

| Prio | Item | Esforco | Impacto | Arquivo(s) |
|---|---|---|---|---|
| **P0** | Corrigir safe-area do CTA em `PartidaVotar.tsx:228` | 0.2d | Alto (votacao e o fluxo principal) | `src/routes/PartidaVotar.tsx` |
| **P0** | Trocar paleta default Tailwind por tokens de marca (verde/amber) | 1d | Alto (identidade imediata) | `src/index.css`, `src/lib/tema.ts` |
| **P0** | Substituir emojis da nav/header por SVG icons (lucide-react) | 1d | Alto (coesao visual) | `src/routes/Layout.tsx`, `package.json` |
| **P0** | Ranking responsivo: cards em <640px, tabela em > | 2d | Alto (atende docs/melhorias-futuras) | `src/routes/Ranking.tsx` |
| **P1** | `StatBox` grid-cols-5 -> grid-cols-2 mobile | 0.5d | Medio | `src/routes/Perfil.tsx:227`, `src/routes/Estatisticas.tsx` |
| **P1** | `Login.tsx`: input digitavel + `enterKeyHint="go"` + autocomplete correto | 0.5d | Alto (primeira impressao) | `src/routes/Login.tsx` |
| **P1** | Placar principal em `text-5xl` display + tabular-nums | 0.3d | Alto (momento hero) | `src/routes/PartidaDetalhe.tsx:115` |
| **P1** | Snackbar global + haptics wrapper | 1.5d | Medio (todo o app) | novo `src/components/Snackbar.tsx`, `src/lib/haptics.ts` |
| **P1** | SW offline-first (app-shell + NetworkFirst dados) + offline.html | 1.5d | Alto (uso em campo) | `public/sw.js`, novo `public/offline.html` |
| **P1** | Mover "Conta" (tema/logout/admin) para bottom sheet/menu | 1d | Medio (header clean + alcance polegar) | `src/routes/Layout.tsx` |
| **P2** | Trocar `window.location.href` por `navigate()` em `PartidaEditar` | 0.2d | Medio (sem flash) | `src/routes/PartidaEditar.tsx:113` |
| **P2** | Busca/filtro em `PartidaNova` (lista de jogadores) | 1d | Medio (admin) | `src/routes/PartidaNova.tsx` |
| **P2** | Pull-to-refresh em listas | 1.5d | Baixo-Medio | `Jogos`, `Ranking`, `Estatisticas` |
| **P2** | Reveal animado do craque quando fecha votacao | 0.5d | Medio (momento alto) | `src/routes/PartidaDetalhe.tsx:142` |
| **P2** | Stepper/wizard no `NovoJogador` | 1d | Baixo (admin, raro) | `src/routes/NovoJogador.tsx` |
| **P2** | `useBlocker` em `PartidaVotar` prevenir saida incompleta | 0.5d | Medio (ja em docs/melhorias-futuras) | `src/routes/PartidaVotar.tsx` |
| **P2** | Avatar/silueta por inicial em circulos coloridos (`Ranking`, `EstatisticasRacha`) | 1d | Baixo-Medio (personalidade) | varios |
| **P2** | Logo / wordmark em SVG | 1d | Alto (branding) | novo `src/components/Logo.tsx` |
| **P2** | Splash com brand (manifest `screenshot`s para install) | 0.5d | Medio | `public/manifest.webmanifest` |

---

## 6. Quick wins (5) - 1 a 3 dev-dias cada

### QW1 - Paleta de marca (1 dev-dia)

Sair do `#2563eb` (default Tailwind). Definir tokens em `src/index.css`:

```
@theme {
  --color-primaria: #15803d;       /* verde campo */
  --color-destaque: #f59e0b;       /* amber - craque, FAB */
  --color-perigo:   #dc2626;       /* GC, encerrada */
}
```

Migrar `bg-[var(--cor-destaque)]` para nova semantica (`bg-color-primaria` para CTAs, `bg-color-destaque` para hero/fab). Atualizar `public/manifest.webmanifest:8` `theme_color: #15803d`. Validar contraste WCAG AA em ambos temas.

### QW2 - Icones SVG na nav e header (1 dev-dia)

Instalar `lucide-react`. Em `src/routes/Layout.tsx:111-189` trocar os spans `<emoji>` de Resumo/Jogos/Ranking/Estatisticas/Perfil por `<Home/>`, `<Shield/>`, `<Medal/>`, `<TrendingUp/>`, `<Settings/>`. Header `Layout.tsx:32-50`: trocar `+ Jogador` por `<UserPlus/>` + texto, alternar `<Sun/>`/`<Moon/>` nos trocar de tema. Resultado: visual coeso iOS/Android, tamanhos controlaveis.

### QW3 - Fix safe-area + altura do CTA de votacao (0.2 dev-dia)

Em `src/routes/PartidaVotar.tsx:228` trocar `fixed inset-x-0 bottom-16 z-40 p-3 pb-3` por `style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom))' }}` + adicionar `min-h-[44px]` ao botao. Replicar exatamente o padrao de `PartidaNova.tsx:199` (que esta correto).

### QW4 - Ranking cards no mobile (2 dev-dias)

`src/routes/Ranking.tsx`: extrair a tabela `<table>` para `<TabelaRanking />` (renderiza em `sm:`) e criar `<CardRanking />` para `max-sm:`. Card mostra: posicao + inicial em circulo colorido, nome + posicao (Zagueiro/Meia), metrica principal em destaque, segunda linha com `P/V/E/D` e `%vit`. Adicionar `bg-color-primaria/10` highlight na linha do jogador logado (`useJogadorLogado()` ja existe). Cumpre `docs/melhorias-futuras.md:13-22`.

### QW5 - Placar hero + tabular-nums (0.3 dev-dia)

`src/routes/PartidaDetalhe.tsx:115`: trocar `text-2xl sm:text-3xl` por `text-5xl sm:text-6xl font-display tabular-nums`. Centralizar visualmente. Considerar aumentar `px-4 sm:px-6` para `px-6 sm:px-10`. Resultado: o placar vira o momento hero da tela (coracao do produto).

---

## 7. Roadmap mobile-first (sprints de 2 semanas)

### Sprint 1 - Identidade visual
- QW1 Paleta de marca
- QW2 Icones SVG
- Logo / wordmark SVG (P2)
- Tipografia display (Plus Jakarta Sans ou Sora)
- Atualizar `manifest.webmanifest` (theme_color, screenshots)
- **Verificar:** splash visual; contraste WCAG AA nos 2 temas.

### Sprint 2 - Mobile hardening
- QW3 Safe-area votacao
- QW4 Ranking responsivo
- QW1 da P1: `StatBox` grid-cols-2 mobile (Perfil + Estatisticas)
- Login: input digitavel + `enterKeyHint` + autocomplete
- MoverConta/tema/logout para bottom sheet
- **Verificar:** sem overflow horizontal em 320/375/430px.

### Sprint 3 - Microinteracoes e feedback
- Snackbar global
- Haptics wrapper
- Replace `window.location.href` por `navigate()` em `PartidaEditar`
- Reveal animado do craque
- `useBlocker` na votacao
- Filtro/busca em `PartidaNova`
- **Verificar:** feedback claro para todo CTA principal.

### Sprint 4 - PWA robusto
- SW offline-first (app-shell + NetworkFirst dados)
- Pagina `offline.html`
- Snackbar "online/offline"
- Pull-to-refresh nas listas
- Avatar/silueta por inicial
- Screenshots de install no manifest
- **Verificar:** fluxo completo funcionando em modo aviao (app-shell + ultimos dados em cache).

---

## 8. Apendice - Referencias

### Padroes mobile
- **Apple HIG (Human Interface Guidelines):** https://developer.apple.com/design/human-interface-guidelines
- **Material 3 (Android):** https://m3.material.io
- **WCAG 2.2 mobile:** https://www.w3.org/WAI/standards-guidelines/wcag/
- **PWA Checklist (Google):** https://web.dev/pwa-checklist/

### Topicos especificos
- **Safe areas / env():** https://developer.mozilla.org/en-US/docs/Web/CSS/env
- **Touch targets (44pt / 48dp):** HIG `Patterns > Handling input` + Material `Understanding layout > Touch targets`
- **Vibration API:** https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate
- **enterKeyHint:** https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/enterkeyhint
- **Pull-to-refresh nativo:** RFC Chrome `overscroll-behavior` https://developer.mozilla.org/en-US/docs/Web/CSS/overscroll-behavior
- **Workbox (estrategias de cache PWA):** https://developer.chrome.com/docs/workbox
- **Bottom sheet padrao:** Material 3 `Bottom sheet` + HIG `Sheets`

### Bibliotecas citadas (verificar licensa antes de adicionar)
- **lucide-react** (ISC): icones SVG tree-shakeable.
- **Phosphor Icons** (MIT): alternativa com mais estilos.
- **@fontsourcePlus Jakarta Sans** (OFL-1.1): tipografia display.
- **react-hot-toast** (MIT) ou **sonner** (MIT): snackbar pronto (ou construir minimal custom).
- **vaul** (MIT): drawer / bottom sheet se moverConta para la.

### Mapa de arquivos referenciados neste relatorio
- `src/index.css` - topicos 2.1, 2.2, 3.1, QW1
- `src/lib/tema.ts` - 2.1, 3.1
- `src/routes/Layout.tsx` - 2.3, 4.1, 4.5, QW2
- `src/routes/Login.tsx` - 2.3, 4.1, Sprint 2
- `src/routes/Resumo.tsx` - 2.3
- `src/routes/Jogos.tsx` - 2.3, 4.6
- `src/routes/PartidaNova.tsx` - 2.3, P2 (busca)
- `src/routes/PartidaNovaTimes.tsx` - 2.3, 4.4
- `src/routes/PartidaConfirma.tsx` - 2.3
- `src/routes/PartidaVotar.tsx` - 2.3, 4.2 (bug safe-area), QW3
- `src/routes/PartidaDetalhe.tsx` - 2.3, 4.6, QW5
- `src/routes/PartidaEditar.tsx` - 2.3, Sprint 3 (navigate)
- `src/routes/Ranking.tsx` - 2.3, QW4
- `src/routes/Estatisticas.tsx` - 2.3, Sprint 2 (StatBox)
- `src/routes/EstatisticasRacha.tsx` - 2.3, P2 (avatares)
- `src/routes/Perfil.tsx` - 2.3, 4.1, Sprint 2 (StatBox)
- `src/routes/NovoJogador.tsx` - 2.3
- `src/components/BannerLembrete.tsx` - 2.3
- `src/components/ConfirmDialog.tsx` - 2.1
- `src/components/SeletorNota.tsx` - 2.1
- `src/components/DuplaCard.tsx` - 2.3 (neutro)
- `src/components/Estado.tsx` - 4.4 (snackbar proposto)
- `src/components/SecaoRacha.tsx` - 2.1
- `public/manifest.webmanifest` - 2.2, 3.1, QW1
- `public/sw.js` - 2.2, 4.7, Sprint 4
- `docs/melhorias-futuras.md` - alinhamento (QW4, P2 useBlocker)

---

**Fim do relatorio.** Nenhum codigo alterado. Arquivo gerado em `docs/relatorio-ux-mobile.md`.
