# Plano — Hall da Fama + Ranking por temporada (histórico 2023–2025)

> Status: aprovado, **não implementado** (29/09/2026). Revisado após validação técnica (subagentes backend + frontend contra o código em 29/09) — correções e decisões novas incorporadas ao texto abaixo. Fonte dos dados históricos: `historico/2023.csv`, `historico/2024.csv`, `historico/2025.csv` (agregados anuais por jogador, limpos — só jogadores com ≥5 participações).

## Visão geral

Duas mudanças complementares:

1. **Ranking** (`/ranking/:metrica`): passa a exibir **somente a temporada corrente** (hoje, 2026). Em 01/01/2027 passa a exibir só 2027 automaticamente.
2. **Hall da Fama** (rotas novas `/hall-da-fama/:metrica`, acessadas por um botão **HOF** no header do Ranking, à esquerda do botão "Filtros"): ranking **consolidado de toda a história** — anos arquivados (2023–2025, vindos dos CSVs) + anos vivos ainda não arquivados (hoje, 2026). Convidados temporários (`random*`) não entram.

Métricas do Hall: **gols**, **% de pontos** ((3V+E)/(3×P), fórmula dos CSVs), **assistências** (dado novo, só existe a partir de 2026) e **partidas**. Mesmo mecanismo do Ranking: abas-rotas com swipe, `ModalFiltrosRanking`, ordenação por coluna, cache SWR, skeletons.

Cards de destaques no topo do Hall (**artilheiro da história, mais vitórias, maior % de pontos, mais partidas**) calculados **client-side** a partir das linhas já carregadas, respeitando os filtros ativos. Sem RPC nova para isso.

## Decisões tomadas nas discussões

Originais (29/09, mantidas):

- Mapeamentos de nomes dos CSVs: `Vitor` → `VitorVieira`; `Victor Andre` → `vitor andre`; `Thiagão` → `Thiagao` (o banco também tem `thiago` e `thacio`, outras pessoas); `Digão` → `Digao`; `Knust` → `knust` **existente** (ver correção abaixo).
- Jogadores históricos sem username são **criados no banco**: Maudonet, Digao, Gnu, Bolinha, Heizer, Caioba, Cadeirudo e **Andre_R** (esquecido na primeira lista; underscore porque a regra canônica de username — migrations 094/108 — não aceita espaços).
- Jogadores novos entram como **avulsos** (`is_mensalista = false`).
- O acumulado do Hall **inclui o ano corrente** (2026 ao vivo).
- `% de pontos` usa a fórmula dos CSVs ((3V+E)/(3P)), não o %V que o Ranking atual exibe.
- O recorte por ano da `ranking` (débito identificado: a view atual agrega todos os anos) **entra no plano** — em 2027 ela somaria 2026+2027 sem isso.
- Fecho de ano: arquitetura **auto-corretiva** + cron idempotente (detalhes abaixo). O Hall nunca depende do cron para estar correto.

Da validação (29/09):

- **Convidados não entram no Hall**: filtro por `username !~* '^random'` na view (o prefixo `random` é reservado a convidados temporários por regra — migrations 075/094/096/108). Não pode filtrar por `posicao='random'` porque os 9 históricos também usam essa posição. A `ranking` (temporada) **mantém** o comportamento atual, convidados incluídos.
- **Knust não é jogador novo**: `knust` já existe desde a seed (migration 022). O CSV `Knust` resolve para o existente por case-insensitive.
- **Senha em texto puro**: o projeto compara/armazena senha em plaintext desde a migration 021 — seed dos novos usa literal `'123'`, não bcrypt.
- **Abas do Hall como rotas** (`/hall-da-fama/:metrica` + redirect), fiel ao padrão do Ranking — deep-link e back-button por aba de graça.
- **Extrair componentes compartilhados** em vez de duplicar: `TabelaRanking`/`valorOrdenacao`/`LinhaRanking` (de Ranking.tsx) e o card `Destaque` (de Resumo.tsx) viram componentes em `src/components/`, consumidos pelas três telas.
- **TabBar**: o Hall marca a aba "Ranking" como ativa (matcher estendido).
- Cards de destaque: gols, **vitórias**, %pontos, partidas (vitórias ficou no lugar de assistências; as abas seguem com assistências).
- Confirmar na base ao vivo, antes do seed, que `VitorVieira` e `vitor andre` existem (não constam de nenhuma seed do repo; o guard da migration falharia ruidosamente).

## Migration

Número: **próximo livre na hora de executar** (109 está reservado pelo plano realtime de escolha de times; se ele avançar primeiro, usar 110).

### 1. Jogadores novos (8, sem Knust)

`INSERT` de Maudonet, Digao, Gnu, Bolinha, Heizer, Caioba, Cadeirudo, Andre_R com `ON CONFLICT (lower(trim(username))) DO NOTHING` — arbiter por expressão, casando com o índice CI `jogadores_username_ci_unique` da migration 108 (`ON CONFLICT (username)` simples não o interceptaria e estouraria 23505).

- `posicao = 'random'` (CHECK da migration 023 já aceita; semântica de "sem posição fixa", igual aos convidados).
- `is_mensalista = false`, `is_ativo = false` (não aparecem em escalação/confirmação; seguem aparecendo no Hall via join).
- `senha_hash = '123'` **literal** (padrão real da seed; senhas são texto puro desde a migration 021).

### 2. Tabela `historico_anual` (anos arquivados)

| coluna | tipo | observação |
|---|---|---|
| `ano` | int | parte da PK |
| `jogador_id` | bigint FK jogadores | parte da PK |
| `partidas` | int | |
| `vitorias` / `empates` / `derrotas` | int | |
| `gols` | int | |
| `assistencias` | int, default 0 | 0 no seed de 2023–25; preserva o dado a partir do arquivo de 2026 |
| `pontos` | int | V×3+E, como nos CSVs |

- Seed: 71 linhas (2023: 20, 2024: 25, 2025: 26), resolvendo `jogador_id` por username (trim + case-insensitive + mapeamentos da seção de decisões; `Knust` resolve para o `knust` existente).
- Guards na migration: todo `jogador_id` resolvido e `vitorias + empates + derrotas = partidas` em cada linha (proteção contra erro de digitação no seed).

### 3. View `hall_fama` (consolidada, auto-corretiva)

Ramo vivo deriva de **`v_levantamento`** (migration 089) — não montar os joins na mão: V/E/D/pontos dependem do `partida_placar` que a view já resolve (incl. gols contra), e herdar dela elimina risco de divergência semântica entre Ranking e Hall.

```sql
CREATE OR REPLACE VIEW hall_fama AS
WITH vivos AS (
  SELECT jogador_id,
         COUNT(*) FILTER (WHERE vitoria) AS vitorias,
         COUNT(*) FILTER (WHERE empate)  AS empates,
         COUNT(*) FILTER (WHERE derrota) AS derrotas,
         COUNT(*)                        AS partidas,
         SUM(gols)          AS gols,
         SUM(assistencias)  AS assistencias,
         SUM(pontos)        AS pontos
  FROM v_levantamento
  WHERE EXTRACT(YEAR FROM data_jogo AT TIME ZONE 'America/Sao_Paulo')::int
        NOT IN (SELECT ano FROM historico_anual)
  GROUP BY jogador_id
),
consolidado AS (
  SELECT jogador_id, SUM(partidas) AS partidas, SUM(vitorias) AS vitorias,
         SUM(empates) AS empates, SUM(derrotas) AS derrotas, SUM(gols) AS gols,
         SUM(assistencias) AS assistencias, SUM(pontos) AS pontos
  FROM (
    SELECT jogador_id, partidas, vitorias, empates, derrotas, gols, assistencias, pontos
    FROM historico_anual
    UNION ALL SELECT * FROM vivos
  ) x
  GROUP BY jogador_id
)
SELECT c.jogador_id, j.username, j.posicao,
       c.partidas, c.vitorias, c.empates, c.derrotas,
       c.gols, c.assistencias, c.pontos
FROM consolidado c
JOIN jogadores j ON j.id = c.jogador_id
WHERE j.username !~* '^random';   -- convidados temporários fora do Hall

GRANT SELECT ON hall_fama TO anon, authenticated;  -- padrão 016/089
```

- Nenhum ano é contado em dobro por construção (`NOT IN`). O filtro de convidados fica no SELECT externo e cobre os dois ramos de uma vez.
- **Fecho de ano não depende do cron**: em 01/01/2027 a parte viva passa a cobrir 2026+2027 automaticamente — nenhum dado some, nenhuma contagem muda.
- `historico_anual` não recebe grant (o frontend nunca a lê; view roda com privilégios do owner — mesmo precedente da `ranking` expor `username`/`posicao` apesar dos grants colunares de 069/084).

### 4. View `ranking` (temporada corrente)

Redefinida com o **mesmo molde e as mesmas colunas** da atual (089), acrescentando só o filtro de ano na origem:

```sql
WHERE EXTRACT(YEAR FROM l.data_jogo AT TIME ZONE 'America/Sao_Paulo')::int
      = EXTRACT(YEAR FROM now() AT TIME ZONE 'America/Sao_Paulo')::int
```

- Consumo verificado: a view `ranking` só é lida por `src/routes/Ranking.tsx`; nenhuma view/RPC/SQL depende dela — redefinir não quebra nada além da página Ranking, que é a intenção.
- Mesmas colunas ⇒ `Row` de `database.types.ts` continua válido sem ajuste.
- Hoje o comportamento visível não muda (só existe 2026 na base; as partidas importadas começam em 2026-01-08, sem overlap com 2023–25 arquivados).
- `resumo_ano(p_ano)` fica intocada (já recebe o ano explícito).
- Não há materialized views no projeto; `now()` em view comum é avaliada por query — seguro.

### 5. Cron de arquivo (pg_cron, padrão das migrations 104/105)

1º de janeiro, **03:00 UTC = 00:00 BRT** (o pg_cron do Supabase avalia a expressão no fuso da sessão, UTC — ver comentário na migration 060): schedule `'0 3 1 1 *'`, job nomeado + unschedule-if-exists (molde 055/060), log em `cron_execucoes` (molde 104).

O comando calcula o ano-alvo **dentro do job**, no fuso de São Paulo — nunca embutido na expressão:

```sql
v_ano := EXTRACT(YEAR FROM now() AT TIME ZONE 'America/Sao_Paulo')::int - 1;

INSERT INTO historico_anual (ano, jogador_id, partidas, vitorias, empates, derrotas, gols, assistencias, pontos)
SELECT v_ano, jogador_id, ... FROM v_levantamento WHERE EXTRACT(YEAR FROM data_jogo AT TIME ZONE 'America/Sao_Paulo')::int = v_ano ...
ON CONFLICT (ano, jogador_id) DO UPDATE
SET partidas = EXCLUDED.partidas, vitorias = EXCLUDED.vitorias, /* ...idem... */;
```

- **`DO UPDATE`, não `DO NOTHING`**: se partidas do ano forem editadas/corrigidas após o arquivamento, a re-execução cura o arquivo. Mantém a idempotência e o Hall sempre correto.
- Se falhar: nada quebra — o Hall segue contando o ano vivo; quando rodar, a contagem permanece idêntica (o `NOT IN` evita dupla contagem).
- `pontos` do arquivo = V×3+E; `assistencias` do arquivo = soma real (dado existe desde 2026).

## Frontend

### 6. Rotas e registros

- `src/lib/rotas.ts`: carregador único `carregarHallDaFama` (regra do cabeçalho do arquivo) + entrada na `TABELA_PRE_CARREGAMENTO` (`{ padrao: /^\/hall-da-fama/, carregar: carregarHallDaFama }`).
- `src/App.tsx`: rota `/hall-da-fama` com redirect para `/hall-da-fama/gols` (aba default; molde do redirect `/ranking` → `/ranking/pontos`) + rota `/hall-da-fama/:metrica` (lazy).
- `src/routes/Layout.tsx`:
  - entrada em `SKELETONS_POR_ROTA` — `SkeletonRanking` (já desenha 4 abas, casando com as do Hall), mantendo o padrão de CLS=0;
  - matcher da TabBar estendido: `rankingAtivo` também casa `/hall-da-fama` (aba "Ranking" ativa no Hall).
- Prefetch da rota no toque do botão HOF (padrão `preCarregarAoInteragir`).

### 7. `src/routes/Ranking.tsx`

Botão **HOF** no header, à esquerda do botão "Filtros" (linhas ~302–323), estilo do chip existente, `NavLink` para `/hall-da-fama`. Mais nada muda no Ranking.

### 8. Extração de componentes (antes de criar o Hall)

- `src/components/TabelaRanking.tsx`: extrair de `Ranking.tsx` a `TabelaRanking` (~411–511), o `valorOrdenacao` (~150–159) e o tipo `LinhaRanking` (~47–59). Parametrizar as métricas derivadas: Ranking calcula `media_gols`/`percentual_vitorias`; Hall calculará `%pontos = pontos/(3×partidas)` e `gols/jogo`. O render genérico por colunas já tolera a ausência de `gols_contra` (o Hall não terá essa coluna).
- `src/components/CardDestaque.tsx`: extrair o card `Destaque` de `Resumo.tsx` (~171–192), hoje interno e não exportado.
- `Ranking.tsx` e `Resumo.tsx` passam a consumir os extraídos — mudança estrutural pontual, **sem alteração de comportamento visual** (regressão visual: Ranking e Resumo idênticos antes/depois).

### 9. `src/routes/HallDaFama.tsx`

Espelha a mecânica do `Ranking.tsx`:

- Query `supabase.from('hall_fama')` — **sem LIMIT/paginação**, mesma shape da query do Ranking (os destaques do topo dependem do conjunto completo de linhas; travar assim por escrito). Ordenação server-side fixa por pontos desc (ordem de chegada), ordenação por aba/coluna client-side, como o Ranking.
- 4 abas-rotas com swipe (`useSwipeTabs` + `navigate`): **gols**, **pontos** (label "% Pontos"), **assistências**, **partidas**. `%pontos` e `gols/jogo` calculados client-side via `valorOrdenacao` compartilhado.
- Reuso direto: `ModalFiltrosRanking` (posição + mínimo de partidas — props 100% genéricas), `useCache`, `SkeletonRanking`, `PullToRefresh`, `MensagemEstado`, `vibrateLight`.
- Bloco de destaques no topo com `CardDestaque`: **gols, vitórias, %pontos, partidas**, derivado das linhas carregadas e respeitando os filtros ativos (posição filtra na query; mínimo de partidas client-side — derivar de `linhasFiltradas` cobre ambos).
- `jogador_id` como key da linha e para destacar o jogador logado (`useJogadorLogado`), como o Ranking faz.
- Observação: os jogadores históricos têm `posicao = 'random'` — aparecem no filtro "todas as posições"; não há opção "random" no modal (comportamento igual ao dos convidados hoje).
- Nova chave de cache em `chavesCache.ts` (`hall:<filtro>`), padrão `chaveRanking` (convenção "prefixo:parâmetros").
- Aceito como está (cosmético): o slider de mínimo de partidas fica granular demais no histórico (presets 0/6/12/20 pensados para temporada); ajustar depois se incomodar.

### 10. `src/lib/database.types.ts`

Adicionar manualmente apenas `Views.hall_fama` no molde de `Views.ranking` (só `Row` nullable + `Relationships`; sem `gols_contra`). `historico_anual` não é consumida pelo frontend — só entrar em `Tables` se os tipos forem regenerados via CLI.

## Fora do escopo

- Alterar `resumo_ano`, ou a página Resumo **além da extração do `CardDestaque`** (seção 8), ou qualquer regra existente de votação/escalação.
- Renomear/limpar os CSVs além do já feito (ficam no repo como fonte documentada do seed).
- Filtrar convidados da `ranking` (temporada) — decisão válida só para o Hall.

## Validações ao final

- Build + lint verdes.
- Sanidade do consolidado: Danilo 2023–25 = 101+109+83 = **293 gols**; Tadeu = 58+49+56 = **163 gols** e 54+85+75 = **214 pontos**; conferir as demais somas.
- Consulta SQL na `hall_fama` validando V+E+D = partidas por linha, que nenhum ano é contado em dobro (arquivado + vivo) e que **nenhum username `random*` aparece**.
- Regressão visual: Ranking 2026 idêntico ao atual; Ranking e Resumo idênticos após a extração dos componentes (seção 8).
