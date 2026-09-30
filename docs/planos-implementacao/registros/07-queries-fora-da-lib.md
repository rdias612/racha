# 07 · Consolidar as últimas queries fora da `lib` — Registro de Execução e Validação

> Registro da execução do plano [07-queries-fora-da-lib.md](../07-queries-fora-da-lib.md) em 2026-09-30, na branch `main`, por dois agentes independentes: **implementador** (4 passos) e **validador** (auditoria read-only). Veredito final da auditoria: **APROVADO**, sem bloqueantes e sem ressalvas de correção. Executado como pré-requisito do plano 05 (cadeia 07 → 05 → 06).

## 1. Execução

- **4 commits** (`692c97a` → `c6ef582`), 1 passo = 1 commit, `tsc -b && vite build` verde em todos.
- Passo 1: `carregarMuralJogos()` + tipos `PartidaMural`/`PlacarMural`/`MuralJogos` em `lib/partidas.ts`; `Jogos.tsx` perde as interfaces locais e o `import { supabase }` (`692c97a`).
- Passo 2: novo `src/lib/ranking.ts` com `LinhaRanking` + `carregarRanking(filtro)` (`5f184b5`).
- Passo 3: `carregarPartidasComVotacaoAberta()` em `lib/partidas.ts`; BannerLembrete mantém polling, `geracaoRef`, filtro de votados (sessão), `visibilitychange` e countdown (`3df1b01`).
- Passo 4: `criarPartida(dados)` + `ParticipanteNovo` em `lib/partidas.ts`; invalidações, limpeza de rascunho e `navigate` permanecem no call site (`c6ef582`).
- Critério de encerramento: `grep -rn "lib/supabase" src/routes src/components` → vazio; único restante fora de `lib/` é `SessaoContext.tsx:10` (aceitável, seção 2 do plano).
- Fora de escopo confirmado pela auditoria: `SessaoContext.tsx`, `useCache.ts`, `chavesCache.ts`, `sw.js` com diff vazio; nenhuma chave nova.

## 2. Confirmações da auditoria (transposição literal, query a query)

| Query | Conferido | Literal? |
|---|---|---|
| Mural (`partidas_com_placar`) | Mesmo select, mesmo `order('data_jogo', desc)`, mesmo guard de nulos, cast `StatusPartida`, defaults `?? 0` | ✓ |
| View `ranking` | Mesmo select (11 colunas), mesmos 6 `order` na mesma sequência, `eq('posicao', filtro)` condicional, mesmo mapeamento com fallbacks | ✓ |
| Votação aberta | Mesmo select/eq/gt; predicado `votacaoAberta` transposto; filtro de votados (sessão) permanece no componente | ✓ |
| RPC `criar_partida` | Mesmo payload `p_data_jogo/p_criado_por/p_participantes`, mesmos 2 `throw` (erro RPC e rollback) | ✓ |

Pontos delicados verificados: `useCallback` com deps `[]` (Jogos) e `[posicaoFiltro]` (Ranking) preservados (contrato `useCache.ts:109-110`); `lib/ranking.ts` importa só `./supabase` e `./times` (sem acoplamento a `components/`); nenhuma assinatura visível à UI mudou; nenhum import morto restante.

## 3. Divergências plano × código real (3, todas justificadas e aceitas pela auditoria)

1. **`ParticipanteNovo` é type alias, não interface**: interfaces TS não são atribuíveis ao parâmetro jsonb da RPC (`Type 'ParticipanteNovo' is not assignable to type 'Json'`). Segue o precedente existente no próprio arquivo (`VotoEnviado`, com comentário idêntico).
2. **Predicado interno com `status: string`** em `carregarPartidasComVotacaoAberta` (exigência TS2677 do Row do Supabase) + `map` que descarta o `status` — retorno público fica exatamente `{ id, voting_closes_at }`, como o plano pede.
3. **`type PosicaoId` saiu do import de `Ranking.tsx`**: deixou de ser usado no arquivo (tipo vive em `LinhaRanking` da lib); `noUnusedLocals` do tsc barraria o import mantido.

## 4. Validações técnicas

- `npm run build` e `npm run lint` passam.
- Cada commit toca só os 2 arquivos do seu passo (`lib` + 1 componente); diff total confinado a 6 arquivos; working tree limpa.

## 5. Pendente de validação humana (visual/fluxo, no aparelho)

- [ ] **Jogos**: mural na 1ª visita e em revisita (cache); statuses com placares corretos; excluir partida remove a linha; pull-to-refresh.
- [ ] **Ranking**: 4 abas por métrica; filtro de posição aplica `eq` (tabela e chave mudam juntas); trocar filtro e voltar serve do cache; linha do jogador destacada.
- [ ] **BannerLembrete**: banner com countdown com votação aberta; após votar, partida some do banner; jogador diferente vê banner próprio; aba em background não faz polling; `visibilitychange` re-verifica ao voltar.
- [ ] **PartidaNova**: criar partida navega para `/partida/:id/times`; mural e Resumo refletem; erro de rede mostra mensagem como hoje; rascunho limpo no sucesso e preservado no erro.
