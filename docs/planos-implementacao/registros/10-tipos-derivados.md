# 10 · Derivar tipos de `database.types.ts` (incremental) — Registro de Execução e Validação

> Registro da execução do plano [10-tipos-derivados.md](../10-tipos-derivados.md) em 2026-09-30, na branch `main`, por dois agentes independentes: **implementador** (5 passos) e **validador** (auditoria read-only). Veredito final da auditoria: **APROVADO**, sem bloqueantes e sem ressalvas de correção.

## 1. Execução

- **5 commits** (`0835a4b` → `2ad5216`), 1 passo = 1 módulo, `npx tsc -b` verde em cada; `npm run build` e `npm run lint` verdes ao final. Escopo total: 8 arquivos; `database.types.ts` (gerado) e `lib/supabase.ts` intocados.
- **Passo 1 (única derivação de fato, `0835a4b`)**: `ParRacha` agora é `type ParRacha = Database['public']['Functions']['pares_racha']['Returns'][number]`; `PartidaDraftAtual` é `Pick` do `Row` de `partidas`; os 2 casts do plano removidos (`as ParRacha[]`, `as PartidaDraftAtual | null`); casts de narrowing `NotaPartida` e `ResumoAno` preservados e comentados ("NÃO derivar" no `ResumoAno` — hand-written deliberadamente defensivo). Defesas mortas de `percentual` (`?? 0`, `=== null`, ternário `'—'`) removidas em `EstatisticasRacha.tsx` **e `DuplaCard.tsx`** (consumidor não listado no plano — ver seção 2).
- **Passos 2–5 (só comentários)**: casts de narrowing documentados com caminho do gerado, zero linhas de código alteradas — `dividas.ts` (+ `lib/ranking.ts`, previsto pela coordenação com o plano 07), `notificacoes.ts`, `eventosFinanceirosAutomaticos.ts` (incl. `data.id as number`), `jogadores.ts`.
- Critério de encerramento: 10 casts de narrowing antes, 10 depois (nenhum removido), agora precedidos de comentário; nenhum arquivo de rota tocado além dos 2 do Passo 1; Jogos.tsx/Ranking.tsx intocados; `ResumoAno` não derivado; nenhum helper de derivação criado; tipos de payload (`VotoEnviado` etc.) intocados.

## 2. Divergências plano × código real (justificadas e aceitas pela auditoria)

1. **`DuplaCard.tsx` também consumia `percentual`** (o plano listava só `EstatisticasRacha.tsx`): o componente tipa a prop como `ParRacha` e fazia `par.percentual === null` em 2 lugares — sob `strict`, erro de compilação TS2367; o build não passaria sem tocá-lo. Defesas mortas removidas no mesmo commit (mesmo tipo, mesma unidade de rollback); quando `percentual` não é nulo, o render é byte-idêntico. Varredura exaustiva da auditoria confirmou que não há nenhum outro consumidor de `ParRacha.percentual` (os `percentual ?? 0` restantes pertencem a `Parceria` e `ResumoAno`, onde o null é real — corretamente intocados).
2. **Referência de migration obsoleta no plano**: o plano/análise citavam a `032_rpc_pares_racha.sql`, mas a definição vigente da RPC é a recriada em `089_unificacao_media_aparada_e_levantamento.sql` (CREATE OR REPLACE, lógica idêntica). A auditoria refez a análise na 089: `NULLIF(partidas*3, 0)` com `HAVING COUNT(*) >= p_min_partidas` (default 5; único chamador passa 5) → null inatingível → a premissa de não-nulo **se sustenta**. Plano corrigido.
3. **Números de linha derivados** (planos 03/05/06/07 alteraram os arquivos antes): trechos localizados por contexto; `LinhaRanking` comentado em `lib/ranking.ts` (movido para lá pelo 07), como o próprio plano antecipava.

## 3. Validações técnicas confirmadas pela auditoria

- Todos os 8 caminhos do gerado citados nos comentários conferem (`:723` dividas_resumo, `:733` partida_notas, `:799` ranking, `:830` stats_jogador, `:1013` obter_configuracoes_notificacoes, `:1024` obter_painel_entregas_push, `:132` eventos_financeiros_automaticos, `:1075` pares_racha).
- Passos 2–5 contêm exclusivamente linhas `+` de comentário; grep de casts idêntico antes/depois (o "+1" é falso positivo: comentário novo contém o texto `as unknown as`).
- `npx tsc -b`, `npm run build` e `npm run lint` verdes.

## 4. Observações da auditoria (registro, sem ação)

1. Na ordenação de `EstatisticasRacha`, a comparação direta `a.percentual !== b.percentual` é equivalente ao `?? 0` anterior (quando ambos nulos, `null !== null` → false, mesmo resultado) — mas com o null inatingível, o caso é teórico.
2. Se um dia `percentual` voltar a poder ser null (ex.: remoção do `HAVING`), o render exibiria `NaN%` em vez de `'—'` — risco aceito e documentado como o próprio ganho do plano ("drift quebra o build no ponto certo").
3. O commit `7d05183` ("Update 02-botao-variantes.md", do dono) está na mesma janela de commits — não é do implementador; quem fizer revert da janela inteira deve ter ciência.

## 5. Pendente de validação humana (visual/fluxo, no aparelho)

- [ ] **Súmula de duplas**: tabela carrega com os mesmos valores/formato (% idêntico, **sem "—" em nenhuma célula** — confirmação em execução da premissa de não-nulo), ordenação pelas 4 colunas ok.
- [ ] **Próxima partida** (consumidores de `obterPartidaDraftAtual`): banner/lembretes/confirmações exibem a mesma partida e data de antes.
- [ ] **Smoke de navegação** (`npm run dev`): Resumo, Jogos, Ranking, Estatísticas (Racha/Jogador/Comparar), Administrador — nenhum comportamento mudou.
- [ ] Card de dupla na tela de racha (DuplaCard): percentual renderiza como antes.
