# Plano: Estatísticas de Companheiros e Adversários

## TL;DR

Adicionar ao `/perfil` uma seção **"Parcerias"** com 4 cards: **melhor/pior companheiro** (mesmo time) e **melhor/pior adversário** (contra), baseado em **% de pontos conquistados** = `(vitórias*3 + empates*1) / (partidas_juntos*3)`. Implementado via 1 nova RPC PostgreSQL que devolve o ranking completo de parcerias do jogador (extensível), filtrando parcerias com **≥5 partidas**.

---

## Definição da métrica

- `pontos = vitórias*3 + empates*1` (mesmo critério da view `ranking`)
- `percentual = pontos / (partidas_juntos * 3)` → razão sobre o máximo possível
  - 100% = só vitórias
  - 0% = só derrotas
- **Companheiro**: A e B no **mesmo** `time` (a/b) na mesma partida → vitória quando `partida_placar.vencedor = time`
- **Adversário**: A e B em **times diferentes** na mesma partida → vitória de A quando `partida_placar.vencedor = time_do_A`
- Filtro: `HAVING COUNT(*) >= p_min_partidas` (default 5). Parcerias com menos jogos são descartadas — evita fluke de 1 jogo.
- Escopo: apenas partidas `status IN ('published','closed')`, igual ao `ranking` / `stats_jogador`.

---

## Decisões do produto (alinhadas com o usuário)

| Pergunta            | Resposta                                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Onde exibir?        | Seção nova na rota `/perfil` (`src/routes/Perfil.tsx`). Mais natural ("MEU melhor companheiro").                                            |
| Mínimo de partidas? | **5**. Padrão equilibrado, evita ruído.                                                                                                     |
| Escopo da feature?  | **Base extensível** — RPC devolve lista completa ordenada por %, o frontend mostra só top/bottom. Fácil expandir para tela dedicada depois. |
| Adversários?        | **Sim**, incluir melhor/pior adversário junto com companheiros.                                                                             |
| Critério de pontos? | Mesmo do `ranking` (3 vitória / 1 empate) para consistência.                                                                                |

---

## Fases

### Fase 1 — SQL (backend)

**1.1** Criar migration `supabase/migrations/030_rpc_parcerias_jogador.sql`:

- RPC `parcerias_jogador(p_jogador_id bigint, p_min_partidas integer DEFAULT 5)`
- `RETURNS TABLE`:
  - `tipo text` — `'companheiro'` ou `'adversario'`
  - `outro_jogador_id bigint`
  - `nome text`
  - `partidas bigint`
  - `vitorias bigint`
  - `empates bigint`
  - `derrotas bigint`
  - `pontos bigint`
  - `percentual numeric` — `pontos / (partidas * 3)`, `NULL` se `partidas = 0`
- `LANGUAGE sql`, `SECURITY DEFINER`, `SET search_path = public` (seguir padrão de `028_rpc_resumo_ano.sql`).

Estrutura da query:

```sql
-- CTE 1: todas as partidas do jogador logado com seu time + vencedor
WITH jogador_partidas AS (
  SELECT pp.partida_id, pp.time, pl.vencedor
  FROM partidas_participantes pp
  JOIN partidas      p  ON p.id  = pp.partida_id
  JOIN partida_placar pl ON pl.partida_id = pp.partida_id
  WHERE pp.jogador_id = p_jogador_id
    AND p.status IN ('published','closed')
),
-- CTE 2: companheiros (mesmo time)
companheiros AS (
  SELECT
    'companheiro'::text AS tipo,
    outp.jogador_id,
    j.nome,
    COUNT(*)::bigint                      AS partidas,
    COUNT(*) FILTER (WHERE jp.vencedor = jp.time)::bigint   AS vitorias,
    COUNT(*) FILTER (WHERE jp.vencedor = 'empate')::bigint  AS empates,
    COUNT(*) FILTER (WHERE jp.vencedor <> jp.time
                      AND jp.vencedor <> 'empate')::bigint   AS derrotas
  FROM jogador_partidas jp
  JOIN partidas_participantes outp
    ON outp.partida_id = jp.partida_id
   AND outp.time       = jp.time                 -- mesmo time
   AND outp.jogador_id <> p_jogador_id
  JOIN jogadores j ON j.id = outp.jogador_id
  GROUP BY outp.jogador_id, j.nome
  HAVING COUNT(*) >= p_min_partidas
),
-- CTE 3: adversários (time diferente)
adversarios AS (
  SELECT
    'adversario'::text AS tipo,
    outp.jogador_id,
    j.nome,
    COUNT(*)::bigint                      AS partidas,
    COUNT(*) FILTER (WHERE jp.vencedor = jp.time)::bigint   AS vitorias,
    COUNT(*) FILTER (WHERE jp.vencedor = 'empate')::bigint  AS empates,
    COUNT(*) FILTER (WHERE jp.vencedor <> jp.time
                      AND jp.vencedor <> 'empate')::bigint   AS derrotas
  FROM jogador_partidas jp
  JOIN partidas_participantes outp
    ON outp.partida_id = jp.partida_id
   AND outp.time       <> jp.time                -- time diferente
   AND outp.jogador_id <> p_jogador_id
  JOIN jogadores j ON j.id = outp.jogador_id
  GROUP BY outp.jogador_id, j.nome
  HAVING COUNT(*) >= p_min_partidas
),
todos AS (
  SELECT * FROM companheiros
  UNION ALL
  SELECT * FROM adversarios
)
SELECT
  tipo,
  jogador_id AS outro_jogador_id,
  nome,
  partidas,
  vitorias,
  empates,
  derrotas,
  (vitorias * 3 + empates)::bigint AS pontos,
  (vitorias * 3 + empates)::numeric
    / NULLIF(partidas * 3, 0) AS percentual
FROM todos
ORDER BY
  tipo ASC,                          -- companheiros primeiro, depois adversarios
  percentual DESC NULLS LAST,
  partidas DESC,
  vitorias DESC,
  nome ASC;
```

- `GRANT EXECUTE ON FUNCTION parcerias_jogador(bigint, integer) TO anon, authenticated;`

> **Referência de padrão**: lógica de JOIN + `partida_placar` idêntica às views `009_view_ranking.sql` e `010_view_stats_jogador.sql`, e ao RPC `028_rpc_resumo_ano.sql` (ver cabeçalho `SECURITY DEFINER` + `SET search_path` + `GRANT`).

**1.2** Anexar `\i 030_rpc_parcerias_jogador.sql` ao `supabase/aplicar_tudo.sql` (manter ordem numérica).

**1.3** _(não-bloqueante, manual)_ Rodar `aplicar_tudo.sql` (ou só a `030`) no Supabase Studio do projeto.

---

### Fase 2 — Types (frontend)

**2.1** Em `src/routes/Perfil.tsx`, adicionar interface:

```ts
interface Parceria {
  tipo: "companheiro" | "adversario";
  outro_jogador_id: number;
  nome: string;
  partidas: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  pontos: number;
  percentual: number | null;
}
```

---

### Fase 3 — Fetch no Perfil

**3.1** Em `Perfil.tsx`, adicionar estado `parcerias` (`Parceria[] | null`), `carregandoParcerias`, `erroParcerias`.

**3.2** Buscar via **novo `useEffect` paralelo** (não atrasa os stats básicos):

```ts
supabase.rpc("parcerias_jogador", {
  p_jogador_id: jogador.id,
  p_min_partidas: 5,
});
```

**3.3** Derivar do resultado (a lista já vem ordenada por `% DESC` dentro de cada `tipo`):

- `companheiros = parcerias.filter(p => p.tipo === 'companheiro')`
- `adversarios  = parcerias.filter(p => p.tipo === 'adversario')`
- `melhorComp = companheiros[0]`
- `piorComp    = companheiros.at(-1)`
- `melhorAdv   = adversarios[0]`
- `piorAdv     = adversarios.at(-1)`

---

### Fase 4 — UI

**4.1** Nova `<section>` no `Perfil.tsx`, posicionada **entre** o bloco "Estatísticas" e o bloco "Alterar senha". Reutilizar o padrão visual já existente: `<section>` + `<h3>` com classes `text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400`.

**4.2** Subcomponente `ParceriaCard({ titulo, parceria })`:

- `parceria == null` → placeholder: _"Sem dados suficientes (mín. 5 partidas)"_
- caso contrário:
  - nome em **bold** (`text-neutral-900 dark:text-neutral-100`)
  - `${Math.round((percentual ?? 0) * 100)}%` em `--cor-destaque`
  - detalhe: `${partidas} partidas · ${vitorias}V ${empates}E ${derrotas}D`

> Espelhar estilo de `StatBox` (em `Perfil.tsx`) e `Destaque` (em `Resumo.tsx`).

**4.3** Estrutura da seção:

```
Parcerias
  Companheiros de time
    [grid 2 colunas]
      Melhor companheiro  → ParceriaCard
      Pior companheiro    → ParceriaCard
  Adversários
    [grid 2 colunas]
      Melhor % contra     → ParceriaCard
      Pior % contra       → ParceriaCard
```

Rótulos em PT-BR, alinhados ao tom do app ("Resumo de {ano}", "O que importa é participar").

**4.4** Estados:

- `Carregando compacto` (reutilizar componente existente) durante o fetch.
- `MensagemEstado` (reutilizar) em caso de erro.
- **Empty state**: se não vier nenhuma parceria (companheiros e adversários vazios) → mensagem curta: _"Ainda não há parcerias com 5+ partidas."_

---

## Relevant files

| Arquivo                                             | Ação       | Descrição                                                                                                                                                                                                                   |
| --------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/030_rpc_parcerias_jogador.sql` | **CRIAR**  | Nova RPC `parcerias_jogador`. Modelar após `028_rpc_resumo_ano.sql`.                                                                                                                                                        |
| `supabase/aplicar_tudo.sql`                         | **EDITAR** | Acressentar `\i 030_rpc_parcerias_jogador.sql`.                                                                                                                                                                             |
| `src/routes/Perfil.tsx`                             | **EDITAR** | Interface `Parceria`, estado + fetch RPC, subcomponente `ParceriaCard`, nova seção entre "Estatísticas" e "Alterar senha". Reutiliza `useSessao().jogador.id`, `Carregando`, `MensagemEstado`, classes Tailwind existentes. |

---

## Padrões de referência (reuso, não só nome de arquivo)

- **Lógica de resultado** (`vencedor = time`): `COUNT(*) FILTER (WHERE pl.vencedor = pp.time)` em `009_view_ranking.sql` e `010_view_stats_jogador.sql`.
- **Filtro de status**: `WHERE p.status IN ('published','closed')` — mesmo do `ranking` / `stats_jogador`.
- **Estrutura de RPC**: `028_rpc_resumo_ano.sql` (CTEs + `SECURITY DEFINER` + `SET search_path = public` + `GRANT` final).
- **Padrão visual/UI**: `Perfil.tsx` (`StatBox`), `Resumo.tsx` (`Destaque`), classes Tailwind já consistentes no app.

---

## Verification

1. **SQL** — rodar no Supabase SQL Editor:
   - `SELECT * FROM parcerias_jogador(<id_de_um_jogador_ativo>, 5);` → devolve companheiros + adversários ordenados por `tipo, percentual DESC`.
   - Conferir manualmente contra `partida_placar` para um par conhecido: contar quantas partidas A e B dividiram time; checar `vitorias`/`empates`/`derrotas` do ponto de vista de A.
   - Validar `percentual = pontos / (partidas*3)` em pelo menos 1 linha; garantir `percentual <= 1`.
   - Jogador sem partidas → devolve lista vazia (não erro).
   - Criar uma `draft` e confirmar que ela **não** aparece.
2. **TS** — `npx tsc --noEmit` sem erros.
3. **Build** — `npm run build` passa com exit code 0.
4. **App** — logar como qualquer jogador → abrir `/perfil` → ver a seção **"Parcerias"** com 4 cards. Jogadores com <5 partidas junto de qualquer outro: cards aparecem como placeholder.
5. **Edge cases**: jogador novato (sem partidas), jogador com poucos jogos (<5 com todos → todos placeholders), jogador com histórico longo (top/bottom faz sentido).

---

## Escopo — incluído / excluído

**Incluído:**

- RPC única `parcerias_jogador` (companheiros + adversários numa chamada só).
- Seção "Parcerias" no `/perfil` com 4 cards.
- Filtro de 5 partidas mínimas.

**Excluído** (deixar para depois):

- Rota dedicada `/companheiros` com ranking completo de todos os parceiros (a RPC já devolve tudo, trivial seguir).
- Filtro por ano/período.
- Estatística _"com quem mais fiz gols"_, _"com quem mais levei gols"_, etc.
- Nomes clicáveis (não existe rota pública de perfil de terceiro hoje).

---

## Further Considerations

1. **`p_min_partidas` configurável na UI?** Hoje fixo em 5 na chamada. Recomendo deixar fixo por enquanto; fácil adicionar toggle (2/5/10) depois — a RPC já recebe o parâmetro.
2. **Deploy do SQL**: o arquivo de migration é só código — é preciso rodar `aplicar_tudo.sql` (ou só a `030`) no Supabase Studio do projeto. Passo manual, fora do controle do app.
3. **Numbering**: a migration foi renumberada de `029` → `030` porque `029_add_posicao_view_ranking.sql` já existe.
