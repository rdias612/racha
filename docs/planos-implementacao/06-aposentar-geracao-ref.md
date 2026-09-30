# 06 · Aposentar `geracaoRef` manual — Plano de Implementação

> Ref.: item **D3** do `docs/plano-melhorias-frontend-pwa.md` · Ranking anti-slop: **#6 (nota 6,5)**, Tier 2 (`docs/rank-melhorias-reuso-codigo.md`)
> Esforço estimado: S → M · Risco: baixo · Prioridade global do plano: P1

## 1. Objetivo

Aposentar a proteção contra resposta obsoleta reimplementada à mão (`geracaoRef` + checagens de geração espalhadas nos callbacks) nas duas telas leitoras simples, trocando o tripé `useState` + `useEffect` + `useRef` de cada tela por uma chamada declarativa do `useCache` existente — que já implementa exatamente essa proteção de forma centralizada (`src/hooks/useCache.ts`). São **14 refs** de código delicado de concorrência em 3 arquivos, impossível de corrigir centralizadamente enquanto copiado; após este plano, restam apenas as cópias justificadas (`BannerLembrete`, exceção documentada na seção 6, e as telas de partida, fora de escopo). Efeito colateral bom: as telas passam a servir dado em cache instantaneamente em revisitas (semântica stale-while-revalidate), como `Ranking` já faz hoje.

## 2. Estado atual (evidências verificadas)

Verificado no código em **30/09/2026**. As contagens do doc de origem conferem (5 + 5 + 4 = 14 refs); **uma divergência corrigida**: a chave `chaveParesRacha` citada na proposta do doc de origem **ainda não existe** em `src/lib/chavesCache.ts` (grep confirmado — só aparece nos docs) — sua criação é parte deste plano (Passo 1).

- **`geracaoRef` manual — 14 refs em 3 arquivos** (grep confirmado):
  - `src/routes/EstatisticasRacha.tsx:85,88,93,95,99` (5 refs) — leitura única de `carregarParesRacha(MIN_PARTIDAS)` (`MIN_PARTIDAS = 5`, constante local `:13`), sem mutação nem polling; o `carregar` também alimenta o `PullToRefresh` (`:142`), motivo da proteção viver fora da flag do efeito (comentário `:82-84`).
  - `src/routes/Estatisticas.tsx:75,79,91,107,111` (5 refs) — `Promise.all` de 3 queries da lib (`carregarStatsJogador`, `carregarParceriasJogador`, `carregarParceriasDestaque`, `:85-89`); a "chave" efetiva é `jogadorSelecionadoId` (dep do `useCallback`, `:113`) — a geração protege contra troca de jogador durante o fetch.
  - `src/components/BannerLembrete.tsx:27,33,43,55` (4 refs) — **fora de escopo deste plano** (polling próprio `:74-78`, query inline fora da lib `:37-41`, countdown com `agora`): ver seção 6.
- **O mecanismo equivalente já existe** em `src/hooks/useCache.ts`:
  - `:70-77` — `executar()`: snapshot da geração da chave antes da busca; se a geração mudou quando a resposta chega (invalidação concorrente), a resposta **não** repovoa o cache.
  - `:131-139` — `revalidar()`: mesmo snapshot (`geracaoInicio`) + flag `ativo` de unmount, cobrindo também o caso "busca em voo quando o componente desmonta ou troca de chave".
- **`src/lib/chavesCache.ts`** (30 linhas) é a fonte única das chaves. Existem hoje: `CHAVE_JOGOS` (`:10`), `chaveResumo(ano)` (`:16`), `chaveRanking(filtro)` (`:21`) e `chaveComparador(idA, idB)` (`:26`) — o padrão de chave parametrizada ("prefixo estável + parâmetros da query após `:`") a ser seguido pelas chaves novas.
- **Precedente de consumo**: `src/routes/Ranking.tsx:143-146` — `useCache<LinhaRanking[]>(chaveRanking(posicaoFiltro), buscar)` com `buscar` em `useCallback` (`:141`, deps `[posicaoFiltro]`), e `recarregar` ligado ao `PullToRefresh` (`:217`). É o molde das duas migrações.
- **Queries das telas-alvo já estão na `lib`** (padrão "tela → lib → supabase" atendido): `carregarParesRacha` (`src/lib/partidas.ts:152`, com default `minPartidas = 5`); `carregarStatsJogador` (`src/lib/jogadores.ts:543-545`, overloads `number | number[]`), `carregarParceriasJogador` (`:618`), `carregarParceriasDestaque` (`:639`). Logo, o plano **07 não é pré-requisito** (ver seção 3).

## 3. Pré-condições e dependências

- **Plano 07 (queries fora da `lib`) NÃO é pré-requisito**, apesar do README sugerir a cadeia 07 → 05 → 06: as únicas queries fora da `lib` entre os 3 arquivos do D3 são as de `BannerLembrete` (`:37-41`), que está fora de escopo deste plano. Todas as queries das telas migradas já são funções da `lib` (seção 2). Executar antes do 07 é seguro; a cadeia completa continua valendo quando ela existir como planos.
- **Plano 05 recomendado antes** (não bloqueante): 05 já migra `listarJogadoresAtivosSemRandom` (`Estatisticas.tsx:57`, o dropdown de jogadores — segue de fora neste plano) e lista `carregarStatsJogador` em `Estatisticas.tsx:86` entre seus call sites. **Coordenação de escopo**: este plano absorve o site `Estatisticas.tsx:86` dentro do fetcher composto do Passo 2 (chave por jogador); quem executar em seguida risca esse site da lista do 05 (o site de `Perfil.tsx:48` continua sendo do 05). Ordem inversa também funciona, exigindo só esse reajuste de lista.
- **Sem dependência do plano 03**: as chaves novas NÃO entram em `invalidarCachesDependentesDePartida()` — o precedente consolidado é `chaveRanking`, que também não é invalidada pós-mutação e depende da revalidação on-mount/background do `useCache`. Registrar como opção (não execução): se o dono quiser frescor absoluto pós-mutação nas telas de estatísticas, uma linha no helper do 03 por chave constante resolve para pares-racha (chaves por jogador exigiriam `invalidarCache()` sem argumento — martelo grande, não recomendado).
- **Restrição de janela**: nenhuma — telas leitoras, fora do fluxo de partida; não há mutação nem partida ao vivo envolvida.
- **Decisão do dono exigida antes de executar**: nenhuma — assinaturas e estratégia de chave fechadas na seção 4.

## 4. Plano de execução (1 passo = 1 commit)

Ordem: `EstatisticasRacha` primeiro (S — leitura única, caso trivial do doc de origem), depois `Estatisticas` (M — chave por `jogadorSelecionadoId`). Nenhuma biblioteca nova; nenhum toque em `src/hooks/useCache.ts`.

### Passo 1 — Criar `chaveParesRacha` e migrar `EstatisticasRacha` · 1 commit

- **`src/lib/chavesCache.ts`** — adicionar ao fim (mesmo padrão de `chaveRanking`):

  ```ts
  /** Estatísticas do racha (RPC `pares_racha`): o mínimo de partidas em dupla entra na chave. */
  export function chaveParesRacha(minPartidas: number): string {
    return `pares-racha:${minPartidas}`;
  }
  ```

- **`src/routes/EstatisticasRacha.tsx`** — substituir o tripé de estado (`pares`/`carregando`/`erro`, `:71-73`), `geracaoRef` (`:85`), `carregar` (`:87-101`) e o `useEffect` (`:103-105`) por:

  ```ts
  const buscarPares = useCallback(() => carregarParesRacha(MIN_PARTIDAS), []);
  const { dados: pares, carregando, erro, recarregar } = useCache<ParRacha[]>(
    chaveParesRacha(MIN_PARTIDAS),
    buscarPares
  );
  ```

  Ajustes mecânicos: `<ParRacha[] | null>` vira `T | undefined` (`pares === null` → `pares === undefined` em `:137`; os `pares ? ... : []` dos `useMemo` não mudam); `onRefresh={carregar}` (`:142`) vira `onRefresh={recarregar}` (molde `Ranking.tsx:217`). **Obrigatório `useCallback`** — `buscar` instável revalida a cada render (contrato documentado em `useCache.ts:109-110`). Imports: sai `useRef`/`useEffect`/`formatarMensagemErro` (se sem uso), entram `useCache` e `chaveParesRacha`; `MIN_PARTIDAS` permanece local (usado em texto de UI além da query).
- Validar com `tsc -b`; `grep -n geracaoRef src/routes/EstatisticasRacha.tsx` vazio.
- Commit: "migra EstatisticasRacha para useCache, aposentando geracaoRef (D3)".

### Passo 2 — Criar fetcher composto + `chaveEstatisticasJogador` e migrar `Estatisticas` · 1 commit

- **`src/lib/jogadores.ts`** — ao lado das três funções que ele orquestra (coesão, sem camada nova):

  ```ts
  /** Conjunto de dados da aba "Por jogador" das estatísticas, buscado em paralelo. */
  export interface EstatisticasJogador {
    stats: StatsJogador | null;
    parcerias: Parceria[];
    destaques: Record<MetricaDestaque, ParceriaDestaque | undefined>;
  }

  export async function carregarEstatisticasJogador(jogadorId: number): Promise<EstatisticasJogador> {
    const [stats, parcerias, destaques] = await Promise.all([
      carregarStatsJogador(jogadorId),
      carregarParceriasJogador(jogadorId),
      carregarParceriasDestaque(jogadorId),
    ]);
    // mesmo mapeamento de array → lookup por métrica hoje em Estatisticas.tsx:97-105
    ...
  }
  ```

- **`src/lib/chavesCache.ts`** — `export function chaveEstatisticasJogador(jogadorId: number): string { return \`estatisticas-jogador:\${jogadorId}\`; }` (padrão `chaveComparador`).
- **`src/routes/Estatisticas.tsx`** — remover `stats`/`parcerias`/`destaques` (`:34-42`), `geracaoRef` (`:75`), `carregar` (`:77-113`) e o `useEffect` de carregamento (`:115-117`); o efeito do dropdown (`:54-70`, `listarJogadoresAtivosSemRandom`) **permanece** (escopo do plano 05). Novo consumo:

  ```ts
  const { dados, carregando, erro, recarregar } = useCache<EstatisticasJogador>(
    chaveEstatisticasJogador(jogadorSelecionadoId ?? -1),
    useCallback(async () => {
      if (jogadorSelecionadoId === null) {
        return { stats: null, parcerias: [], destaques: { mais_gols: undefined, melhor_nota: undefined, pior_nota: undefined } };
      }
      return carregarEstatisticasJogador(jogadorSelecionadoId);
    }, [jogadorSelecionadoId])
  );
  ```

  (forma exata a ajustar na implementação: a chave usa sentinela `-1` quando nada selecionado e o fetcher guarda `null` — mesmo espírito de `chaveComparador` com `'-'`; derive `stats = dados?.stats`, `parcerias = dados?.parcerias ?? []` etc. para os `useMemo` existentes; `onRefresh={recarregar}` no `PullToRefresh`.)
  A troca de jogador deixa de depender de `geracaoRef`: mudar a chave com o componente montado é tratado nativamente (`useCache.ts:119-125` — serve o cache da nova chave e descarta resposta da anterior via geração).
- Validar com `tsc -b`; `grep -rn geracaoRef src/` deve retornar só `BannerLembrete.tsx`.
- Commit: "migra Estatisticas (por jogador) para useCache via fetcher composto (D3)".

Total: 2 commits. Comportamento de rede muda para melhor (revisitas sem skeleton, dedupe de buscas concorrentes); render e regras de UI intocados.

## 5. Validação manual

Sem testes automáticos (AGENTS.md). Checklist no aparelho/build:

- [ ] `npm run build` (ou `tsc -b`) sem erros; `grep -rn geracaoRef src/` retorna apenas `BannerLembrete.tsx`.
- [ ] **EstatisticasRacha — primeira visita**: skeleton aparece e a tabela carrega (fluxo idêntico ao de hoje).
- [ ] **Revisita**: navegar Resumo → Estatísticas/Racha de novo — tabela aparece **instantaneamente** (cache) e atualiza em background (network tab: 1 request de revalidação).
- [ ] **Pull-to-refresh** em Racha: indicador segura até a resposta e a tabela reflete (caso novo dado de partida).
- [ ] **Offline com cache**: modo avião em revisita — tela serve dado local (banner offline); **offline sem cache** (aba limpa): mensagem de erro, como hoje.
- [ ] **Estatisticas — troca de jogador** no dropdown, trocas rápidas em sequência: a tela final reflete o jogador selecionado (sem resposta cruzada de requisição antiga — a proteção que `geracaoRef` fazia).
- [ ] **Estatisticas — revisita / pull-to-refresh / offline**: mesmos três cenários do bloco anterior.
- [ ] Ordenação de colunas, abas por swipe e seção "Melhor/Pior dupla" seguem funcionando (lógica local, não migrada).
- [ ] **BannerLembrete** continua aparecendo com votação aberta e countdown correndo (arquivo não tocado — sanity check).
- [ ] Nenhuma outra tela regrediu (as mudanças são confinadas aos 2 arquivos de rota + 2 da `lib`).

## 6. Fora de escopo

- **`BannerLembrete.tsx` NÃO migra — exceção legítima, documentada**: não é tela leitora simples. Faz **polling próprio com intervalo adaptativo** (30 s com pendentes / 5 min sem — `:74-78`), pula busca em aba em segundo plano e re-verifica no `visibilitychange` (`:80-87`), mantém tick de countdown separado (`:90-94`), trata falha de polling **silenciosamente** mantendo o último estado (`:62-64`) e roda sobre query inline fora da `lib` (`:37-41`) que pertence ao plano **07** (`carregarPartidasComVotacaoAberta`). Encaixar isso no `useCache` (fechado a ouvintes de invalidação, sem noção de intervalo) exigiria estender o hook — o oposto do objetivo deste plano. O `geracaoRef` local dele (4 refs) protege contra troca de jogador logado durante o polling e permanece.
- **NÃO migrar as telas de partida** (`PartidaDetalhe`, `PartidaAoVivo`, `PartidaVotar`, `PartidaEditar`, `PartidaTimes`): estado interdependente de partida/eventos/votos, mutação-pesada e polling de ao-vivo — o fetch manual é justificado lá (posição reiterada pelo doc de origem).
- **Não** migrar o dropdown de jogadores de `Estatisticas` (`listarJogadoresAtivosSemRandom`, `:54-70`) — é item do plano **05** (chaves `CHAVE_ELENCO_*`).
- **Não** tocar em `src/hooks/useCache.ts` (nenhuma extensão de hook, nenhuma opção nova).
- **Não** adicionar as chaves novas a `invalidarCachesDependentesDePartida()` (plano 03) — precedente `chaveRanking` + revalidação on-mount cobrem; opção registrada na seção 3.
- **Não** mexer em `Perfil.tsx` (site `carregarStatsJogador` de lá é do plano 05) nem renomear/mover funções existentes da `lib`.

## 7. Riscos e rollback

- **Risco: mudança sutil de semântica de frescor** — hoje as telas são sempre fresh-on-mount; com `useCache`, revisita mostra cache e revalida em background (dado pode levar ~1 s para atualizar após uma partida encerrada). Mitigado: é exatamente a semântica já aceita em `Ranking` e `Comparador`; validação manual cobre o cenário "pull após partida". Se o dono rejeitar, rollback do passo devolve o comportamento.
- **Risco: erro de revalidação ficar silencioso com cache presente** — semântica documentada do `useCache` (`:103-107`: erro só aparece quando não há nada a exibir); tela continua utilizável. Aceito por precedência; sem mitigação adicional neste plano.
- **Risco: loop de revalidação por fetcher instável** — `buscar`/`buscarPares` **precisam** de `useCallback` com deps corretas (contrato `useCache.ts:109-110`); sintoma visível imediatamente em rede. Coberto no passo a passo e na validação.
- **Risco: `chaveEstatisticasJogador` com sentinela** (`-1`/`null`-guard) pode cachejar estado vazio sob a chave sentinela — inofensivo (estado vazio é determinístico) e confinado ao pré-seleção do dropdown.
- **Rollback do Passo 1**: `git revert` isolado — restaura tripé + `geracaoRef` de `EstatisticasRacha`; `chaveParesRacha` sai junto (não há outro leitor). `Estatisticas` nem é tocada.
- **Rollback do Passo 2**: `git revert` isolado — restaura o estado de `Estatisticas` e remove `carregarEstatisticasJogador`/`chaveEstatisticasJogador`. Os dois passos são independentes: reverter um não afeta o outro.
- **Débito a registrar (não corrigir aqui)**: sobreposição do site `Estatisticas.tsx:86` (`carregarStatsJogador`) entre os planos 05 e 06 — riscar da lista do que executar por último (seção 3); e a opção de frescor absoluto pós-mutação via uma linha no helper do plano 03, se um dia o dono a quiser.
