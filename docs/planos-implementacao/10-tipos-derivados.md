# 10 · Derivar tipos de `database.types.ts` (incremental) — Plano de Implementação

> Ref.: item **D4** do `docs/plano-melhorias-frontend-pwa.md` · Ranking anti-slop: **#10 (nota 5,0)**, Tier 2 (`docs/rank-melhorias-reuso-codigo.md`)
> Esforço estimado: S por módulo · Risco: baixo (type-level) · Prioridade global do plano: P2

## 1. Objetivo

Eliminar interfaces hand-written que **sobrescrevem o que o gerador de tipos já produz**: hoje o `database.types.ts` gerado (completo e atual) tem um único consumidor (`lib/supabase.ts:2`), e todo o resto do código redeclara na mão os formatos de retorno das RPCs/views, reforçado por casts. A duplicação é de **tipo**, não de código executável — um drift de migration compila sem erro hoje. A proposta é derivar os tipos por `Database['public'][...]` onde o mapeamento é 1:1 (uma linha por módulo) e, onde o cast faz narrowing legítimo (colunas nullable de view, `string` do banco → union de domínio), **manter o cast e apenas comentá-lo** apontando para o tipo gerado. Nada de big-bang: um módulo `lib` por commit, validado por `tsc -b`.

## 2. Estado atual (evidências verificadas)

Verificado no código em **30/09/2026**:

- **`src/lib/database.types.ts`** (1330 linhas, gerado a partir do banco) — único consumidor em todo o `src/` é **`src/lib/supabase.ts:2`** (`import type { Database } from './database.types'`; grep confirmado, nenhum outro arquivo importa o módulo ou usa `Database[...]`).
- **`src/lib/partidas.ts:137-148`** — interface `ParRacha` hand-written com 10 campos; cast no retorno da RPC em `:157` (`(data ?? []) as ParRacha[]`). A RPC `pares_racha` está no gerado em `database.types.ts:1075-1088` com **os mesmos 10 campos**. Divergência única: o gerado declara `percentual: number` (não-nulo) e a interface hand-written declara `percentual: number | null`. O SQL (definição vigente da RPC: `089_unificacao_media_aparada_e_levantamento.sql:~399`, que recria a da `032_rpc_pares_racha.sql` com a mesma lógica) computa via `NULLIF(partidas*3, 0)` — com o filtro `HAVING COUNT(*) >= p_min_partidas` da própria RPC, nunca é null; o `| null` é defesa morta.
- **Consumidores do `percentual`** — `src/routes/EstatisticasRacha.tsx` (`?? 0` na ordenação e render com ternário `'—'`) **e `src/components/DuplaCard.tsx`** (também tipa a prop como `ParRacha` e faz `par.percentual === null` — consumidor descoberto na execução, não listado no doc de origem). Sob `strict: true` (`tsconfig.app.json:16`), derivar `ParRacha` torna essas comparações `=== null` **erro de compilação** (`number` vs `null` sem overlap) — os call sites precisam sair junto.
- **`src/lib/partidas.ts:474-478`** — interface `PartidaDraftAtual` (3 campos) espelha exatamente o `select` de `:483`; o `Row` da tabela `partidas` no gerado (`database.types.ts:419-428`) tem esses 3 campos **idênticos e não-nulos** (`id: number`, `data_jogo: string`, `confirmacao_closes_at: string | null`) — derivável 1:1 via `Pick`.
- **`src/lib/partidas.ts:51-58`** — `NotaPartida` vs view `partida_notas` no gerado (`database.types.ts:733+`): **todas as colunas `| null`** — o cast de `:134` é narrowing legítimo, não derivável 1:1. Idem `ResumoAno` (`:500-525`): a interface é **deliberadamente mais defensiva** que o gerado (gerado em `database.types.ts:1124+` declara campos não-nulos; a RPC pode não ter atletas no ano — comentário do próprio código em `:498-499`). Caso inverso: aqui derivar **afrouxaria** a segurança — manter hand-written.
- **`src/lib/jogadores.ts`** — todos os casts existentes são narrowing/normalização, não sobrescrita 1:1: `mapearJogadorLista` (`:89-105`) converte `posicao: string` do banco → `PosicaoId` (`:102-103`); `LinhaConfrontoRow`/`PartidaConfrontoRow` (`:326-337`, `:355-363`) fazem union `number | string` por causa do driver Postgres; `StatsJogador` (`:530-537`) normaliza view `stats_jogador` com colunas `| null` (`database.types.ts:830+`) via `?? 0` (`:556-563`, `:575-582`); `Parceria`/`ParceriaDestaque` (`:594-612`) estreitam `tipo`/`metrica: string` → unions (`:625`, `:648`).
- **`src/lib/dividas.ts`** — `Divida` (`:25-44`) inclui o join `jogadores(username, ...)` (`:38-43`), formato que o gerado não reproduz 1:1; `mapearLinhaDivida` (`:62-68`) aplica fallback defensivo de `natureza`; `DevedorResumo` (`:82-88`) lê a view `dividas_resumo` cujo `Row` no gerado (`database.types.ts:723-730`) é **todo `| null`** — cast de `:98` é narrowing.
- **`src/lib/notificacoes.ts`** — `NotificacoesConfig` (`:5-34`) tem cast `as unknown as` (`:75`) porque a RPC `obter_configuracoes_notificacoes` retorna **`Json`** no gerado (`database.types.ts:1013-1016`) — não derivável por caminho de tipo. `PainelEntregaJogador` (`:122-140`) estreita `posicao: string` → `PosicaoId` (comentário do próprio código em `:126-127` justifica) e `aparelhos: Json` → `AparelhoPush[]` (gerado em `database.types.ts:1024-1045`); cast em `:147`.
- **`src/lib/eventosFinanceirosAutomaticos.ts`** — `EventoFinanceiroAutomatico` (`:8-21`) estreita `gatilho`/`natureza`/`tipo`/`destino` de `string` (tabela no gerado, `database.types.ts:132-147`) para as unions de domínio; cast em `:52`.
- **Tipos de query em rotas** — `LinhaRanking` (`src/routes/Ranking.tsx:47-59`) lê a view `ranking` (gerado `database.types.ts:799-830`, **todo `| null`**) com mapeamento tolerante a nulos + casts (`:121-140`); `Partida`/`Placar` locais (`src/routes/Jogos.tsx:21-31`) leem a view `partidas_com_placar` (gerado `:789-797`, **todo `| null`**) com guards e casts (`:59-67`). Em ambos o narrowing é a estratégia correta — não são candidatos a derivação.
- **Consequência estrutural**: dos módulos auditados, os únicos mapemientos **1:1** (deriváveis sem cast) hoje são `ParRacha` e `PartidaDraftAtual`, ambos em `lib/partidas.ts`. Todo o resto do valor do plano é **documentar por que os casts permanecem** — que é exatamente o que evita que alguém "derive" errado depois.

## 3. Pré-condições e dependências

- **Coordenação com o plano 07** (`queries-fora-da-lib.md`): o 07 cria `lib/ranking.ts` com `LinhaRanking` hand-written **de propósito** (seção 6 daquele plano delega a derivação a este plano). Se executado depois do 07, o comentário do Passo 2 recai sobre `lib/ranking.ts` em vez de `Ranking.tsx`. Se executado antes, `Ranking.tsx` continua como está hoje (a interface local só entra em escopo quando o 07 ou uma mudança funcional tocar o arquivo — ver seção 6).
- **Ordem dentro do plano**: nenhum passo depende de outro em runtime; a ordem abaixo vai do caso mais claro (derivação real, `ParRacha`) aos módulos só-comentário.
- **Decisão do dono exigida antes de executar**: nenhuma — a estratégia (derivar 1:1, manter narrowing comentado) é a do doc de origem, reproduzida na seção 4.
- **Restrição de janela**: nenhuma. Todas as mudanças são type-level (compilador), sem alteração de comportamento em tela; seguro mesmo durante partida ao vivo.

## 4. Plano de execução (1 passo = 1 módulo `lib` = 1 commit)

Convenção comum a todos os passos: importar o tipo raiz uma vez por módulo com `import type { Database } from './database.types';` e derivar com o caminho completo — padrão canônico deste plano:

```ts
// RPC: exatamente a linha retornada por pares_racha (database.types.ts:1075)
type ParRacha = Database['public']['Functions']['pares_racha']['Returns'][number];
// Tabela/view (subconjunto de colunas do select):
type PartidaDraftAtual = Pick<
  Database['public']['Tables']['partidas']['Row'],
  'id' | 'data_jogo' | 'confirmacao_closes_at'
>;
```

Nenhuma biblioteca nova; nenhum toque em `database.types.ts` (gerado) nem em `lib/supabase.ts`.

### Passo 1 — `lib/partidas.ts`: derivar `ParRacha` e `PartidaDraftAtual` · 1 commit

- **`src/lib/partidas.ts`** — substituir a interface `ParRacha` (`:137-148`) por derivação:

  ```ts
  /** Linha da RPC pares_racha (fonte: database.types.ts — Functions.pares_racha.Returns). */
  export type ParRacha = Database['public']['Functions']['pares_racha']['Returns'][number];
  ```

  e a interface `PartidaDraftAtual` (`:474-478`) por `Pick` do `Row` da tabela `partidas` (exemplo acima). Remover os casts correspondentes: `:157` (`(data ?? []) as ParRacha[]` vira `data ?? []` — o retorno da RPC já é tipado pelo cliente) e `:491` (`data as PartidaDraftAtual | null` vira `data`, já `| null` pelo `maybeSingle`). Adicionar `import type { Database } from './database.types';` no topo. Comentar (sem alterar) os casts de narrowing que permanecem: `NotaPartida` (`:51-58`, view `partida_notas` com colunas `| null`) e `ResumoAno` (`:500-525`, hand-written deliberadamente mais defensivo que o gerado — "o gerado declara não-nulo, mas a RPC pode não ter destaques no ano; NÃO derivar").
- **`src/routes/EstatisticasRacha.tsx`** — único ajuste funcionalmente perceptível (e é só de compilação): remover a defesa morta de `percentual` — `:330` vira render direto (`{Math.round(par.percentual * 100)}%`, sem o ternário do `'—'`) e os `?? 0` de `:36-37, 46-47, 52-54` saem por clareza. **Antes de remover, conferir em execução que o traço "—" não aparece hoje** (se aparecer, a premissa de não-nulo está errada — parar e reavaliar; ver seção 7).
- Commit: "deriva ParRacha e PartidaDraftAtual de database.types.ts (D4)".

### Passo 2 — `lib/dividas.ts` (+ `lib/ranking.ts` se o plano 07 já existir): só comentar · 1 commit

- Nenhum tipo é derivável 1:1 aqui: `Divida` carrega o join `jogadores` (formato que o gerado não expressa), `DevedorResumo` lê view com colunas `| null` e o `mapearLinhaDivida` aplica fallback de `natureza`. O passo é **documentar os casts** com comentários de uma linha apontando para o gerado, no padrão do comentário já existente em `notificacoes.ts:126-127`:
  - `:38-43` — "join jogadores(username, is_mensalista, chave_pix, telefone): formato do select, não do Row da tabela";
  - `:62-68` — "narrowing + fallback defensivo de natureza; Row gerado de dividas não tipa o enum";
  - `:82-88` e `:98` — "view dividas_resumo: colunas | null no gerado (database.types.ts:723); cast de narrowing é intencional".
- Se o plano 07 já tiver criado `lib/ranking.ts`, replicar o comentário na `LinhaRanking` de lá ("view ranking: colunas | null no gerado; mapeamento tolerante é intencional — NÃO derivar"). Se não, pular (o de `Ranking.tsx` entra quando o 07 ou mudança funcional tocar o arquivo).
- Commit: "documenta casts de narrowing em dividas (D4)".

### Passo 3 — `lib/notificacoes.ts`: só comentar · 1 commit

- `NotificacoesConfig` é **não derivável por construção**: a RPC retorna `Json` (`database.types.ts:1013-1016`) e o cast `as unknown as NotificacoesConfig` (`:75`) é a ponte necessária. `PainelEntregaJogador` estreita `posicao: string` → `PosicaoId` e `aparelhos: Json` → `AparelhoPush[]` (`:147`). O passo adiciona apenas os comentários de intenção (o de `:126-127` já existe — estender o padrão para `:75` e `:147`), citando o caminho do gerado.
- Commit: "documenta casts de narrowing em notificacoes (D4)".

### Passo 4 — `lib/eventosFinanceirosAutomaticos.ts`: só comentar · 1 commit

- `EventoFinanceiroAutomatico` (`:8-21`) estreita as 4 colunas `string` da tabela (gerado `database.types.ts:132-147`) para as unions `GatilhoEventoAuto`/`NaturezaLancamento`/`TipoDivida`/`DestinoEventoAuto`; cast em `:52`. Comentar o cast ("colunas string no Row gerado; unions de domínio exigem narrowing — fontes: `dividas.ts` e este módulo") e o `data.id as number` de `:100` (`insert().select('id').single()` — narrowing do `Json` de retorno, se aplicável; conferir no ato).
- Commit: "documenta casts de narrowing em eventosFinanceirosAutomaticos (D4)".

### Passo 5 — `lib/jogadores.ts`: só comentar · 1 commit

- Maior módulo, nenhum derivável 1:1 — todos os casts já são narrowing com justificativa parcialmente documentada; completar os comentários:
  - `mapearJogadorLista` (`:102-103`) — "posicao/posicao_b: string no Row gerado; PosicaoId é união de domínio (`times.ts`)";
  - `LinhaConfrontoRow`/`PartidaConfrontoRow` (`:326-337`, `:355-363`) — os comentários existentes (`:324-325`) já cobrem; apenas referenciar que o gerado declara `number` puro e o driver pode entregar `string`;
  - `StatsJogador` (`:530-537`) — "view stats_jogador: colunas | null no gerado; normalização ?? 0 é intencional";
  - `Parceria`/`ParceriaDestaque` (`:624-634`, `:645-654`) — "tipo/metrica: string no gerado; estreitamento para união com descarte de desconhecidos é intencional".
- Commit: "documenta casts de narrowing em jogadores (D4)".

Total: 5 commits, um por módulo. O Passo 1 é o único que muda tipos de fato (e é onde o ganho do ranking se materializa); os Passos 2–5 transformam conhecimento tácito ("por que esse cast existe?") em explícito, impedindo a derivação errada que o doc de origem exclui ("manter os casts de narrowing onde views são nullable/string").

## 5. Validação manual

Sem testes automáticos (AGENTS.md); `tsc -b` **não é teste, é checagem de tipos** — é a validação principal deste plano, pois tudo é type-level. Por passo:

- [ ] `npx tsc -b` (ou `npm run build`) sem erros — **obrigatório em cada commit**.
- [ ] **Passo 1 — Súmula de duplas (EstatisticasRacha)**: com ≥ 2 jogadores e partidas suficientes, a tabela de pares de racha carrega com os mesmos valores de antes (pontos, %, ordenação pelas 4 colunas); nenhuma célula de % mudou de formato; `grep -n "percentual" src/routes/EstatisticasRacha.tsx` não retorna mais `=== null` nem `?? 0`.
- [ ] **Passo 1 — próxima partida (consumidores de `obterPartidaDraftAtual`)**: telas que usam a "partida draft atual" (banner/lembretes, confirmações) continuam exibindo a mesma partida e data de antes.
- [ ] **Passos 2–5**: `grep -rn "as unknown as\|as PosicaoId\|as StatusPartida" src/lib` continua encontrando os mesmos casts (nenhum removido), agora precedidos de comentário citando `database.types.ts`; nenhum arquivo de rota/componente tocado.
- [ ] **Regressão geral**: `npm run dev` + navegação de fumaça (Resumo, Jogos, Ranking, Estatísticas, Administrador) — nenhuma tela muda de comportamento; bundle sem alteração de runtime relevante (tipos não existem em runtime; só o ternário do Passo 1 desaparece do bundle).

## 6. Fora de escopo

- **Não derivar os tipos de query das rotas preventivamente** — `LinhaRanking` (`Ranking.tsx`), `Partida`/`Placar` locais (`Jogos.tsx`) e afins só entram quando uma mudança funcional tocar o arquivo (e, no caso do `Ranking`, o plano 07 já move o tipo para `lib/ranking.ts`). Nada de migração cosmética ampla.
- **Não remover os casts de narrowing** de view nullable/`string` → união (`jogadores.ts`, `dividas.ts`, `notificacoes.ts`, `eventosFinanceirosAutomaticos.ts`, `partidas.ts:134`/`:113`, rotas) — a estratégia está correta; este plano apenas os comenta.
- **Não derivar `ResumoAno`** — o tipo gerado é otimista (campos não-nulos) e a interface hand-written é deliberadamente defensiva; derivar reduziria a segurança de compilação.
- **Não regenerar nem editar `database.types.ts`** — é artefato gerado; o plano consome, nunca altera.
- **Não introduzir helpers/utilitários genéricos de derivação** (ex.: tipos utilitários próprios além de `Pick` nativo) — cada derivação é uma linha direta no módulo que a usa (KISS/YAGNI).
- **Não ampliar o escopo de derivação a tipos de payload de mutação** (`VotoEnviado`, `ParticipanteEdicao`, `EventoFinanceiroAutomaticoPayload` etc.) — são DTOs de entrada da aplicação, não retornos do banco; a duplicação relevante do item D4 é de leitura.
- **Não criar testes automáticos** (diretriz atual do AGENTS.md).

## 7. Riscos e rollback

- **Risco geral: baixo** — tudo é type-level; o compilador (`tsc -b`) é o veredito de cada passo. Nenhum passo altera lógica de runtime além do ternário morto do Passo 1.
- **Risco específico do Passo 1 (`percentual`)**: a premissa de não-nulo vem do tipo gerado e da análise do SQL (definição vigente: migration `089_unificacao_media_aparada_e_levantamento.sql` — `NULLIF` inatingível com o `HAVING COUNT(*) >= p_min_partidas`; confirmada por reanálise na auditoria da execução). Se a validação manual constatar que o traço "—" **aparece hoje** em produção, a premissa está errada: parar, reavaliar (possível divergência entre o schema do gerador e a base real) e, se confirmado o null em execução, o tipo correto é o hand-written — nesse caso reverter o Passo 1 e registrar o achado como débito no doc de origem.
- **Risco de derivação "correta demais"**: derivar amarra o tipo ao formato atual da RPC; uma migration que mude o retorno de `pares_racha`/`partidas` passa a quebrar o build **no ponto certo** (isto é o objetivo — o drift deixa de ser silencioso). Não é risco, é o ganho.
- **Rollback**: cada passo é um commit isolado, revertível por `git revert` sem afetar os outros (módulos independentes; o Passo 1 toca 2 arquivos, os demais 1). Reverter o Passo 1 restaura `ParRacha`/`PartidaDraftAtual` hand-written e as defesas de `EstatisticasRacha` exatamente como estavam. Nenhum passo depende de outro em runtime, e nenhum afeta os planos 05/06/07 (que não derivam tipos — seção 6 daqueles planos).
- **Débito a registrar (não corrigir aqui)**: nenhum novo. Os casts comentados nos Passos 2–5 permanecem como débito consciente e documentado, não como pendência deste plano.
