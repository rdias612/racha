# 35 · Fase 5 — Notificações de resultado (RF06/RF07) — Registro de Execução e Validação

> Registro da execução da [fase-5-tasks.md](../35-fases/fase-5-tasks.md) do plano 35 em 02/10/2026, na branch `main`, no fluxo de três agentes: **executor**, **auditor** (read-only) e **corretor** (acionado por 1 achado Important). Veredito da auditoria: **APROVADO COM RESSALVAS** (ressalva A1 corrigida com migration corretiva).

## 1. Execução

- **3 commits** (1 por task):
  - `1ea8e30` — migration `113_notificar_clipes.sql`: CHECK de `reminder_key` ampliado com `'clipes-prontos'`/`'clipes-sem-clipes'`/`'clipes-falha'` (padrão da relax `107`) + RPC `listar_destinatarios_clipes(p_partida_id, p_apenas_admins)` SECURITY DEFINER (goleiros incluídos — divergência 8.1; grant só à `service_role` — 8.2). **Aplicada no remoto** (local=remoto=113).
  - `076af6f` — Edge Function `supabase/functions/notificar-clipes/index.ts` no padrão da irmã `send-confirmation-requests` (segredos idênticos, nenhuma env nova; payload único `{partida_id, resultado}`; partida/contagem lidas do banco; claim separado do envio; TTL 3 dias + urgency normal; 404/410 limpam subscription; mensagens PT-BR por desfecho). **Deployada** via `npx supabase functions deploy notificar-clipes`.
  - `6655dfa` — `scripts/clipes/notificacoes.mjs` (`notificarResultado` best-effort — nenhum throw; secret via `obter_segredo_vault('push_cron_secret')`, nunca logado; timeout 15s) + integração no `main()` (passo 7 pós-ledger no sucesso; no catch entre `fecharRegistroImportacao('falha')` e `exit(1)`, ambos condicionados a partida existir — falha sem partida fica só no ledger, divergência 8.3) + linha do `push_cron_secret` no doc de configuração. YAML sem diff.
- **Validações do executor**: anon key na RPC → 401/42501 (grant correto); CHECK aceita as chaves novas, duplicata → 23505; RPC testada contra dados reais (partida 40: modo admins = 5; modo participantes = 1); deploy concluído; build/lint exit 0; greps de segredo limpos.

## 2. Auditoria (aprovado com ressalvas)

- S1–S4 ✅ com comparação bloco a bloco contra o molde (`send-confirmation-requests`); ordenação dos caminhos no `main()` confirmada (sucesso: importação → limpeza → fecharRegistro → notificar; erro: catch → fecharRegistro('falha') → notificar → exit(1)); `notificarResultado` nunca lança (best-effort íntegro); RNF02 íntegro; 3 commits limpos, nada em `src/`, nenhuma lib nova.
- **A1 (Important — inconsistência interna da SPEC, corrigido)**: o esboço SQL da própria spec tinha `j.is_admin = false` na branch de participantes — admin que jogou a partida não recebia o push RF06, contradizendo o requisito ("os participantes") e a justificativa da divergência 8.1 da própria spec. **Correção do corretor**: commit `dacfeb9` — migration corretiva `114_rpc_destinatarios_clipes_admin_participantes.sql` (`CREATE OR REPLACE FUNCTION` sem a condição, grants idempotentes mantidos) + **plano corrigido na fonte** (esboço da Task 1 + divergência 10 anotada). **Revalidação contra dados reais (partida 40)**: modo participantes 1 → **6** (5 admins que jogaram agora incluídos); modo admins = 5 sem regressão; anon key → 401/42501.
- **A2 (informativo, sem ação)**: `enviarPara` não checa `error` dos UPDATEs de ledger/DELETEs de subscription — idêntico ao comportamento do molde (`send-confirmation-requests`), coerência de padrão mantida; envio sequencial continua nos demais destinatários quando um webpush rejeita.

## 3. Observações operacionais

- **Impacto na numeração**: a corretiva ocupa a **114**, que a Fase 6 planejava usar (`114_rpc_disparar_importacao_clipes.sql`). A pré-condição da Fase 6 já manda conferir numeração — ao executá-la, deslocar para a próxima livre (115/116) sem mudança de conteúdo.
- O banco estava sem dados de importação (`clipes`/`clipes_importacoes` vazios) durante a fase — a validação RF06 ponta a ponta precisa da run real da Fase 3 antes.
- `origin/main` visto em `6655dfa` durante a auditoria (push paralelo do dono novamente — anotado, não é achado de código; o commit `dacfeb9` da corretiva ficou local).

## 4. Pendente de validação humana (dono)

- [ ] Push dos commits locais (`dacfeb9` + registro desta fase).
- [ ] **RF06 ponta a ponta**: importar uma partida real com clipes (run da Action) → cada participante inscrito (incluindo admins que jogaram) recebe **um** push "Os N clipes da partida de {dia}..." abrindo `/partida/{id}`; 1 linha `clipes-prontos` por jogador em `push_reminder_deliveries`.
- [ ] **RF07**: curl com `resultado: 'falha'` (e `'sem_clipes'`) → push de aviso a cada admin inscrito, com mensagem distinta; linhas `clipes-falha`/`clipes-sem-clipes` no ledger de entregas; desfecho também em `clipes_importacoes` (painel da Fase 8).
- [ ] **Idempotência**: repetir o disparo → `claimed: 0`, nenhum push novo.
- [ ] Negativos: sem header → 401; payload inválido → 400; partida inexistente → 400 (sem push e sem linha).
- [ ] Jogador participante sem inscrição push → sem linha e sem erro.
- [ ] Log do curl/run sem o valor de `push_cron_secret` (RNF02).
- [ ] Caso goleiro inscrito (dados atuais não exercitam — conferir quando um goleiro tiver subscription).
