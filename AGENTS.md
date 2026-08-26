# ⚽ AGENTS.md — Diretrizes Canônicas de Contribuição (Racha Gragoatá CBO)

> **Aviso para Modelos de Linguagem (LLMs) e Agentes Autônomos**:  
> Este documento é a **fonte canônica de verdade** sobre arquitetura geral, stack técnica, banco de dados (Supabase/PostgreSQL), segurança e regras de negócio do projeto **Racha Gragoatá CBO**.  
> 🎨 **Para qualquer desenvolvimento de Frontend, UI, UX, Tokens, Layout, Componentes ou Redação/Tom de Voz**: O arquivo canônico e mandatório é o [`design-system.md`](./design-system.md). Consulte-o obrigatoriamente antes de criar ou refatorar interfaces.
> Qualquer contribuição, refatoração ou criação de código deve seguir rigorosamente as diretrizes aqui consolidadas. **Não desvie destes padrões.**

---

## 📑 Sumário

1. [Visão Geral e Propósito do Projeto](#1-visão-geral-e-propósito-do-projeto)
2. [Stack Tecnológica e Configurações](#2-stack-tecnológica-e-configurações)
3. [Estrutura de Diretórios e Responsabilidades](#3-estrutura-de-diretórios-e-responsabilidades)
4. [Identidade Visual e Design System — "Súmula de Quinta"](#4-identidade-visual-e-design-system--súmula-de-quinta)
5. [Padrões de Código Frontend e React 19](#5-padrões-de-código-frontend-e-react-19)
6. [UX Mobile e Diretrizes PWA](#6-ux-mobile-e-diretrizes-pwa)
7. [Padrões de Backend, Banco de Dados e Supabase](#7-padrões-de-backend-banco-de-dados-e-supabase)
8. [Regras de Negócio e Domínio do Futebol (O Racha)](#8-regras-de-negócio-e-domínio-do-futebol-o-racha)
9. [Segurança, Autenticação e Permissões](#9-segurança-autenticação-e-permissões)
10. [Matriz de "Faça Assim" vs "Não Faça Assim"](#10-matriz-de-faça-assim-vs-não-faça-assim)
11. [Scripts Úteis e Checklist de Contribuição](#11-scripts-úteis-e-checklist-de-contribuição)

---

## 1. Visão Geral e Propósito do Projeto

O **Racha Gragoatá CBO** é uma plataforma progressiva (PWA) de gerenciamento e engajamento para a tradicional pelada semanal realizada às quintas-feiras à noite. O sistema resolve o ciclo de vida completo do racha:

- **Confirmação de Presença Semanal**: Limite de 14 jogadores de linha titulares com fila de espera e prioridade para mensalistas até quarta-feira às 16h BRT.
- **Sorteio Balanceado Automático**: Divisão de times equilibrada por posição primária/secundária e média de notas históricas dos atletas.
- **Súmula em Tempo Real**: Registro ao vivo de gols, assistências e gols contra durante o jogo.
- **Votação e Notas com Média Aparada**: Cédula secreta pós-jogo onde cada atleta avalia os participantes (1 a 10), descartando extremos (menor e maior nota) e elegendo o Craque da Partida.
- **Módulo Financeiro Transacional**: Controle individual de mensalidades (R$ 90,00) e avulsos (R$ 20,00) com extrato e quitação.
- **Engajamento e Estatísticas**: Ranking anual com cálculo de pontos (3 por vitória, 1 por empate), aproveitamento, artilharia, parcerias/duplas e Web Push Notifications.

### Filosofia Arquitetural:

1. **Zero "Code Slop"**: Código limpo, sem componentes não utilizados, sem hacks e sem violação de hooks.
2. **Design Autêntico**: Rejeição total ao visual genérico de SaaS corporativo feito por IA. A estética emula a súmula de mesa, placar de LED e o futebol amador noturno.
3. **Transacionalidade e Integridade ACID**: Operações relacionais complexas ocorrem dentro de RPCs no PostgreSQL, nunca em múltiplos round-trips do client.
4. **Mobile First Extremo**: Toques confortáveis (>= 44px), feedback tátil (haptics), transições suaves e tolerância total a conexões instáveis.

---

## 2. Stack Tecnológica e Configurações

| Camada            | Tecnologia           | Versão     | Observações / Configurações                                                                        |
| ----------------- | -------------------- | ---------- | -------------------------------------------------------------------------------------------------- |
| **Linguagem**     | TypeScript           | `^5.9.3`   | `strict: true`, `verbatimModuleSyntax: true`, `noUncheckedSideEffectImports: true`                 |
| **Frontend Core** | React & React DOM    | `^19.2.8`  | StrictMode, React 19 Hooks, Lazy loading de rotas com `Suspense`                                   |
| **Build & Dev**   | Vite                 | `^8.2.1`   | Plugin `@vitejs/plugin-react`                                                                      |
| **Estilização**   | Tailwind CSS         | `^4.3.3`   | Tailwind v4 puro via `@import 'tailwindcss';` em `src/index.css` (sem `tailwind.config.js` legado) |
| **Roteamento**    | React Router DOM     | `^7.18.2`  | Rotas aninhadas com `<Layout />`, `<Outlet />`, `Navigate` e `useParams`                           |
| **Ícones**        | Lucide React         | `^1.31.0`  | Biblioteca padrão exclusiva para ícones                                                            |
| **BaaS / Banco**  | Supabase JS          | `^2.112.2` | PostgreSQL 15+, PL/pgSQL RPCs, Views agregadas, `pg_cron`, `pg_net`                                |
| **Linter**        | ESLint (Flat Config) | `^10.9.0`  | `typescript-eslint`, `eslint-plugin-react-hooks`                                                   |
| **Formatador**    | Prettier             | `^3.9.6`   | Aspas simples (`'`), ponto-e-vírgula obrigatório (`;`), `printWidth: 100`, `tabWidth: 2`           |

---

## 3. Estrutura de Diretórios e Responsabilidades

```text
racha/
├── AGENTS.md                  # Este arquivo (guia canônico para agentes: arquitetura, backend e regras)
├── design-system.md           # Guia canônico do Design System "Súmula de Quinta" (UI, UX, Tokens, Redação)
├── package.json               # Dependências e scripts de desenvolvimento
├── vite.config.ts             # Configuração do Vite e plugins
├── eslint.config.js           # Configuração ESLint flat config v9+
├── .prettierrc                # Regras de formatação Prettier
├── .editorconfig              # Configurações de indentação e charset do editor
├── index.html                 # Shell HTML, fontes Google e meta tags de tema PWA
├── iniciar_local.bat          # Setup local: build de produção + vite preview ("dev" = servidor Vite)
├── public/                    # Manifest, ícones SVG/PNG e fallback offline.html
├── src/
│   ├── main.tsx               # Ponto de entrada: StrictMode, ErrorBoundary, registro PWA
│   ├── App.tsx                # Declaração central de rotas (componentes lazy importados de lib/rotas.ts)
│   ├── index.css              # Tokens CSS, temas dark/light, fontes e utilitários Tailwind v4
│   ├── components/            # Componentes visuais reutilizáveis
│   │   ├── Avatar.tsx         # Avatar quadrado terroso com plaqueta de posição
│   │   ├── CampoPartida.tsx   # Prancheta tática proporcional com mini-placares
│   │   ├── ConfirmDialog.tsx  # Modal de confirmação acessível (substitui window.confirm)
│   │   ├── DialogoEvento.tsx  # Modal de registro de gols/assistências ao vivo
│   │   ├── EscalacaoTimesEditor.tsx # Editor unificado de divisão de times
│   │   ├── Estado.tsx         # MensagemEstado (inline persistente) e Carregando
│   │   ├── Logo.tsx           # Escudo partido P&B com estrela âmbar central
│   │   ├── PullToRefresh.tsx  # Gesto de refresh mobile com detecção recursiva de scroll
│   │   ├── SeletorNota.tsx    # Dropdown tátil de notas de 1 a 10
│   │   ├── Skeletons.tsx      # Skeletons estruturais das telas (CLS = 0)
│   │   └── Snackbar.tsx       # Toast de notificação rápida com haptics e auto-dismiss
│   ├── context/
│   │   └── SessaoContext.tsx  # Gerenciamento global de sessão e sync do jogador logado
│   ├── hooks/
│   │   ├── useAdmin.ts        # Hook para validação de privilégios administrativos
│   │   ├── useCache.ts        # Cache em memória SWR (stale-while-revalidate) com dedupe e invalidação
│   │   ├── useEscalacaoTimes.ts # Hook de sorteio automático e manipulação de times
│   │   ├── useJogadorLogado.ts  # Atalho para dados do atleta conectado
│   │   ├── useListbox.ts      # Motor unificado de listbox/combobox acessível
│   │   ├── useModalA11y.ts    # Gerenciamento de foco, focus trap e acessibilidade de modais
│   │   ├── useSnackbar.ts     # Hook gerenciador de notificações efêmeras com haptics
│   │   └── useSwipeTabs.ts    # Gesto touch de swipe entre abas com trava vertical
│   ├── lib/
│   │   ├── dividas.ts         # Métodos de consulta e quitação financeira
│   │   ├── erros.ts           # Tratamento centralizado de erros e mensagens amigáveis
│   │   ├── escalacao.ts       # Algoritmo matemático de balanceamento de times (ABBA)
│   │   ├── formatacao.ts      # Formatadores de moeda (BRL), nomes e datas (pt-BR)
│   │   ├── haptics.ts         # Vibração tátil defensiva (Vibration API)
│   │   ├── jogadores.ts       # Consultas, gestão de mensalistas e superadmins
│   │   ├── navegacao.ts       # Helper voltar(navigate, fallback) resiliente a deep-links
│   │   ├── partidas.ts        # Tipos, queries e chamadas a RPCs de partidas
│   │   ├── pwa.ts             # Service Worker e eventos de instalação PWA
│   │   ├── rotas.ts           # Fonte única das rotas lazy e do prefetch preCarregarRota(path)
│   │   ├── supabase.ts        # Instância singleton do cliente Supabase
│   │   ├── tema.ts            # Hook e alternância de tema claro/escuro
│   │   └── times.ts           # Constantes de times (Preto 'a' / Branco 'b') e posições
│   └── routes/                # Telas da aplicação (lazy loaded)
│       ├── Layout.tsx         # Shell estável: Header sticky, Offline Banner, Suspense por rota, TabBar com prefetch
│       ├── Login.tsx          # Tela de autenticação por username/senha
│       ├── Resumo.tsx         # Boletim Oficial da Temporada
│       ├── Jogos.tsx          # Mural de placares de jogos
│       ├── Ranking.tsx        # Pódio Top 3 e tabela de classificação
│       ├── Perfil.tsx         # Estatísticas individuais e troca de senha
│       ├── Estatisticas.tsx   # Visão detalhada por jogador
│       ├── EstatisticasRacha.tsx # Destaques do ano e duplas do racha
│       ├── PartidaDetalhe.tsx # Súmula oficial, presença e placar LED
│       ├── PartidaAoVivo.tsx  # Operação de campo em tempo real
│       ├── PartidaVotar.tsx   # Cédula de votação de notas com autosave
│       ├── PartidaEditar.tsx  # Edição transacional de súmula
│       ├── PartidaNova.tsx    # Criação manual de novo jogo
│       ├── PartidaConfirma.tsx# Presença e escalação da nova partida
│       ├── GestaoJogadores.tsx# Gerenciamento de atletas e mensalistas
│       └── Administrador.tsx  # Painel financeiro de dívidas e cobranças
├── supabase/
│   ├── aplicar_tudo.sql       # Script mestre unificado para criação do banco do zero
│   ├── migrations/            # Migrations incrementais sequenciais (001_... a 071_...)
│   └── functions/             # Edge Functions Deno (send-voting-reminders, etc.)
├── GUIA/                      # Manuais passo a passo para devs e LLMs
│   ├── README.md              # Índice dos guias disponíveis
│   ├── MIGRACOES_AUTOMATICAS.md # Guia de migrações e comandos do Supabase CLI
│   └── SETUP_FRONTEND_LOCAL.md # Guia de setup do frontend local com Supabase real
└── docs/                      # Documentação histórica e relatórios de auditoria
```

---

## 4. Identidade Visual e Design System — "Súmula de Quinta"

> 📖 **Fonte Canônica e Oficial do Design System**: [`design-system.md`](./design-system.md)  
> Para detalhes aprofundados sobre tokens de cores, escala formal de espaçamento (_spacing tokens_), tipografia, anatomia de componentes, snippets de código, tom de voz em 3 níveis, glossário canônico e checklist de acessibilidade (a11y), **consulte e siga rigorosamente o [`design-system.md`](./design-system.md)**.

### 4.1 Diretriz Mandatória para Agentes e Modelos de IA

Antes de criar, estilizar ou refatorar qualquer componente, tela ou fluxo visual:

1. **Consulte o [`design-system.md`](./design-system.md)** para garantir fidelidade aos tokens, espaçamentos, tipografia e padrões de interface.
2. 🚫 **É TERMINANTEMENTE PROIBIDO criar interfaces com visual SaaS genérico de IA** (como `rounded-xl`, sombras difusas azuladas `shadow-lg`, gradientes desnecessários, fundos brancos puros estéreis ou fontes corporativas genéricas). A estética emula a súmula de mesa, placar de LED e o futebol amador noturno.

### 4.2 Resumo dos Pilares Invioláveis de Interface

1. **Padrão Estrutural (Listas Contínuas vs. Cards)**: O padrão visual primário para rankings, histórico de jogos e listas de presença é a **lista contínua minimalista** (`divide-y divide-borda/40 border-y border-borda`). Cards com `shadow-carimbo` e borda são reservados **apenas para destaques semânticos reais** (ex: Próxima Partida, Craque da Partida, Banners Push/Offline, Pódio).
2. **Tokens Semânticos**: Proibido hardcodar hexadecimais ou cores Tailwind genéricas (`bg-blue-600`, `text-gray-900`) no JSX. Utilize exclusivamente os tokens semânticos (`bg-fundo`, `bg-superficie`, `bg-superficie-2`, `border-borda`, `text-giz`, `text-giz-fraco`, `bg-destaque`, `text-destaque`, `text-destaque-tinta`, `bg-ok`, `bg-perigo`, `bg-campo`, `bg-preto-time`, `bg-branco-time`).
3. **Tríade Tipográfica Estrita**:
   - **`font-display` (`Barlow Condensed`)**: Títulos, nomes de jogadores, cabeçalhos de súmula, badges, crachás e botões (com `uppercase tracking-wider` ou `tracking-widest`).
   - **`font-sans` (`Archivo`)**: Corpo de texto, formulários, alertas, modais e descrições.
   - **`font-mono` (`Chivo Mono`)**: Placares, notas, percentuais, valores em R$, contadores e posições (com `tabular-nums`).
4. **Geometria, Cantos e Sombras-Carimbo**:
   - Cantos duros: `rounded-[2px]` (badges compactas), `rounded-[3px]` (avatares), `rounded-[4px]` (botões, inputs, cards e modais) e no máximo `rounded-[6px]` (diálogos tela cheia).
   - Sombras secas sem blur: `shadow-carimbo`, `shadow-carimbo-destaque`, `shadow-carimbo-preto`.
5. **Formulários e Foco Acessível**: Inputs e selects em `bg-superficie-2`, `rounded-[4px]`, `text-base` (previne zoom indesejado no iOS) e foco acessível visível (`focus-visible:outline-2 focus-visible:outline-destaque focus-visible:outline-offset-2`).
6. **Tom de Voz e Glossário Canônico**: Seguir os 3 níveis de comunicação definidos no `design-system.md` (1. Oficial/Administrativo, 2. Funcional/Amigável, 3. Resenha/Pós-Jogo) e os termos oficiais (_Boletim Oficial_, _Artilheiro Oficial_, _Maestro do Racha_, _Craque da Rodada_, _Quadro de Presença_).

---

## 5. Padrões de Código Frontend e React 19

### 5.1 Strict Rules of Hooks

Nunca chame hooks (`useState`, `useEffect`, `useMemo`, `useCallback`, `useNavigate`, etc.) após condicionais de retorno / guards de permissão. **Todos os hooks devem permanecer incondicionalmente no topo do componente.**

### 5.2 Prevenção Obrigatória de Race Conditions

Todo `useEffect` que realize chamadas assíncronas deve implementar a flag de cleanup `let ativo = true; return () => { ativo = false; };`:

```tsx
// Padrão obrigatório para carregamento de dados em rotas e componentes
useEffect(() => {
  let ativo = true;

  async function carregarDados() {
    try {
      setCarregando(true);
      const dados = await buscarPartida(partidaId);
      if (ativo) {
        setPartida(dados);
      }
    } catch (err) {
      if (ativo) {
        setErro(formatarMensagemErro(err, 'Não foi possível carregar a partida.'));
      }
    } finally {
      if (ativo) {
        setCarregando(false);
      }
    }
  }

  carregarDados();

  return () => {
    ativo = false;
  };
}, [partidaId]);
```

**Exceção arquitetural (`useCache`)**: rotas que carregam dados via `useCache()` (seção 5.5) **não** implementam a flag manualmente — o `buscar` é uma função pura (apenas consulta o banco e lança erro) e o hook é o único escritor de estado, aplicando a proteção contra races internamente (nunca seta estado pós-unmount nem após troca de chave). Não reintroduza flags `ativo` manuais nessas rotas.

### 5.3 Padrão Triplo de Feedback da UI

1. **Notificação Rápida / Ação Efêmera**: `<Snackbar />`
   - Dispara haptic automático (`vibrateSuccess` / `vibrateError`).
   - Auto-dismiss em 3000ms.
   - Posicionamento respeitando a TabBar: `style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' }}`.
2. **Mensagem Persistente / Inline**: `<MensagemEstado tipo="erro" | "sucesso" | "info" />`
   - Usado em formulários, topo de listas vazias e falhas permanentes de tela.
3. **Diálogos de Confirmação Crítica**: `<ConfirmDialog />`
   - **Proibido usar `window.confirm()` ou `window.alert()`**.
   - Acessível com trapping de foco, tecla `Escape` e trava de scroll no body.

### 5.4 Cumulative Layout Shift (CLS = 0) com Skeletons

Toda rota principal possui um esqueleto correspondente em `src/components/Skeletons.tsx` que espelha exatamente a mesma estrutura física, alturas e grid do conteúdo carregado para garantir CLS zero na transição.

**Posicionamento do `<Suspense>`**: o boundary de lazy loading vive **dentro do `Layout.tsx`**, envolvendo apenas o `<Outlet />`, com fallback selecionado por pathname (mapa prefixo → skeleton, definido como constante de módulo antes dos hooks). **É proibido envolver as `<Routes>` inteiras em `App.tsx`** — isso desmontaria Header e TabBar a cada chunk carregado. A rota `/login` (fora do Layout) possui boundary próprio com `CarregandoGeral`.

### 5.5 Cache em Memória SWR (`src/hooks/useCache.ts`)

As telas de aba (Resumo, Jogos, Ranking) carregam dados via `useCache<T>(chave, buscar)`, com semântica **stale-while-revalidate** e zero dependências externas:

1. **Primeira visita** (sem cache): exibe o skeleton da rota → busca → cacheia em memória de módulo (sobrevive a remontagens da rota).
2. **Revisitas**: renderizam o cache **instantaneamente** (sem skeleton) e revalidam em background; a atualização chega suavemente quando a resposta retorna.
3. **Erros tolerantes**: falha de revalidação com dados em tela é silenciosa; erro só vira `MensagemEstado` quando não existe cache.
4. **Dedupe**: requests concorrentes para a mesma chave compartilham a mesma promise em voo.
5. **Invalidação obrigatória após mutações**: toda escrita que afete dados cacheados deve chamar `invalidarCache(chave)` (ex.: exclusão de partida em `Jogos.tsx` → `invalidarCache('jogos')`). A invalidação também incrementa a geração da chave, impedindo que uma busca iniciada antes da mutação repovoque o cache com dado obsoleto.
6. **Pull-to-Refresh**: passe `recarregar` como `onRefresh` — o gesto busca na rede de verdade e aguarda a promise resolver.

Regras de uso: `buscar` deve ser estável (`useCallback`) e uma **função pura** (apenas consulta e lança erro; nunca seta estado); a chave deve identificar o conteúdo consultado, incluindo filtros que alteram a query (ex.: `ranking:${posicaoFiltro}`).

---

## 6. UX Mobile e Diretrizes PWA

### 6.1 Alvos de Toque Mínimos de 44px

Todo elemento clicável (botões, seletores, abas, links, botões de ação e itens de lista) deve garantir altura mínima de toque de 44px (`min-h-[44px]` ou padding equivalente).

### 6.2 Safe Area Insets do Sistema Operacional

- O `body` possui `padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)`.
- Elementos fixados na base (como a TabBar ou barras de ação inferiores) devem utilizar `paddingBottom: env(safe-area-inset-bottom, 0px)`.

### 6.3 Navegação Resiliente a Deep-Links

Sempre que implementar botões de retorno ("Voltar"), use a função utilitária `voltar(navigate, fallback)` de `src/lib/navegacao.ts`. Se o usuário tiver entrado direto por notificação push ou link externo e o histórico estiver vazio, ele é redirecionado com segurança para a rota de fallback sem quebrar a aplicação.

### 6.4 Feedback Háptico Tátil (`src/lib/haptics.ts`)

- `vibrateLight()`: Toques em abas, filtros e seleção de notas.
- `vibrateSuccess()`: Confirmação de presença e salvamento com sucesso.
- `vibrateWarning()`: Violação de regras (ex: tentar escalar 2º goleiro no mesmo time).
- `vibrateError()`: Erros de validação e falhas de requisição.
- `vibrateGoal()`: Registro ou alteração de gol no modo ao vivo.

### 6.5 Ocultação da TabBar em Fluxos Focados

No `Layout.tsx`, a barra de navegação inferior é automaticamente ocultada em telas de fluxo focado (criação, edição, votação e jogo ao vivo) através da regex:

```tsx
const isFluxoFocado =
  /^\/partida\/(nova(\/times|\/confirma)?|\d+\/(votar|editar|ao-vivo|times))/.test(pathname);
```

Quando verdadeiro, o `<main>` recebe padding inferior adequado para fixação das barras de ação diretamente na base da tela.

### 6.6 Prevenção de Conflito de Gestos Touch

Tabelas ou contêineres roláveis horizontalmente dentro de páginas que utilizam `useSwipeTabs` devem conter a propriedade `data-no-swipe` para impedir que o gesto de rolagem dispare acidentalmente a troca de abas.

### 6.7 Prefetch de Chunks de Rotas Lazy (`src/lib/rotas.ts`)

Todas as declarações `lazy()` das rotas vivem **exclusivamente** em `src/lib/rotas.ts` — a fonte única dos imports dinâmicos. A TabBar chama `preCarregarRota(path)` nos handlers `onTouchStart`, `onMouseEnter` e `onFocus` para pré-carregar o chunk JS da aba antes do clique. Ao criar uma nova rota, registre-a nesse módulo; **nunca duplique specifiers de `import('./routes/...')` em outros arquivos**.

---

## 7. Padrões de Backend, Banco de Dados e Supabase

### 7.1 Regra Zero UUID (Apenas Bigint / Bigserial)

**É expressamente proibido o uso de UUIDs (`gen_random_uuid()`, `uuid`) como chave primária ou estrangeira.**  
Todas as tabelas do projeto utilizam identificadores numéricos sequenciais (`bigserial PRIMARY KEY` ou `bigint`).

### 7.2 Migrations Sequenciais de 3 Dígitos

- As migrations residem em `supabase/migrations/` e devem seguir estritamente o padrão `XXX_nome_descritivo.sql` (ex: `071_nova_funcionalidade.sql`). Nunca utilize timestamps longos do CLI.
- Mantenha `supabase/aplicar_tudo.sql` sincronizado com os esquemas estáveis.

### 7.3 Padrões Obrigatórios para Funções e RPCs PostgreSQL

Toda RPC criada no PostgreSQL deve seguir rigorosamente os modificadores:

```sql
CREATE OR REPLACE FUNCTION nome_da_funcao_em_portugues(
  p_parametro_um bigint,
  p_parametro_dois jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Lógica transacional atômica
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION nome_da_funcao_em_portugues(bigint, jsonb) TO anon, authenticated;
```

**Diretrizes de RPC**:

1. Nomes em português no infinitivo snake_case (`fazer_login`, `salvar_edicao_partida`, `registrar_votos`, `registrar_divida`, `obter_medias_notas_jogadores`).
2. Parâmetros com prefixo `p_`.
3. `SECURITY DEFINER` com `SET search_path = public` obrigatório contra ataques de injeção de schema.
4. `STABLE` para funções puras de leitura agregada e `VOLATILE` (padrão) para escrita.
5. `GRANT EXECUTE ON FUNCTION ... TO anon, authenticated;` explícito no final da migration.

### 7.4 Atomicidade Transacional: "Tudo em uma única RPC"

Operações relacionais compostas (ex: criar ou editar partida com elenco, apagar eventos de excluídos, recalcular débitos avulsos) **NUNCA** devem ser realizadas em múltiplos passos pelo cliente TypeScript. Elas devem ser encapsuladas em uma RPC transacional única que receba `jsonb` ou arrays.

### 7.5 Agregações no PostgreSQL vs Download de Tabelas

**Nunca baixe tabelas inteiras no cliente para calcular médias, rankings ou saldos devedores.**

- Médias aparadas de notas: use a RPC `obter_medias_notas_jogadores()` (Migration 070).
- Placares e saldos: use as views `partidas_com_placar` (mural de jogos em query única, Migration 071), `partida_placar`, `view_ranking` e `dividas_resumo`.

### 7.6 Fusos Horários e Agendamentos com `pg_cron`

O daemon do `pg_cron` no Supabase avalia expressões em **UTC**. O fuso de Brasília é fixo em **UTC-3** (BRT).

- **10:00 BRT** = **13:00 UTC** (`0 13 * * 1` para segundas-feiras).
- Dentro de funções SQL e queries, use sempre: `now() AT TIME ZONE 'America/Sao_Paulo'`.

---

## 8. Regras de Negócio e Domínio do Futebol (O Racha)

### 8.1 Ciclo de Vida da Partida

```text
[draft] (Agendada) ──(Admin abre jogo)──> [live] (Em andamento)
   │                                           │
   │ (Publicação direta)                       │ (Admin finaliza)
   ▼                                           ▼
[published] (Votação aberta por 24h) ──(Expira prazo)──> [closed] (Encerrada)
```

1. **`draft` (Agendada)**: Criada automaticamente pelo cron de segunda-feira 10h BRT para a quinta-feira às 19h. Aguarda confirmação de presença e divisão de times.
2. **`live` (Em andamento)**: Jogo rolando. Registro em tempo real de gols normais, assistências e gols contra com sincronização periódica a cada 10s.
3. **`published` (Votação aberta)**: Partida finalizada. Abre a cédula de votação de notas por 24 horas (`voting_closes_at = now() + interval '24 hours'`) e gera débitos de avulsos.
4. **`closed` (Encerrada)**: Prazo expirado (fechado pelo cron de 1 minuto). Notas congeladas e Craque revelado na súmula oficial.

### 8.2 Capacidade, Confirmação de Presença e Prazos

- **Capacidade Máxima**: **14 jogadores titulares de linha** (`CAPACIDADE_PARTIDA = 14`). Os 2 goleiros não fazem parte da divisão de times e confirmação nesta etapa.
- **Reserva dos Mensalistas**: Ao criar a partida, todos os mensalistas ativos são pré-inscritos como `pendente`.
- **Prazo Limite de Confirmação**: **Quarta-feira às 16:00 BRT** (`confirmacao_closes_at`).
- **Contagem de Vagas e Confirmação**:
  - Apenas participantes com status `'confirmado'` ocupam vaga preenchida na partida (`vagasOcupadas`).
  - Mensalistas e avulsos `'pendente'` ou `'recusado'` **não** ocupam vaga preenchida.
  - Teto de confirmação: máximo de 14 jogadores de linha confirmados (`CAPACIDADE_PARTIDA = 14`). Ao atingir 14 confirmações, as vagas esgotam.
  - Status `'confirmado'` ocupa 1 vaga; status `'pendente'` e `'recusado'` não ocupam vaga.

### 8.3 Times, Posições e Goleiros da Partida

- **Times**: `a` (**Time Preto**) vs `b` (**Time Branco**) com **7 jogadores de linha + 1 goleiro por time** (total 8 por time, 16 na partida).
- **Seleção dos Goleiros na Divisão de Times**:
  - A confirmação semanal é estrita aos **14 jogadores de linha**.
  - Na tela de divisão dos times (`/partida/:id/times`), o administrador aloca os 14 jogadores de linha (7 Preto e 7 Branco) e seleciona o **Goleiro do Time Preto** e o **Goleiro do Time Branco** em seletores dedicados (com opção de cadastro rápido via modal inline).
- **Atletas Híbridos (Linha vs. Gol)**:
  - Se um atleta com perfil de goleiro (ex: _Dudu_, _Pedrinho_) jogar na **linha**, ele confirma presença entre os 14 titulares, vota na súmula pós-jogo e segue a regra financeira padrão de linha.
  - Se atuar no **gol** (`posicao = 'goleiro'`), ele é escalado diretamente na tela de times, **não vota** na cédula pós-jogo, **recebe notas** dos 14 de linha, concorre ao Craque da Partida e recebe a diária de **R$ 30,00**.
- **Posições Válidas**:
  - Primárias (`posicao`): `goleiro`, `zagueiro`, `lateral`, `meia`, `atacante`, `random`.
  - Secundárias (`posicao_b`): `goleiro`, `zagueiro`, `lateral`, `meia`, `atacante`.

### 8.4 Sistema de Votação, Média Aparada e Craque da Partida

- **Escala de Notas**: Inteiros de **1 a 10**.
- **Regras da Cédula**:
  - Apenas participantes da partida que atuaram na **linha** (`posicao <> 'goleiro'`) podem votar.
  - Atletas que atuaram como goleiro na partida não votam (bloqueio no frontend e na RPC `registrar_votos`).
  - Usuários _random_ não votam.
  - É proibido votar em si mesmo (_self-vote_ bloqueado no front e na RPC).
  - O atleta de linha deve avaliar todos os demais participantes da partida (incluindo os 2 goleiros).
  - Suporte a rascunho local em tempo real e descarte de voto para correção enquanto o prazo estiver aberto.
- **Média Aparada (_Trimmed Mean_)**:
  Quando um atleta recebe 3 ou mais votos, descarta-se a menor e a maior nota da média:
  $$\text{media\_oficial} = \frac{\sum(\text{notas}) - \min(\text{nota}) - \max(\text{nota})}{\text{total\_votos} - 2}$$
  Para 1 ou 2 votos, aplica-se a média aritmética simples.
- **Eleição do Craque da Partida**:
  Definido automaticamente via Window Function com os critérios de desempate:
  1º Maior Média Aparada $\rightarrow$ 2º Maior Volume de Votos $\rightarrow$ 3º Ordem Alfabética do Nome.

### 8.5 Módulo Financeiro, Dívidas e Diárias de Goleiro

- **Diária de Goleiros (R$ 30,00)**: Ao finalizar/publicar a partida, são geradas automaticamente 2 despesas de **R$ 30,00** para os atletas que atuaram no gol naquela partida. O painel administrativo exibe a Chave PIX do atleta com botão de cópia rápida.
- **Isenção dos Goleiros na Partida**: Quem joga no gol é **isento de taxa de avulso** por aquela partida.
- **Mensalidade**: Valor padrão de **R$ 90,00**. Gerada mensalmente no dia 01 às 10h BRT para todos os mensalistas ativos (não-goleiros), com competência `YYYY-MM`.
- **Avulso**: Valor padrão de **R$ 20,00**. Gerado automaticamente ao finalizar/publicar a partida para participantes de linha com `is_mensalista = false` e `posicao <> 'goleiro'`.
- **Outro**: Lançamento manual avulso (churrasco, coletes, multas).
- **Teto de Mensalistas**: Máximo de **14 mensalistas ativos** (`MAX_MENSALISTAS = 14`).
- **Regra de Administradores**: **Apenas mensalistas podem ser Administradores**. Se o status de mensalista de um atleta for desativado, o privilégio de administrador é revogado automaticamente.
- **Superadministradores Hardcoded (`SUPERADMINS`)**:
  Os usuários `'dico'`, `'tadeu'` e `'natal'` são **permanentemente administradores e mensalistas** no código e no banco, não podendo ter seus privilégios alterados.

### 8.6 Jogadores Randômicos e Placeholders (`random\d*`)

- Atletas avulsos sem cadastro prévio recebem username no padrão `/^random\d*$/i` (ex: `random`, `random1`...`random99`) e posição `random`.
- **Restrições**: Randoms não votam, não recebem dívidas de mensalidade, não acessam perfil e são **excluídos de rankings estatísticos gerais e relatórios de duplas**.

### 8.7 Gols Normais vs. Gols Contra no Placar

- O gol contra (`gols_contra`) **soma pontos diretamente para o time adversário** sem subtrair gols do time de quem fez o gol contra:
  $$\text{Placar Time Preto} = \sum \text{Gols}(Preto) + \sum \text{Gols Contra}(Branco)$$
  $$\text{Placar Time Branco} = \sum \text{Gols}(Branco) + \sum \text{Gols Contra}(Preto)$$
- **Pontuação no Ranking**: Vitória = 3 pontos, Empate = 1 ponto, Derrota = 0 pontos.

---

## 9. Segurança, Autenticação e Permissões

1. **Proteção da Coluna `senha_hash` (Migration 069)**:
   A coluna `senha_hash` da tabela `jogadores` teve seu `SELECT` revogado para `anon` e `authenticated`. Apenas colunas públicas são acessíveis no client.
2. **Autenticação Centralizada na RPC `fazer_login`**:
   O login valida as credenciais através da função `SECURITY DEFINER` `fazer_login(p_username, p_senha)`, que compara o hash e retorna os dados seguros do atleta autenticado.
3. **Persistência de Sessão no Frontend**:
   O login armazena os dados básicos em `localStorage` (`racha_sessao`) e o `SessaoProvider` sincroniza periodicamente em background com a tabela `jogadores`.
4. **Gates de Autorização no Banco**:
   Ações sensíveis (excluir partida, cadastrar jogador, quitar dívidas) recebem o ID do operador e validam `is_admin = true` diretamente no PostgreSQL.

---

## 10. Matriz de "Faça Assim" vs "Não Faça Assim"

| Área                    | ❌ Não Faça Assim (Proibido)                                   | ✅ Faça Assim (Padrão Correto)                                      |
| ----------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Identificadores**     | `id UUID DEFAULT gen_random_uuid()`                            | `id bigserial PRIMARY KEY` (Regra Zero UUID)                        |
| **Migrations**          | `20260822173000_adicionar_tabela.sql`                          | `071_adicionar_tabela.sql` (sequencial 3 dígitos)                   |
| **Segurança em RPCs**   | Funções sem `SECURITY DEFINER` ou sem `search_path`            | `SECURITY DEFINER SET search_path = public`                         |
| **Permissões SQL**      | Esquecer `GRANT EXECUTE` na migration                          | `GRANT EXECUTE ON FUNCTION ... TO anon, authenticated;`             |
| **Edição de Partida**   | Deletar e reinserir participantes em múltiplos steps do client | Usar a RPC atômica `salvar_edicao_partida(p_id, p_jsonb)`           |
| **Consultas Agregadas** | Baixar a tabela `votes` inteira para calcular médias no front  | Usar a RPC `obter_medias_notas_jogadores()`                         |
| **Layout / Estrutura**  | Empilhar dezenas de cards isolados com borda e sombra          | Listas contínuas com `divide-y` (cards só para destaque semântico)  |
| **Design / Cores**      | Usar cores Tailwind padrão (`bg-blue-600`, `text-gray-900`)    | Usar tokens semânticos (`bg-destaque`, `text-giz`, `bg-superficie`) |
| **Design / Cantos**     | `rounded-xl`, `rounded-2xl`, sombras suaves `shadow-lg`        | Cantos duros `rounded-[4px]`, `shadow-carimbo`, `border-borda`      |
| **Tipografia**          | Usar fontes genéricas em tudo                                  | `font-display uppercase` em títulos/badges e `font-mono` em números |
| **Tom de Voz / Nomes**  | Termos SaaS genéricos ("Dashboard", "MVP", "Winrate")          | Glossário canônico ("Boletim Oficial", "Craque", "Mais Eficiente")  |
| **Inputs / Forms**      | Inputs sem anel de foco visível ou com texto menor que 16px    | `focus-visible:outline-destaque` e `text-base` (anti-zoom no iOS)   |
| **Diálogos**            | `if (window.confirm('Excluir?'))`                              | `<ConfirmDialog open={...} onConfirm={...} />`                      |
| **Feedback Rápido**     | `alert('Salvo com sucesso!')`                                  | `<Snackbar mensagem="..." tipo="sucesso" />` com haptics            |
| **Rules of Hooks**      | Colocar `useEffect` ou `useMemo` após `if (!isAdmin) return`   | Declarar todos os hooks no topo e posicionar o guard no final       |
| **Race Conditions**     | `useEffect` assíncrono sem flag de cancelamento                | Usar `let ativo = true; return () => { ativo = false; };`           |
| **UX Mobile**           | Botões pequenos com altura menor que 44px                      | `min-h-[44px]` em todos os botões e alvos de toque                  |
| **Navegação**           | `navigate(-1)` seco (quebra se acessado via deep-link)         | `voltar(navigate, '/jogos')` de `src/lib/navegacao.ts`              |
| **Erros na UI**         | Exibir `error.message` cru ("Failed to fetch")                 | Usar `formatarMensagemErro(err)` de `src/lib/erros.ts`              |

---

## 11. Scripts Úteis e Checklist de Contribuição

### 11.1 Comandos do Projeto

```bash
# Iniciar servidor de desenvolvimento
npm run dev

# Checagem completa de tipos TypeScript e ESLint
npm run lint

# Correção automática de problemas do linter
npm run lint:fix

# Formatação completa de arquivos com Prettier
npm run format

# Verificação de conformidade de formatação
npm run format:check

# Build de produção
npm run build

# Servir o build de produção localmente (vite preview)
npm run preview

# Setup e início local completos (Windows), na porta 5173
iniciar_local.bat        # build de produção + vite preview (comportamento padrão)
iniciar_local.bat dev    # servidor de desenvolvimento Vite com HMR
```

---

### 11.2 Checklist Obrigatório Antes de Finalizar Tarefas ou PRs

Antes de considerar qualquer modificação concluída, valide item por item:

- [ ] **1. Verificação de Tipos e Linter**: Executou `npm run lint` e o resultado passou com **0 erros**?
- [ ] **2. Formatação de Código**: Executou `npm run format` para alinhar com o Prettier?
- [ ] **3. Build de Produção**: O comando `npm run build` gerou a pasta `dist/` sem falhas?
- [ ] **4. Fidelidade ao Design System (`design-system.md`)**: A interface respeita listas contínuas, cantos 4px, `shadow-carimbo`, tokens semânticos de cor, tom de voz e fontes `Archivo`, `Barlow Condensed` e `Chivo Mono`?
- [ ] **5. Alvos de Toque e Safe Areas**: Todos os botões possuem no mínimo 44px (`min-h-[44px]`) e respeitam safe area insets do iOS/Android?
- [ ] **6. Strict Rules of Hooks**: Todos os hooks estão no topo da função antes de qualquer retorno condicional?
- [ ] **7. Race Conditions**: Todo `useEffect` de carregamento trata a flag `let ativo = true` no cleanup (ou delega essa proteção ao `useCache`, seção 5.5)?
- [ ] **8. Diálogos e Alertas**: Não há nenhum `window.confirm` ou `window.alert` no código (uso exclusivo de `ConfirmDialog`, `Snackbar` ou `MensagemEstado`)?
- [ ] **9. Navegação Resiliente**: Todos os botões de voltar utilizam `voltar(navigate, fallback)`?
- [ ] **10. Integridade do Banco (se houver SQL)**:
  - Migrations usam numeração sequencial de 3 dígitos (`071_...sql`).
  - Zero UUID (apenas `bigserial` / `bigint`).
  - RPCs possuem `SECURITY DEFINER`, `SET search_path = public` e `GRANT EXECUTE`.
  - Coluna `senha_hash` nunca é exposta em leituras públicas.
- [ ] **11. Cache SWR e Mutações**: Se a tela usa `useCache`, toda mutação bem-sucedida chama `invalidarCache(chave)` e o `PullToRefresh` usa `recarregar` (busca na rede de verdade)?
