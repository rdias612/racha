# 📋 Plano de Implementação: Melhorias Core de UX, Gestos e Arquitetura

**Projeto:** Racha Gragoatá (CBO)  
**Data:** 21 de Agosto de 2026  
**Status:** Pronto para Execução  
**Escopo:**
1. **Code Splitting & Skeletons Zero-CLS**
2. **Navegação Touch Swipe (Gestos Mobile)**
3. **Unificação da Escalação de Times (`EscalacaoTimesEditor`)**

---

## 🎯 Objetivos de Engenharia e UX

1. **Desempenho & Web Vitals (Zero-CLS):** Reduzir o bundle inicial de JavaScript através de `React.lazy()` e eliminar oscilações de layout (*Cumulative Layout Shift*) ao carregar dados do Supabase utilizando Skeletons estruturais idênticos aos layouts finais.
2. **Ergonomia Mobile Nativa:** Permitir que o usuário navegue entre abas com gestos horizontais de swipe com o polegar, sem bloquear o scroll vertical nativo e com feedback háptico sutil.
3. **Eliminação de Duplicação de Código (~85%):** Centralizar as regras complexas de escalação, travas de goleiro (1/1 GK) e limites de time (8/8) em um único componente reutilizável (`EscalacaoTimesEditor.tsx`).

---

## 🏗️ 1. Fase 1: Code Splitting & Skeletons Zero-CLS

### 1.1. Criação do Módulo de Skeletons (`src/components/Skeletons.tsx`)
- Criar placeholders visuais dimensionados rigorosamente com as mesmas margens, alturas e grids das telas reais com animação CSS `animate-pulse`:
  - `SkeletonResumo`: Header, card da próxima partida e bento grid de destaques da temporada.
  - `SkeletonJogos`: Header com filtro de ano e lista de cards estilo estádio com placar central.
  - `SkeletonRanking`: Pódio Top 3, abas de métricas, slider de mínimo de jogos e linhas/cards de atletas.
  - `SkeletonEstatisticas`: Abas (Jogador x Racha), seletor de atleta, stat boxes e cards de parcerias (companheiros e adversários).
  - `SkeletonPerfil`: Avatar centralizado, badges de mensalidade/admin, stat boxes e seções de segurança.
  - `SkeletonDetalhe`: Placar de estádio, lista de escalação dos dois times e feed de eventos.
  - `SkeletonGestao`: Cards de resumo de mensalistas/admins e lista de atletas.

### 1.2. Refatoração de `src/App.tsx` com `React.lazy` e `Suspense`
- Converter todos os imports estáticos de rotas para `lazy(() => import(...))`.
- Criar container de fallback inteligente que exibe o Skeleton correto de acordo com a rota ativa:
  ```tsx
  const Ranking = lazy(() => import("./routes/Ranking").then(m => ({ default: m.Ranking })));
  const Jogos = lazy(() => import("./routes/Jogos").then(m => ({ default: m.Jogos })));
  // ... demais rotas
  ```
- Envolver as rotas no `<Suspense fallback={<CarregandoRota />}>`.
- Isolar o bundle de rotas administrativas pesadas (`PartidaEditar`, `GestaoJogadores`, `Administrador`) para que não sobrecarreguem o primeiro acesso do atleta comum.

---

## 👆 2. Fase 2: Navegação Touch Swipe & Gestos Mobile

### 2.1. Utilitário de Haptics (`src/lib/haptics.ts`)
- Criar/garantir wrapper seguro para `navigator.vibrate`:
  - `vibrateLight()`: pulso de 15ms para toques rápidos e troca de abas.
  - `vibrateSuccess()`: confirmação de gravação de escalação ou salvamento.
  - `vibrateWarning()`: alerta de violação de regra (ex: tentar escalar 2º goleiro).

### 2.2. Criação do Hook `src/hooks/useSwipeTabs.ts`
- Implementar máquina de estados de toque com precisão:
  - **`onTouchStart`**: captura coordenadas iniciais `(x, y)` e timestamp.
  - **`onTouchMove`**: calcula `deltaX` e `deltaY`. Aplica trava vertical prematura: se `|deltaY| > 12px` e `|deltaY| > |deltaX|`, desativa imediatamente o swipe e entrega o controle ao scroll vertical nativo do navegador.
  - **`onTouchEnd`**: valida se `|deltaX| >= 50px`, se `|deltaX| > |deltaY| * 1.2` e se o tempo total do gesto foi menor que 800ms.
  - Se válido, dispara `vibrateLight()` e navega para a aba anterior/próxima via `navigate()`.
  - Exclui toques iniciados em `input[type="range"]`, botões ou elementos com atributo `data-no-swipe`.

### 2.3. Integração do Swipe nas Abas Principais
- **`Ranking.tsx`**: Swipe horizontal entre as 4 métricas:
  `['/ranking/pontos', '/ranking/gols', '/ranking/assistencias', '/ranking/gols-contra']`.
- **`Estatisticas.tsx` & `EstatisticasRacha.tsx`**: Swipe entre as abas:
  `['/estatisticas/jogador', '/estatisticas/racha']`.

---

## ⚽ 3. Fase 3: Unificação da Escalação de Times (`EscalacaoTimesEditor`)

### 3.1. Criação de `src/components/EscalacaoTimesEditor.tsx`
- Componente puro e modular com TypeScript rigoroso recebendo:
  - `jogadores: JogadorLista[]` (lista dos confirmados).
  - `times: Record<number, TimeId>` (alocação atual).
  - `mediasNotas: Record<number, number>` (médias históricas).
  - `onAtribuirTime: (id: number, time: TimeId) => void`.
  - `onAutoEscalar: () => void`.
  - `onSalvar: () => void`.
  - `salvando: boolean`.
  - `titulo`, `subtitulo`, `infoExtra` opcionais.
- **Regras de Negócio Integradas:**
  - Limite de 8 atletas por time (`LIMITE_POR_TIME = 8`).
  - Trava estrita de goleiros: máximo de 1 goleiro por time (`contagemGoleiros.a <= 1` e `contagemGoleiros.b <= 1`).
  - Cálculo de equilíbrio de estrelas (média de notas do Time Preto vs Time Branco).
  - Feedback visual dos botões Preto e Branco com touch targets de `min-h-[44px]` e `active:scale-95`.
  - Rodapé fixo com safe-area (`calc(4rem + env(safe-area-inset-bottom))`) e botão de ação principal.

### 3.2. Refatoração de `src/routes/PartidaNovaTimes.tsx`
- Reduzir o arquivo de 438 linhas para ~60 linhas.
- Responsabilidades da rota:
  - Validar se o usuário é admin e recuperar estado de navegação da Etapa 1.
  - Executar `supabase.rpc("criar_partida", ...)` no callback `onSalvar`.
  - Renderizar `<EscalacaoTimesEditor />`.

### 3.3. Refatoração de `src/routes/PartidaTimes.tsx`
- Reduzir o arquivo de 458 linhas para ~80 linhas.
- Responsabilidades da rota:
  - Carregar a partida existente e participantes do Supabase.
  - Filtrar confirmados.
  - Executar os updates em lote na tabela `partidas_participantes` no callback `onSalvar`.
  - Renderizar `<EscalacaoTimesEditor />`.

---

## 🧪 4. Plano de Testes e Validação

| Teste | Tipo | Critério de Aceite |
| :--- | :--- | :--- |
| **Typecheck** | Automatizado (`tsc --noEmit`) | 0 erros de compilação TypeScript. |
| **Build Vite** | Automatizado (`npm run build`) | Bundle gerado com chunks divididos (`dist/assets/*.js`) com sucesso. |
| **Zero-CLS** | Manual / DevTools | Ausência de saltos visuais durante o carregamento de Jogos, Ranking e Perfil. |
| **Touch Swipe** | Manual / Mobile | Deslizar horizontalmente no Ranking muda de métrica; rolar para cima/baixo rola a lista normalmente sem disparar troca acidental de aba. |
| **Escalação Nova Partida** | Manual | Criar nova partida, clicar em "Gerar automaticamente", testar botões Preto/Branco, validar trava de 2º goleiro e salvar. |
| **Escalação Partida Existente** | Manual | Abrir partida draft em `/partida/:id/times`, ajustar jogadores e salvar com sucesso no banco. |

---

## 📦 5. Arquivos Afetados

- `[NOVO]` [`src/components/Skeletons.tsx`](file:///c:/GIT/racha/src/components/Skeletons.tsx)
- `[NOVO]` [`src/components/EscalacaoTimesEditor.tsx`](file:///c:/GIT/racha/src/components/EscalacaoTimesEditor.tsx)
- `[NOVO]` [`src/hooks/useSwipeTabs.ts`](file:///c:/GIT/racha/src/hooks/useSwipeTabs.ts)
- `[NOVO/MODIFICADO]` [`src/lib/haptics.ts`](file:///c:/GIT/racha/src/lib/haptics.ts)
- `[MODIFICADO]` [`src/App.tsx`](file:///c:/GIT/racha/src/App.tsx)
- `[MODIFICADO]` [`src/routes/PartidaNovaTimes.tsx`](file:///c:/GIT/racha/src/routes/PartidaNovaTimes.tsx)
- `[MODIFICADO]` [`src/routes/PartidaTimes.tsx`](file:///c:/GIT/racha/src/routes/PartidaTimes.tsx)
- `[MODIFICADO]` [`src/routes/Ranking.tsx`](file:///c:/GIT/racha/src/routes/Ranking.tsx)
- `[MODIFICADO]` [`src/routes/Estatisticas.tsx`](file:///c:/GIT/racha/src/routes/Estatisticas.tsx)
- `[MODIFICADO]` [`src/routes/EstatisticasRacha.tsx`](file:///c:/GIT/racha/src/routes/EstatisticasRacha.tsx)
