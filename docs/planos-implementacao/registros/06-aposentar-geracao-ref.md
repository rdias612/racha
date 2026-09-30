# 06 · Aposentar `geracaoRef` manual — Registro de Execução e Validação

> Registro da execução do plano [06-aposentar-geracao-ref.md](../06-aposentar-geracao-ref.md) em 2026-09-30, na branch `main`, por dois agentes independentes: **implementador** (2 passos) e **validador** (auditoria read-only). Veredito final da auditoria: **APROVADO**, sem bloqueantes e sem ressalvas de correção. Executado após os planos 07 e 05 (coordenação de escopo em `Estatisticas`).

## 1. Execução

- **2 commits** (`f5b9dcc` → `e25dd61`), 1 passo = 1 commit, build e lint verdes (zero warnings).
- **Passo 1** (`f5b9dcc`): `chaveParesRacha(minPartidas)` em `lib/chavesCache.ts` (formato `pares-racha:N`, padrão `chaveRanking`); `EstatisticasRacha.tsx` migrado — tripé estado/`geracaoRef`/`carregar`/`useEffect` removido, `useCache` com `buscarPares = useCallback(..., [])`, `null` → `undefined`, `onRefresh={recarregar}`, `MIN_PARTIDAS` local preservado, imports mortos removidos.
- **Passo 2** (`e25dd61`): interface `EstatisticasJogador` + `carregarEstatisticasJogador(jogadorId)` em `lib/jogadores.ts` (Promise.all das 3 funções + mesmo mapeamento array→lookup por métrica que existia em `Estatisticas.tsx:97-105`, posicionada ao lado das funções que orquestra); `chaveEstatisticasJogador(jogadorId)` (`estatisticas-jogador:N`); `Estatisticas.tsx` migrado com chave sentinela (`jogadorSelecionadoId ?? -1`) e fetcher que guarda estado vazio quando nada selecionado; dropdown de jogadores (`:54-70`) **byte a byte intocado** (efeito do plano 05); `onRefresh={recarregar}`.
- Critério de encerramento: `grep -rn geracaoRef src/` retorna **apenas** `BannerLembrete.tsx` (4 refs — exceção documentada, intocada com diff vazio).
- Fora de escopo confirmados intocados: `useCache.ts`, `Perfil.tsx`, telas de partida, e as 2 chaves novas NÃO entraram em `invalidarCachesDependentesDePartida()` (precedente `chaveRanking` — seção 3/6 do plano).

## 2. Divergências plano × código real (justificadas e aceitas pela auditoria)

1. **Chaves novas ao fim de `chavesCache.ts`**: o plano foi escrito contra o arquivo de 30 linhas; hoje tem 8 chaves dos planos 03/05. Inserção no fim é a leitura literal e a menos intrusiva.
2. **Fetcher de Estatisticas declarado antes da chamada** (não inline no `useCache`): autorizado pelo plano ("forma exata a ajustar na implementação"); mais fiel ao molde `Ranking.tsx` e passa no `react-hooks/exhaustive-deps`.
3. **Constante de módulo `SEM_PARCERIAS: Parceria[] = []`** como fallback de `dados?.parcerias`: solução canônica do React para estabilidade de referência em dep de `useMemo` (fallback inline recriaria `[]` a cada render e invalidaria os memos de `maximoPartidas`/`parceriasFiltradas`). 3 linhas, comentada, sem overengineering.
4. **Skeleton como `carregando && pares === undefined`** em EstatisticasRacha: tecnicamente redundante (`carregando` já implica `dados === undefined`), mas preservado como mudança mínima do `null`→`undefined` do plano — decisão certa pelo AGENTS.md.
5. **Estado vazio pré-seleção/primeira seleção do dropdown renderiza zeros por instantes** em vez de skeleton: sancionado pelas seções 4 e 7 do plano (semântica SWR já aceita em Ranking/Comparador; em trocas subsequentes o comportamento é melhor — mostra o dado do jogador anterior).

## 3. Validações técnicas confirmadas pela auditoria

- Escopo exato por passo: Passo 1 toca só `chavesCache.ts` + `EstatisticasRacha.tsx`; Passo 2 só `jogadores.ts` + `chavesCache.ts` + `Estatisticas.tsx`.
- Fetchers estáveis com deps corretas (`[]` e `[jogadorSelecionadoId]`) — sem risco de loop de revalidação (contrato `useCache.ts:109-110`).
- Mapeamento do fetcher composto idêntico ao código antigo; guards de render (skeleton/erro) preservados; `useMemo`s de ordenação/cards intocados.
- `npm run build` e `npm run lint` verdes; `geracaoRef` restante confinado a `BannerLembrete.tsx`.

## 4. Débitos registrados (conforme plano, não corrigidos aqui)

- Riscar o site `carregarStatsJogador` (antigo `Estatisticas.tsx:86`) da lista do plano 05 — este plano o absorveu no fetcher composto (a documentação do 05 já tratava `Estatisticas` como exceção do 06, nada a alterar lá).
- Opção de frescor absoluto pós-mutação nas telas de estatísticas via 1 linha no helper do plano 03 (só para `chaveParesRacha`; chaves por jogador exigiriam `invalidarCache()` sem argumento — martelo grande, não recomendado), se o dono um dia quiser.

## 5. Pendente de validação humana (visual/fluxo, no aparelho)

- [ ] EstatisticasRacha — primeira visita: skeleton e tabela (fluxo idêntico ao atual).
- [ ] EstatisticasRacha — revisita: tabela instantânea do cache + 1 request de revalidação no Network.
- [ ] EstatisticasRacha — pull-to-refresh: indicador segura até responder; tabela reflete novo dado de partida.
- [ ] Offline com cache (modo avião em revisita): serve dado local com banner; offline sem cache: mensagem de erro como hoje.
- [ ] Estatisticas — troca de jogador e trocas rápidas em sequência: tela final reflete o selecionado, sem resposta cruzada (a proteção que `geracaoRef` fazia).
- [ ] Estatisticas — revisita / pull-to-refresh / offline: mesmos cenários.
- [ ] Ordenação de colunas, abas por swipe e "Melhor/Pior dupla" seguem funcionando.
- [ ] BannerLembrete continua com votação aberta e countdown (sanity check — arquivo não tocado).
- [ ] Nenhuma outra tela regrediu (mudanças confinadas a 2 rotas + 2 arquivos da lib).
