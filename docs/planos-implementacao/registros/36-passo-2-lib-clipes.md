# 36 · Passo 2 — Lib `clipes.ts`: listar partidas com clipes + exclusão via edge function — Registro de Execução e Validação

> Registro da execução do passo 2 do plano 36 (repositório + exclusão manual de clipes em `/clipes/admin`) em 02/10/2026, na branch `main`, no fluxo de três agentes: **executor** (commit `7980edf`), **revisor** (read-only) e **corretor/registrador** (correção de melhoria + este registro). Veredito da validação: **APROVADO COM RESSALVAS** (zero bloqueantes).

## 1. Contexto

Este passo 2 é a **camada de acesso (lib)** para a aba Repositório do painel admin: listar as partidas que têm clipes (alimenta o seletor do passo 3) e excluir clipes selecionados via a edge function `admin-excluir-clipes` do passo 1. Padrão das demais libs do projeto (partidas.ts, notificacoes.ts): função exportada, cliente Supabase, throw de erro, retorno tipado.

## 2. Implementação

- **Commit `7980edf`** — `src/lib/clipes.ts` (+88/−0), diff puramente aditivo:
  - **`obterPartidasComClipes()`**: join `partidas!inner(status)` **sem filtro de status** — painel de admin enxerga tudo (as cláusulas de status das demais funções do arquivo servem à visão do jogador); `order` por `data_jogo` desc + `partida_id` desc; dedupe por `partida_id` em JS na primeira ocorrência (precedente KISS `retencao.mjs:34-37` — tabela pequena, sem RPC de agregação).
  - **`excluirClipes(adminId, ids)`**: primeira chamada client-side de Edge Function do app; `functions.invoke` com body `{ admin_id, clipes_ids }`; unwrap de `FunctionsHttpError` via `error.context.json()` → `Error(body.erro)` para o snackbar mostrar a mensagem real da função (ex.: 'Acesso restrito a administradores.') em vez do texto genérico do SDK ('Edge Function returned a non-2xx status code').
  - **Tipos** `PartidaComClipes` e `ResultadoExclusaoClipes` (snake_case espelhando o wire, precedente `ImportacaoClipes` no mesmo arquivo).

## 3. Divergências aceitas do plano (do relatório do implementador)

1. **`status` incluído no retorno** de `PartidaComClipes` — `partidas` não tem adversário/nome (`database.types.ts`); é o único campo dela útil ao label do seletor.
2. **Discriminação de erro por `instanceof`** — o SDK 2.112.2 tipa o `error` do invoke como `any`; classes confirmadas em node_modules.
3. **Cast documentado** no retorno de `excluirClipes` — redundante via genérico, mantido para explicitar o tipo do wire após a guarda do erro.

## 4. Validação (aprovado com ressalvas)

- Revisão item a item pelo agente revisor: **zero achados bloqueantes**. Contrato com a edge function do passo 1 conferido campo a campo (`{ admin_id, clipes_ids }` na entrada; `{ excluidos, bytes_liberados }` na saída).
- **`instanceof FunctionsHttpError` confirmado no runtime do SDK**: o `context` é a `Response` lançada antes da leitura do body — o unwrap via `context.json()` é válido.
- **Nenhuma ambiguidade nos `.order`**: ambas as colunas (`data_jogo`, `partida_id`) pertencem à tabela raiz `clipes`.
- **Regressão zero**: diff só aditivo (+88/−0); `tsc --noEmit` limpo.

## 5. Correção pós-validação

- **Achado 1 da validação** (nível melhoria, não bloqueante): `FunctionsFetchError`/`FunctionsRelayError` eram relançadas como estão, mas a mensagem do SDK é técnica em inglês ('Failed to send a request to the Edge Function') e `formatarMensagemErro` **não a traduz** (não casa com o padrão de `erros.ts:21-23`) — o snackbar mostraria inglês justamente no caso "sem internet". Correção: branch `instanceof` dedicada, ANTES do `throw error` final, lançando 'Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.' (comportamento pequeno e deliberado, comentado no código).
- **Nit 2 da validação** (mesma função): comentário de 1 linha no cast do retorno, seguindo o padrão dos casts de RPC (`clipes.ts:113-114`) — documenta o narrowing explícito pós-guarda.
- **Nits 3 e 4 NÃO aplicados** (opcionais, fora de escopo na leitura do validador). Commit docs desta tarefa (o mesmo que grava este registro).

## 6. Pendente de validação humana (dono)

- [ ] Deploy da edge function do passo 1 (pré-requisito de qualquer E2E de exclusão).
- [ ] Validação E2E da lib no **Passo 3** (a camada só é exercitada pela UI do Repositório).
- [ ] Push do commit da implementação (`7980edf`) + deste commit docs.
