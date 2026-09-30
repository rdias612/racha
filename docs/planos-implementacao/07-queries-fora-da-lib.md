# 07 · Consolidar as últimas queries fora da `lib` — Plano de Implementação

> Ref.: item **D5** do `docs/plano-melhorias-frontend-pwa.md` · Ranking anti-slop: **#7 (nota 6,0)**, Tier 2 (`docs/rank-melhorias-reuso-codigo.md`)
> Esforço estimado: S · Risco: mínimo · Prioridade global do plano: P2

## 1. Objetivo

Mover para `lib/` as **4 últimas queries Supabase escritas inline em componentes**, completando o padrão "tela → lib → supabase" já estabelecido pelas ~39 funções RPC/consulta existentes. A duplicação aqui não é de trecho idêntico, é de **inconsistência arquitetural**: 4 sites fogem do padrão que o resto do código segue, e cada um deles é uma query que não pode virar cacheável nem ser reaproveitada por um segundo consumidor (é o caso imediato da função de votação aberta, que o `BannerLembrete` hoje esconde dentro do próprio polling). Todas as migrações são **transposições literais** — polling, geração de requisição e countdown permanecem nos componentes; nenhuma função muda de assinatura visível para a UI.

## 2. Estado atual (evidências verificadas)

Verificado no código em **30/09/2026**. As 4 linhas do doc de origem conferem (corrigida apenas a extensão do trecho do `Ranking`, que se estende até o fechamento do filtro, abaixo):

- **`src/routes/Jogos.tsx:51-54`** — view `partidas_com_placar` (migration 071) com `select` + `order('data_jogo', desc)`, inline no `buscar` do `useCache(CHAVE_JOGOS, buscar)` (`:72`); o mapeamento de linhas → `{ partidas, placares }` está em `:57-69` com tipos locais `Partida`/`Placar`/`DadosJogos` (`:21-36`). Único uso de `supabase` no arquivo (grep confirmado).
- **`src/routes/Ranking.tsx:108-125`** — view `ranking` com `select` fixo, 6 `order` encadeados e `eq('posicao', posicaoFiltro)` condicional (`:120-122`), inline no `buscar` do `useCache(chaveRanking(posicaoFiltro), buscar)` (`:143-146`); mapeamento tolerante a nulos `:126-140` retorna `LinhaRanking[]` (interface local `:47-59`). Único uso de `supabase` no arquivo.
- **`src/components/BannerLembrete.tsx:37-41`** — query em `partidas` com `eq('status', 'published')` + `gt('voting_closes_at', now)`, inline no `verificar` do polling (`:29-65`); o filtro "ainda não votadas" (`carregarPartidasVotadas` + `votacaoAberta`, `:51-61`) depende do `jogadorId` da sessão. Único uso de `supabase` no arquivo.
- **`src/routes/PartidaNova.tsx:158-165`** — RPC `criar_partida` com payload `{ p_data_jogo, p_criado_por, p_participantes }` montado em `:145-156` (participantes com `jogador_id/posicao/time/gols/assistencias/gols_contra`), inline em `handleCriarEEscalar` — **única mutação fora da `lib`**. Tratamento pós-sucesso (limpeza de rascunho `:167-171`, invalidações `:173-174`, `navigate` `:176`) e pós-erro (`:177-180`) é fluxo de tela. Único uso de `supabase` no arquivo.
- **`src/context/SessaoContext.tsx:50-54`** — query em `jogadores` dentro de `sincronizarJogador`: **aceitável e fora de escopo** — o contexto é dono do estado de sessão (doc de origem positiona assim; coerente com plano 05/06, que também não o tocam).
- **Padrão de destino existente**: `src/lib/partidas.ts` concentra `carregarPartida` (`:69`), `carregarPlacar` (`:79`), `carregarPartidasVotadas` (`:182`), mutações (`abrirPartida` `:270`, `finalizarPartida` `:319`) e o helper puro `votacaoAberta` (`:543`). `src/lib/chavesCache.ts` já tem `CHAVE_JOGOS` (`:10`) e `chaveRanking(filtro)` (`:21`). **Não existe** módulo de domínio para ranking (grep confirmado) — as constantes de métrica vivem no componente (`Ranking.tsx:35-40`).
- Os 4 componentes já consomem `useCache`/`invalidarCache` corretamente; a query inline é o único ponto fora do padrão em cada um deles.

## 3. Pré-condições e dependências

- **Este plano PRECEDE o plano 05** (`elenco-usecache.md`, D2) — dependência declarada no ranking (#7: "queries fora da lib não são cacheáveis"), no `README.md` deste diretório (cadeia **07 → 05 → 06**) e no próprio plano 05 (seção 2, último bullet: "`criar_partida` precisa estar em `lib/` antes que `PartidaNova` seja reescrita em volta do `useCache`"). As funções criadas aqui tornam as queries de tela elegíveis a chaves de cache no 05.
- **Coordenação com o plano 06** (`aposentar-geracao-ref.md`): a seção 6 daquele plano já cita a query inline de `BannerLembrete` (`:37-41`) como "pertencente ao plano 07 (`carregarPartidasComVotacaoAberta`)". Não há sobreposição de arquivos: o 06 **não** toca `BannerLembrete` (exceção documentada), e este plano **não** aposenta o `geracaoRef` dele — apenas extrai a query. Ordem entre 06 e 07 é livre.
- **Sem dependência do plano 03** (helper de invalidação): nenhuma chave nova é criada aqui (`CHAVE_JOGOS` e `chaveRanking` já existem) e a mutação `criarPartida` mantém as invalidações no call site, exatamente como hoje.
- **Decisão do dono exigida antes de executar**: nenhuma — nomes, módulos e assinaturas fechados na seção 4 (seguem a proposta nominal do doc de origem).
- **Restrição de janela**: nenhuma crítica. Os 4 passos são transposições mecânicas sem mudança de comportamento; se executado durante partida ao vivo, ainda assim não há risco (nenhuma tela de partida ao vivo é tocada).

## 4. Plano de execução (1 passo = 1 commit)

Um commit por query, ordem arbitrária entre passos (cada um é independente); a ordem abaixo vai do maior consumo (mural) à mutação. Nenhuma biblioteca nova; nenhum toque em `useCache.ts`, `chavesCache.ts` ou `SessaoContext.tsx`.

### Passo 1 — `carregarMuralJogos()` (Jogos) · 1 commit

- **`src/lib/partidas.ts`** — ao lado de `carregarPlacar` (coesão de domínio), adicionar tipos e função, transpondo literalmente `Jogos.tsx:50-70` (query, ordenação, mapeamento e tolerância a nulos idênticos):

  ```ts
  /** Partida como exibida no mural (view `partidas_com_placar`): só os campos da tela. */
  export interface PartidaMural {
    id: number;
    data_jogo: string;
    status: StatusPartida;
  }

  /** Placar do mural, indexável por id de partida. */
  export interface PlacarMural {
    partida_id: number;
    gols_time_a: number;
    gols_time_b: number;
  }

  /** Conteúdo do mural de jogos: partidas + placares lookup. */
  export interface MuralJogos {
    partidas: PartidaMural[];
    placares: Record<number, PlacarMural>;
  }

  /** Mural completo (view `partidas_com_placar`), mais recente primeiro. */
  export async function carregarMuralJogos(): Promise<MuralJogos> { ... }
  ```

  (tipos estreitos de tela de propósito — as interfaces `Partida`/`Placar` já existentes na `lib` têm campos que a view não retorna; derivação por `database.types.ts` é território do plano 10/D4.)
- **`src/routes/Jogos.tsx`** — remover interfaces locais `Partida`/`Placar`/`DadosJogos` (`:21-36`) e o corpo do `buscar`; o hook passa a ser `useCache<MuralJogos>(CHAVE_JOGOS, useCallback(() => carregarMuralJogos(), []))` (ou `buscar` delegando à função da lib — forma exata ao gosto do revisor, desde que `useCallback` com deps `[]` permaneça, contrato `useCache.ts:109-110`). Os usos de tipo no arquivo passam a importar `PartidaMural`/`MuralJogos` de `../lib/partidas`. Sai o `import { supabase }`.
- Commit: "move query do mural de jogos para carregarMuralJogos na lib (D5)".

### Passo 2 — `carregarRanking(filtro)` + módulo `lib/ranking.ts` (Ranking) · 1 commit

- **`src/lib/ranking.ts`** (novo — não há módulo de domínio para ranking; as constantes de métrica de UI permanecem no componente) — transpor `Ranking.tsx:107-140` literalmente:

  ```ts
  import { supabase } from './supabase';
  import type { PosicaoId } from './times';

  /** Linha da view `ranking`. */
  export interface LinhaRanking { ... }  // interface hoje em Ranking.tsx:47-59, sem mudança

  /** Ranking da temporada pela view `ranking`, filtrado por posição. */
  export async function carregarRanking(filtro: PosicaoId | 'todas'): Promise<LinhaRanking[]> { ... }
  ```

  A assinatura aceita `PosicaoId | 'todas'` — **mesma de `chaveRanking`** (`chavesCache.ts:21`) — para a `lib` não importar tipo de `components/` (acoplamento invertido); o `PosicaoFiltro` do componente é subtipo atribuível.
- **`src/routes/Ranking.tsx`** — remover a interface `LinhaRanking` local (`:47-59`, importar de `../lib/ranking`) e o corpo do `buscar`; manter `useCallback` com `[posicaoFiltro]` chamando `carregarRanking(posicaoFiltro)`. Sai o `import { supabase }`. `metricas`, ordenação local, swipe e filtros permanecem intocados.
- Commit: "move query da view ranking para carregarRanking na lib (D5)".

### Passo 3 — `carregarPartidasComVotacaoAberta()` (BannerLembrete) · 1 commit

- **`src/lib/partidas.ts`** — ao lado de `carregarPartidasVotadas` (as duas funções juntas formam o cálculo "urnas abertas pendentes para mim", com segunda demanda futura — lembretes), adicionar:

  ```ts
  /** Partida com urna aberta (status `published`, prazo no futuro). */
  export interface PartidaVotacaoAberta {
    id: number;
    voting_closes_at: string;
  }

  /** Partidas `published` com votação ainda aberta, já filtradas por `votacaoAberta`. */
  export async function carregarPartidasComVotacaoAberta(): Promise<PartidaVotacaoAberta[]> { ... }
  ```

  Transposição de `BannerLembrete.tsx:37-41` + o predicado `votacaoAberta(p) && p.voting_closes_at != null` (`:59`): a função é **pura de domínio** (sem sessão) e retorna só `{ id, voting_closes_at }` — o `status` selecionado hoje só serve ao predicado e não sai da `lib`.
- **`src/components/BannerLembrete.tsx`** — o `verificar` passa a chamar `carregarPartidasComVotacaoAberta()` e mantém **no componente** tudo que é de tela: guard de `document.hidden`/`jogadorId`, `geracaoRef`, o filtro "não votadas" via `carregarPartidasVotadas(jogadorId, ids)` (depende da sessão), polling adaptativo (`:74-78`), `visibilitychange` e countdown (interface local `PartidaAberta` sai, substituída pelo tipo da `lib`). Sai o `import { supabase }`.
- Commit: "move query de votação aberta para carregarPartidasComVotacaoAberta na lib (D5)".

### Passo 4 — `criarPartida(dados)` (PartidaNova) · 1 commit

- **`src/lib/partidas.ts`** — junto das demais mutações (`abrirPartida`, `finalizarPartida`):

  ```ts
  /** Participante inicial no payload da RPC `criar_partida`. */
  export interface ParticipanteNovo {
    jogador_id: number;
    posicao: PosicaoId;
    time: TimeId | null;
    gols: number;
    assistencias: number;
    gols_contra: number;
  }

  /** Cria a partida via RPC `criar_partida`; retorna o id novo. Erro se a RPC falhar ou vier sem id (rollback). */
  export async function criarPartida(dados: {
    dataJogo: string;       // ISO, já com hora padrão aplicada
    criadoPor: number;
    participantes: ParticipanteNovo[];
  }): Promise<number> { ... }
  ```

  Corpo transposto de `PartidaNova.tsx:158-165` incluindo os dois `throw` existentes (erro da RPC e id ausente/rollback) — a mutação não engole falha, mesmo contrato das demais mutações da `lib`.
- **`src/routes/PartidaNova.tsx`** — `handleCriarEEscalar` monta `ParticipanteNovo[]` (mesmo mapeamento de `:146-156`) e chama `criarPartida({ dataJogo: dataIso, criadoPor: adminLogado.id, participantes: payloadParticipantes })`. Permanecem no componente: limpeza do rascunho de `localStorage`, `invalidarCache(CHAVE_JOGOS)` + `invalidarCache(chaveResumo(...))` (passam a usar a função, sem mudança) e o `navigate`. Sai o `import { supabase }` (o `CAPACIDADE_PARTIDA`/`STORAGE_NOVA_PARTIDA` continuam vindo de `../lib/partidas`).
- Commit: "move RPC criar_partida para criarPartida na lib (D5)".

Total: 4 commits, um por query, cada um reverível isoladamente. **Zero mudança de comportamento** em tela: mesmas queries, mesmas ordenações, mesmos mapeamentos, mesmos erros.

## 5. Validação manual

Sem testes automáticos (AGENTS.md). Por passo, no aparelho/build:

- [ ] `npm run build` (ou `tsc -b`) sem erros.
- [ ] **Passo 1 — Jogos**: mural carrega na primeira visita e em revisita (cache); ao vivo/published/closed com placares corretos; excluir partida remove a linha (exclusão local + invalidações como hoje); pull-to-refresh atualiza.
- [ ] **Passo 2 — Ranking**: 4 abas por métrica carregam; filtro de posição aplica `eq` (tabela muda e chave de cache muda junto); trocar filtro e voltar serve do cache na hora; pull-to-refresh funciona; linha do jogador destacada.
- [ ] **Passo 3 — BannerLembrete**: com votação aberta e jogador que ainda não votou, banner aparece com countdown correndo; após votar, a partida some do banner (filtro de votados segue no componente); jogador logado diferente vê banner próprio; aba em segundo plano não dispara polling (visibilitychange re-verifica ao voltar) — **nenhum desses comportamentos deverá mudar**.
- [ ] **Passo 4 — PartidaNova**: criar partida navega para `/partida/:id/times`; mural e resumo refletem a partida nova (invalidações pós-criação); erro de rede mostra a mensagem como hoje; rascunho de `localStorage` é limpo no sucesso e preservado no erro.
- [ ] **Consistência global**: `grep -rn "from '../lib/supabase'" src/routes src/components` não retorna mais nenhum dos 4 arquivos; o único restante fora de `lib/` é `src/context/SessaoContext.tsx` (aceitável, seção 2).
- [ ] Regressão geral: nenhuma outra tela mudou (as alterações são confinadas a 3 arquivos de rota, 1 componente, `lib/partidas.ts` e o novo `lib/ranking.ts`).

## 6. Fora de escopo

- **Não tocar em `SessaoContext.tsx`** — a query de sincronização de sessão (`:50-54`) é do dono do estado de sessão; doc de origem a considera aceitável.
- **Não migrar nada para `useCache`** — nem `BannerLembrete` (polling próprio, exceção já documentada no plano 06), nem as telas de partida. Servir queries por cache é o plano **05**; este plano apenas as torna elegíveis.
- **Não criar chaves de cache novas nem mexer em `lib/chavesCache.ts`** — `CHAVE_JOGOS` e `chaveRanking` já cobrem os leitores atuais.
- **Não mover para a `lib` nada além da query/RPC**: polling, `geracaoRef`, countdown, filtros que dependem de sessão (votados), montagem de payload de UI, invalidações, navegação e limpeza de rascunho permanecem nos componentes.
- **Não mover `metricas`/constantes de UI do `Ranking`** nem mudar a localização de `PosicaoFiltro` (próximo ao modal é pré-existente; generalizar essa extração é território de outros itens, não deste).
- **Não derivar tipos de `database.types.ts`** aqui (interfaces `PartidaMural`/`LinhaRanking` nascem hand-written, transposição literal) — derivação é o plano **10** (D4), incremental.
- **Não criar testes automáticos** (diretriz atual do AGENTS.md).

## 7. Riscos e rollback

- **Risco geral: baixíssimo** — cada passo é transposição literal; o compilador (`tsc -b`) pega divergência de tipo e a validação manual cobre comportamento. O único ponto de atenção mecânico é **preservar `useCallback` com deps corretas** nos fetchers de `Jogos` (`[]`) e `Ranking` (`[posicaoFiltro]`) — fetcher instável revalida a cada render (contrato `useCache.ts:109-110`); sintoma visível imediatamente no Network.
- **Risco sutil no Passo 3**: mover o predicado `votacaoAberta` para dentro da `lib` muda *onde* o filtro acontece, não *o que* é filtrado; o filtro de "não votadas" (sessão) permanece no componente — se por engano for movido, o banner deixa de respeitar votos do jogador logado; a validação do Passo 3 cobre exatamente esse cenário.
- **Risco de import circular**: `lib/partidas.ts` já importa de `lib/times` (`ParticipanteNovo` usa `PosicaoId`/`TimeId`) — sem ciclo novo; `lib/ranking.ts` importa só `supabase` e `times`.
- **Rollback**: cada passo é um commit isolado, revertível por `git revert` sem afetar os outros (nenhum passo depende do anterior em runtime; só a dependência lógica 07 → 05 importa, e reverter um passo não quebra o 05 — ele apenas volta a depender da query inline para o site correspondente). Reverter os 4 em faixa restaura o estado original por completo: nenhuma função de `lib` existente é alterada, nenhum arquivo é renomeado.
- **Coordenação com o plano 05**: se o 05 for executado depois, suas seções 2/3 já assumem `criarPartida` na `lib`; nada a ajustar. Se este plano for revertido após o 05 existir, o site `PartidaNova.tsx:158` volta a existir e deve ser re-riscado apenas após reexecutar este plano.
- **Débito a registrar (não corrigir aqui)**: nenhum novo. O débito pré-existente de tipos hand-written (`PartidaMural`, `LinhaRanking`) já está coberto pelo plano 10 (D4).
