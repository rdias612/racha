# Design System — Racha Gragoatá CBO ("Súmula de Quinta")

> **Versão 2.0 — Guia Canônico de Identidade Visual, UX, Tokens e Arquitetura de Interface**  
> Este documento é a referência oficial para o design system do **Racha Gragoatá CBO**.  
> Ele foi estruturado em quatro camadas complementares: **Brand**, **Design Tokens**, **Components** e **Diretrizes para IAs & Desenvolvedores**.

---

## 📑 Sumário

1. [Camada 1: Brand (Identidade, Metáfora e Tom de Voz)](#1-camada-1-brand-identidade-metáfora-e-tom-de-voz)
2. [Camada 2: Design Tokens (Cores, Tipografia, Spacing, Radius, Sombras e Motion)](#2-camada-2-design-tokens)
3. [Camada 3: Components & Padrões de UI](#3-camada-3-components--padrões-de-ui)
4. [Camada 4: Diretrizes para IAs & Desenvolvedores (Regras, Acessibilidade e Checklist)](#4-camada-4-diretrizes-para-ias--desenvolvedores)

---

## 1. Camada 1: Brand (Identidade, Metáfora e Tom de Voz)

### 1.1 Metáfora Central: "Súmula de Papel & Resenha Raiz"

O app do Racha Gragoatá CBO não é um SaaS corporativo genérico nem um dashboard comercial estéril. A identidade visual nasce da fusão entre:

- **A Súmula Oficial & Prancheta do Árbitro:** Contrastes nítidos Preto vs. Branco, papel levemente texturizado, dados tabulares precisos, numerais em mono e carimbos de validação.
- **A Resenha Autêntica de Quinta-Feira:** A paixão, a zoeira sadia, os apelidos tradicionais da pelada, a artilharia, os destaques da rodada e a transparência financeira entre amigos.

### 1.2 Dosagem da Estética (Identidade de Assinatura vs. Sobrecarga Retrô)

Os elementos temáticos são usados como **assinatura de marca**, e não para poluir todas as superfícies da tela:

- A textura de grão de papel (`body::after`) é extremamente sutil (4% de opacidade com `mix-blend-mode: overlay`).
- Linhas pontilhadas (`sumula-header`) separam grandes seções editoriais, e não cada linha de dados.
- Sombras secas deslocadas (`shadow-carimbo`) são reservadas para botões de destaque, modais e cards semânticos.
- O app deve respirar como uma aplicação mobile esportiva contemporânea, rápida, limpa e funcional.

### 1.3 Tom de Voz Hierarquizado em 3 Níveis

A comunicação varia de acordo com o contexto funcional da tela:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ NÍVEL 1 · OFICIAL / ADMINISTRATIVO                                      │
│ Contexto: Financeiro, prazos de confirmação, login, regras e erros.     │
│ Tom: Claro, direto, objetivo, sério e respeitoso. Sem piadas.          │
│ Ex: "Confirmações encerram quarta às 16:00 BRT. Débito em aberto."      │
├─────────────────────────────────────────────────────────────────────────┤
│ NÍVEL 2 · FUNCIONAL / AMIGÁVEL                                          │
│ Contexto: Navegação, lista de presença, perfil individual, formulários. │
│ Tom: Prestativo, esportivo, conciso e acessível.                        │
│ Ex: "Vaga confirmada na lista titular. Toque para alterar posição."    │
├─────────────────────────────────────────────────────────────────────────┤
│ NÍVEL 3 · RESENHA & PÓS-JOGO                                            │
│ Contexto: Ranking anual, estatísticas do racha, votação e WhatsApp.    │
│ Tom: Irreverente, bem-humorado, vibrante, valorizando feitos e zoeiras. │
│ Ex: "Maestro do Racha", "Maior Seca (🧊 Jejum)", "Fita de Craque".      │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Glossário Canônico de Termos:

| Conceito              | Nome no App                           | O que Evitar (Genérico)       |
| :-------------------- | :------------------------------------ | :---------------------------- |
| Tela Inicial          | **Boletim Oficial da Temporada**      | Dashboard / Home              |
| Mais Gols             | **Artilheiro Oficial** (⚽ Gols)      | Top Scorer / Artilharia Geral |
| Mais Passes           | **Maestro do Racha** (🅰️ Passes)      | Mais Assistências             |
| Mais Presença         | **Frequência Máxima / Presença**      | Usuário Ativo / Assiduidade   |
| Melhor Aproveitamento | **Mais Eficiente** (% Vitórias)       | Winrate / Taxa de Sucesso     |
| Sequência de Vitórias | **Maior Sequência** (🔥 Embalado)     | Streak Positiva               |
| Sequência sem Vencer  | **Maior Seca** (🧊 Jejum)             | Bad Streak / Sem Vitórias     |
| Melhor da Partida     | **Craque da Rodada** (com Fita)       | MVP / Destaque do Jogo        |
| Lista Semanal         | **Quadro de Presença (16 Titulares)** | Check-in / Formulário         |
| Gestão de Dívidas     | **Controle de Mensalidades & Súmula** | Pagamentos / Cobranças SaaS   |

---

## 2. Camada 2: Design Tokens

Configurados nativamente via Tailwind v4 e variáveis CSS em `src/index.css`.

### 2.1 Paleta de Cores Semânticas

| Token Tailwind                       | Variável CSS           | Modo Claro (`:root`)       | Modo Escuro (`.dark`) | Uso Semântico                                      |
| :----------------------------------- | :--------------------- | :------------------------- | :-------------------- | :------------------------------------------------- |
| `bg-fundo`                           | `--cor-fundo`          | `#f3efe4` (papel marfim)   | `#12100d` (noturno)   | Fundo global da aplicação                          |
| `bg-superficie`                      | `--cor-superficie`     | `#faf7ee`                  | `#1b1814`             | Blocos, cabeçalhos, diálogos                       |
| `bg-superficie-2`                    | `--cor-superficie-2`   | `#ece7d8`                  | `#242019`             | Linhas alternadas, inputs, hover                   |
| `border-borda`                       | `--cor-borda`          | `#d8d2c0`                  | `#35302a`             | Bordas e divisórias sólidas                        |
| `text-giz`                           | `--cor-giz`            | `#1e1c18` (tinta escura)   | `#f2efe6` (giz claro) | Texto principal / títulos                          |
| `text-giz-fraco`                     | `--cor-giz-fraco`      | `#6b6759`                  | `#a39f92`             | Metadados, labels, subtítulos                      |
| `bg-destaque`                        | `--cor-destaque`       | `#ffb300` (âmbar refletor) | `#ffb300`             | Fundo de ações primárias, badges, abas ativas      |
| `text-destaque` / `outline-destaque` | `--cor-destaque-texto` | `#92400e` (âmbar escuro)   | `#ffb300` (âmbar)     | Texto/números em destaque e foco visível (WCAG AA) |
| `text-destaque-tinta`                | `--cor-destaque-tinta` | `#1a1200`                  | `#1a1200`             | Texto de alto contraste sobre `bg-destaque`        |
| `bg-ok` / `text-ok`                  | `--cor-ok`             | `#58b368` (verde campo)    | `#58b368`             | Vitórias, confirmações, quitado                    |
| `bg-perigo` / `text-perigo`          | `--cor-perigo`         | `#e4572e` (laranja alerta) | `#e4572e`             | Derrotas, dívidas, exclusões                       |
| `bg-preto-time`                      | `--cor-preto-time`     | `#0d0d0e`                  | `#0d0d0e`             | Identidade do Time Preto                           |
| `bg-branco-time`                     | `--cor-branco-time`    | `#f4f1e8`                  | `#f4f1e8`             | Identidade do Time Branco                          |
| `bg-campo`                           | `--cor-campo`          | `#dfe8dc`                  | `#16281c`             | Fundo do campo tático                              |
| `border-campo-linha`                 | `--cor-campo-linha`    | `#b9cbb6`                  | `#2c4433`             | Linhas da prancheta tática                         |

### 2.2 Tipografia & Emparelhamento

| Família              | Token          | Configuração Padrão                             | Onde Usar                                                                      |
| :------------------- | :------------- | :---------------------------------------------- | :----------------------------------------------------------------------------- |
| **Barlow Condensed** | `font-display` | `uppercase tracking-wider` ou `tracking-widest` | Títulos, nomes de jogadores, cabeçalhos, placares e botões.                    |
| **Archivo**          | `font-sans`    | Normal, `leading-relaxed`                       | Corpo de texto corrido, formulários, alertas, modais e descrições.             |
| **Chivo Mono**       | `font-mono`    | `tabular-nums`                                  | Placares (`2 x 1`), percentuais, notas (`8.5`), datas, saldos e valores em R$. |

### 2.3 Escala Formal de Espaçamento (Spacing Tokens)

Para garantir consistência e evitar valores arbitrários:

| Nível de Espaçamento    | Classes Tailwind                   | Dimensão        | Contexto de Aplicação                                              |
| :---------------------- | :--------------------------------- | :-------------- | :----------------------------------------------------------------- |
| **Micro / Ícone**       | `gap-1`, `p-1`, `space-x-1`        | `4px`           | Entre ícone e texto, badges de posição, mini tags.                 |
| **Elemento / Compacto** | `gap-2`, `p-2`, `py-1.5`, `px-2.5` | `8px`           | Padding interno de inputs, botões compactos, chips táticos.        |
| **Linha / Padrão**      | `gap-3`, `p-3`, `py-3`             | `12px` – `16px` | Linhas de lista, itens de menu, células de tabela, campos de form. |
| **Bloco / Card**        | `p-4`, `p-5`, `gap-4`              | `16px` – `20px` | Interior de cards semânticos, modais e cabeçalhos de tela.         |
| **Seção / Editorial**   | `space-y-6`, `my-6`, `gap-6`       | `24px`          | Distância entre blocos de súmula e grandes grupos de dados.        |
| **Layout / Margem**     | `px-3 sm:px-4`, `max-w-2xl`        | `12px` – `16px` | Margem lateral padrão para a visualização mobile containerizada.   |

### 2.4 Geometria, Cantos e Sombras

- **Border Radius:**
  - `rounded-[2px]`: Badges compactas, plaquetas de posição de avatar.
  - `rounded-[4px]`: Botões, inputs, cards semânticos, modais e containers.
  - `rounded-[6px]`: Modais de tela cheia ou caixas de diálogo maiores.
  - _(Evitar `rounded-xl`, `rounded-2xl` e `rounded-full` em botões de ação estruturais)._
- **Sombras-Carimbo (Elevação Seca):**
  - Padrão: `shadow-carimbo` (`box-shadow: 3px 3px 0 var(--cor-borda);`)
  - Destaque: `shadow-carimbo-destaque` (`box-shadow: 3px 3px 0 #b37d00;`)
  - Preto: `shadow-carimbo-preto` (`box-shadow: 3px 3px 0 #000000;`)

### 2.5 Sistema de Motion & Transições

- **Durações e Easings Padrão:**
  - **Rápida (`150ms ease-out`):** Hover, active states, toque tátil, troca de cor e `animate-fade-in`.
  - **Normal (`200ms ease-out`):** Abertura de modais (`animate-slide-up`), gavetas e transições de abas.
  - **Suave (`300ms ease-in-out`):** Reordenação de times e transições de tela.
- **Acessibilidade:** Suporte nativo a `@media (prefers-reduced-motion: reduce)` anulando durações para `0.01ms`.

---

## 3. Camada 3: Components & Padrões de UI

### 3.1 Padrão Estrutural: Listas Contínuas Minimalistas

O padrão visual primário para rankings, histórico de jogos e listas de presença é a **lista contínua**, sem caixas isoladas para cada item:

```tsx
// Padrão de Lista Contínua de Jogadores / Ranking
<div className="divide-y divide-borda/40 border-y border-borda">
  {itens.map((item) => (
    <div
      key={item.id}
      className="flex items-center justify-between py-3 px-1 transition hover:bg-superficie-2/50"
    >
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm font-bold text-giz-fraco tabular-nums">
          {item.posicao}º
        </span>
        <Avatar nome={item.nome} posicao={item.posicao_campo} size="sm" />
        <span className="font-display font-bold text-base uppercase tracking-wide text-giz">
          {item.nome}
        </span>
      </div>
      <span className="font-mono text-sm font-bold text-destaque tabular-nums">
        {item.pontos} pts
      </span>
    </div>
  ))}
</div>
```

### 3.2 Cards Semânticos (Uso por Exceção e Destaque)

Cards com borda e sombra são utilizados **apenas** quando houver necessidade semântica de isolamento ou destaque visual:

1. **Próxima Partida com Contagem de Vagas:** Card com borda âmbar dupla e badge de status.
2. **Craque da Partida:** Card especial com fita escura superior e selo rotacionado.
3. **Banner de Permissão Push / Offline:** Bloco com mensagem acionável isolada.
4. **Destaques Sazonais do Boletim:** Grid com os líderes da temporada (Artilheiro, Maestro, Eficiente).

### 3.3 Botões de Ação (Alvo Mínimo 44px)

```tsx
// 1. Primário Âmbar (Ação Principal)
<button
  type="button"
  className="min-h-[44px] inline-flex items-center justify-center rounded-[4px] bg-destaque px-4 py-2.5 font-display text-sm font-black uppercase tracking-wider text-destaque-tinta shadow-carimbo-destaque transition active:translate-y-px hover:brightness-105"
>
  Confirmar Presença
</button>

// 2. Secundário Superfície
<button
  type="button"
  className="min-h-[44px] inline-flex items-center justify-center rounded-[4px] border border-borda bg-superficie px-4 py-2.5 font-display text-sm font-bold uppercase tracking-wider text-giz shadow-carimbo transition active:translate-y-px hover:bg-superficie-2"
>
  Cancelar
</button>

// 3. Destrutivo / Alerta
<button
  type="button"
  className="min-h-[44px] inline-flex items-center justify-center rounded-[4px] border border-perigo/40 bg-perigo/10 px-4 py-2.5 font-display text-sm font-bold uppercase tracking-wider text-perigo transition active:translate-y-px hover:bg-perigo hover:text-white"
>
  Descartar Súmula
</button>
```

### 3.4 Inputs e Controles de Formulário

- **Estilização Padronizada:**
  - Fundo `bg-superficie-2`, borda `border-borda`, cantos `rounded-[4px]`.
  - Altura confortável (`min-h-[44px]`), texto `font-sans text-base` (evita zoom automático no iOS).
  - Foco acessível com anel âmbar: `focus-visible:outline-2 focus-visible:outline-destaque focus-visible:outline-offset-2`.
- **Dropdowns / `<select>`:** Customizados com ícone SVG discreto, tipografia legível e contraste alto.

### 3.5 Placar LED de Partida

- Barra horizontal escura contínua com fundo `#0d0d0e`.
- Nomes dos times em `font-display uppercase tracking-wider`.
- Numerais do placar em `font-display font-black text-3xl tabular-nums text-white`.
- No modo `live`, ponto âmbar pulsante (`animate-pulse`) indicando cronômetro e bola rolando.

### 3.6 Avatares Terrosos (`Avatar.tsx`)

- Formato quadrado chanfrado `rounded-[3px]` com tamanho padronizado (`sm: 32px`, `md: 40px`, `lg: 56px`).
- Paleta determinística por hash do nome: `campo`, `couro`, `tijolo`, `oliva`, `petroleo`, `terra`.
- Plaqueta retangular na base estilo crachá/camisa com sigla da posição (`GOL`, `ZAG`, `MEI`, `ATA`).

### 3.7 Diálogos e Modais (`ConfirmDialog.tsx`)

- Substitui qualquer uso de `window.confirm()` ou `window.alert()`.
- Backdrop com desfoque (`bg-black/60 backdrop-blur-xs`), cantos `rounded-[4px]`, borda `border-2 border-borda`.
- Trapping de foco, fechamento por `Escape`, clique externo e trava de scroll no `body`.

### 3.8 Feedback, Notificações e Empty States

- **Ações Rápidas / Efêmeras:** `<Snackbar />` posicionado acima da TabBar (`bottom-[calc(4.5rem+env(safe-area-inset-bottom))]`) com auto-dismiss em 3s.
- **Mensagens Persistentes / Erros de Tela:** `<MensagemEstado tipo="erro" | "sucesso" | "info" />`.
- **Empty States (Estados Vazios Informativos):** Nunca deixar tela em branco. Exibir mensagem em tom esportivo com orientação clara do que fazer.
- **Skeletons (CLS = 0):** `<SkeletonResumo />`, `<SkeletonDetalhe />`, `<SkeletonRanking />` espelhando a mesma altura física e grid do conteúdo carregado. Exibidos **apenas na primeira visita** (sem cache): revisitas renderizam o dado em cache instantaneamente, com revalidação silenciosa em background (`useCache`). No lazy loading de rotas, o skeleton de fallback é selecionado por pathname dentro do `Layout`, mantendo a casca do app (Header/TabBar) estável — nunca pisca a moldura.

---

## 4. Camada 4: Diretrizes para IAs & Desenvolvedores

### 4.1 Categorização das Regras em 3 Níveis

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ 🔴 NÍVEL 1: REGRAS OBRIGATÓRIAS (MUST) — INVIOLÁVEIS                    │
│ 1. Alvos de toque de no mínimo 44px (min-h-[44px]).                     │
│ 2. Foco visível acessível (outline-destaque com outline-offset).         │
│ 3. Tokens semânticos estritos (não hardcodar hexadecimais no JSX).       │
│ 4. Regras de Hooks do React 19 (hooks incondicionais no topo).          │
│ 5. Operações compostas no banco em RPCs atômicas (PostgreSQL).          │
│ 6. Semântica acessível (aria-labels, roles, contrastes WCAG AA).         │
├─────────────────────────────────────────────────────────────────────────┤
│ 🟡 NÍVEL 2: PREFERÊNCIAS DE DESIGN (SHOULD) — PADRÃO DO PROJETO        │
│ 1. Priorizar Listas Contínuas Minimalistas em vez de cards empilhados.   │
│ 2. Tipografia: Barlow para títulos, Chivo para números, Archivo texto.  │
│ 3. Sombras secas deslocadas (shadow-carimbo) e cantos de 4px.           │
│ 4. Evitar gradientes de cor desnecessários e fundos brancos puros.      │
│ 5. Manter densidade de informação alta e boa legibilidade mobile.       │
├─────────────────────────────────────────────────────────────────────────┤
│ 🟢 NÍVEL 3: EXCEÇÕES CONTEXTUAIS (MAY) — PERMITIDAS COM JUSTIFICATIVA   │
│ 1. Uso de Cards para entidades isoladas (Próxima Partida, Craque, Push). │
│ 2. Prancheta de campo tático com fundo verde noturno diferenciado.       │
│ 3. Destaque âmbar expandido para celebrações (Pódio 1º lugar do Ranking).│
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Acessibilidade & Inclusão (a11y)

- **Contraste de Cores:** Todos os pares de texto/fundo atendem ao critério de contraste mínimo WCAG AA (≥ 4.5:1 para texto normal e ≥ 3:1 para foco/UI). O token de destaque é desacoplado entre fundo e texto: enquanto fundos e botões (`bg-destaque`) utilizam o âmbar refletor (`#ffb300`) com tinta escura (`text-destaque-tinta`: `#1a1200`), textos, números e foco visível (`text-destaque`, `outline-destaque`) utilizam `--cor-destaque-texto`, que resolve dinamicamente para âmbar escurecido (`#92400e`, contraste ≥ 5,8:1) no tema claro e para âmbar refletor (`#ffb300`, contraste ≥ 10,6:1) no tema escuro.
- **Comunicação Multimodal:** Nunca use apenas cor para indicar status. Sempre acompanhe com ícones (`Check`, `Clock`, `AlertTriangle`, `X`) e texto legível por leitores de tela.
- **Teclado & Leitores de Tela:** Todos os botões, abas e modais possuem marcação semântica (`aria-expanded`, `aria-selected`, `aria-current="page"`, `role="tab"`).

### 4.3 Progressive Enhancement & PWA

- **Feedback Háptico (`haptics.ts`):** `vibrateLight()`, `vibrateSuccess()`, `vibrateGoal()`, `vibrateWarning()` e `vibrateError()` devem ser tratados como melhoria progressiva com fallback silencioso para dispositivos sem suporte à Vibration API.
- **Pull-to-Refresh:** Integrado nas telas com dados voláteis (Resumo, Jogos, Ranking) respeitando o contêiner de rolagem ativo; não aplicar mecanicamente em telas estáticas de formulários. Em telas com cache (`useCache`), o gesto invoca `recarregar` — busca na rede que aguarda a resposta e atualiza o cache — garantindo dado fresco mesmo com conteúdo em memória.
- **Resiliência de Navegação:** Sempre usar `voltar(navigate, fallback)` para que usuários vindos de notificações push ou deep-links não fiquem travados.

---

## 5. Checklist de Validação para Novas Telas e Refatorações

Antes de submeter ou aprovar qualquer mudança de código ou interface:

- [ ] **Acessibilidade:** Todas as áreas de toque possuem `>= 44px` e `focus-visible` configurado?
- [ ] **Tokens:** Foram utilizadas apenas variáveis semânticas do Tailwind v4 (`bg-fundo`, `text-giz`, `border-borda`)?
- [ ] **Hierarquia:** A tela prioriza listas contínuas fluidas e reserva cards apenas para destaques semânticos reais?
- [ ] **Tipografia:** Nomes/títulos em `font-display` (Barlow), números em `font-mono` (Chivo) e texto em `font-sans` (Archivo)?
- [ ] **Espaçamento:** A escala de spacing (`gap-1`, `gap-2`, `gap-3`, `gap-4`, `space-y-6`) foi respeitada?
- [ ] **Tom de Voz:** Os textos seguem a hierarquia de tom (Oficial / Amigável / Resenha) adequada para a tela?
- [ ] **Estados:** Foram implementados Skeleton (CLS = 0), Empty State explicativo e tratamento de erro amigável?
- [ ] **Temas:** A visualização foi testada e aprovada tanto no Modo Claro quanto no Modo Escuro?
