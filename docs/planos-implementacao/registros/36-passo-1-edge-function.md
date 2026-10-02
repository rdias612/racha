# 36 · Passo 1 — Edge Function admin-excluir-clipes — Registro de Execução e Validação

> Registro da execução do passo 1 do plano 36 (repositório + exclusão manual de clipes em `/clipes/admin`) em 02/10/2026, na branch `main`, no fluxo de três agentes: **executor** (commit `a155911`), **revisor** (read-only) e **corretor/registrador** (ressalva documentada + este registro). Veredito da validação: **APROVADO COM RESSALVAS** (zero bloqueantes).

## 1. Contexto

O plano 36 cobre repositório + exclusão manual de clipes no painel `/clipes/admin`. Este passo 1 é o **backend** da exclusão em lote: a Edge Function que o painel (passo 3) chamará via `supabase.functions.invoke`. A limpeza por retenção (RF09) só apaga por `data_jogo` — a exclusão manual existe para corrigir importação errada por seleção de clipes.

## 2. Implementação

- **Commit `a155911`** — `supabase/functions/admin-excluir-clipes/index.ts` (254 linhas), arquivo novo:
  - **POST com CORS completo** (Origin, Methods e Headers no preflight OPTIONS e nas respostas): primeira função do projeto chamada DO BROWSER via `functions.invoke` — o invoke faz preflight OPTIONS (content-type JSON + Authorization) antes do POST; as irmãs (notificar-clipes etc.) são server→server e dispensam CORS.
  - **Validação 400**: `admin_id` inteiro > 0 e `clipes_ids` array não-vazio com teto de 500 itens (trava de abuso — exclusão manual é pontual, nunca varredura em massa).
  - **Gate de admin server-side** via `jogadores.is_admin` → 403 (modelo do RPC `excluir_partida`, migration `066`: o app não usa JWT do Supabase, o corpo é a credencial; deploy com `--no-verify-jwt`, precedente notificar-clipes/cron).
  - **Carga por `IN`** com ids inexistentes ignorados (idempotência); 0 linhas → resposta sem tocar nada.
  - **Ordem Storage → linhas → ledger** herdada de `retencao.mjs:88-140` ('Not Found' tolerado item a item no remove; qualquer outro erro aborta ANTES de tocar a tabela).
  - **Ledger por partida** em `clipes_importacoes`: origem `'manual'` (ação do admin, não de run), status `'limpeza'` (já presente no CHECK da migration `109`), `data_referencia` = diaBRT da partida, `size_bytes` nulo contado como 0 com warn (padrão retencao.mjs:59-64).
  - **Resposta** `{ excluidos, bytes_liberados }`; erros → 500 com mensagem e log com contexto (sem segredos).

## 3. Divergências aceitas do plano (do relatório do implementador)

1. **Dedupe de `clipes_ids` via `Set`** — repetição no array não duplica carga nem contagem.
2. **Coerção de string numérica** em `admin_id` e nos ids (mesma tolerância de `partida_id` em notificar-clipes:159-161 — o body JSON do invoke pode trazer números como string).
3. **Env mínimo**: só `SUPABASE_URL` + service key (`PUSH_SUPABASE_KEY` ?? `SUPABASE_SERVICE_ROLE_KEY`) — sem VAPID/cron secret, que a função não usa.
4. **`excluidos` = linhas carregadas** (não o retorno do DELETE), semântica de retencao.mjs — ids inexistentes já foram ignorados na carga.

## 4. Validação (aprovado com ressalvas)

- Revisão item a item do implementador pelo agente revisor: **zero achados bloqueantes**. Conformidade confirmada: CORS completo no OPTIONS e no POST, filtros parametrizados (sem concatenação), zero `any`, e campos do ledger 1:1 com a migration `109` e `database.types.ts`.
- **Achados nits 7–9 aceitos sem correção** (consistência de padrão com o código existente — mudá-los quebraria o alinhamento com os precedentes citados).

## 5. Correção pós-validação

- **Achado 2 da validação** (nível melhoria, não bloqueante): se o INSERT no ledger falha (após Storage + DELETE concluídos), o catch devolve 500 — mas a exclusão já aconteceu, e um retry achará 0 linhas e devolverá `{ excluidos: 0 }` sem jamais gravar o ledger daquela exclusão. Gap também presente na retenção (retencao.mjs:132-137, ledger por último).
- **Correção escolhida (KISS, sem mudança de comportamento)**: comentário de ressalva no bloco do ledger documentando o trade-off e o precedente da retenção — aceito por ser operação manual pontual e rara. Commit docs desta tarefa (o mesmo que grava este registro).

## 6. Pendente de validação humana (dono)

- [ ] Deploy: `npx supabase functions deploy admin-excluir-clipes --no-verify-jwt`.
- [ ] Validação E2E: payload inválido → 400; não-admin → 403; exclusão real → objeto some do bucket `clipes` + entrada `limpeza`/`manual` no ledger.
- [ ] Push do commit da implementação (`a155911`) + deste commit docs.
