# Plano: Estatísticas de Companheiros e Adversários

## TL;DR

Criar uma nova rota **`/estatisticas`** (e aba correspondente na nav do `Layout`) para abrigar as estatísticas do jogador logado. A página terá **dois módulos** iniciais: **(1) Estatísticas básicas** — duplicação das stats já existentes no Perfil (Partidas / Vitórias / Gols / Assists / Gols contra); **(2) Parcerias** — 4 cards com **melhor/pior companheiro** (mesmo time) e **melhor/pior adversário** (contra), baseado em **% de pontos conquistados** = `(vitórias*3 + empates*1) / (partidas_juntos*3)`. Backend: 1 nova RPC PostgreSQL que devolve o ranking completo de parcerias (extensível), filtrando parcerias com **≥5 partidas**.

**Importante**: o bloco de estatísticas básicas no `/perfil` **permanece intacto** — elas são **duplicadas** em `/estatisticas`, não removidas do Perfil. A página é o ponto de entrada para futuras estatísticas avançadas.

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
| Onde exibir?        | Nova rota **`/estatisticas`** + aba nova na nav do `Layout`. Página com módulos em `<section>`; futuros módulos entram como novas sections. |
| Conteúdo inicial?   | Dois módulos: **"Estatísticas básicas"** (duplicada do Perfil) + **"Parcerias"** (4 cards).                                                 |
| Perfil atual?       | **Intacto**. As stats básicas lá são **duplicadas** em `/estatisticas`, não removidas.                                                      |
| Mínimo de partidas? | **5** (só p/ o módulo Parcerias). Padrão equilibrado, evita ruído.                                                                          |
| Escopo da feature?  | **Base extensível** — RPC devolve lista completa ordenada por %, o frontend mostra só top/bottom. Fácil expandir para mais módulos depois.  |
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

### Fase 2 — Nova rota `/estatisticas`

**2.1** Criar `src/routes/Estatisticas.tsx` — nova página que abrigará os módulos de estatísticas. Hoje: **"Estatísticas básicas"** + **"Parcerias"**. Estrutura esqueleto:

```tsx
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useSessao } from '../context/SessaoContext';
import { Carregando, MensagemEstado } from '../components/Estado';

// Stats básicas (igualzinho ao Perfil)
interface Stats {
  jogador_id: number;
  partidas: number;
  gols: number;
  assistencias: number;
  gols_contra: number;
  vitorias: number;
}

// Parcerias (nova)
interface Parceria {
  tipo: 'companheiro' | 'adversario';
  outro_jogador_id: number;
  nome: string;
  partidas: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  pontos: number;
  percentual: number | null;
}

export function Estatisticas() {
  const { jogador } = useSessao();
  const [stats, setStats] = useState<Stats | null>(null);
  const [parcerias, setParcerias] = useState<Parceria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!jogador) return;

    // busca paralela: stats básicas (mesma query do Perfil) + parcerias
    Promise.all([
      supabase
        .from('stats_jogador')
        .select('jogador_id, partidas, gols, assistencias, gols_contra, vitorias')
        .eq('jogador_id', jogador.id)
        .maybeSingle(),
      supabase.rpc('parcerias_jogador', {
        p_jogador_id: jogador.id,
        p_min_partidas: 5,
      }),
    ]).then(([resStats, resParc]) => {
      if (resStats.error) return setErro(resStats.error.message);
      if (resParc.error) return setErro(resParc.error.message);
      setStats(resStats.data);
      setParcerias(resParc.data ?? []);
      setCarregando(false);
    });
  }, [jogador?.id]);

  if (!jogador) return null;
  // ... render (ver Fase 3)
}
```

> **Observação**: a query de `stats_jogador` é **idêntica** à que já existe em `Perfil.tsx`. Por simplicidade **duplicamos** o subcomponente `StatBox` em `Estatisticas.tsx` por enquanto (passível de refatoração depois — ver Escopo).

**2.2** Registrar a rota em `src/App.tsx`:

- Importar `Estatisticas`.
- Adicionar `<Route path="/estatisticas" element={<Estatisticas />} />` dentro do grupo do `Layout` (mesmo nível de `/perfil`, `/jogos`, etc.).

**2.3** Adicionar a aba na nav do `src/routes/Layout.tsx`:

- Inserir um `<NavLink to="/estatisticas">` com a mesma classe `itemClasse`.
- Ícone: 📊 (estatísticas). Posição: depois de "Rankings" e antes do "Perfil" (que tem `ml-auto`).

---

### Fase 3 — UI da página

**3.1** Em `Estatisticas.tsx`, derivar do resultado (a lista da RPC já vem ordenada por `% DESC` dentro de cada `tipo`):

- `companheiros = parcerias.filter((p) => p.tipo === "companheiro")`
- `adversarios  = parcerias.filter((p) => p.tipo === "adversario")`
- `melhorComp = companheiros[0]`
- `piorComp    = companheiros.at(-1)`
- `melhorAdv   = adversarios[0]`
- `piorAdv     = adversarios.at(-1)`

**3.2** Subcomponentes (no mesmo arquivo):

- **`StatBox({ label, value })`** — duplicado do `Perfil.tsx` (mesma estrutura/classes Tailwind). Renderiza um número grande em `--cor-destaque` + label pequeno uppercase.
- **`ParceriaCard({ titulo, parceria })`**:
  - `parceria == null` → placeholder: _"Sem dados suficientes (mín. 5 partidas)"_
  - caso contrário:
    - nome em **bold** (`text-neutral-900 dark:text-neutral-100`)
    - `${Math.round((percentual ?? 0) * 100)}%` em `--cor-destaque`
    - detalhe: `${partidas} partidas · ${vitorias}V ${empates}E ${derrotas}D`

> Espelhar estilo de `StatBox` (em `Perfil.tsx`) e `Destaque` (em `Resumo.tsx`).

**3.3** Estrutura da página:

```
Estatísticas  ← título da rota (h2)

[Estatísticas básicas]   ← módulo 1 (section + h3)
  [grid 5 colunas]
    Partidas    → StatBox
    Vitórias    → StatBox
    Gols        → StatBox
    Assists     → StatBox
    Gols contra → StatBox

[Parcerias]              ← módulo 2 (section + h3)
  Companheiros de time
    [grid 2 colunas]
      Melhor companheiro  → ParceriaCard
      Pior companheiro    → ParceriaCard
  Adversários
    [grid 2 colunas]
      Melhor % contra     → ParceriaCard
      Pior % contra       → ParceriaCard

( futuros módulos entram aqui como novas <section> )
```

Rótulos em PT-BR, alinhados ao tom do app ("Resumo de {ano}", "O que importa é participar").

**3.4** Estados:

- `Carregando` (reutilizar componente existente) durante o fetch.
- `MensagemEstado` (reutilizar) em caso de erro.
- **Empty state de Parcerias**: se não vier nenhuma parceria (companheiros e adversários vazios) → mensagem curta: _"Ainda não há parcerias com 5+ partidas."_ (As stat boxes básicas sempre renderizam, mesmo zeradas.)

> **Fonte dos dados das stats básicas**: view `stats_jogador` (migration `010_view_stats_jogador.sql`), a mesma que o Perfil já consome. Sem nova RPC para isto.

---

## Relevant files

| Arquivo                                             | Ação       | Descrição                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/030_rpc_parcerias_jogador.sql` | **CRIAR**  | Nova RPC `parcerias_jogador`. Modelar após `028_rpc_resumo_ano.sql`.                                                                                                                                                                                                                                                                                                                                                                                        |
| `supabase/aplicar_tudo.sql`                         | **EDITAR** | Acressentar `\i 030_rpc_parcerias_jogador.sql`.                                                                                                                                                                                                                                                                                                                                                                                                             |
| `src/routes/Estatisticas.tsx`                       | **CRIAR**  | Nova página/rota `/estatisticas`. Estrutura extensível (módulos em `<section>`). Hoje: módulo 1 "Estatísticas básicas" (5 `StatBox` lendo `stats_jogador`) + módulo 2 "Parcerias" (4 `ParceriaCard` lendo a RPC). Contém interfaces `Stats` e `Parceria`, fetch paralelo (`Promise.all`), subcomponentes `StatBox` (duplicado do Perfil) e `ParceriaCard`. Reutiliza `useSessao().jogador.id`, `Carregando`, `MensagemEstado`, classes Tailwind existentes. |
| `src/App.tsx`                                       | **EDITAR** | Importar `Estatisticas` e adicionar `<Route path="/estatisticas" element={<Estatisticas />} />` dentro do grupo do `Layout`.                                                                                                                                                                                                                                                                                                                                |
| `src/routes/Layout.tsx`                             | **EDITAR** | Adicionar `<NavLink to="/estatisticas">📊 Estatísticas</NavLink>` na nav, depois do bloco "Rankings" e antes do "Perfil" (que tem `ml-auto`). Reutilizar `itemClasse`.                                                                                                                                                                                                                                                                                      |

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
4. **App** — logar como qualquer jogador → clicar na aba **"Estatísticas"** na nav → ver os dois módulos: **"Estatísticas básicas"** (5 stat boxes com os mesmos números do `/perfil`) e **"Parcerias"** (4 cards). Jogadores com <5 partidas junto de qualquer outro: cards aparecem como placeholder. A aba "Perfil" permanece **intacta** (dados pessoais + stats básicas + troca de senha) — as stats básicas estão agora duplicadas em `/estatisticas`.
5. **Edge cases**: jogador novato (sem partidas), jogador com poucos jogos (<5 com todos → todos placeholders), jogador com histórico longo (top/bottom faz sentido).

---

## Escopo — incluído / excluído

**Incluído:**

- RPC única `parcerias_jogador` (companheiros + adversários numa chamada só).
- Nova rota `/estatisticas` + aba na nav.
- Módulo **"Estatísticas básicas"** (5 stat boxes) — **duplicado** do `/perfil`, sem remover do Perfil.
- Módulo **"Parcerias"** com 4 cards (top/bottom companheiro, top/bottom adversário).
- Filtro de 5 partidas mínimas (só p/ Parcerias).

**Excluído** (deixar para depois):

- Outros módulos da página `/estatisticas` (a página já está pronta para recebê-los — é só adicionar novas `<section>`).
- Extrair `StatBox` para um arquivo compartilhado (hoje duplicado entre `Perfil.tsx` e `Estatisticas.tsx`; refatoração posterior quando a duplicação pesar).
- View/ranking completo de todos os parceiros (a RPC já devolve tudo; trivial expor numa sub-rota quando quiser).
- Filtro por ano/período.
- Estatística _"com quem mais fiz gols"_, _"com quem mais levei gols"_, etc.
- Nomes clicáveis (não existe rota pública de perfil de terceiro hoje).

---

## Further Considerations

1. **Página como landing de estatísticas avançadas**: como o usuário pretende adicionar mais coisas, a `/estatisticas` foi modelada como página própria com módulos em `<section>`. Quando houver muitos módulos, vale avaliar sub-nav interna (tabs ou anchor links) para não virar uma página infinita.
2. **`p_min_partidas` configurável na UI?** Hoje fixo em 5 na chamada. Fácil adicionar toggle (2/5/10) depois — a RPC já recebe o parâmetro.
3. **Deploy do SQL**: o arquivo de migration é só código — é preciso rodar `aplicar_tudo.sql` (ou só a `030`) no Supabase Studio do projeto. Passo manual, fora do controle do app.
4. **Numbering**: a migration foi renumerada de `029` → `030` porque `029_add_posicao_view_ranking.sql` já existe.
