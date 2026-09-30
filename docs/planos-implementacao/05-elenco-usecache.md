# 05 · Servir elenco e derivados pelo cache SWR existente — Plano de Implementação

> Ref.: item **D2** do `docs/plano-melhorias-frontend-pwa.md` · Ranking anti-slop: **#5 (nota 7,0)**, Tier 2 (`docs/rank-melhorias-reuso-codigo.md`)
> Esforço estimado: M · Risco: baixo-moderado · Prioridade global do plano: P1

## 1. Objetivo

Substituir o boilerplate `useEffect`+`useState` de fetch de elenco — reinventado em **~15 call sites de 10 arquivos** — pelo hook `useCache` (SWR) que já existe e é superior: navegar Resumo → Jogos → Nova partida → Detalhe hoje dispara **4+ fetches do mesmo elenco na mesma sessão**; migrado, cada tela vira 1–2 linhas declarativas e a segunda visita sai do cache em memória. O ganho é duplo: menos código duplicado (o mesmo padrão copiado 15 vezes, não trechos idênticos) e menos requisição em rede móvel. **Nenhum mecanismo novo** — só chaves novas em `lib/chavesCache.ts`, migração dos leitores e invalidação nos pontos de mutação.

## 2. Estado atual (evidências verificadas)

Verificado no código em **30/09/2026**; todas as linhas do doc de origem conferidas e corretas:

**Leitores sem cache (`useEffect`+`useState` manual):**

- `listarJogadoresAtivos()` — `src/routes/Administrador.tsx:55` (dentro de `Promise.allSettled`, com filtro local `isRandomUsername` e tolerância a falha: dropdown vazio sem derrubar o resto da tela); `src/routes/PartidaEditar.tsx:68` e `src/routes/PartidaNova.tsx:67` (dentro de `Promise.all` com partida/participantes); `src/routes/PartidaTimes.tsx:102`; `src/components/ConfirmacoesPartida.tsx:249` (fetch **lazy**, só quando o painel de avulsos é aberto).
- `listarTodosJogadores()` — `src/routes/Comparador.tsx:71` (effect próprio, falha silenciosa de propósito) e `src/routes/GestaoJogadores.tsx:60`.
- `listarJogadoresAtivosSemRandom()` — `src/routes/Estatisticas.tsx:57` (effect próprio, falha silenciosa).
- `listarGoleiros()` — `src/routes/GestaoGoleiros.tsx:63` **+ refetches pós-mutação** `:91` (criar), `:130` (editar PIX/telefone), `:148` (alternar status); `src/routes/PartidaTimes.tsx:103` **+ refetch** `:167` (pós `criarGoleiroRapido`).
- `listarUsernames()` — `src/routes/Login.tsx:39`.

**Derivados re-buscados sem cache:**

- `obterMediasNotasJogadores()` — `src/routes/PartidaTimes.tsx:104`; `src/routes/Comparador.tsx:96` (aqui **dentro** do fetcher do `useCache(chaveComparador(idA, idB))`, ou seja: re-buscada a cada troca de par).
- `obterPartidasRecentesJogadores(2)` — `src/routes/PartidaNova.tsx:67` e `src/components/ConfirmacoesPartida.tsx:250`.
- `carregarStatsJogador(...)` — `src/routes/Perfil.tsx:48` (individual); `src/routes/Estatisticas.tsx:86` (individual, dentro do fetch composto com `geracaoRef` manual — território do plano 06); `src/routes/Comparador.tsx:95` (lote `[idA, idB]`, já dentro do cache `chaveComparador`).

**Infraestrutura existente (nada a criar):**

- `src/hooks/useCache.ts` — SWR em memória de módulo (sobrevive a unmount/remount): dedupe de buscas concorrentes (`emVoo`, `:8-9`), proteção contra resposta obsoleta por geração (`:12-13`, `:70-77`, `:131-139`), troca de chave com componente montado (`:123-125`), `invalidarCache(chave?)` que notifica ouvintes montados para revalidar (`:39-58`), `recarregar` para o PullToRefresh (`:166-179`). Erro de revalidação com dado em tela é silencioso; `carregando` só na primeira visita.
- `src/lib/chavesCache.ts` (29 linhas) — **fonte única das chaves** por design; exporta `CHAVE_JOGOS`, `chaveResumo(ano)`, `chaveRanking(filtro)`, `chaveComparador(idA, idB)`. Telas nunca montam strings de chave à mão.
- Consumidores atuais de `useCache`: `Resumo`, `Jogos`, `Ranking`, `Comparador`, `PartidaAoVivo`, `PartidaDetalhe`, `PartidaNova`, `PartidaTimes`, `PartidaEditar` (grep confirmado).

**Mutações de elenco (pontos de invalidação):**

- `src/routes/NovoJogador.tsx:64` — `criarJogador(...)`.
- `src/routes/GestaoJogadores.tsx:266` — `salvarCaracteristicasJogadores(...)` (lote RPC mensalista/admin; hoje confirma otimisticamente com `setJogadores(jogadoresDraft)` em `:269`, sem invalidar ninguém).
- `src/routes/GestaoGoleiros.tsx:90` (`criarGoleiroRapido`), `:122-129` (`atualizarDadosPixTelefone`), `:147` (`alternarStatusAtivoJogador`) — todas seguidas de refetch local de `listarGoleiros()`.
- `src/routes/PartidaTimes.tsx:166-167` — `criarGoleiroRapido` + refetch local de `listarGoleiros()`.
- `src/routes/PartidaVotar.tsx:245` — `registrarVotos(...)` altera as **médias de notas**, hoje sem invalidação nenhuma.
- `COLUNAS_JOGADOR_LISTA` (`src/lib/jogadores.ts:42`) **inclui `chave_pix` e `telefone`** — logo, depois de editar PIX/telefone, qualquer lista de elenco em cache está obsoleta. É o motivo da exceção da seção 6.

**Pré-requisito pendente (plano 07):** `src/routes/PartidaNova.tsx:158` chama a RPC `criar_partida` direto do componente — única mutação fora da `lib`; transposição feita pelo plano 07.

## 3. Pré-condições e dependências

- **Plano 07 (`queries-fora-da-lib.md`, D5) DEVE vir antes** — dependência declarada no ranking (#7: "pré-requisito do D2 — queries fora da lib não são cacheáveis") e no `README.md` deste diretório (cadeia **07 → 05 → 06**). Em especial, `criar_partida` precisa estar em `lib/` antes que `PartidaNova` seja reescrito em volta do `useCache`.
- **Plano 03 (`helper-invalidacao-partida.md`, D1) executado antes** — o Passo 1 deste plano **estende** `invalidarCachesDependentesDePartida()` criado por ele (exatamente como o próprio plano 03 antecipa na seção 3: "as chaves novas do plano 05 passarão a ser invalidadas dentro do helper").
- **Relacionado, não bloqueante**: plano 06 (`aposentar-geracao-ref.md`) reestrutura `Estatisticas`; por isso este plano **não** toca o fetch composto de `Estatisticas` (ver seção 6).
- **Decisão do dono exigida antes de executar (uma só)**: aceitar que `carregarStatsJogador` por jogador (chave `stats-jogador:<id>`) **não é invalidável por chave** quando uma partida é publicada — o helper do plano 03 não tem como enumerar ids. O grau de obsolescência é exatamente o **já aceito hoje** no `Comparador` (stats loteadas sob `chaveComparador`, nunca invalidadas na publicação). Se não aceitar, excluir o Passo 4b e registrar em `34-debitos-registrados.md`.
- **Restrição de janela**: o Passo 2 toca as telas do fluxo de partida (`PartidaNova`, `PartidaEditar`, `PartidaTimes`, `ConfirmacoesPartida`). Executar **fora de janela de rachas ao vivo**.

## 4. Plano de execução (1 passo = 1 commit)

Abordagem: **sem mecanismo novo**. Chaves novas em `lib/chavesCache.ts` (fonte única), invalidação centralizada nas mutações e no helper do plano 03, migração dos leitores tela a tela consumindo `{ dados, carregando, erro }` do hook em vez de estado espelhado. Ordem deliberada: primeiro invalidação (inerte, sem leitor migrado), depois grupos de telas por commit.

### Passo 1 — Chaves novas + invalidação nas mutações (commit inerte) · 1 commit

- **`src/lib/chavesCache.ts`** — adicionar ao fim:

  ```ts
  /** Elenco ativo (inclui randoms) para escalação/confirmação/edição de partidas. */
  export const CHAVE_ELENCO_ATIVO = 'elenco:ativos';

  /** Elenco completo (exclui randoms) para gestão e comparador. */
  export const CHAVE_ELENCO_TODOS = 'elenco:todos';

  /** Atletas reais ativos (id+username) para seletores de estatísticas. */
  export const CHAVE_ELENCO_SEM_RANDOM = 'elenco:ativos-reais';

  /** Goleiros ativos e inativos. */
  export const CHAVE_GOLEIROS = 'elenco:goleiros';

  /** Usernames reais (exclui randoms) para o autocomplete do login. */
  export const CHAVE_USERNAMES = 'jogadores:usernames';

  /** Médias de notas aparadas por atleta (RPC `obter_medias_notas_jogadores`). */
  export const CHAVE_MEDIAS_NOTAS = 'jogadores:medias-notas';

  /** Presenças recentes por atleta; os meses entram na chave (hoje só se usa 2). */
  export function chavePartidasRecentesJogadores(meses: number): string {
    return `jogadores:partidas-recentes:${meses}`;
  }

  /** Stats da temporada de um atleta (view `stats_jogador`). */
  export function chaveStatsJogador(jogadorId: number): string {
    return `stats-jogador:${jogadorId}`;
  }
  ```

- **`src/lib/chavesCache.ts`** — estender `invalidarCachesDependentesDePartida()` (criada no plano 03) com as derivadas **inteiras** de partida:

  ```ts
  invalidarCache(CHAVE_MEDIAS_NOTAS);
  invalidarCache(chavePartidasRecentesJogadores(2));
  ```

  (Stats por jogador ficam de fora — ver decisão da seção 3.)

- **`src/routes/NovoJogador.tsx`** — após sucesso de `criarJogador` (`:64`): `invalidarCache(CHAVE_ELENCO_ATIVO); invalidarCache(CHAVE_ELENCO_TODOS); invalidarCache(CHAVE_ELENCO_SEM_RANDOM); invalidarCache(CHAVE_GOLEIROS); invalidarCache(CHAVE_USERNAMES);` (o novo jogador pode ser goleiro e entra no autocomplete do login).
- **`src/routes/GestaoJogadores.tsx`** — após sucesso de `salvarCaracteristicasJogadores` (`:266`): `invalidarCache(CHAVE_ELENCO_ATIVO); invalidarCache(CHAVE_ELENCO_TODOS); invalidarCache(CHAVE_GOLEIROS);` (mensalista/admin/status mudam o `JogadorLista` que outras telas exibem). O commit otimista local (`:269`) permanece.
- **`src/routes/GestaoGoleiros.tsx`** — nos três pontos de mutação (`:90`, `:122-129`, `:147`): invalidar `CHAVE_GOLEIROS`, `CHAVE_ELENCO_ATIVO`, `CHAVE_ELENCO_TODOS` (PIX/telefone fazem parte de `JogadorLista`). Os refetches locais permanecem (exceção, seção 6).
- **`src/routes/PartidaTimes.tsx`** — em `handleSalvarNovoGoleiro` (`:166`): invalidar as mesmas três chaves (o refetch local é removido no Passo 2).
- **`src/routes/PartidaVotar.tsx`** — após sucesso de `registrarVotos` (`:245`): `invalidarCache(CHAVE_MEDIAS_NOTAS);`.
- Nenhum leitor migrado neste passo: o commit é funcionalmente inerte (invalidar chave sem leitor é no-op) e trivialmente revertível.
- Commit: "adiciona chaves de elenco/derivados e invalidação nas mutações (D2)".

### Passo 2 — Fluxo de partida (maior ganho: 4+ fetches → cache) · 1 commit

Migrar `PartidaNova`, `PartidaEditar`, `PartidaTimes`, `ConfirmacoesPartida`:

- **`src/routes/PartidaNova.tsx`** — substituir o carregamento do `Promise.all` (`:67`) por dois hooks: `useCache(CHAVE_ELENCO_ATIVO, listarJogadoresAtivos)` e `useCache(chavePartidasRecentesJogadores(2), () => obterPartidasRecentesJogadores(2))`. As listas passam a ser derivadas (`const jogadores = dados ?? []`); `carregando` da tela vira a combinação do hook com o estado local restante. Manter intactos: hidratação de `localStorage`, rascunho de selecionados e `criar_partida` (já em `lib` pelo plano 07).
- **`src/routes/PartidaEditar.tsx`** — tirar `listarJogadoresAtivos()` do `Promise.all` (`:68`); `useCache(CHAVE_ELENCO_ATIVO, listarJogadoresAtivos)`; o efeito fica só com `carregarPartida`+`carregarParticipantes`; `carregando` combinado.
- **`src/routes/PartidaTimes.tsx`** — tirar os três fetches do `Promise.all` (`:102-104`): `useCache(CHAVE_ELENCO_ATIVO, ...)`, `useCache(CHAVE_GOLEIROS, listarGoleiros)`, `useCache(CHAVE_MEDIAS_NOTAS, obterMediasNotasJogadores)`. Em `handleSalvarNovoGoleiro`, remover o refetch local de `listarGoleiros()` (`:167`) — a invalidação do Passo 1 revalida o hook montado — mantendo apenas `setGoleiroA/B(novoId)`.
- **`src/components/ConfirmacoesPartida.tsx`** — `useCache(CHAVE_ELENCO_ATIVO, ...)` + `useCache(chavePartidasRecentesJogadores(2), ...)`; os candidatos avulsos derivam de `dados`. **Nota de comportamento**: hoje o fetch é lazy (só ao abrir o painel de avulsos, `:249`); passa a ocorrer no mount — em virtually toda navegação a chave já está quente (veio de Nova partida/Detalhe), então é cache hit ou dedupe, sem requisição nova. Aceito e verificado na validação.
- Commit: "serve elenco/goleiros/médias das telas de partida pelo useCache (D2)".

### Passo 3 — Administração e acesso · 1 commit

- **`src/routes/Administrador.tsx`** — `useCache(CHAVE_ELENCO_ATIVO, listarJogadoresAtivos)`; o filtro `isRandomUsername` local e a tolerância a falha permanecem (com `erro` e sem `dados`, o dropdown fica vazio como hoje — o `useCache` só expõe `erro` quando não há dado em tela, semântica compatível).
- **`src/routes/Login.tsx`** — `useCache(CHAVE_USERNAMES, listarUsernames)` no lugar do effect `:39`; `carregandoUsernames`/`erroUsernames` saem do hook.
- Commit: "serve elenco do administrador e usernames do login pelo useCache (D2)".

### Passo 4 — Estatísticas leves (Comparador e Perfil) · 1 commit

- **`src/routes/Comparador.tsx`** — (a) elenco dos seletores: trocar o effect `:71-85` por `useCache(CHAVE_ELENCO_TODOS, listarTodosJogadores)`; (b) médias: tirar `obterMediasNotasJogadores()` do fetcher do par (`:96`) e servir de `useCache(CHAVE_MEDIAS_NOTAS, obterMediasNotasJogadores)`, mesclando no resultado exibido — a chave do comparador deixa de re-buscar as médias a cada troca de par. `carregarStatsJogador([idA, idB])` (`:95`) e `compararJogadores` permanecem no fetcher sob `chaveComparador` (escopo do plano 06/D3 não; decisão: não mexer).
- **`src/routes/Perfil.tsx`** (Passo 4b, mesmo commit) — trocar o effect `:48` por `useCache(chaveStatsJogador(jogadorId), () => carregarStatsJogador(jogadorId))`; a troca de chave com componente montado já é resolvida pelo hook (`useCache.ts:123-125`); `carregandoStats` sai do hook.
- Commit: "serve elenco do comparador e stats do perfil pelo useCache (D2)".

**`GestaoJogadores` (`:60`) NÃO é migrado** — fica na exceção da seção 6. Com isso, o inventário final de call sites migrados é 13 dos ~15; os 2 restantes são exceções documentadas.

## 5. Validação manual

Sem testes automáticos (AGENTS.md). Por passo, no aparelho/build:

- [ ] `npm run build` (ou `tsc -b`) sem erros.
- [ ] **Passo 1**: executar cada mutação (criar jogador, salvar lote em Gestão de Atletas, criar/editar/ativar goleiro, salvar times, votar) sem erro visível; comportamento das telas idêntico ao de hoje (o passo é inerte para o usuário).
- [ ] **Passo 2 — ganho principal**: com DevTools/aba Network, navegar Resumo → Jogos → Nova partida → voltar → Nova partida de novo: a segunda visita a `PartidaNova` **não** dispara fetch de `jogadores`/`partidas_recentes` (sai do cache; só revalidação silenciosa se a tela remontar — conferir que o dado serve instantâneo).
- [ ] `PartidaNova`: criar partida com elenco salvo em rascunho (`localStorage`) segue funcionando; erro de rede exibe mensagem como hoje.
- [ ] `PartidaTimes`: salvar times; criar goleiro rápido pelo modal — o novo goleiro aparece na listagem de goleiros sem recarregar a tela (revalidação via invalidação) e vai para o time escolhido.
- [ ] `PartidaEditar`: abrir edição de partida existente — campos e elenco corretos.
- [ ] `ConfirmacoesPartida`: abrir painel de avulsos — lista aparece; presença/recusa continuam funcionando.
- [ ] **Passo 3**: `Administrador` — dropdown de jogador do formulário financeiro popula; falha simulada (offline) deixa dropdown vazio sem quebrar o resto, como hoje. `Login` — autocomplete de usernames funciona; criar jogador novo e voltar ao login mostra o nome novo (invalidação do Passo 1).
- [ ] **Passo 4**: `Comparador` — trocar o par de atletas não re-busca as médias (uma requisição a menos por comparação); confronto e stats corretos. `Perfil` — stats corretos ao abrir e ao trocar de jogador logado.
- [ ] **Consistência pós-mutação** (fluxo fim a fim): criar jogador → Nova partida lista o novo; desativar atleta em Gestão de Atletas → ele sai do elenco de Nova partida; editar PIX de goleiro em Gestão de Goleiros → dado novo visível na própria tela (refetch local da exceção); votar → médias novas no Comparador/PartidaTimes após revalidação.
- [ ] PullToRefresh nas telas que o têm continua funcionando (nenhuma tela migrada usa `recarregar` neste plano, mas o hook é compartilhado).

## 6. Fora de escopo

- **Não migrar `GestaoGoleiros` nem `GestaoJogadores` para `useCache`** — são telas de edição (drafts, PIX/telefone, lote otimista) cujo refetch local pós-mutação é o comportamento correto; elas apenas passam a **invalidar** as chaves compartilhadas (Passo 1). É a exceção "telas que editam PIX/telefone mantêm refetch local" do doc de origem.
- **Não migrar o fetch composto de `Estatisticas`** (`:86`, stats+parcerias+destaques com `geracaoRef` e PullToRefresh) — território do plano 06; migrar aqui duplicaria o esforço e misturaria escopos. Seu seletor de elenco (`:57`) idem: fica para o 06, que já reescreve o arquivo.
- **Não criar mecanismo de invalidação por prefixo/padrão** (para invalidar `stats-jogador:*` de uma vez) — YAGNI; se um dia for preciso, vira item próprio.
- **Não criar hooks de domínio** tipo `useElenco()` — a chamada `useCache(CHAVE_ELENCO_ATIVO, listarJogadoresAtivos)` na tela é explícita e suficiente (AGENTS.md: sem abstração sem demanda).
- **Não tocar** nas funções de `src/lib/jogadores.ts` (assinaturas, filtros de random, notas de design) nem no `src/hooks/useCache.ts`.
- **Não migrar** `PartidaDetalhe`, `PartidaAoVivo`, `PartidaVotar` (estado interdependente de partida, fora do escopo D2) nem o cache HTTP do `sw.js` (este plano é cache de memória de sessão).
- **Não** alterar o comportamento lazy de mais nenhum fetch além do aceito em `ConfirmacoesPartida` (documentado no Passo 2).

## 7. Riscos e rollback

- **Risco principal: dado levemente obsoleto** se uma mutação de elenco esquecer a invalidação. Mitigações: as invalidações ficam prontas **antes** de qualquer leitor migrar (Passo 1), centralizadas nos 4 arquivos de mutação existentes; a semântica do `useCache` limita o dano (revalida em background ao remontar/invalidar; erro com dado em tela não derruba a tela). Checklist "Consistência pós-mutação" da seção 5 cobre cada par mutação→leitor.
- **Risco aceito e explícito**: stats por jogador (`chaveStatsJogador`) ficam obsoletos dentro da sessão que atravessa uma publicação de partida — mesmo grau já aceito hoje no `Comparador` (`chaveComparador` nunca é invalidada). Registrado como decisão do dono (seção 3).
- **Risco de regressão no fluxo de partida** (Passo 2 é o maior): a reescrita troca estado espelhado por dados derivados do hook; o erro mais provável é mecânico (estado não derivado, `carregando` mal combinado), coberto pelo `tsc -b` e pela validação tela a tela. Janela fora de racha ao vivo.
- **Rollback**: cada passo é um commit isolado e revertível por `git revert`:
  - Reverter o Passo 4: telas voltam ao fetch manual; chaves/invalidações dos passos anteriores permanecem (inofensivas).
  - Reverter o Passo 3 ou 2: idem — cada tela volta individualmente ao `useEffect`+`useState` original.
  - Reverter o Passo 1: remove chaves e invalidações; nenhum leitor dependia delas ainda (só revertê-lo se os passos seguintes já tiverem caído).
  - Revert em faixa (1→4) restaura o estado original por completo; nada neste plano é destrutivo (nenhuma função de `lib` ou do hook muda).
- **Débito a registrar (não corrigir aqui)**: invalidação de `stats-jogador:*` após publicação de partida (aguarda mecanismo por prefixo) — anotar em `34-debitos-registrados.md` se a decisão da seção 3 for aceitar.
