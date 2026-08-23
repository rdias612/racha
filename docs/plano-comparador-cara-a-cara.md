# Plano de Implementação — Comparador Cara-a-Cara (Confronto Direto)

**Data:** 22/08/2026
**Origem:** Item pendente do [`relatorio-analise-completa.md`](./relatorio-analise-completa.md) — Eixo 4 (Novos requisitos), Feature #2, Prioridade Alta, Complexidade Média.
**Escopo:** Comparação direta entre dois atletas (gols, assistências, notas, retrospecto) + histórico de confrontos diretos **juntos vs adversários**, com toda a agregação resolvida no PostgreSQL.

---

## 📑 Sumário

1. [Objetivo e Requisitos](#1-objetivo-e-requisitos)
2. [Decisões de Arquitetura](#2-decisões-de-arquitetura)
3. [Etapa 1 — Backend: Migration `072_rpc_confronto_direto.sql`](#3-etapa-1--backend-migration-072_rpc_confronto_diretosql)
4. [Etapa 2 — Camada de dados no frontend (`lib/jogadores.ts`)](#4-etapa-2--camada-de-dados-no-frontend-libjogadorests)
5. [Etapa 3 — Rota `Comparador.tsx` (UI)](#5-etapa-3--rota-comparadortsx-ui)
6. [Etapa 4 — Integração de rotas, abas e skeleton](#6-etapa-4--integração-de-rotas-abas-e-skeleton)
7. [Casos extremos e empty states](#7-casos-extremos-e-empty-states)
8. [Ordem de execução e verificação](#8-ordem-de-execução-e-verificação)
9. [Fora do escopo](#9-fora-do-escopo)

---

## 1. Objetivo e Requisitos

Permitir que qualquer atleta responda às perguntas clássicas da resenha de quinta:

1. **Comparativo geral lado a lado** — gols, assistências, gols contra, partidas, vitórias, aproveitamento e média de nota (aparada) dos dois atletas.
2. **Quando jogam juntos** — nº de partidas no mesmo time, retrospecto comum (V/E/D) e produção de cada um nessas partidas (gols, assistências, nota média no contexto).
3. **Quando se enfrentam** — nº de partidas em times opostos, retrospecto individual (espelhado: vitória de A = derrota de B) e produção de cada um nesses duelos.
4. **Últimos confrontos** — lista das partidas mais recentes compartilhadas por ambos, com placar, data e atalho para a súmula (`/partida/:id`).

Requisitos não-funcionais: uma única ida ao banco por bloco de dados (agregação 100% no Postgres), zero UUID, CLS = 0 com skeleton dedicado, alvos de toque >= 44px e identidade "Súmula de Quinta".

---

## 2. Decisões de Arquitetura

| #   | Decisão                                                                                                                | Justificativa                                                                                                                                                                                                                                                                                                                                                               |
| --- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Nova aba `/estatisticas/comparar`** (terceira aba ao lado de "Jogador" e "Racha"), e não rota solta `/comparar`      | Reutiliza o padrão existente de abas com swipe (`useSwipeTabs`) e NavLink em `Estatisticas.tsx`/`EstatisticasRacha.tsx`; mantém a TabBar principal enxuta (5 itens, sem nova entrada); features de estatística vivem sob `/estatisticas/*`. O relatório sugeria "`/comparar` **ou** aba em `Estatisticas.tsx`" — a aba é a opção com menor custo de descoberta e navegação. |
| 2   | **Agregação exclusivamente em 2 RPCs novas** (`confronto_direto` e `confronto_direto_partidas`)                        | Regra 7.5 do AGENTS.md: nunca baixar tabelas para agregar no client. Precedente: `parcerias_jogador` (030) e `parcerias_destaque_jogador` (042) resolvem problema análogo no servidor.                                                                                                                                                                                      |
| 3   | **`RETURNS TABLE` com discriminador `lado`/`bloco`** (sem jsonb de retorno)                                            | Todas as RPCs complexas do projeto retornam `TABLE` (003, 028, 030, 032, 042, 070). O padrão "UNION ALL com coluna discriminadora" já existe na 042 (`metrica`).                                                                                                                                                                                                            |
| 4   | **Duas funções em vez de uma** (agregados vs. lista de partidas)                                                       | Granularidades diferentes (5 linhas agregadas vs. N linhas de partidas) não cabem limpas numa única `TABLE`. O client consolida com `Promise.all` — mesmo padrão de `Estatisticas.tsx` hoje (view + 2 RPCs em paralelo).                                                                                                                                                    |
| 5   | **Comparativo geral reaproveita fontes existentes** (`view stats_jogador` + RPC `obter_medias_notas_jogadores` da 070) | Zero SQL novo para o bloco "Números na Temporada". A RPC nova cobre apenas o que não existe: contexto juntos/adversários.                                                                                                                                                                                                                                                   |
| 6   | **Estado via `useCache`** com chave `comparar:${idA}:${idB}`                                                           | Tela somente-leitura de aba (regra 5.5). Sem mutações, não há `invalidarCache`; `PullToRefresh` recebe `recarregar`. A chave inclui os dois ids (filtros que alteram a query fazem parte da chave).                                                                                                                                                                         |
| 7   | **`partida_placar` como fonte de vencedor e placar**                                                                   | Mesma fonte das views `ranking`/`stats_jogador` — regra de gols contra já corrigida pelas migrations 061–064.                                                                                                                                                                                                                                                               |

---

## 3. Etapa 1 — Backend: Migration `072_rpc_confronto_direto.sql`

Arquivo novo em `supabase/migrations/072_rpc_confronto_direto.sql` (numeração sequencial de 3 dígitos; a 071 é a última). Ao final, **sincronizar `supabase/aplicar_tudo.sql`** com as duas funções — e aproveitar o passo para incluir também a RPC `obter_medias_notas_jogadores` (migration 070), hoje ausente desse script mestre (regra 7.2).

> **Nota de nomenclatura (diretriz 7.3-1):** a regra pede nomes de RPC no infinitivo, porém as RPCs de leitura canônicas do projeto são substantivos (`parcerias_jogador` 030, `pares_racha` 032, `parcerias_destaque_jogador` 042) e o relatório de origem já batizou a feature de `confronto_direto`. Decisão registrada: **manter o substantivo** pelo precedente interno.

### 3.1 RPC `confronto_direto(p_jogador_a, p_jogador_b)`

Agregados por atleta em cada contexto. Sempre 4 linhas (podem ter `partidas = 0` quando o contexto não ocorreu — o client decide exibir ou não o bloco):

```sql
CREATE OR REPLACE FUNCTION confronto_direto(
  p_jogador_a  bigint,
  p_jogador_b  bigint
)
RETURNS TABLE (
  lado         text,    -- 'a' | 'b'  (referente a p_jogador_a / p_jogador_b)
  bloco        text,    -- 'juntos'  | 'adversos'
  partidas     bigint,
  gols         bigint,  -- produção do atleta nas partidas do contexto
  assistencias bigint,
  gols_contra  bigint,
  vitorias     bigint,  -- retrospecto do time do atleta no contexto
  empates      bigint,
  derrotas     bigint,
  media_nota   numeric  -- AVG(partida_notas.avg_rating) do atleta no contexto (NULL se nunca recebeu nota)
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  ...
$$;

GRANT EXECUTE ON FUNCTION confronto_direto(bigint, bigint) TO anon, authenticated;
```

Lógica interna (esboço das CTEs para o implementador):

1. **Validação**: se `p_jogador_a = p_jogador_b` → `RAISE EXCEPTION 'Selecione dois atletas diferentes.'`. Ambos os ids devem existir em `jogadores` com `posicao <> 'random'` (placeholders excluídos de relatórios, regra 8.6) → senão `RAISE EXCEPTION 'Atleta não encontrado.'`.
   > ⚠️ **`LANGUAGE plpgsql` obrigatório**: `RAISE EXCEPTION` não existe em funções `LANGUAGE sql` (as RPCs SQL do projeto — 030/042/070 — justamente não validam server-side). Precedente de validação em PL/pgSQL: `salvar_edicao_partida` (068). Como em plpgsql as colunas do `RETURNS TABLE` viram variáveis, **qualificar todas as referências de coluna** nas queries (`pp.gols`, `p.status`, `pl.vencedor`...) para evitar a ambiguidade corrigida na migration 044.
2. **CTE `encontros`**: partidas com `status IN ('published','closed')` em que **ambos** participaram, trazendo `partida_id`, `time_a` (time do jogador A), `time_b`, `vencedor` e placar via `JOIN partida_placar`.
3. **CTE `notas`**: `partida_id`, `target_id`, `avg_rating` da view `partida_notas` para os dois atletas (1 linha por partida — a view já agrega por `(partida_id, target_id)`, logo `LEFT JOIN` não infla `COUNT(*)`; mesmo artifício da 042).
4. **Derivação `juntos`** (`time_a = time_b`): produção individual (`SUM` de gols/assistências/gols_contra de cada atleta) + retrospecto **comum** (V/E/D comparando o time compartilhado com `vencedor`) + média de nota individual no contexto.
5. **Derivação `adversos`** (`time_a <> time_b`): idem, mas o retrospecto é calculado por atleta contra o seu próprio time (o espelhamento A-vence=B-perde emerge naturalmente).
6. Saída final: `UNION ALL` das 4 combinações (`lado` × `bloco`), com `ORDER BY bloco, lado` (ordenação de cortesia; o client mapeia por `(lado, bloco)`, nunca por índice).

### 3.2 RPC `confronto_direto_partidas(p_jogador_a, p_jogador_b, p_limite)`

Histórico das últimas partidas compartilhadas (as duas relações juntas, mais recentes primeiro):

```sql
CREATE OR REPLACE FUNCTION confronto_direto_partidas(
  p_jogador_a  bigint,
  p_jogador_b  bigint,
  p_limite     integer DEFAULT 10
)
RETURNS TABLE (
  partida_id   bigint,
  data_jogo    timestamptz,  -- partidas.data_jogo
  relacao      text,         -- 'juntos' | 'adversos'
  time_a       text,         -- time ('a'|'b') do jogador A naquela partida
  gols_time_a  bigint,       -- placar final via partida_placar
  gols_time_b  bigint,
  vencedor     text          -- 'a' | 'b' | 'empate'
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  ...
$$;

GRANT EXECUTE ON FUNCTION confronto_direto_partidas(bigint, bigint, integer) TO anon, authenticated;
```

Mesma CTE `encontros` da 3.1, com `ORDER BY data_jogo DESC LIMIT LEAST(GREATEST(p_limite, 1), 50)` (clamp defensivo). Reaplica as validações de ids (mesmos `RAISE EXCEPTION`).

> **Notas de conformidade (AGENTS.md 7.3):** nomes em português snake_case; parâmetros `p_`; `STABLE` (leitura agregada pura); `SECURITY DEFINER` + `SET search_path = public`; `GRANT EXECUTE ... TO anon, authenticated` explícito; zero UUID (apenas `bigint`). Aplicação da migration conforme [`GUIA/MIGRACOES_AUTOMATICAS.md`](../GUIA/MIGRACOES_AUTOMATICAS.md).

---

## 4. Etapa 2 — Camada de dados no frontend (`lib/jogadores.ts`)

Acrescentar ao módulo de domínio de jogadores (mesmo lar de `obterMediasNotasJogadores`):

```ts
// Contexto do confronto: 4 linhas da RPC confronto_direto mapeadas por (lado, bloco)
export interface LinhaConfronto {
  lado: 'a' | 'b';
  bloco: 'juntos' | 'adversos';
  partidas: number;
  gols: number;
  assistencias: number;
  gols_contra: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  media_nota: number | null;
}

export interface PartidaConfronto {
  partida_id: number;
  data_jogo: string;
  relacao: 'juntos' | 'adversos';
  time_a: string;
  gols_time_a: number;
  gols_time_b: number;
  vencedor: string;
}

// Função pura: apenas consulta e lança erro (nunca seta estado) — requisito do useCache
export async function compararJogadores(
  a: number,
  b: number,
  limite = 10
): Promise<{
  linhas: LinhaConfronto[];
  partidas: PartidaConfronto[];
}>;
```

Implementação: `Promise.all` das duas RPCs via `supabase.rpc('confronto_direto', ...)` e `supabase.rpc('confronto_direto_partidas', ...)`; erros repassados com `throw` (o `useCache`/`formatarMensagemErro` cuidam da mensagem amigável — as exceções da RPC já vêm em pt-BR).

---

## 5. Etapa 3 — Rota `Comparador.tsx` (UI)

Nova tela em `src/routes/Comparador.tsx`. **Tom de voz Nível 3** (estatísticas do racha — design-system 1.3): leve, de resenha, sem cair em termos SaaS. Título canônico: **"Confronto Direto"** (evitar "Head-to-Head", "Versus", "Compare").

### 5.1 Estrutura de estado e dados

```tsx
// Todos os hooks no topo, antes de qualquer retorno condicional (regra 5.1):
// - useSessao (A default = atleta logado; B default = null)
// - useState: idA, idB, lista de jogadores (carregada 1x via listarTodosJogadores()
//   em useEffect com flag `let ativo = true`)
// - useCache(`comparar:${idA}:${idB}`, buscar) onde buscar é useCallback estável e
//   puro; quando idB === null, resolve estrutura vazia sem tocar no banco
//   (a chave muda para `comparar:${idA}:-` e nenhuma RPC dispara)
```

> **Comportamento transitório conhecido:** ao selecionar B pela primeira vez, o `useCache` troca a chave mantendo os "dados antigos" (estrutura vazia) na tela até a resposta chegar, sem skeleton ("adjust state during render"). O empty state "Escolha dois atletas" pisca por um instante — transitório aceitável; se incomodar, renderizar o empty state de seleção condicionalmente **fora** do `useCache`.

- Lista de atletas: `listarTodosJogadores()` (já filtra `random\d*` — regra 8.6; permite comparar veteranos inativos que têm histórico).
- Trocar lados: botão de swap entre os seletores (haptic `vibrateLight`); a ordem trocada gera chave nova — trocas futuras saem grátis do cache em memória.

### 5.2 Anatomia visual (topo → base)

1. **Cabeçalho de súmula**: `sumula-header` com "Confronto Direto" (`font-display uppercase tracking-wider`) e tag mono "Estatísticas CBO".
2. **Abas** (padrão atual replicado nas três telas de estatísticas): `Jogador | Racha | Comparar`.
3. **Card do duelo** (card semântico legítimo — é o herói da tela, análogo ao Card do Craque): avatares `Avatar` lado a lado com plaqueta de posição, nomes em `font-display`, "×" central em `font-mono`; botão de swap no cartão (alvo 44px).
4. **Seletores A/B**: dois `<select>` em `bg-superficie-2`, `text-base` (anti-zoom iOS), `rounded-[4px]` (padrão de inputs do AGENTS.md 4.2.5), labels `<label htmlFor>` "Atleta A"/"Atleta B", foco visível `focus-visible:outline-2 outline-destaque`.
5. **Números na Temporada** — lista contínua comparativa (`divide-y divide-borda/40 border-y border-borda`, padrão 3.1 do design-system; **não** empilhar StatBoxes soltos): cada linha = `valor A | rótulo central | valor B`, valores em `font-mono tabular-nums`, com destaque sutil (`text-destaque`) no lado que domina a métrica. Fontes: `stats_jogador` (via query `.in('jogador_id', [idA, idB])`) e `obter_medias_notas_jogadores()` para as notas — buscadas dentro do mesmo `buscar` do `useCache` (junto com `compararJogadores`), tudo em paralelo. Barra de domínio opcional por linha usando `bg-preto-time`/`bg-branco-time` (tokens existentes) — deixando claro na UI que preto/branco identificam apenas os **lados esquerdo/direito** do comparativo (Atleta A / Atleta B), não a camisa de nenhum time.
6. **Bloco "Quando Vestem o Mesmo Manto" (juntos)**: retrospecto comum `V-E-D` em mono, produção de cada atleta nas partidas conjuntas (gols/assists/nota no contexto). Se `partidas = 0` → `MensagemEstado tipo="info"`: "Ainda não dividiram o mesmo time." (ver 7. Empty states).
7. **Bloco "Quando se Enfrentam" (adversos)**: retrospecto individual espelhado (duas linhas V-E-D, uma por atleta) + produção em campo oposto.
8. **Últimos Confrontos** — lista contínua: data (`formatarDataLista`), mini-placar `gols_time_a × gols_time_b` em `font-mono` (estilo mural do `Jogos.tsx`), badge `rounded-[2px]` "Juntos"/"Rival" e navegação para `/partida/:id` via `Link` com `preCarregarRota` em `onTouchStart`/`onMouseEnter`.
9. Tudo envolto em `<PullToRefresh onRefresh={recarregar}>` e `swipeHandlers` do `useSwipeTabs`.

### 5.3 Regras de interface obrigatórias

- Tokens semânticos apenas (`bg-superficie`, `border-borda`, `text-giz`, `text-destaque`...) — proibido hex/Tailwind genérico.
- Cantos `rounded-[4px]` (cards/seletores), `rounded-[3px]` (interno), `rounded-[2px]` (badges); sombras `shadow-carimbo`.
- Tipografia: `font-display uppercase` em títulos/rótulos; `font-mono tabular-nums` em todos os números; `font-sans` em textos de apoio.
- Todos os alvos de toque `min-h-[44px]` (seletores, swap, linhas do histórico navegáveis).
- Erros via `formatarMensagemErro` + `MensagemEstado`; **nunca** `error.message` cru, `window.confirm` ou `alert`.

---

## 6. Etapa 4 — Integração de rotas, abas e skeleton

Checklist fechado de arquivos a tocar (todos os pontos de registro centralizado):

| Arquivo                            | Mudança                                                                                                                                                                                                                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/rotas.ts`                 | `carregarComparador` + `export const Comparador = lazy(...)` + entrada `{ padrao: /^\/estatisticas\/comparar/, carregar: carregarComparador }` na `TABELA_PRE_CARREGAMENTO` **antes** de `/^\/estatisticas/` (ordem importa). Único lugar com `import()` de rotas (regra 6.7). |
| `src/App.tsx`                      | `<Route path="/estatisticas/comparar" element={<Comparador />} />` dentro do `Layout`.                                                                                                                                                                                         |
| `src/routes/Estatisticas.tsx`      | + NavLink "Comparar"; `useSwipeTabs` passa a `['/estatisticas/jogador', '/estatisticas/racha', '/estatisticas/comparar']`.                                                                                                                                                     |
| `src/routes/EstatisticasRacha.tsx` | Idem (mesma lista de abas, `activeTab: '/estatisticas/racha'`).                                                                                                                                                                                                                |
| `src/routes/Comparador.tsx`        | Nova rota (etapa 3).                                                                                                                                                                                                                                                           |
| `src/components/Skeletons.tsx`     | + `SkeletonComparador` espelhando a anatomia da tela (header, abas, card do duelo, 2 seletores, ~6 linhas de métricas, blocos juntos/adversos, 4 linhas de histórico) para CLS = 0 (regra 5.4).                                                                                |
| `src/routes/Layout.tsx`            | Entrada `{ padrao: /^\/estatisticas\/comparar/, Skeleton: SkeletonComparador }` no `SKELETONS_POR_ROTA` **antes** de `/^\/estatisticas/`.                                                                                                                                      |
| `supabase/aplicar_tudo.sql`        | Espelhar as duas funções da migration 072 (regra 7.2).                                                                                                                                                                                                                         |

---

## 7. Casos extremos e empty states

| Caso                                         | Comportamento                                                                                                                                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B não selecionado                            | Tela exibe seletores + `MensagemEstado tipo="info"` "Escolha dois atletas para abrir o confronto." Nenhuma RPC disparada.                                                                        |
| A = B                                        | Bloqueado no `<select>` (opção desabilitada) **e** no servidor (`RAISE EXCEPTION`); `formatarMensagemErro` exibe a mensagem amigável.                                                            |
| Nunca jogaram juntos                         | Bloco "juntos" oculto ou com empty state info: "Ainda não dividiram o mesmo time."                                                                                                               |
| Nunca se enfrentaram                         | Bloco "adversos" com empty state info: "Ainda não se enfrentaram em campos opostos."                                                                                                             |
| Nunca jogaram juntos **nem** adversários     | Histórico substituído por empty state único: "Estes atletas ainda não se cruzaram em súmula nenhuma."                                                                                            |
| Atleta sem partidas/votos                    | `stats_jogador` sem linha → zeros; `media_nota = null` → exibir "—" em mono.                                                                                                                     |
| Random (`random\d*`)                         | Fora dos seletores (`listarTodosJogadores` filtra) e rejeitado pela RPC (regra 8.6).                                                                                                             |
| Deep-link direto em `/estatisticas/comparar` | Tela funcional sem histórico de navegação (não usa `navigate(-1)`; a volta é pelas abas/TabBar).                                                                                                 |
| Offline                                      | `supabase.rpc` é POST (o SW cacheia apenas GETs): a tela depende do cache em memória do `useCache`; sem rede e sem cache → `MensagemEstado` de erro amigável. Documentar limitação, não mitigar. |

---

## 8. Ordem de execução e verificação

Sequência recomendada (cada etapa deixa o app verde):

1. **Migration 072** + sync do `aplicar_tudo.sql` + aplicação no Supabase (guia de migrações).
2. **`lib/jogadores.ts`**: tipos e `compararJogadores` puro.
3. **`Comparador.tsx`** + `SkeletonComparador` + registros (`rotas.ts`, `App.tsx`, `Layout.tsx`) + terceira aba nas telas de estatísticas.
4. **Verificação final** (checklist do AGENTS.md 11.2):
   - `npm run lint` → 0 erros (tsc + eslint).
   - `npm run format` → Prettier alinhado.
   - `npm run build` → `dist/` sem falhas.
   - Hooks no topo; `useCache` como único escritor de estado (sem flags `ativo` na rota — exceção arquitetural 5.5; a lista de jogadores em `useEffect` próprio **usa** a flag).
   - Fidelidade ao design-system: lista contínua como padrão, card apenas no duelo, tokens semânticos, tríade tipográfica, cantos 4px, `shadow-carimbo`.
   - SQL: sem UUID, `SECURITY DEFINER` + `search_path` + `GRANT EXECUTE`, numeração 072.

**Testes manuais de aceite:**

- [ ] Selecionar A e B quaisquer → comparativo geral bate com a aba "Jogador" individual (mesma fonte `stats_jogador`).
- [ ] Retrospecto "adversos" de A é o espelho de B (V_A = D_B etc., empates iguais).
- [ ] Vitórias somando "juntos" + "adversos" <= vitórias totais da carreira de cada atleta.
- [ ] Troca de lados (swap) redesenha a tela com os lados invertidos.
- [ ] Linha do histórico navega para a súmula correta e o placar bate com o mural de `Jogos`.
- [ ] Swipe entre as três abas de estatísticas nos dois sentidos; pull-to-refresh recarrega o confronto.
- [ ] Navegação direta por URL e pelo app ambas funcionam.

---

## 9. Fora do escopo (V1)

- Comparação de 3+ atletas simultâneos.
- Filtros por temporada/período ("só 2026").
- Nota média contextuada por casa/fora ou por fase da noite.
- Share do confronto como imagem/texto para o grupo do WhatsApp (candidato natural a follow-up junto da cobrança via WhatsApp, feature #1 do backlog).
