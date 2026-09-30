# 04 — Camada de dados, estado e serviços

> Análise da camada de dados/estado/serviços do PWA (fontes: `src/lib/`, `src/hooks/`, `src/context/`, `src/routes/`, `src/components/`). Método: leitura do código-fonte real (caminho:linha verificados), com `.superdesign/init/routes.md` e `docs/tmp-analise-pwa/00-superdesign-init.md` usados apenas como mapa. Nenhum código alterado, nenhum crédito gasto.
>
> Filosofia aplicada (AGENTS.md): KISS/YAGNI/DRY com critério — o objetivo é **menos duplicação e manutenção mais fácil**, NÃO reescrever a camada de dados nem introduzir bibliotecas novas.

---

## 1. Resumo executivo (top 5)

A camada de dados está **saudável e bem estruturada**: queries SQL vivem quase integralmente em `src/lib/*.ts` (só 5 sites tocam o client `supabase` fora da lib), as RPCs não têm nenhuma chamada duplicada, `erros.ts` e `formatacao.ts` são adotados transversalmente, e o `useCache` (SWR caseiro com dedupe/generations/invalidação) cobre as telas leitoras principais. As duplicações reais estão no **boilerplate ao redor das queries**, não nas queries. Top 5 propostas:

| # | Proposta | Prioridade | Esforço |
|---|----------|-----------|---------|
| 1 | Extrair helper de invalidação pós-mutação de partida (par `CHAVE_JOGOS` + `chaveResumo(ano)` repetido em 7 sites) | P0 | S |
| 2 | Servir elenco/estatísticas-base do elenco pelo cache SWR existente (elenco ativo é re-buscado na rede a cada mount de 9 telas/componentes) | P1 | M |
| 3 | Migrar telas leitoras simples para `useCache`, eliminando o padrão manual `carregando/erro/geracaoRef` duplicado (3 sites reimplementam a proteção de geração que o hook já tem) | P1 | S–M |
| 4 | Reduzir drift de tipos derivando de `database.types.ts` onde o mapeamento é 1:1 (o arquivo gerado está completo, mas é consumido só por `supabase.ts`; 15 casts mascaram mismatch) | P2 | S (incremental) |
| 5 | Consolidar as últimas queries que moram fora da `lib` (BannerLembrete, Jogos, Ranking, RPC de criar partida) — rotas não tocam no client `supabase` | P2 | S cada |

---

## 2. Estado atual mapeado

### 2.1 Como as telas buscam dados — mapa por rota

Duas convenções coexistem, ambas legítimas e documentadas:

- **Idioma A — `useCache` (SWR)**: telas puramente leitoras com cache de sessão. Consumidores: `routes/Jogos.tsx:72`, `routes/Resumo.tsx:58`, `routes/Ranking.tsx:143`, `routes/Comparador.tsx:109` (9 rotas importam algo de `useCache`, mas as 4 rotas de partida usam apenas `invalidarCache`).
- **Idioma B — fetch manual** (`useState` carregando/erro + `useEffect` + `carregar`): telas de fluxo com mutação/polling e telas de gestão: `Estatisticas`, `EstatisticasRacha`, `Perfil`, `PartidaDetalhe`, `PartidaAoVivo`, `PartidaTimes`, `PartidaEditar`, `PartidaVotar`, `PartidaNova`, `GestaoJogadores`, `GestaoGoleiros`, `Administrador`, `Notificacoes*` (4), `Login`.

As queries em si passam por funções de domínio em `src/lib/` (`partidas.ts`, `jogadores.ts`, `dividas.ts`, `notificacoes.ts`, `eventosFinanceirosAutomaticos.ts`). Inventário de acesso a dados:

- **Tabelas/views** (`grep .from(`): `jogadores` 6×, `push_subscriptions` 4×, `eventos_financeiros_automaticos` 4×, `partidas_participantes` 3×, `partidas` 3×, `votes` 2×, `stats_jogador` 2× (mesma função em overloads), `dividas` 2× — e 1× cada as views `ranking`, `partidas_com_placar`, `partida_placar`, `partida_notas`, `partida_eventos`, `dividas_resumo`.
- **RPCs**: 39 RPCs distintas, **cada uma chamada em exatamente 1 lugar** — zero duplicação de chamada de RPC. `obterMediasNotasJogadores` e `obterPartidasRecentesJogadores` têm fallback client-side embutido na própria lib (`lib/jogadores.ts:272-318`), não duplicado nos callers.

Conclusão: a regra "tela → função de lib → supabase" está implementada e respeitada na maior parte do código (ex.: `Resumo.tsx:39-58` compõe `carregarResumoAno` + `obterPartidaDraftAtual` + `carregarParticipantes` dentro de `useCache`).

### 2.2 Acessos diretos ao client `supabase` fora de `src/lib/` (5 sites)

| Site | O que faz | Avaliação |
|------|-----------|-----------|
| `context/SessaoContext.tsx:50-54` | Re-sincroniza o perfil (`jogadores` com `COLUNAS_JOGADOR_LISTA`) no boot | Aceitável: é o dono do estado de sessão; colunas importadas da lib (sem duplicar select) |
| `routes/Jogos.tsx:51-54` | Query da view `partidas_com_placar` dentro do `buscar` do `useCache` | Único desvio no padrão entre as telas leitoras com cache (Resumo usa funções da lib) |
| `routes/Ranking.tsx:108-118` | Query da view `ranking` com filtro dinâmico | Idem: query na rota, não na lib |
| `components/BannerLembrete.tsx:37-41` | Polling de `partidas` published com prazo futuro | Query de leitura num componente de UI |
| `routes/PartidaNova.tsx:158` | RPC `criar_partida` direto no submit | Única mutação fora da lib |

### 2.3 Duplicações mais relevantes (quantificadas)

**a) Re-fetch do mesmo dataset sem cache — elenco (maior volume):**

A mesma leitura de elenco é refeita na rede a cada mount, sem cache, em:

- `listarJogadoresAtivos()` (todos os ativos, 9 colunas): `Administrador.tsx:55`, `PartidaEditar.tsx:68`, `PartidaNova.tsx:67`, `PartidaTimes.tsx:102`, `components/ConfirmacoesPartida.tsx:249`
- `listarTodosJogadores()` (catálogo completo): `Comparador.tsx:71`, `GestaoJogadores.tsx:60`
- `listarJogadoresAtivosSemRandom()`: `Estatisticas.tsx:57`
- `listarGoleiros()`: `GestaoGoleiros.tsx:63` (+ refetch pós-mutação em 91/130/148), `PartidaTimes.tsx:103`
- `listarUsernames()`: `Login.tsx:39`

Ou seja: navegar Resumo → Jogos → Nova partida → (confirmar) → Detalhe dispara 4+ fetches do elenco na mesma sessão, cada um com seu `try/catch/setJogadores` próprio. Dataset é quase estático (muda só via telas admin).

**b) Re-fetch sem cache — dados derivados do elenco:**

- `obterMediasNotasJogadores()` (mapa completo): `Comparador.tsx:96`, `PartidaTimes.tsx:104`
- `obterPartidasRecentesJogadores(2)`: `PartidaNova.tsx:67`, `ConfirmacoesPartida.tsx:250`
- `carregarStatsJogador`: `Perfil.tsx:48`, `Estatisticas.tsx:86` (navegar Perfil → Estatisticas do mesmo jogador refaz a RPC/view)

**c) Par de invalidação copiado — 7 sites:**

`invalidarCache(CHAVE_JOGOS); invalidarCache(chaveResumo(new Date().getFullYear()));` aparece textualmente em:

- `routes/Jogos.tsx:86-87`
- `routes/PartidaTimes.tsx:210-211`
- `routes/PartidaEditar.tsx:204-205`
- `routes/PartidaDetalhe.tsx:151-152`
- `routes/PartidaNova.tsx:173-174`
- `routes/PartidaAoVivo.tsx:136-137` e `:223-224`

Se amanhã o boletim passar a depender de mais uma chave, são 7 arquivos para atualizar (risco real de esquecer um — hoje, por exemplo, nada invalida as futuras chaves de elenco propostas no item 3).

**d) Boilerplate de carregamento reimplementado:**

- Proteção contra resposta obsoleta via `geracaoRef` manual em 3 sites: `Estatisticas.tsx:75-111`, `EstatisticasRacha.tsx:85-99`, `BannerLembrete.tsx:27-55` — exatamente o que `useCache` já faz internamente (`hooks/useCache.ts:70-77` gerações, `:130-147` revalidação). `EstatisticasRacha` é o caso mais claro: uma única leitura (`carregarParesRacha`) sem mutação nem polling — um `useCache` com chave nova resolveria.
- `let ativo = true; return () => { ativo = false; }` repetido em ~15 effects (`Perfil.tsx:43-66`, `GestaoJogadores.tsx:55-68`, `Comparador.tsx:69-86`, `CardNotificacoes.tsx:20-40`, etc.).
- Padrão `if (carregando) return <Skeleton…>; if (erro && !dados) return <MensagemEstado…>` copiado entre as 4 telas com `useCache` (com comentários idênticos em `Jogos.tsx:100-104` e `Resumo.tsx:63-68`).

### 2.4 Padrões de loading/erro e feedback

- **`lib/erros.ts` é adotado transversalmente**: `formatarMensagemErro` é importado por 26 arquivos (todas as rotas com dados + 8 componentes). Mapeia códigos Postgres/PostgREST (`erros.ts:55-69`), padrões de texto (`:72-91`) e falha de conexão (`:13-24`). **Não há mensagem técnica crua em inglês vazando para a UI.**
- Os 4 `mostrarSnackbar('erro', …)` sem `formatarMensagemErro` (`GestaoGoleiros.tsx:170`, `Jogos.tsx:90`, `NotificacoesVotacao.tsx:90`, `NotificacoesConfirmacao.tsx:123`) são: recusas de negócio com `ok === false` (mensagem fixa é correta) ou variável já formatada. **Consistente.**
- **Hierarquia de feedback é coerente**: erro de carregamento de página → `MensagemEstado` (31 usos); erro/sucesso de mutação → `Snackbar` via `useSnackbar` (com haptics integrados, `hooks/useSnackbar.ts:49-53`); erro de formulário → texto inline abaixo do campo (`Perfil.tsx:30-39`). Não propostas de mudança aqui além do item (e) abaixo.
- **Semântica de erro do `useCache` bem definida** (`hooks/useCache.ts:102-111`): skeleton só na 1ª visita; falha de revalidação em background é silenciosa e mantém dados em tela — decisão importante para PWA offline-instável, e respeitada pelos 4 consumidores (ex.: `Jogos.tsx:103-104`).
- **Tolerância granular intencional** em telas compostas: `Administrador.tsx:52-82` usa `Promise.allSettled` para não derrubar o dropdown de jogadores se a RPC financeira falhar; `PartidaDetalhe.tsx:66-79` tolera falha do count de votos. Padrão local, não precisa centralizar.
- **Polling** (não realtime): `PartidaAoVivo.tsx:90-96` recarrega a cada 10 s enquanto `status === 'live'`; `BannerLembrete.tsx:74-87` alterna 30 s/5 min e pausa com aba oculta. Adequado à escala.

### 2.5 Estado de sessão/perfil — coeso

- `SessaoContext.tsx` é a **única** fonte de leitura/refresh do perfil: grep por `COLUNAS_JOGADOR_LISTA` confirma que a query por `id` existe só lá (`SessaoContext.tsx:50-54`); nenhuma outra tela busca a linha do jogador. Auto-cura: desloga se `is_ativo` virou false (`:58-66`), grava no `localStorage` só quando campos relevantes mudam (`:72-81`).
- `useJogadorLogado.ts:3-6` e `useAdmin.ts:4-8` são wrappers finos sobre o contexto (aplicam `aplicarSuperAdmin` já normalizado no provider e `SUPERADMIN_IDS` da lib — sem leitura duplicada de privilégio).
- Consumo homogêneo: 22 arquivos usam `useSessao`/`useJogadorLogado`; `Layout.tsx:80-81` guarda a sessão; nenhum componente lê `localStorage` de sessão direto (só o provider).
- Débito menor (observado, não priorizado): após o login (que já retorna o perfil via `fazer_login`), o `setJogador` dispara o effect de sincronização (`:41-88`), causando 1 leitura redundante do perfil na entrada. Inofensivo na escala atual.

### 2.6 Tipos: `database.types.ts` gerado e completo, mas pouco aproveitado

- O arquivo é **gerado do Supabase** (bloco `__InternalSupabase`/`PostgrestVersion: '14.15'`, `database.types.ts:2-6`), com 11 tabelas, 6 views e ~40 funções **com `Args` e `Returns` completos** (ex.: `fazer_login` em `:982-988`, `obter_painel_entregas_push` em `:1024-1032`, `pares_racha` em `:1075-1080`). Está atualizado (contém `partidas_com_placar`, views e RPCs de todas as migrations citadas).
- Porém o **único consumidor** é `lib/supabase.ts:2` (tipagem do client). Como o client é tipado, as leituras de tabela e as RPCs **já retornam tipos** do gerador — e o código imediatamente os sobrescreve com casts:
  - `lib/partidas.ts:76` (`as Partida | null`), `:113`, `:134` (`as NotaPartida[]`), `:157` (`as ParRacha[]`), `:175`, `:231`
  - `lib/jogadores.ts:308`, `:406`, `:421`
  - `lib/dividas.ts:63`, `:98` — `lib/notificacoes.ts:75`, `:147` (`as unknown as`) — `lib/eventosFinanceirosAutomaticos.ts:52`
- Existem dois motivos para os casts: (1) **narrowing legítimo** — as views retornam colunas todas nullable e `status`/`posicao` chegam como `string`, enquanto os tipos de domínio estreitam (ex.: `partida_notas` Row nullable → `NotaPartida` não-nula); (2) **duplicação evitável** — interfaces como `ParRacha` (`partidas.ts:137-148`), `ResumoAno` (`:500-525`), `NotificacoesConfig` (`notificacoes.ts:5-34`) copiam à mão o formato que o gerado já descreve; um drift futuro de migration passaria batido no compile-time, descoberto só em runtime.
- Tipos de resultado de query também moram em rotas: `LinhaRanking` (`Ranking.tsx:47-59`, espelha a view `ranking`) e `Partida`/`Placar` locais (`Jogos.tsx:21-31`, subconjunto da view `partidas_com_placar` que duplica nomes de `lib/partidas.ts`). `DadosResumo` (`Resumo.tsx:21-24`) e `ComparativoTela` (`Comparador.tsx:34-39`) são composições de tipos de lib — não são drift, apenas formas de tela.

### 2.7 Consistência transversal (formatação, constantes, storage)

- **`formatacao.ts` é usado em toda parte**: grep de `Intl.DateTimeFormat`/`toLocaleDateString` fora da lib retorna exatamente 1 ocorrência — `numero2casas` em `Ranking.tsx:30` (formato numérico específico de coluna de ranking; candidato marginal, não urgente). Nenhuma formatação de data inline duplicada. Datas ISO cruas só em manipulação de intervalo (`NotificacoesConfirmacao.tsx:183` etc.), não em exibição.
- **Chaves de localStorage**: todas nomeadas como constantes junto ao módulo dono — `racha_sessao` (`SessaoContext.tsx:22`), `racha_nova_partida` (`lib/partidas.ts:331`), `racha_tema` (`lib/tema.ts:6`), `CHAVE_PUSH_DESATIVADO` (`lib/pwa.ts`), prefixo `racha_voto_draft_` (`PartidaVotar.tsx:75`). Sem strings mágicas espalhadas. Chaves do cache SWR centralizadas em `lib/chavesCache.ts` (4 chaves) e **todos** os 4 consumidores de `useCache` usam essas chaves — nenhum literal montado à mão.
- **Constantes de domínio centralizadas e derivadas**: `LIMITE_POR_TIME` (`lib/times.ts:33`) → `CAPACIDADE_PARTIDA` (`lib/partidas.ts:330`); `COLUNAS_JOGADOR_LISTA` única (`lib/jogadores.ts:41`); `SELECT_DIVIDA` única (`lib/dividas.ts:55`); `NOTA_PADRAO` (`lib/escalacao.ts:16`).
- Constantes mágicas restantes (baixo impacto): intervalos de polling literais `10_000` (`PartidaAoVivo.tsx:94`), `30_000`/`5 * 60_000` (`BannerLembrete.tsx:75`); nota padrão da urna `6` literal (`PartidaVotar.tsx:179` — valor igual a `NOTA_PADRAO` por coincidência semântica, **não** mesclar).

### 2.8 Realtime

- **Zero uso** de Realtime: nenhum `.channel(`, `postgres_changes` ou `removeChannel` em `src/` (grep vazio). Toda atualização "em tempo real" é polling + revalidação explícita pós-mutação (`PartidaAoVivo.tsx:90-96`, `recarregar()` após cada RPC).
- O plano `docs/plano-escolha-times-realtime.md:29,87-96,368-375` já decide a arquitetura (Supabase Realtime `postgres_changes` nas tabelas de draft + revalidação por RPC; evento como gatilho, nunca como fonte da verdade) e reserva a migration 109 — **ainda não implementado, nenhuma infraestrutura pronta no client**. Quando implementar, o padrão natural será: evento → `invalidarCache(chave)` → ouvintes do `useCache` revalidam (mecanismo já existente em `hooks/useCache.ts:39-58`).

---

## 3. Propostas priorizadas

### P0-1 — Helper único de invalidação pós-mutação de partida

- **Problema**: o par `invalidarCache(CHAVE_JOGOS); invalidarCache(chaveResumo(new Date().getFullYear()))` está copiado em 7 sites (lista em 2.3c). Qualquer chave nova que dependa de partidas exige tocar em 7 arquivos; esquecer um gera tela obsoleta silenciosa.
- **Proposta**: exportar de `lib/chavesCache.ts` (que já é a "fonte única das chaves") uma função `invalidarCachesDependentesDePartida(): void` que faz as duas chamadas (e no futuro as demais). Substituir os 7 sites. Alternativa ainda menor: constante `CHAVES_PARTIDA_MUTADA: string[]` + loop.
- **Benefício**: ponto único de manutenção; preparar terreno para chaves futuras (elenco, realtime).
- **Esforço**: S (1 arquivo novo + 7 edits mecânicos). **Risco**: mínimo (comportamento idêntico).

### P1-2 — Servir elenco e derivados pelo cache SWR existente

- **Problema**: o dataset mais lido do app (elenco ativo, ~20 linhas) é re-buscado a cada mount de 9 telas/componentes (2.3a-b). No PWA com rede móvel instável isso custa latência perceptível a cada fluxo e multiplica pontos de falha — cada caller tem seu próprio `try/catch/setJogadores/ativo`.
- **Proposta**: **sem novo mecanismo** — usar o `useCache` que já existe:
  1. Adicionar chaves em `lib/chavesCache.ts`: `CHAVE_ELENCO_ATIVO`, `CHAVE_ELENCO_TODOS`, `CHAVE_GOLEIROS`, `CHAVE_MEDIAS_NOTAS` (convenção já documentada no arquivo).
  2. Nas telas leitoras, trocar o `useEffect`+`useState` por `useCache(chave, listarJogadoresAtivos)` etc. (o fetcher é a própria função da lib — ela já é pura, requisito do hook).
  3. Invalidar (`invalidarCache(CHAVE_ELENCO_*)`) nas mutações que mudam elenco: `NovoJogador.tsx` (criar), `GestaoJogadores.tsx` (características/ativo), `GestaoGoleiros.tsx` (criar goleiro/ativo/dados) — são os mesmos pontos onde hoje essas telas já refazem sua listagem local.
- **Benefício**: navegação entre abas/fluxos serve o elenco instantaneamente do cache (comportamento já esperado pelo `useCache`); menos requisições por sessão; menos boilerplate duplicado nos callers; invalidação explícita num ponto.
- **Esforço**: M (chaves + ~9 migrações de call-site + 3 pontos de invalidação). **Risco**: baixo-moderado — dado levemente obsoleto se mutação esquecer invalidação (mitigado pelo passo 3 e pela revalidação em background do hook); telas que editam dados do jogador (PIX/telefone) podem manter refetch local como hoje.

### P1-3 — Migrar telas leitoras simples para `useCache` e aposentar `geracaoRef` manual

- **Problema**: `EstatisticasRacha.tsx:85-99` reimplementa carregamento + geração para uma leitura única e sem mutação (mesma proteção que `useCache` tem de fábrica). `Estatisticas.tsx:75-111` idem, com chave natural = jogador selecionado. `BannerLembrete.tsx` mantém geração manual, mas tem polling próprio — caso legítimo de exceção.
- **Proposta**: migrar `EstatisticasRacha` primeiro (S): `useCache(chaveParesRacha(MIN_PARTIDAS), buscar)`. Depois `Estatisticas` (M): chave por `jogadorSelecionadoId` (mesmo padrão de `chaveRanking(filtro)`). Não migrar telas com mutação/polling pesado (`PartidaAoVivo`, `PartidaVotar`, `PartidaDetalhe`) — o fetch manual é justificado lá (estado interdependente de partida/eventos/votos).
- **Benefício**: menos código duplicado (o boilerplate `carregando/erro/geracao` some); estale-while-revalidate grátis na volta para a aba de estatísticas (comportamento hoje: sempre skeleton).
- **Esforço**: S na primeira, M na segunda. **Risco**: baixo (superfície pequena, sem mutação).

### P2-4 — Reduzir drift de tipos derivando de `database.types.ts` (incremental)

- **Problema**: o schema gerado está completo e atual, mas os tipos de domínio são re-declarados à mão e o resultado das queries é sobrescrito por cast (2.6). Drift de migration (coluna renomeada, tipo mudado) compila sem erro.
- **Proposta**: derivar onde o mapeamento é 1:1, um módulo por vez. Exemplos seguros: `type ParRacha = Database['public']['Functions']['pares_racha']['Returns'][number]` (elimina interface + cast em `partidas.ts:137-157`); `Placar`, `EventoPartida`, `VotoEnviado` (idem); `LinhaRanking` de `Database['public']['Views']['ranking']['Row']` movido p/ lib. **Manter** os mapeadores de narrowing onde views são nullable ou `string` precisa virar union (`carregarParticipantes`, `partida_notas`, `notificacoes.ts:147`, `posicao: string → PosicaoId`) — nesses o cast é a estratégia correta e só merece um comentário.
- **Benefício**: compile-time detecta mudança de schema nas funções derivadas; menos duplicação de declaração; tipos de query deixam de morar em rotas (`Jogos.tsx:21-31`, `Ranking.tsx:47-59`).
- **Esforço**: S por módulo (fazer aos poucos, sem big-bang). **Risco**: baixo — é tudo type-level; `tsc -b` valida.

### P2-5 — Consolidar as últimas queries fora da `lib` (rotas/componentes não tocam no client)

- **Problema**: 4 sites fora do `SessaoContext` violam o padrão dominante "query mora na lib" (2.2): `Jogos.tsx:51-54`, `Ranking.tsx:108-118`, `BannerLembrete.tsx:37-41`, `PartidaNova.tsx:158`.
- **Proposta**: mover cada uma para função de leitura/mutação pura em `lib/`:
  - `lib/partidas.ts`: `carregarMuralJogos()` (query atual de Jogos, com o achatamento placar/partidas que já existe no `buscar`) e `carregarPartidasComVotacaoAberta()` (query do BannerLembrete — o polling, a geração e o countdown ficam no componente).
  - `lib/partidas.ts` ou `lib/ranking.ts`: `carregarRanking(filtro)` (query dinâmica do Ranking; a chave `chaveRanking` continua igual).
  - `lib/partidas.ts`: `criarPartida(dados)` envolvendo a RPC do `PartidaNova.tsx:158`.
- **Benefício**: consistência total do padrão; funções testáveis/reutilizáveis (a de votação aberta já tem duas demandas: BannerLembrete e o futuro lembrete); queries de tela ficam cacheáveis quando necessário (P1-2).
- **Esforço**: S cada. **Risco**: mínimo (transposição literal + teste manual da tela).

### P3 — Melhorias de baixo custo (registros, fazer quando tocar no arquivo)

- **Nomear intervalos de polling**: `POLLING_AO_VIVO_MS = 10_000` (`PartidaAoVivo.tsx:94`) e constantes equivalentes em `BannerLembrete.tsx:75`. Esforço S, risco zero.
- **`numero2casas` do Ranking** (`Ranking.tsx:30`): se um segundo uso surgir, mover para `formatacao.ts` como `formatarDecimal(n, casas)`. Hoje, uso único — YAGNI, pode ficar.
- **Re-export de conveniência** `notificacoes.ts:3` (`obterPartidaDraftAtual`): manter — evita import cruzado de rotas entre módulos; registrar como intencional.
- **Leitura redundante de perfil pós-login** (2.5): só atacar se algum dia virar dor real; tocar no `SessaoContext` por isso não vale o risco de regressão num arquivo que concentra autenticação.

### Priorização sugerida de execução

1. P0-1 (meio dia, remove o maior copy-paste).
2. P2-5 (transposições mecânicas; prepara P1-2).
3. P1-2 (maior ganho de UX de rede no PWA).
4. P1-3 (começar por EstatisticasRacha).
5. P2-4 (por oportunidade, a cada módulo tocado).

---

## 4. O que NÃO fazer

1. **Não adicionar React Query/TanStack/Zustand/SWR externo.** O `useCache` caseiro já implementa o essencial (stale-while-revalidate, dedupe de fetch concorrente, gerações anti-obsolência, invalidação com notificação de montados, `recarregar` compatível com pull-to-refresh) em 188 linhas testadas por uso, sem dependência. Migrar 9 consumidores para uma lib nova troca um problema pequeno e conhecido por um big-bang de revisão — contra KISS e contra AGENTS.md (sem libs sem necessidade clara).
2. **Não persistir o cache SWR em localStorage/sessionStorage nem criar cache cross-tab.** Os datasets são pequenos e mudam pouco; a revalidação em background já cobre revisitas, e sincronizar invalidação entre abas adicionaria um subsistema novo sem ganho perceptível nesta escala (~25 usuários).
3. **Não criar uma camada "ApiService/Repository/DataSource" genérica ou classe `Util` de dados.** Os módulos de domínio em `src/lib/*.ts` **já são** a camada de dados do projeto (nome em português, um por domínio). Encima-los com uma abstração adicional violaria a arquitetura atual e adicionaria indireção sem problema real a resolver.
4. **Não centralizar snackbar/erro num contexto global.** O padrão atual (mutação → snackbar local; carregamento → `MensagemEstado`; form → erro inline) é simples, local e previsível. Um provider global de feedback acopla todas as telas e complica os fluxos focados (ao-vivo/votar) que hoje decidem entre inline e toast por contexto.
5. **Não migrar telas de mutação/polling (`PartidaAoVivo`, `PartidaVotar`, `PartidaEditar`, `PartidaDetalhe`) para `useCache`.** O estado delas é interdependente (partida + participantes + eventos + rascunho local) e mutação-pesada; o fetch manual com recarregar explícito é a solução correta ali. Padronizar por padronizar reduziria clareza.
6. **Não implementar Realtime agora.** O plano de escolha de times realtime (`docs/plano-escolha-times-realtime.md`) ainda não começou; nenhuma infra de canal existe no client. Quando avançar, o desenho já prevê evento como gatilho de revalidação (compatível com `invalidarCache`), e esse será o único lugar com Realtime — não espalhar subscriptions por outras telas.
7. **Não fundir a nota padrão da urna (`PartidaVotar.tsx:179`) com `NOTA_PADRAO` (`escalacao.ts:16`)** — o valor 6 coincide, mas os domínios são distintos (nota de voto vs. média de sorteio); acoplá-los criaria regressão silenciosa se uma regra mudar.
8. **Não reescrever `database.types.ts` à mão nem tipar tudo derivado de uma vez.** O arquivo é gerado; o trabalho é gradual (P2-4) e os casts de narrowing nas views nullable são intencionais — removê-los forçaria espalhar `??` defensivo por toda a UI.

---

*Análise verificada no código em 2026-09-29. Nenhum dos itens acima altera comportamento funcional visível; todos preservam a arquitetura existente (lib de domínio + hooks + contexto de sessão).*
