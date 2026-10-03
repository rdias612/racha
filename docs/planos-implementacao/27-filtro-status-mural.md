# 27 · Filtro por status no mural de jogos — Plano de Implementação

> Ref.: item **E6** do `docs/plano-melhorias-frontend-pwa.md` · Ranking anti-slop: **#27 (nota 0,5)**, Tier 4 (`docs/rank-melhorias-reuso-codigo.md`)
> Esforço estimado: S–M · Risco: baixo · Prioridade global do plano: P2

## 1. Objetivo

Adicionar ao Mural de Jogos (`Jogos.tsx`) uma linha de chips de status no cabeçalho — **Todas · Em andamento · Votação aberta · Encerrada · Agendada** — que filtra o mural **client-side**, sobre os dados já carregados e cacheados pelo `useCache(CHAVE_JOGOS)`. Nenhuma query nova, nenhuma chave de cache nova: o mural único cresce sem filtro hoje (`Jogos.tsx:39-44`) e partidas ao vivo se perdem no histórico. O padrão visual é cópia idêntica das pílulas de filtro do fluxo do Ranking (`ModalFiltrosRanking.tsx:116-145`), **inline, sem criar abstração nova** (ver relação com o débito do plano 15 nas seções 3 e 7).

## 2. Estado atual (evidências verificadas)

Evidências conferidas no código em **2026-10-03**:

- **`src/lib/partidas.ts:110-131`** — o mural vem de `carregarMuralJogos()`: consulta a view `partidas_com_placar` (migration 071) com `select('id, data_jogo, status, gols_time_a, gols_time_b')` + `order('data_jogo', desc)` (`:112-115`) e retorna `MuralJogos = { partidas: PartidaMural[]; placares: Record<number, PlacarMural> }` (`:105-108`). `PartidaMural` tem exatamente `id`, `data_jogo` e `status: StatusPartida` (`:91-95`). As antigas interfaces locais `Partida`/`Placar`/`DadosJogos` de `Jogos.tsx` já não existem — foram movidas para a lib pelo plano 07 (`MuralJogos`/`PartidaMural`/`PlacarMural`).
- **`src/routes/Jogos.tsx:39-41`** — mural único sem filtro: `const buscar = useCallback(() => carregarMuralJogos(), [])` (`:39`) alimenta `useCache<MuralJogos>(CHAVE_JOGOS, buscar)` (`:41`). Os tipos `MuralJogos`/`PartidaMural` e `STATUS_LABEL` já são importados da lib (`:15-21`; `STATUS_LABEL` em `:16`).
- **Status expostos pela view**: `StatusPartida = 'draft' | 'live' | 'published' | 'closed'` (`src/lib/partidas.ts:5`), com rótulos em `STATUS_LABEL` (`:15-20`): `draft: 'Agendada'`, `live: 'Em andamento'`, `published: 'Votação aberta'`, `closed: 'Encerrada'`.
- **Divergência do doc de origem, corrigida neste plano**: a proposta E6 lista 3 chips ("Ao vivo · Encerradas · Rascunho"), mas a view expõe **4 status** — omitir `published` (votação aberta) deixaria partidas em votação invisíveis ao filtrar. O plano cobre os **4 status + "Todas"**, reusando `STATUS_LABEL` (sem duplicar rótulos).
- **Filtro local existente**: `Jogos.tsx:44` já filtra `dados.partidas` por `idsExcluidos` (exclusões locais sobrepõem o cache) — o filtro de status se encadeia **depois** desse, no mesmo espírito (estado derivado, sem tocar o cache).
- **Padrão de pílula do Ranking** (a replicar): `src/components/ModalFiltrosRanking.tsx:116-145` — botão base `min-h-[44px] inline-flex items-center justify-center rounded-[3px] px-2 py-2 text-xs font-display font-bold uppercase tracking-wider transition cursor-pointer`, ternário ativo `bg-destaque text-destaque-tinta shadow-xs border border-destaque font-black` / inativo `border border-borda bg-superficie-2 text-giz-fraco hover:text-giz hover:bg-superficie` (`:120-123` e `:134-138`), com `type="button"` e `vibrateLight()` no toque (handler `handleTrocarPosicao`, `:58-61`; `vibrateLight` definida em `src/lib/haptics.ts:19`). Documentado como uma das 3 variantes do débito `PilulaFiltro` no **plano 15** (seção 2, tabela comparativa).
- **Container de chips do Ranking**: `src/routes/Ranking.tsx:275` — `flex flex-wrap items-center gap-1.5 pt-0.5`; estado vazio por filtro usa `MensagemEstado tipo="info"` + botão "Redefinir filtros" (`:313-327`).
- **Chave do mural**: `CHAVE_JOGOS = 'jogos'` (`src/lib/chavesCache.ts:11`), documentada como "query sem parâmetros" (`:10`) — este plano **não** altera isso: o filtro nunca entra na chave.
- **Cabeçalho do mural**: `CabecalhoSumula` em `Jogos.tsx:78-93` (título + CTA "Nova partida" do admin); a linha de chips entra logo abaixo, antes do card vazio/lista (`:95-156`).

## 3. Pré-condições e dependências

- **Plano 07 já executado**: o mural vem de `carregarMuralJogos()` (`src/lib/partidas.ts`) e os tipos do mural são `MuralJogos`/`PartidaMural`/`PlacarMural` da lib — não há mais interfaces locais em `Jogos.tsx`. **Nenhum conflito**: o filtro é client-side sobre `MuralJogos.partidas` e não altera a assinatura da função da lib. A menção a "chave de cache parametrizada" da redação original deste plano está **fora de escopo** (ver seção 6).
- **Decisão do dono já tomada** (coordenação deste plano): replicar as classes das pílulas **inline**, sem criar `PilulaFiltro` — 2 contextos de uso em tela (mural e Ranking) não justificam a abstração agora. Consequência registrada: após este plano, o critério de ativação nº 1 do plano 15 ("4º uso" do ternário) materializa-se formalmente; a extração permanece território exclusivo do plano 15, **não** deste.
- **Variante visual escolhida**: a do `ModalFiltrosRanking` (ativo `shadow-xs border-destaque font-black`) — é literalmente o padrão de chips do fluxo de filtros do Ranking, que o doc de origem manda replicar; a variante majoritária `shadow-carimbo` do plano 15 só entra se o plano 15 for ativado (normalização aconteceria lá, não aqui).
- **Restrição de janela**: nenhuma crítica — o mural não é tela de partida ao vivo; tocar `Jogos.tsx` durante um ao-vivo não afeta as telas de partida.

## 4. Plano de execução (1 passo = 1 commit)

Tudo em **`src/routes/Jogos.tsx`** — um único arquivo, um único commit (a feature é pequena e coesa; fatiá-la criaria commit intermediário com UI morta).

### Passo 1 — Chips de status + filtro client-side · 1 commit

1. **Constante de chips** (topo do arquivo, após os imports; tipos todos da lib — `STATUS_LABEL` já importado em `:16`; adicionar `type StatusPartida` ao import existente de `../lib/partidas` em `:15-21`):

   ```tsx
   type StatusFiltro = StatusPartida | 'todas';

   const FILTROS_STATUS: { valor: StatusFiltro; rotulo: string }[] = [
     { valor: 'todas', rotulo: 'Todas' },
     { valor: 'live', rotulo: STATUS_LABEL.live },
     { valor: 'published', rotulo: STATUS_LABEL.published },
     { valor: 'closed', rotulo: STATUS_LABEL.closed },
     { valor: 'draft', rotulo: STATUS_LABEL.draft },
   ];
   ```

   (ordem por relevância para o jogador — ao vivo primeiro, como pede o problema do E6.)
2. **Estado** no componente: `const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>('todas');` + handler local `function selecionarStatus(valor: StatusFiltro) { vibrateLight(); setStatusFiltro(valor); }` (mesmo gesto de `ModalFiltrosRanking.tsx:58-61`). Importar `vibrateLight` de `../lib/haptics`.
3. **Derivação** (após o filtro de `idsExcluidos` de `:44`; **decisão fixa: sem `useMemo`** — a lista é pequena e o `.filter` é barato; memoizar aqui seria complexidade sem medida, contra KISS):

   ```tsx
   const partidasVisiveis =
     statusFiltro === 'todas' ? partidas : partidas.filter((p) => p.status === statusFiltro);
   ```

   O `.map` da lista (`:106`) e o teste de vazio filtrado (item 5) passam a consumir `partidasVisiveis`; `partidas` permanece para o estado vazio real do mural.
4. **Linha de chips** entre o `CabecalhoSumula` (termina em `:93`) e o card vazio/lista — ternário **idêntico** ao de `ModalFiltrosRanking.tsx:116-145`:

   ```tsx
   <div className="mb-3 flex flex-wrap gap-1.5">
     {FILTROS_STATUS.map(({ valor, rotulo }) => {
       const ativo = statusFiltro === valor;
       return (
         <button
           key={valor}
           type="button"
           aria-pressed={ativo}
           onClick={() => selecionarStatus(valor)}
           className={`min-h-[44px] inline-flex items-center justify-center rounded-[3px] px-2 py-2 text-xs font-display font-bold uppercase tracking-wider transition cursor-pointer ${
             ativo
               ? 'bg-destaque text-destaque-tinta shadow-xs border border-destaque font-black'
               : 'border border-borda bg-superficie-2 text-giz-fraco hover:text-giz hover:bg-superficie'
           }`}
         >
           {rotulo}
         </button>
       );
     })}
   </div>
   ```

   (`aria-pressed` de graça, como o futuro `PilulaFiltro` do plano 15 faria; sem `whitespace-nowrap` — 5 chips curtos cabem com wrap em telas estreitas, como os atalhos rápidos do `ModalFiltrosRanking:171-190`.)
5. **Estado vazio filtrado**: quando `partidas.length > 0` mas `partidasVisiveis.length === 0`, exibir `MensagemEstado tipo="info"` ("Nenhuma partida com esse filtro.") + botão "Limpar filtro" (classes do "Redefinir filtros" do `Ranking.tsx:322-324`, ação `selecionarStatus('todas')`) — mesmo desenho do `Ranking.tsx:313-327`. O card vazio atual (`:95-103`) continua valendo para mural genuinamente vazio.
6. Nada mais muda: ordenação, links (`live` → `/ao-vivo`, `:142`), `PainelPlacar`, exclusão, `ConfirmDialog`, `Snackbar` e `PullToRefresh` intocados.
- Commit: "adiciona filtro por status no mural de jogos (E6)".

## 5. Validação manual

Sem testes automáticos (AGENTS.md). No aparelho/build:

- [ ] `npm run build` (ou `tsc -b`) sem erros.
- [ ] Mural carrega como hoje na primeira visita e em revisita (cache `CHAVE_JOGOS` servindo na hora) — **nenhuma requisição nova** ao trocar de chip (conferir aba Network).
- [ ] Chip "Todas" ativo por padrão; tocar cada um dos 4 chips de status filtra corretamente (`Em andamento` mostra só `live`, etc.) e alterna `vibrateLight`.
- [ ] Tocar no chip já ativo mantém a seleção (comportamento de rádio, não toggle-off — igual às pílulas do Ranking).
- [ ] Filtro respeita exclusões locais: excluir uma partida com filtro ativo remove a linha imediatamente.
- [ ] Com filtro sem resultados, aparece a mensagem "Nenhuma partida com esse filtro." e "Limpar filtro" restaura "Todas"; mural genuinamente vazio continua mostrando o card "Ainda não tem jogo na ficha.".
- [ ] Chips com alvo de toque ≥ 44px; linha quebra em duas fileiras sem cortar texto em tela estreita (~360px).
- [ ] `aria-pressed` reflete o chip ativo no DOM (devtools).
- [ ] Card `live` continua linkando para `/partida/:id/ao-vivo` com qualquer filtro ativo.
- [ ] Regressão: CTA "Nova partida" (admin), `ConfirmDialog` de exclusão e `Snackbar` funcionam como antes com filtro ativo.

## 6. Fora de escopo

- **Filtro por temporada** — fica para o roadmap #2 do dono; **não antecipar** (doc de origem é explícito). Nenhuma preparação de chave de cache ou assinatura para isso.
- **Extrair `PilulaFiltro`** — território exclusivo do plano 15 e somente com seu gatilho de ativação confirmado pelo dono; aqui o ternário nasce inline, cópia fiel do `ModalFiltrosRanking`.
- **Filtro server-side / nova chave de cache** (`jogos:status`-qualquer-coisa), incluindo qualquer variante de chave parametrizada — o mural é pequeno e já vem inteiro; `CHAVE_JOGOS` permanece sem parâmetros.
- **Contador "Exibindo X de Y partidas"** estilo Ranking — YAGNI enquanto não houver queixa.
- **Persistência do filtro** (query param, `localStorage`) — estado de tela efêmero, como no Ranking.
- Tocar `Ranking.tsx`, `ModalFiltrosRanking.tsx`, `partidas.ts` ou qualquer outro arquivo (normalização visual das pílulas é do plano 15).
- Criar testes automáticos (diretriz atual do AGENTS.md).

## 7. Riscos e rollback

- **Risco geral: baixo** — mudança confinada a um arquivo, sem tocar query, cache, lib ou telas de partida. O compilador pega divergência de tipo e a validação manual cobre comportamento.
- **Risco de interação com `idsExcluidos`**: o filtro de status deve encadear **depois** da exclusão local (`:44`); inverter a ordem não muda o resultado final (dois filtros independentes), mas manter o encadeamento existente evita dois percursos de verdade no arquivo.
- **Risco de regressão no estado vazio**: o card vazio atual (`:95`) testa `partidas.length === 0`; se o novo teste usar a lista filtrada para os dois casos, o card "Ainda não tem jogo na ficha." apareceria errado com filtro sem resultado — a validação manual cobre exatamente esse cenário.
- **Risco de débito (registrado, não corrigido aqui)**: o novo ternário inline é a cópia nº 4 do padrão de pílula — fortalece o gatilho de ativação do plano 15. **Não extrair neste plano** (misturaria feature com refactor estrutural, contra AGENTS.md); ao concluir, sinalizar ao dono que o critério do plano 15 deve ser revisitado.
- **Rollback**: commit único e isolado; `git revert` restaura o mural sem filtro sem afetar nenhum outro arquivo ou plano (nenhum passo de outro plano depende deste código).
