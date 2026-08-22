# 📋 Plano Mestre de Implementação — Design System v2.0 ("Súmula de Quinta")

> **Documento de Engenharia & Orquestração de Agentes Autônomos**  
> **Referência Canônica:** [`design-system.md`](file:///c:/Users/PC/Documents/GitHub/racha/design-system.md) e [`AGENTS.md`](file:///c:/Users/PC/Documents/GitHub/racha/AGENTS.md)  
> **Objetivo:** Estabelecer o roteiro granular e modular para alinhar 100% da interface, componentes, tokens, fluxos e tom de voz do **Racha Gragoatá CBO** à versão 2.0 do Design System, estruturado para permitir delegação massiva e paralela a subagentes autônomos.

---

## 📑 Sumário

1. [Instruções de Orquestração & Protocolo de Subagentes](#1-instruções-de-orquestração--protocolo-de-subagentes)
2. [Grafo de Dependências e Matriz de Paralelismo](#2-grafo-de-dependências-e-matriz-de-paralelismo)
3. [WP0: Fundação de Tokens CSS, Motion & Componentes Primitivos](#3-wp0-fundação-de-tokens-css-motion--componentes-primitivos)
4. [WP1: Shell da Aplicação, Header, Navegação & Identidade Global](#4-wp1-shell-da-aplicação-header-navegação--identidade-global)
5. [WP2: Rota Resumo — Boletim Oficial da Temporada](#5-wp2-rota-resumo--boletim-oficial-da-temporada)
6. [WP3: Mural de Jogos & Súmula Oficial de Partida](#6-wp3-mural-de-jogos--súmula-oficial-de-partida)
7. [WP4: Operação de Campo Ao Vivo, Registro de Eventos & Cédula de Votação](#7-wp4-operação-de-campo-ao-vivo-registro-de-eventos--cédula-de-votação)
8. [WP5: Sorteio Balanceado, Prancheta Tática & Nova Partida](#8-wp5-sorteio-balanceado-prancheta-tática--nova-partida)
9. [WP6: Rankings, Pódio Top 3, Duplas & Estatísticas do Racha](#9-wp6-rankings-pódio-top-3-duplas--estatísticas-do-racha)
10. [WP7: Painel Financeiro, Cobrança WhatsApp, Perfil & Gestão de Atletas](#10-wp7-painel-financeiro-cobrança-whatsapp-perfil--gestão-de-atletas)
11. [WP8: Auditoria de Acessibilidade (a11y), Skeletons (CLS = 0) & Homologação PWA](#11-wp8-auditoria-de-acessibilidade-a11y-skeletons-cls--0--homologação-pwa)
12. [Checklist Final de Entrega para o Orquestrador](#12-checklist-final-de-entrega-para-o-orquestrador)

---

## 1. Instruções de Orquestração & Protocolo de Subagentes

Quando o **Orquestrador de Agentes** delegar um Work Package (WP) para um subagente, o prompt do subagente **DEVE** conter o seguinte protocolo operacional:

### 1.1 Diretrizes Mandatórias para Subagentes

1. **Fontes da Verdade:** Ler obrigatoriamente [`design-system.md`](file:///c:/Users/PC/Documents/GitHub/racha/design-system.md) e [`AGENTS.md`](file:///c:/Users/PC/Documents/GitHub/racha/AGENTS.md) antes de editar qualquer arquivo.
2. **Zero Code Slop:** Não criar divs aninhadas inúteis, classes inexistentes ou variáveis não utilizadas.
3. **Strict Rules of Hooks:** Declarar todos os React Hooks incondicionalmente no topo do componente, antes de qualquer guard clause (`if (!isAdmin) return <Navigate ... />`).
4. **Tratamento de Concorrência:** Manter o padrão de cleanup flag `let ativo = true; return () => { ativo = false; };` em todos os `useEffect` de busca assíncrona.
5. **Alvos de Toque:** Garantir `min-h-[44px]` em todos os botões, abas, links e seletores.
6. **Verificação de Integridade:** Após qualquer modificação, o subagente deve validar seu trabalho executando:
   ```bash
   npm run lint && npm run format:check
   ```

---

## 2. Grafo de Dependências e Matriz de Paralelismo

```text
┌─────────────────────────────────────────────────────────────┐
│ WP0: Fundação de Tokens, Motion & Primitivos de UI (Core)   │
└──────────────────────────────┬──────────────────────────────┘
                               │ (Bloqueante para todos os outros)
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│ WP1: Shell & │       │ WP2: Boletim │       │ WP3: Jogos & │
│ Navegação    │       │ Resumo       │       │ Súmula       │
└───────┬──────┘       └───────┬──────┘       └───────┬──────┘
        │                      │                      │
        ├──────────────────────┼──────────────────────┤
        ▼                      ▼                      ▼
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│ WP4: Ao Vivo │       │ WP5: Tática  │       │ WP6: Ranking │
│ & Votação    │       │ & Sorteio    │       │ & Duplas     │
└───────┬──────┘       └───────┬──────┘       └───────┬──────┘
        │                      │                      │
        └──────────────────────┼──────────────────────┘
                               ▼
               ┌──────────────────────────────┐
               │ WP7: Financeiro, Perfil &    │
               │ Gestão de Atletas            │
               └──────────────┬───────────────┘
                              ▼
               ┌──────────────────────────────┐
               │ WP8: A11y, Skeletons CLS=0   │
               │ & Homologação Final          │
               └──────────────────────────────┘
```

| ID      | Pacote de Trabalho          | Escopo Principal                                           | Pré-requisitos   | Pode Rodar em Paralelo com |
| :------ | :-------------------------- | :--------------------------------------------------------- | :--------------- | :------------------------- |
| **WP0** | Tokens, Spacing, Primitivos | `index.css`, componentes base                              | Nenhum           | Ninguém (Base)             |
| **WP1** | Shell, Layout & Nav         | `Layout.tsx`, `Header`, `Logo`                             | WP0              | WP2, WP3, WP6              |
| **WP2** | Boletim da Temporada        | `Resumo.tsx`, destaques sazonais                           | WP0              | WP1, WP3, WP6              |
| **WP3** | Mural de Jogos & Súmula     | `Jogos.tsx`, `PartidaDetalhe.tsx`                          | WP0              | WP1, WP2, WP6              |
| **WP4** | Ao Vivo & Votação           | `PartidaAoVivo.tsx`, `PartidaVotar.tsx`                    | WP0, WP3         | WP5, WP6, WP7              |
| **WP5** | Prancheta & Sorteio         | `CampoPartida.tsx`, `EscalacaoTimesEditor.tsx`             | WP0              | WP4, WP6, WP7              |
| **WP6** | Rankings & Estatísticas     | `Ranking.tsx`, `Estatisticas.tsx`, `EstatisticasRacha.tsx` | WP0              | WP1, WP2, WP5              |
| **WP7** | Financeiro & Perfil         | `Administrador.tsx`, `Perfil.tsx`, `GestaoJogadores.tsx`   | WP0              | WP4, WP5, WP6              |
| **WP8** | Acessibilidade & Skeletons  | `Skeletons.tsx`, auditoria a11y global                     | Todos anteriores | Ninguém (Final)            |

---

## 3. WP0: Fundação de Tokens CSS, Motion & Componentes Primitivos

### 🎯 Objetivo

Estruturar as variáveis fundamentais de espaçamento, cantos, transições e utilitários em `src/index.css` e criar os componentes primitivos reutilizáveis para que as telas não inventem padrões isolados.

### 📁 Arquivos Impactados

- `src/index.css`
- `src/components/Badge.tsx` _(NOVO ou Padronizado)_
- `src/components/ListRow.tsx` _(Padrão de linha contínua)_
- `src/components/Estado.tsx`
- `src/components/ConfirmDialog.tsx`
- `src/components/Snackbar.tsx`

### 🔨 Tarefas Detalhadas

1. **Ajustes de Tokens em `src/index.css`:**
   - Garantir que as diretivas `@theme` e `:root` / `.dark` contenham os tokens semânticos completos:
     `--cor-fundo`, `--cor-superficie`, `--cor-superficie-2`, `--cor-borda`, `--cor-giz`, `--cor-giz-fraco`, `--cor-destaque`, `--cor-destaque-tinta`, `--cor-preto-time`, `--cor-branco-time`, `--cor-campo`, `--cor-campo-linha`, `--cor-perigo`, `--cor-ok`.
   - Adicionar utilitários de motion padronizados:
     - `@utility transition-fast { transition: all 150ms ease-out; }`
     - `@utility transition-normal { transition: all 200ms ease-out; }`
     - `@utility transition-slow { transition: all 300ms ease-in-out; }`
   - Formalizar sombras secas: `shadow-carimbo`, `shadow-carimbo-destaque`, `shadow-carimbo-preto`.
   - Manter a textura sutil de grão (`body::after` a 4% de opacidade).
2. **Componente de Badge / Pílula Unificada (`Badge.tsx`):**
   - Suporte a variantes: `posicao` (estilo crachá/camisa), `status` (aberta, ao vivo, finalizada, pendente), `destaque` (âmbar) e `neutro`.
   - Cantos `rounded-[2px]`, tipografia `font-display uppercase tracking-widest text-[10px] font-black`.
3. **Padronização do `ConfirmDialog.tsx`:**
   - Cantos `rounded-[4px]`, borda dura `border-2 border-borda`, backdrop com desfoque, botões em 44px com tipografia condensed e suporte à tecla `Escape`.
4. **Padronização do `Snackbar.tsx`:**
   - Posicionamento móvel respeitando `env(safe-area-inset-bottom)` e TabBar.
   - Haptics integrados (`vibrateSuccess` / `vibrateError`).

### ✅ Critérios de Aceite

- [ ] Variáveis CSS e classes Tailwind v4 validadas sem erros de compilação.
- [ ] `npm run lint` e `npm run format:check` passam com 0 erros.
- [ ] Componentes primitivos exportados com tipagem TypeScript estrita.

---

## 4. WP1: Shell da Aplicação, Header, Navegação & Identidade Global

### 🎯 Objetivo

Refinar a casca do app (`Layout.tsx`), o cabeçalho sticky, o seletor de tema, os menus de administração e a barra de navegação inferior (TabBar) com alvos de 44px, respeitando os fluxos focados.

### 📁 Arquivos Impactados

- `src/routes/Layout.tsx`
- `src/components/Logo.tsx`
- `src/components/BannerLembrete.tsx`
- `public/offline.html`

### 🔨 Tarefas Detalhadas

1. **Header Sticky:**
   - Fundo `bg-fundo/95 backdrop-blur`, borda inferior sutil `border-b border-borda`.
   - Logo SVG partido P&B com estrela âmbar central (`Logo.tsx`).
   - Botão de alternância de tema (Sol/Lua) com feedback tátil e `min-h-[44px] min-w-[44px]`.
   - Menu Dropdown Admin com cantos `rounded-[4px]`, sombra `shadow-carimbo` e itens em `min-h-[44px]`.
2. **Barra de Navegação Inferior (TabBar):**
   - Ícones `Home`, `Shield`, `Medal`, `TrendingUp`, `User`.
   - Indicador ativo com barra âmbar superior (`after:h-0.5 after:bg-destaque`).
   - Ocultação automática em rotas de fluxo focado (`/partida/:id/votar`, `/partida/:id/ao-vivo`, `/partida/:id/times`, `/partida/nova/*`).
3. **Banner Offline Global:**
   - Barra no topo com `bg-perigo`, `WifiOff`, tipografia `font-mono text-xs font-bold uppercase tracking-wider`.
4. **Página Offline PWA (`public/offline.html`):**
   - Alinhar tipografia, cores e logo com a versão 2.0 do Design System.

### ✅ Critérios de Aceite

- [ ] Navegação fluida entre as 5 abas principais.
- [ ] TabBar é ocultada perfeitamente nas telas de fluxo focado e reaparece ao voltar.
- [ ] Safe-area-insets respeitados em iPhones e dispositivos Android com barra de gestos.

---

## 5. WP2: Rota Resumo — Boletim Oficial da Temporada

### 🎯 Objetivo

Transformar a tela principal (`/`) no **Boletim Oficial da Temporada**, eliminando o visual de cards repetitivos em favor de um layout editorial de jornal esportivo com cabeçalho de súmula, destaque para o próximo jogo e estatísticas sazonais.

### 📁 Arquivos Impactados

- `src/routes/Resumo.tsx`
- `src/components/CardNotificacoes.tsx`
- `src/components/BotaoInstalar.tsx`
- `src/components/Skeletons.tsx` (`SkeletonResumo`)

### 🔨 Tarefas Detalhadas

1. **Cabeçalho Editorial de Súmula:**
   - Divisória pontilhada `sumula-header` (`border-b-2 border-dotted border-borda pb-2`).
   - Micro-rótulo `text-[10px] font-mono uppercase tracking-widest text-destaque font-bold`: `"BOLETIM OFICIAL DO RACHA"`.
   - Título em `font-display font-bold text-2xl uppercase tracking-wider`: `"TEMPORADA {ano}"`.
   - Contador de partidas jogadas em `font-mono tabular-nums`.
2. **Card Semântico da Próxima Partida (Exceção de Destaque):**
   - Borda dupla âmbar `border-2 border-destaque bg-superficie`.
   - Badge destacada `PRÓXIMA QUINTA`, data formatada e indicador de vagas `16/16 VAGAS` em `font-mono`.
   - Transição suave ao toque (`active:scale-[0.99]`).
3. **Grade de Destaques da Temporada (Tom de Voz Resenha):**
   - _Artilheiro Oficial_ (⚽ Gols)
   - _Maestro do Racha_ (🅰️ Passes)
   - _Frequência Máxima_ (🛡️ Presença)
   - _Mais Eficiente_ (📈 % Vitórias)
   - _Maior Sequência_ (🔥 Embalado)
   - _Maior Seca_ (🧊 Jejum)
   - Blocos limpos com cantos `rounded-[4px]`, sombra `shadow-carimbo`, valores em `font-mono text-destaque` e nomes em `font-display font-black uppercase`.
4. **Pull-to-Refresh & Empty State:**
   - Recarregamento suave de dados via `<PullToRefresh>`.
   - Mensagem esportiva se a temporada estiver começando (_"Nenhuma partida na súmula ainda este ano. O primeiro jogo da temporada vai inaugurar os números oficiais."_).

### ✅ Critérios de Aceite

- [ ] Carregamento inicial exibe `SkeletonResumo` com zero CLS.
- [ ] Puxar para atualizar (pull-to-refresh) funciona perfeitamente sem conflito com o scroll vertical.
- [ ] Textos e números respeitam o glossário oficial.

---

## 6. WP3: Mural de Jogos & Súmula Oficial de Partida

### 🎯 Objetivo

Estruturar o mural histórico de partidas e a tela de detalhes da súmula oficial (placar LED, quadro de presença de 16 titulares, lista de espera, fita do Craque da Rodada e ações de arbitragem).

### 📁 Arquivos Impactados

- `src/routes/Jogos.tsx`
- `src/routes/PartidaDetalhe.tsx`
- `src/components/Skeletons.tsx` (`SkeletonDetalhe`)

### 🔨 Tarefas Detalhadas

1. **Mural de Jogos (`Jogos.tsx`):**
   - Lista contínua de partidas ordenadas cronologicamente.
   - Mini-placar LED com fundo preto `#0d0d0e`, nomes dos times em condensed e placar em `font-mono tabular-nums`.
   - Indicadores de status da partida (`Agendada`, `Ao Vivo` pulsante, `Votação Aberta`, `Encerrada`).
   - Área de toque de 44px nos botões de ação e lixeira admin.
2. **Súmula Oficial da Partida (`PartidaDetalhe.tsx`):**
   - **Placar LED Principal:** Barra contínua com alto contraste P&B, numerais gigantes e badges de status.
   - **Card do Craque da Rodada (Quando Encerrada):** Card especial com fita preta no topo, selo translúcido rotacionado e média aparada da nota em destaque mono.
   - **Quadro de Presença (16 Vagas Titulares):**
     - Divisão clara entre _Titulares Confirmados (máx 16)_ e _Fila de Espera (Excedentes)_.
     - Linhas contínuas com `divide-y divide-borda/40`.
     - Botão de confirmação de presença (`min-h-[44px]`) com atualização otimista imediata e feedback tátil (`vibrateSuccess`).
   - **Ações de Arbitragem / Admin:**
     - Botões em `min-h-[44px]` para abrir jogo, finalizar súmula, editar times ou descartar votos.

### ✅ Critérios de Aceite

- [ ] Lista de presença atualiza instantaneamente (otimista) com rollback seguro em falhas de rede.
- [ ] Placar LED renderiza perfeitamente em telas pequenas (320px) e médias (420px).
- [ ] Craque da partida só é revelado quando o status for `closed` (votação encerrada).

---

## 7. WP4: Operação de Campo Ao Vivo, Registro de Eventos & Cédula de Votação

### 🎯 Objetivo

Garantir usabilidade máxima na beira do gramado no modo ao vivo (registro rápido de gols com haptics) e criar uma cédula de votação de notas (1 a 10) intuitiva, com progresso em tempo real e persistência local.

### 📁 Arquivos Impactados

- `src/routes/PartidaAoVivo.tsx`
- `src/routes/PartidaVotar.tsx`
- `src/components/DialogoEvento.tsx`
- `src/components/SeletorNota.tsx`

### 🔨 Tarefas Detalhadas

1. **Modo Ao Vivo na Beira do Campo (`PartidaAoVivo.tsx`):**
   - Tela cheia com TabBar oculta (`isFluxoFocado`).
   - Cronômetro central e placar gigante.
   - Botões de ação grandes (`min-h-[48px]`) para registrar gol do Time Preto ou Time Branco.
   - Lista rápida de atletas para marcação do autor do gol, assistência ou gol contra.
2. **Modal de Registro de Gol (`DialogoEvento.tsx`):**
   - Seleção tátil rápida do autor e garçom.
   - Vibração especial ao confirmar gol (`vibrateGoal`).
3. **Cédula de Votação Secreta (`PartidaVotar.tsx`):**
   - Barra de progresso superior: `"Avalie os 16 participantes · X restantes"`.
   - Lista contínua de atletas com seus respectivos avatares e times da partida.
   - Seletor de nota tátil (`SeletorNota.tsx`) de 1 a 10 com feedback leve (`vibrateLight`).
   - Autosave contínuo em `localStorage` por usuário/partida contra perda acidental.
   - Saída acidental protegida por `ConfirmDialog`.
   - Botão final de submissão na base com `safe-area-inset-bottom`.

### ✅ Critérios de Aceite

- [ ] Votação salva rascunho instantâneo no `localStorage`.
- [ ] Submissão dispara RPC transacional de votos e limpa rascunho local.
- [ ] Alvos de toque no seletor de notas confortáveis para dedos grandes.

---

## 8. WP5: Sorteio Balanceado, Prancheta Tática & Nova Partida

### 🎯 Objetivo

Apresentar a divisão equilibrada dos times na prancheta tática, permitindo sorteio automático pelo algoritmo balanceado (ABBA por notas e posições) ou ajuste manual com feedback tátil.

### 📁 Arquivos Impactados

- `src/components/CampoPartida.tsx`
- `src/components/EscalacaoTimesEditor.tsx`
- `src/routes/PartidaTimes.tsx`
- `src/routes/PartidaNovaTimes.tsx`
- `src/routes/PartidaConfirma.tsx`
- `src/routes/PartidaNova.tsx`

### 🔨 Tarefas Detalhadas

1. **Prancheta Tática (`CampoPartida.tsx`):**
   - Fundo de gramado noturno (`bg-campo` / `--cor-campo`) com demarcações em `--cor-campo-linha`.
   - Distribuição espacial dos atletas por posição (`GOL`, `ZAG`, `MEI`, `ATA`).
   - Chips com bordas secas, iniciais e plaquetas de posição.
2. **Editor de Escalação e Sorteio (`EscalacaoTimesEditor.tsx`):**
   - Botão de sorteio com transição suave de troca de elencos.
   - Validação de regras estritas: no máximo 1 goleiro titular por time; aviso tátil se violado (`vibrateWarning`).
   - Comparativo de média de notas dos dois times em `font-mono tabular-nums`.
3. **Fluxos de Criação & Convocação (`PartidaNova.tsx` / `PartidaConfirma.tsx`):**
   - Formulário de agendamento de data/hora respeitando a escala de espaçamento do WP0.
   - Lista de convocação com checkboxes acessíveis de 44px.

### ✅ Critérios de Aceite

- [ ] Hook `useEscalacaoTimes` reutilizado perfeitamente entre as telas de sorteio.
- [ ] Validação impede criação de time com mais de 8 jogadores titulares na partida de 16.
- [ ] Prancheta tática escala proporcionalmente em qualquer largura de tela.

---

## 9. WP6: Rankings, Pódio Top 3, Duplas & Estatísticas do Racha

### 🎯 Objetivo

Construir a experiência de dados e ranking anual com pódio visual dos 3 primeiros colocados, tabela de classificação densa e análise de parcerias/duplas da temporada.

### 📁 Arquivos Impactados

- `src/routes/Ranking.tsx`
- `src/routes/Estatisticas.tsx`
- `src/routes/EstatisticasRacha.tsx`
- `src/components/DuplaCard.tsx`
- `src/components/SecaoRacha.tsx`
- `src/components/Skeletons.tsx` (`SkeletonRanking`)

### 🔨 Tarefas Detalhadas

1. **Pódio Visual Top 3 (`Ranking.tsx`):**
   - 1º Lugar: Bloco destacado com fundo âmbar refletor, numerais em `font-display font-black text-4xl` e troféu.
   - 2º e 3º Lugares: Numerais vazados (`texto-vazado`) com alto contraste.
   - Avatares terrosos com plaqueta de posição.
2. **Tabela de Classificação Contínua:**
   - Colunas: Posição, Jogador, Pontos (P), Jogos (J), Vitórias (V), Empates (E), Derrotas (D), Gols (GP), Aproveitamento (%).
   - Numerais em `font-mono tabular-nums` alinhados à direita.
   - Contêiner com `data-no-swipe` para permitir scroll horizontal sem disparar troca acidental de abas.
3. **Mural de Parcerias & Duplas (`EstatisticasRacha.tsx` / `DuplaCard.tsx`):**
   - Exibição de duplas com maior índice de vitórias quando jogam no mesmo time vs quando jogam como adversários.
   - Cards limpos com tipografia mono e badges de entrosamento.

### ✅ Critérios de Aceite

- [ ] Pódio Top 3 responsivo com excelente legibilidade em temas claro e escuro.
- [ ] Tabela de classificação rola suavemente no mobile com cabeçalhos fixos ou identificadores claros.
- [ ] `SkeletonRanking` exibe o pódio e a tabela sem nenhum salto de layout (CLS = 0).

---

## 10. WP7: Painel Financeiro, Cobrança WhatsApp, Perfil & Gestão de Atletas

### 🎯 Objetivo

Modernizar a gestão financeira e o perfil dos atletas com extratos em formato de canhoto de súmula, cobrança inteligente de dívidas via WhatsApp, troca de senha e gestão de mensalistas.

### 📁 Arquivos Impactados

- `src/routes/Administrador.tsx`
- `src/routes/Perfil.tsx`
- `src/routes/GestaoJogadores.tsx`
- `src/routes/NovoJogador.tsx`
- `src/components/Skeletons.tsx` (`SkeletonPerfil`)

### 🔨 Tarefas Detalhadas

1. **Painel Financeiro & Dívidas (`Administrador.tsx`):**
   - Tom de voz **Oficial / Nível 1** (sério, transparente e direto).
   - Extrato com linhas contínuas (`divide-y divide-borda/40`), valores em `font-mono text-perigo` (débito) ou `text-ok` (quitado).
   - **Cobrança Inteligente via WhatsApp:**
     - Exibição da antiguidade da dívida ("há 2 semanas 🚨").
     - Botão em 44px com ícone de WhatsApp que copia ou abre mensagem pré-formatada amigável com valor total, semanas em aberto e chave PIX do grupo.
2. **Perfil Individual do Atleta (`Perfil.tsx`):**
   - StatBoxes minimalistas com números em `font-mono text-2xl font-bold`.
   - Histórico pessoal de notas médias e aproveitamento.
   - Status de mensalidade/débito individual.
   - Formulário de troca de senha com inputs acessíveis (`focus-visible`).
3. **Gestão de Jogadores (`GestaoJogadores.tsx` / `NovoJogador.tsx`):**
   - Lista contínua de atletas ativos/inativos com switches acessíveis para definir `is_mensalista` e `is_admin`.
   - Cadastro ágil de novos atletas com seleção de posição primária e secundária.

### ✅ Critérios de Aceite

- [ ] Botão de cobrança WhatsApp gera texto completo e copia para o clipboard com feedback via `Snackbar`.
- [ ] Quitação de débitos executa a RPC transacional com recarregamento imediato do saldo.
- [ ] Nenhuma quebra de layout no perfil em modo claro ou escuro.

---

## 11. WP8: Auditoria de Acessibilidade (a11y), Skeletons (CLS = 0) & Homologação PWA

### 🎯 Objetivo

Realizar a auditoria técnica final de acessibilidade, contraste WCAG AA, conformidade de skeletons em todas as rotas e validação do comportamento PWA em dispositivos reais.

### 📁 Arquivos Impactados

- `src/components/Skeletons.tsx`
- `src/index.css`
- `index.html`
- `public/manifest.webmanifest`
- `public/sw.js`

### 🔨 Tarefas Detalhadas

1. **Auditoria de Skeletons (CLS = 0):**
   - Verificar se `SkeletonResumo`, `SkeletonDetalhe`, `SkeletonRanking` e `SkeletonPerfil` espelham com 100% de exatidão a geometria física, padding e alturas reais das telas prontas.
2. **Auditoria de Acessibilidade (WCAG AA):**
   - Validar todos os pares de cor (giz/fundo, destaque-tinta/âmbar, perigo/fundo) com contraste mínimo de `4.5:1`.
   - Verificar `outline-2 outline-destaque outline-offset-2` em navegação por teclado (`Tab`).
   - Conferir atributos `aria-label`, `aria-expanded`, `aria-current` e `role="status"` em todos os componentes interativos.
3. **Validação PWA & Service Worker:**
   - Testar instalação do PWA em Android (Chrome) e iOS (Safari).
   - Validar cache Stale-While-Revalidate para leitura offline de súmulas passadas.
   - Testar vibrações hápticas e verificar fallback silencioso em navegadores sem suporte.

### ✅ Critérios de Aceite

- [ ] 0 erros no Lighthouse / a11y audit.
- [ ] Cumulative Layout Shift (CLS) = 0.00 em todas as transições de carregamento.
- [ ] App totalmente operacional offline para consulta de dados em cache.

---

## 12. Checklist Final de Entrega para o Orquestrador

Ao finalizar a execução de todos os Work Packages, o orquestrador deve rodar a seguinte bateria de testes finais:

```bash
# 1. Validação de Tipagem TypeScript Estrita
npm run lint

# 2. Validação de Formatação Prettier
npm run format:check

# 3. Build de Produção do Vite
npm run build
```

### ✅ Critérios de Conclusão Global:

- [ ] Todos os 9 Work Packages concluídos e validados.
- [ ] Build de produção (`vite build`) executado com sucesso e zero warnings de tipo.
- [ ] Identidade "Súmula de Quinta" consistente em 100% das páginas.
- [ ] Aplicação pronta para uso em campo nas quintas-feiras!
