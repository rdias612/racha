# A1 - Encapsular acesso Supabase nas telas

**Origem:** item A1 do [relatório de conformidade](../relatorio-conformidade-agents.md).  
**Prioridade:** P1.  
**Objetivo:** retirar queries e RPCs das telas, mantendo em `src/lib` o acesso ao Supabase, o mapeamento de resposta e o contrato de erro. Estado visual, cache e navegação continuam nas telas.

## Estado atual confirmado

| Consumidor                                                    | Operação atual                                                                                           | Contrato que precisa ser preservado                                                            |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [Jogos.tsx](../../src/routes/Jogos.tsx)                       | Query obrigatória da view `partidas_com_placar`                                                          | `DadosJogos`, `CHAVE_JOGOS`, exclusão otimista e erro visível quando a view está indisponível  |
| [Ranking.tsx](../../src/routes/Ranking.tsx)                   | Query de `ranking` com filtros e ordenação fixa                                                          | `LinhaRanking`, `chaveRanking(posicaoFiltro)` e manutenção da lista durante revalidação        |
| [PartidaNova.tsx](../../src/routes/PartidaNova.tsx)           | RPC `criar_partida` com participantes e zeros de placar                                                  | Retorno do ID, limpeza de rascunho, invalidação de `CHAVE_JOGOS`/resumo e navegação            |
| [BannerLembrete.tsx](../../src/components/BannerLembrete.tsx) | Query de partidas `published` com votação aberta; consulta de votos já está em `carregarPartidasVotadas` | Polling, `visibilitychange`, deduplicação por geração, countdown e manutenção do último estado |

## Contratos fechados antes da execução

1. `carregarJogos()` será exportada por [partidas.ts](../../src/lib/partidas.ts) e consultará exclusivamente a view `partidas_com_placar`. A migration 071 é pré-requisito de deploy; não haverá fallback para o waterfall antigo.
2. `carregarRanking(filtro)` será exportada por um novo `src/lib/ranking.ts`, pois ranking é um domínio de consulta próprio e não deve aumentar a responsabilidade de `partidas.ts`.
3. `criarPartida(dataJogo, criadoPor, participantes)` ficará em `partidas.ts` e lançará o erro original para a rota aplicar `formatarMensagemErro`.
4. `carregarPartidasComVotacaoAberta()` ficará em `partidas.ts` e retornará somente `{ id, voting_closes_at }[]`.
5. Nenhuma função de `src/lib` terá estado React, navegação, snackbar ou invalidação de cache.

## Tasks de implementação

### A1.1 - Criar o contrato de carregamento do mural

**Arquivo:** [src/lib/partidas.ts](../../src/lib/partidas.ts).  
**Alteração:** mover para o módulo os tipos de `Partida`, `Placar` e `DadosJogos` necessários ao mural e implementar `carregarJogos()`.

1. Copiar a seleção da view `partidas_com_placar` e a ordenação atual.
2. Lançar qualquer erro retornado pelo Supabase, inclusive view ausente; a ausência indica migration/deploy incompleto e deve aparecer no estado de erro da tela.
3. Mapear `data ?? []` para o mesmo `Record<number, Placar>` usado atualmente.

**Aceite:** o retorno contém as mesmas partidas e placares produzidos hoje, e a função não depende de cache ou estado da rota.

### A1.2 - Trocar `Jogos` para o contrato do módulo

**Arquivo:** [src/routes/Jogos.tsx](../../src/routes/Jogos.tsx).

1. Remover o import de `supabase` e a função `buscarJogosDuasQueries`.
2. Importar `carregarJogos` e passar sua referência para `useCache`.
3. Preservar `idsExcluidos`, `excluirPartida`, `invalidarCache(CHAVE_JOGOS)`, skeleton e mensagens de erro.

**Checkpoint:** `rg "supabase|\\.from\\(|\\.rpc\\(" src/routes/Jogos.tsx` não encontra resultado; `npm run lint` e `npm run build` passam.

### A1.3 - Criar e consumir o carregador de ranking

**Arquivos:** novo `src/lib/ranking.ts` e [Ranking.tsx](../../src/routes/Ranking.tsx).

1. Mover a interface `LinhaRanking` e declarar `carregarRanking(filtro: PosicaoId | 'todas')`.
2. Reproduzir a cadeia de ordenação: `pontos`, `vitorias`, `partidas`, `gols`, `assistencias` descendentes e `username` ascendente.
3. Aplicar `.eq('posicao', filtro)` somente quando o filtro não for `todas`.
4. Lançar o erro da query sem formatá-lo no módulo.
5. Remover o import de `supabase` e substituir o callback `buscar` da rota por `carregarRanking(posicaoFiltro)`.
6. Preservar `chaveRanking`, `useCache`, ordenação visual e filtros locais.

**Checkpoint:** a rota não possui acesso Supabase; trocar de filtro continua reutilizando o cache correspondente e mantendo dados antigos durante a busca.

### A1.4 - Encapsular a criação de partida

**Arquivos:** [src/lib/partidas.ts](../../src/lib/partidas.ts) e [src/routes/PartidaNova.tsx](../../src/routes/PartidaNova.tsx).

1. Criar o tipo `PayloadParticipanteNovaPartida` com `jogador_id`, `posicao`, `time: null`, `gols: 0`, `assistencias: 0` e `gols_contra: 0`.
2. Implementar `criarPartida(dataJogo, criadoPor, participantes)` chamando uma única vez a RPC `criar_partida`.
3. Tratar `error` lançando-o e rejeitar retorno nulo/ausente como erro de criação, mantendo a decisão de mensagem na rota.
4. Na rota, remover o import de `supabase` e substituir somente o bloco RPC.
5. Preservar conversão de data, limpeza de `STORAGE_NOVA_PARTIDA`, invalidações e navegação.

**Checkpoint:** `PartidaNova.tsx` não contém `.rpc(` nem import de `supabase`; erro continua chegando a `formatarMensagemErro`.

### A1.5 - Encapsular a consulta de votação aberta

**Arquivos:** [src/lib/partidas.ts](../../src/lib/partidas.ts) e [src/components/BannerLembrete.tsx](../../src/components/BannerLembrete.tsx).

1. Criar `PartidaVotacaoAberta` com `id` e `voting_closes_at`.
2. Implementar `carregarPartidasComVotacaoAberta()` com `status = 'published'` e `voting_closes_at > new Date().toISOString()`.
3. Lançar erro para que o componente preserve o último estado no `catch` já existente.
4. Substituir apenas a query direta no callback `verificar`; manter `carregarPartidasVotadas`, `geracaoRef`, intervalos e listener de visibilidade.

**Checkpoint:** o componente não contém `.from(` nem import de `supabase`; polling e countdown continuam inalterados.

### A1.6 - Validação integrada

1. Executar `rg "import.*supabase|\\.from\\(|\\.rpc\\("` nos quatro consumidores e confirmar ausência.
2. Executar `npm run lint` e `npm run build`.
3. Validar o mural com a view existente, erro de view ausente, exclusão e erro de rede.
4. Validar ranking com `todas` e um filtro de posição, incluindo retorno vazio.
5. Criar partida e confirmar limpeza do rascunho, invalidação e navegação.
6. Validar banner com votação aberta, voto já registrado, aba em background e resposta atrasada.

## Critérios de aceite

- Os quatro consumidores não importam `supabase` nem montam queries/RPCs.
- Os quatro contratos fechados acima existem com nomes e retornos tipados.
- Cache, consulta única, polling, invalidação, mensagens e navegação preservam comportamento.
- Não há query duplicada entre rota/componente e `src/lib`.
- `npm run lint` e `npm run build` passam.

## Riscos e limites

- Não mover estado visual, navegação ou snackbar para `src/lib`.
- A migration 071 deve estar aplicada em todos os ambientes antes do deploy desta mudança; ausência da view passa a ser erro de configuração.
- Não alterar permissões do banco; os achados P0 são outro plano de segurança.
- Não criar um gateway genérico: cada função deve representar uma operação de domínio identificável.
