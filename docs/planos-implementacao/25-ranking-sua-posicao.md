# 25 · Ranking: "sua posição" com jump — Plano de Implementação

> Ref.: item **E4** do `docs/plano-melhorias-frontend-pwa.md` · Ranking anti-slop: **#25 (nota 0,5)**, Tier 4 (`docs/rank-melhorias-reuso-codigo.md`)
> Esforço estimado: S · Risco: baixo · Prioridade global do plano: P1

## 1. Objetivo

No Ranking com 30+ atletas, achar a própria linha exige rolar uma tabela larga (com scroll horizontal) — mesmo com a linha do jogador logado já destacada visualmente. Este plano adiciona um **chip fixo acima da tabela** ("Você: 8º · 21 pts") que, ao toque, rola a página e a tabela até a linha destacada via `scrollIntoView`. É feature de UI nova (motivo da nota baixa no ranking anti-slop: zero deduplicação), mantida mínima: 2 commits, um arquivo tocado, nenhuma biblioteca nova, nenhum componente novo em `src/components/`.

**Comportamento definido — jogador fora do ranking**: o chip **não renderiza** quando (a) não há jogador logado, (b) o jogador não tem linha no ranking ou (c) a linha existe mas é excluída pelos filtros ativos (posição/mínimo de partidas) — ou seja, o chip só aparece se a linha destacada está de fato na tabela, evitando um jump para linha inexistente.

## 2. Estado atual (evidências verificadas)

Verificado no código em **03/10/2026** (re-verificação completa: o `Ranking.tsx` tem 455 linhas e houve drift de ~55 linhas em relação à checagem anterior de 30/09/2026):

- **`src/routes/Ranking.tsx:372-375`** — a tabela vive em `<div data-no-swipe className="overflow-x-auto rounded-[4px] border border-borda bg-superficie shadow-carimbo">` (o `data-no-swipe` está na `:373`). É esse contêiner que tem o scroll horizontal da tabela larga.
- **`src/routes/Ranking.tsx:414-449`** — o `map` das linhas já calcula `ehLogado = l.jogador_id === jogadorLogadoId` (`:416`) e aplica o destaque na `<tr>`: `border-l-2 border-destaque bg-destaque/10` (`:421`, dentro do `className` da `:420-422`). A coluna `#` exibe `i + 1` (ou 🏆 no primeiro, `:424-426`).
- **`src/routes/Ranking.tsx:329-337`** — `TabelaRanking` recebe `jogadorLogadoId={jogadorLogado?.id}` (`:336`); `jogadorLogado` vem de `useJogadorLogado()` (`:50`, hook de `src/hooks/useJogadorLogado.ts` que expõe `jogador` do `SessaoContext`, com `id: number` opcional).
- **`src/routes/Ranking.tsx:143-158`** — a ordem exibida é `linhasOrdenadas` (sort por `colunaOrdenacao`/`direcaoOrdenacao`, `:143-154`) filtrada por `minimoPartidas` em `linhasFiltradas` (`:156-158`); é esse array que vira as linhas da tabela (`:330`). A numeração da coluna `#` é o índice em `linhasFiltradas` (`i + 1`, `:425`).
- **`src/routes/Ranking.tsx:37-42`** — `metricas` define, por métrica da rota `/ranking/:metrica`, `titulo`, `coluna` (PTS/GOLS/ASSISTS/GC) e `campo` (`pontos`/`gols`/`assistencias`/`gols_contra`) — base para o valor exibido no chip.
- **`src/routes/Ranking.tsx:273-311`** — padrão de chip do Ranking a reusar (visual): `inline-flex items-center gap-1 px-2 py-1 rounded-[3px] border border-destaque/40 bg-destaque/10 text-destaque-texto text-xs font-display font-bold uppercase tracking-wider` (`:277` e `:290`). Hoje só existem os chips de filtro ativo, dentro de `flex flex-wrap` (`:275`).
- **`src/routes/Ranking.tsx:81-84`** — `useSwipeTabs` com as 4 rotas de métrica; handlers aplicados no contêiner da página (`:174`).
- **`src/hooks/useSwipeTabs.ts:56, 129`** — o `handleTouchStart` ignora toques iniciados em `input[type="range"], select, textarea, [data-no-swipe]` (`:56`): qualquer gesto iniciado sobre a tabela não navega entre abas. Um toque parado no chip (sem arrasto) também não dispara swipe (`absX >= threshold` com `threshold` padrão de 50px, `:129` e `:41`).
- **`src/routes/Ranking.tsx:164-168`** — `if (carregando) return <SkeletonRanking />` (`:164`) e erro sem cache retornam cedo (`:167-168`): o chip nasce depois desses guards, junto da tabela.
- **`src/routes/Layout.tsx:134`** — o header do app é `sticky top-0 z-40` (com `min-h-[44px]` nos botões + `py-2` ≈ 60px de altura): um chip `sticky` na página precisa de offset `top` abaixo dele.
- **`src/components/PullToRefresh.tsx:10-19`** — o `PullToRefresh` (`Ranking.tsx:171`) não cria contêiner de scroll próprio (o `getScrollTop` sobe até `window`), então `position: sticky` funciona dentro dele e `scrollIntoView` rola a janela normalmente.
- **Precedente de `scrollIntoView` no repo**: `src/hooks/useListbox.ts:79` — `opcaoRefs.current[destaque]?.scrollIntoView({ block: 'nearest', inline: 'nearest' })`. Padrão já consagrado, nada novo a introduzir.

## 3. Pré-condições e dependências

- **Nenhum plano pré-requisito.** O chip consome apenas estado já derivado no `Ranking` (`linhasFiltradas`, `jogadorLogado`, `metricas`); não depende do 07 (queries na lib — a query do ranking nem entra neste plano) nem do 11 (chip "mini" no Badge — o chip aqui reusa o padrão visual dos chips de filtro existentes, sem criar componente novo).
- **Sem decisão pendente do dono**: comportamento de "jogador fora do ranking" já definido na seção 1 (chip não renderiza); semântica do número exibida na seção 4 (posição = numeração da coluna `#` na ordenação corrente).
- **Restrição de janela**: nenhuma (tabela de leitura, sem partida ao vivo envolvida). Validar no aparelho com **30+ atletas** reais para exercitar scroll vertical e horizontal (seção 5).

## 4. Plano de execução (1 passo = 1 commit)

Todo o trabalho vive em **`src/routes/Ranking.tsx`**. Nenhum arquivo novo, nenhuma dependência nova, nenhuma mudança em `useSwipeTabs` (o `data-no-swipe` da tabela já cobre o gesto).

### Passo 1 — Chip fixo "Você: Nº · valor" acima da tabela · 1 commit

- **`src/routes/Ranking.tsx`**, no componente `Ranking`:
  1. Derivar a linha do jogador logado a partir do que a tabela exibe: `const indiceMeu = jogadorLogado ? linhasFiltradas.findIndex(l => l.jogador_id === jogadorLogado.id) : -1;` — `indiceMeu === -1` cobre os 3 casos da seção 1 (deslogado, sem linha, filtrado fora) e o chip não renderiza.
  2. Renderizar, **acima do bloco da tabela** (entre a barra de filtros `:232-311` e o `TabelaRanking` `:329`), quando `indiceMeu !== -1`, um `<button>` seguindo o padrão visual dos chips de filtro (`:277`): mesmas classes de chip (`border-destaque/40 bg-destaque/10 text-destaque-texto text-xs font-display font-bold uppercase tracking-wider rounded-[3px]`), com `min-h-[44px]` (alvo de toque do projeto), `sticky top-16 z-10` (fica abaixo do header sticky do `Layout.tsx:134`, que tem ≈60px — ajuste fino do offset na validação manual) e fundo opaco (`bg-superficie` sob o `bg-destaque/10`) para o texto não transparecer sobre as linhas ao rolar.
  3. Conteúdo do chip: `Você: {indiceMeu + 1}º · {valor}` — a posição é **a mesma numeração da coluna `#`** (`i + 1` de `linhasFiltradas`, `:425`), coerente com qualquer ordenação corrente (por padrão, a ordenação da métrica ativa = classificação; se o usuário reordenar por outro coluna/limpar filtros, o chip reflete a ordem em tela, que é o alvo real do jump). O `valor` é o campo da métrica ativa com sufixo curto: `pontos` → `N pts`, `gols` → `N gols`, `assistencias` → `N assist.`, `gols_contra` → `N GC` (mapeamento local de 1 linha, mesmo espírito de `metricas`, sem constante nova exportada).
  4. `onClick` do chip: `vibrateLight()` (padrão dos outros toques da tela, `:252` — também em `:66`, `:72` e `:77`) + o jump do Passo 2. No Passo 1, o botão ainda só vibra (commit reversível e já útil como indicador).
- O chip fica **fora** do `div[data-no-swipe]` da tabela, mas um toque parado nele não navega de aba (`useSwipeTabs.ts:129` exige `absX >= 50`).
- Commit: "ranking: chip fixo com a posição do jogador logado acima da tabela (E4)".

### Passo 2 — Jump até a linha destacada com `scrollIntoView` · 1 commit

- **`src/routes/Ranking.tsx`**, em `TabelaRanking`:
  1. Na `<tr>` destacada (`:418-422`), quando `ehLogado`, adicionar `id="ranking-linha-logado"` (atributo estático, sem ref lifting entre componentes — o chip está no componente pai e a tabela é filha; `getElementById` é o caminho mais simples e segue a simplicidade exigida pelo AGENTS.md).
- **`src/routes/Ranking.tsx`**, no `onClick` do chip (Passo 1):
  1. `document.getElementById('ranking-linha-logado')?.scrollIntoView({ behavior: 'smooth', block: 'center' })` — mesmo padrão do precedente `useListbox.ts:79`. `block: 'center'` centraliza a linha na viewport; o browser rola também o contêiner `overflow-x-auto` da tabela (`:372-375`), trazendo a linha destacada à vista horizontalmente (útil quando a coluna ordenada está fora da primeira dobra).
  2. Sem `setTimeout`/observadores: se a linha não existe, o chip não renderiza (garantia do Passo 1), então `getElementById` nunca é `undefined` enquanto o chip está visível.
- **Gesto vs. jump** (o ponto delicado): o `scrollIntoView` é programático e não gera `touchstart`, logo o `useSwipeTabs` não o interpreta; e se o usuário **tocar na tabela para interromper** o scroll suave, o toque nasce dentro do `div[data-no-swipe]` (`:373`) e é ignorado pelo `handleTouchStart` (`useSwipeTabs.ts:56`) — nenhuma troca de aba acidental durante/ao final do jump.
- Commit: "ranking: jump até a linha do jogador logado ao tocar o chip de posição (E4)".

Total: 2 commits, cada um reversível isoladamente (o revert do Passo 2 deixa o chip estático do Passo 1 funcionando).

## 5. Validação manual

Sem testes automáticos (AGENTS.md). No build de dev (`npm run dev`), aparelho/emulação mobile, **com 30+ atletas publicados**:

- [ ] `npm run build` (ou `tsc -b`) sem erros.
- [ ] **Chip correto**: logado com linha no ranking, o chip aparece acima da tabela com posição e valor conferindo com a coluna `#` e a linha destacada (ex.: linha `8` com `21` em PTS → "VOCÊ: 8º · 21 PTS").
- [ ] **Métricas**: repetir nas 4 abas (`/ranking/pontos`, `/gols`, `/assistencias`, `/gols-contra`) — posição/valor mudam conforme a métrica; swipe entre abas continua funcionando normalmente (nenhum handler novo na página).
- [ ] **Jump**: rolar a tabela para longe (vertical e horizontal), tocar o chip — a página rola suave até a linha destacada centralizada e o scroll horizontal da tabela traz as colunas da linha à vista; vibração leve no toque.
- [ ] **Gesto vs. jump**: durante o scroll suave do jump, encostar o dedo na tabela e arrastar horizontalmente — **não** deve trocar de aba (o `data-no-swipe` da tabela prevalece, `useSwipeTabs.ts:56`); arrastar sobre o chip também não navega (toque curto `absX < 50`); swipe nas áreas fora da tabela continua trocando aba.
- [ ] **Chip fixo (sticky)**: rolando a página, o chip permanece visível abaixo do header sticky, sem sobreposição com ele e sem "vazar" texto do fundo (fundo opaco); o header do app continua por cima (z-index correto).
- [ ] **Jogador filtrado fora**: ativar filtro de posição ou mínimo de partidas que exclua o jogador logado — o chip **desaparece** (a linha destacada não está na tabela); limpar os filtros traz o chip de volta com a posição atualizada.
- [ ] **Ordenação alternativa**: ordenar por "Atleta" (alfabética) — o chip mostra a posição na ordem exibida (ex.: "3º" = terceiro da lista alfabética), igual à coluna `#`.
- [ ] **Sem jogador logado** (ou sessão expirada): nenhum chip renderiza; a tabela e o destaque de linha ficam como hoje.
- [ ] **Lista vazia / carregando**: com `SkeletonRanking` e com a mensagem "Nenhum atleta encontrado" (`:313-327`), nenhum chip aparece.
- [ ] **Pull-to-refresh**: puxar para atualizar com o chip visível — PTR funciona como antes, sem brigar com o chip sticky; após o refresh, chip e posição seguem corretos.
- [ ] **Acessibilidade rápida**: chip é focável via teclado e o Enter dispara o jump (é um `<button>` nativo).

## 6. Fora de escopo

- **Não criar componente novo** em `src/components/` (nem `ChipPosicao`, nem variação no `Badge` — o chip reusa as classes dos chips de filtro existentes no próprio `Ranking.tsx`; a extração para o `Badge` é o item 11/A8, plano próprio).
- **Não tocar em `useSwipeTabs.ts`**, `PullToRefresh.tsx`, `Layout.tsx` (header) nem em `ModalFiltrosRanking` — o comportamento atual já atende; qualquer ajuste aí é outro plano.
- **Não mudar a query, o cache (`chaveRanking`/`useCache`) nem a ordenação/filtragem existentes** — o chip é derivado do estado já em tela; nada novo é buscado do Supabase.
- **Não implementar destaque temporário/flash na linha após o jump** (o destaque permanente `border-l-2 bg-destaque/10` já existe e basta nesta fase).
- **Não migrar os chips de filtro existentes** para o novo chip nem unificar estilos (mudança cosmética ampla — proibida pelo AGENTS.md neste escopo).
- **Não implementar realtime** (segue o plano próprio `docs/plano-escolha-times-realtime.md`) e **não** criar testes automáticos (diretriz atual do AGENTS.md).

## 7. Riscos e rollback

- **Risco funcional: baixo** — mudança aditiva e localizada em 1 arquivo; a tabela, filtros, ordenação, swipe e PTR não mudam. Pontos de atenção:
  - **Offset do chip sticky**: a altura do header sticky do `Layout` (~60px) não é tokenizada; `top-16` (64px) é estimativa. Se houver sobreposição/sobras visíveis no aparelho (inclusive com o banner offline ativo, `Layout.tsx:121-131`), ajustar o offset no mesmo commit do Passo 1 — pior caso aceitável é o chip rolar junto com a página (remover `sticky`), preservando o jump.
  - **Semântica da posição em ordenação alternativa**: com a tabela ordenada por coluna não-métrica, o número do chip reflete a ordem em tela (ex.: alfabética) e não a classificação — decisão documentada na seção 4; se a validação mostrar confusão, alternativa mínima é renderizar o chip só quando a ordenação corrente é a da métrica (`colunaOrdenacao === configuracao.campo && direcaoOrdenacao === 'desc'`), sem nova lógica de ranking.
  - **`scrollIntoView` e browsers antigos**: API amplamente suportada e já usada no repo (`useListbox.ts:79`); com `behavior: 'smooth'` não suportado, o browser degrada para scroll instantâneo — sem erro.
- **Risco de regressão**: o pior caso é o chip não renderizar (condição `indiceMeu === -1`) — a tela volta exatamente ao estado atual; nenhum outro caminho da tela é alterado.
- **Rollback**: cada passo é um commit isolado e reversível por `git revert` — Passo 1 remove o chip; Passo 2 remove o `id` da `<tr>` e o `scrollIntoView`, deixando o chip estático do Passo 1. Nenhuma migração, nenhum dado persistido, nenhuma mudança fora de `Ranking.tsx`.
