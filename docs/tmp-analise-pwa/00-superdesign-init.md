# Superdesign Init — Análise do Repositório Racha Gragoatá CBO

> Registro da etapa de INICIALIZAÇÃO da skill Superdesign (v0.6.0, CLI v0.14.0). Executada em 2026-09-29. Somente análise local: nenhum projeto criado no canvas, nenhum draft gerado, nenhum crédito gasto, nenhum código do projeto alterado.
>
> Preflight do CLI confirmado: `auth: authenticated as team "Personal" (local credentials)`.

## O que o init mapeou

### Stack e arquitetura de UI

- **Stack**: React 19 + Vite 8 + TypeScript + Tailwind CSS 4 (`@tailwindcss/vite`, sem `tailwind.config.*` — tokens em CSS via `@theme`) + react-router-dom 7 + `@supabase/supabase-js`. Ícones `lucide-react`. Sem biblioteca de componentes — tudo próprio, com nomenclatura em português.
- **Contexto de uso**: PWA instalado no celular (mobile-first total, portrait). Manifest standalone, service worker manual (`public/sw.js`), splash screens iOS, tema inline anti-flash no `<head>`.
- **Design System**: "Súmula de Quinta" — documentado canonicamente em `DESIGN.md` (531 linhas, na raiz). Metáfora visual: papel creme + tinta de giz + carimbo âmbar + placar de LED.

### Rotas

- **22 rotas** declaradas em `src/App.tsx`, todas com componentes `React.lazy` centralizados em `src/lib/rotas.ts` (fonte única + tabela de prefetch por regex).
- 21 rotas aninhadas em `src/routes/Layout.tsx` (app shell); `/login` fora do shell.
- Fluxos focados sem TabBar: `/partida/nova` e `/partida/:id/{times,ao-vivo,editar,votar}` (usam `BarraAcaoInferior`).
- 3 redirecionamentos de módulo (`/ranking`, `/estatisticas`, `/notificacoes`) + fallback `*` → `/`.

### Primitivas compartilhadas (medidas por nº de arquivos importadores)

| Componente | Usos | Papel |
|---|---|---|
| `Estado` (Carregando + MensagemEstado) | 31 | Loading e banners de erro/sucesso/info |
| `BotaoVoltar` | 14 | Retorno com navegação defensiva |
| `Snackbar` | 10 | Toast com haptics e auto-dismiss |
| `Skeletons` (11 exports) | 10 | Skeleton por tela (CLS=0) |
| `ConfirmDialog` | 10 | Confirmação com focus trap |
| `PullToRefresh` | 7 | Wrapper pull-to-refresh |
| `Badge` | 7 | Status/posição/variante |
| `ModalBase` | 6 | Modal canônico (bottom-sheet) |
| `CampoBusca` | 5 | Busca com limpar |
| `BarraAcaoInferior` | 5 | CTA fixa de fluxo focado |
| `AbasNotificacoes` / `AbasEstatisticas` | 4 / 3 | Abas NavLink com prefetch |
| `PainelPlacar` / `CabecalhoTime` | 3 / 3 | Placar LED e cabeçalho de time |
| `StatBox`, `Logo`, `Toggle`, `BadgeTime`, `SelectSumula`, `StepperBox` | 1-2 | Métrica, marca, switch, chips, dropdown, contador |

Hooks de UI: `useModalA11y` (focus trap), `useListbox` (listbox ARIA), `useSwipeTabs` (swipe de abas), `useSnackbar`. Utilitário de feedback tátil: `lib/haptics.ts` (5 padrões de vibração).

### Tokens de tema (variáveis CSS)

- 19 variáveis semânticas `--cor-*` em `:root` (light) e `.dark`, espelhadas como `--color-*` utilitárias no `@theme` do Tailwind 4: fundo/superficie/superficie-2/borda, giz/giz-fraco, preto-time/branco-time (fixas), destaque/destaque-texto/destaque-tinta (âmbar `#ffb300`), campo/campo-linha, perigo/ok/oliva, led-fundo/led-fundo-hover/led-borda.
- Tema por classe `.dark` no `<html>`, default **dark**, persistido em `localStorage['racha_tema']`, com `meta theme-color` atualizado por JS.
- Fontes: Archivo (sans), Barlow Condensed (display), Chivo Mono (mono) — Google Fonts.
- Utilities custom: `shadow-carimbo` (3 sombras variantes), `sumula-header` (linha pontilhada 2px dotted), `no-scrollbar`, `scrollbar-sumula`, `transition-fast/normal`, `animate-fade-in/slide-up`.
- Regras globais: alvo de toque 44px, inputs 16px (anti-zoom iOS), focus outline âmbar, textura de ruído SVG no body, `prefers-reduced-motion` respeitado, safe-areas.

### Principais candidatos a componentes reutilizáveis (DraftComponents)

1. **Layout/App Shell** (header sticky + TabBar + banner offline) — extraível com props `activeTab`, `isAdmin`, `showTabBar`.
2. **HeaderSumula** — padrão de cabeçalho editorial repetido inline em todas as telas (candidato forte a componentização futura no próprio projeto).
3. **PainelPlacar** (3 variantes LED) e **CabecalhoTime** — identidade visual mais distintiva do produto.
4. **Badge** (polimórfico por status/posição), **BadgeTime**, **StatBox** — sistema de dados esportivos.
5. **ModalBase + ConfirmDialog + Snackbar** — camada de interação completa e acessível.
6. **Abas (NavTabs)**, **BotaoVoltar**, **BarraAcaoInferior**, **PullToRefresh** — navegação mobile.
7. **CampoBusca, Toggle, SelectSumula, StepperBox** — formulários.

### Observações / débitos encontrados (apenas registro, fora do escopo)

- Componentes sem nenhuma importação no codebase (possível código morto): `Toggle` e `StepperBox` têm 1-2 usos, mas `ModalSelecionarGoleiro`, `LinhaGoleiro`, `FormEventoAutomatico` etc. aparecem em árvores — verificar-se no futuro: nenhum arquivo de `src/components/` está 100% órfão segundo o traçado, porém alguns têm uso único e baixa coesão com o resto.
- Nomenclatura inconsistente residual: alguns componentes usam propriedades bilíngues (`CampoBusca` aceita `valor`/`value`, `aoMudar`/`onChange`).
- `linhasComparador.tsx` em minúsculas (fora do padrão PascalCase do projeto).

## Artefatos gerados em `.superdesign/init/`

| Arquivo | Conteúdo | Tamanho aprox. |
|---|---|---|
| `components.md` | Código-fonte completo das 19 primitivas compartilhadas + padrão dos Skeletons + hooks de UI | ~59 KB / 1805 linhas |
| `layouts.md` | `Layout.tsx` completo (app shell), `BannerLembrete`, `ErrorBoundary`, `BotaoInstalar`, `main.tsx` e padrões de layout | ~28 KB / 661 linhas |
| `routes.md` | `App.tsx` completo, padrão de lazy/prefetch, tabela das 22 rotas com o que cada uma renderiza | ~9 KB / 143 linhas |
| `theme.md` | Resumo compacto de tokens (paleta light/dark, tipografia, raios, sombras, mobile) + `index.css` completo + `tema.ts` + head do `index.html` + manifest | ~15 KB / 465 linhas |
| `pages.md` | Árvores de dependência de 11 páginas-chave (Resumo, Jogos, Ranking, Perfil, Estatisticas, Comparador, PartidaDetalhe, PartidaAoVivo, Administrador, GestaoJogadores, Login) | ~13 KB / 428 linhas |
| `extractable-components.md` | Catálogo de extração: 7 layout components + 14 basic components com props extraíveis e elementos hardcoded | ~11 KB / 175 linhas |

Validação (init-complete test): os 6 arquivos existem e estão não-vazios.

## Próximos passos (fora desta etapa)

- As etapas seguintes da análise PWA podem consumir os 6 arquivos como contexto de design (via `--context-file`, respeitando o payload budget).
- Ao gerar o primeiro draft de UI, a skill persistirá `.superdesign/resume.json` (esta etapa deliberadamente NÃO o criou).
