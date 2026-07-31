# T8.1 - Review final backend

Data: 2026-07-31
Escopo: migrations locais, seed, configuracao do cliente/EAS e plano T8.1.
Fonte de verdade: `implementation_plan.md` e `supabase/migrations/*.sql`.

## Resultado

Status: **needs_revision** (runtime local validado; pendencias remotas/APK ainda abertas)

Os 3 findings criticos e HIGH-01/HIGH-03 foram corrigidos e validados no Postgres local. Permanecem 2 findings altos e 3 medios, listados abaixo.

## Validacao runtime local (2026-07-31)

- `npx supabase start` e `npx supabase db reset --local --yes`: **passaram**.
- API local: `http://127.0.0.1:54321`; Postgres: `127.0.0.1:54322`; Studio: `http://127.0.0.1:54325`.
- 9 tabelas publicas com RLS, 5 jobs `cron.job`, Vault com secret placeholder: **passou**.
- `anon`/`authenticated` sem `EXECUTE` nas RPCs de push: **passou**.
- RLS/hardening: auto-promocao de perfil, adulteracao de pagamento e RSVP cross-group bloqueados: **passou**.
- Sorteio incompleto bloqueado; roster valido produz 16 participantes, 2 goleiros e 8 por time: **passou**.
- Trigger `auth.users -> profiles` com defaults explicitos: **passou**.
- `npm run tsc`: **passou**; `npm run lint`: **0 erros, 8 warnings**; smoke tests: **203 pass, 0 fail**.

## Cobertura

| Superficie                | Cobertura | Resultado                                                          |
| ------------------------- | --------: | ------------------------------------------------------------------ |
| Tabelas publicas          |         9 | 8 tabelas base + `push_log` criada em T5.2                         |
| Tabelas com RLS explicito |         9 | 8 em T1.7 + `push_log` em T5.2                                     |
| Jobs pg_cron              |         5 | 1 semanal, 1 mensal, 3 push; migrations tambem limpam jobs legados |
| Trigger auth              |         1 | `on_auth_user_created` presente                                    |
| RPCs revisadas            |         8 | FIFO, mensalidade, push, draw e walk-in                            |
| Cliente/EAS               |         2 | `lib/supabase.ts` e `eas.json`                                     |

### Tabelas

`groups`, `profiles`, `matches`, `match_presences`, `match_participants`, `payments`, `expenses`, `device_tokens` e `push_log` existem nas migrations. O RLS esta habilitado para todas as nove tabelas, mas `push_log` nao pertence ao conjunto de oito tabelas declarado no schema/RLS original. Ver [schema](../../../../supabase/migrations/00000000000001_schema.sql#L7-L21), [RLS](../../../../supabase/migrations/00000000000007_rls.sql#L61-L61) e [push_log](../../../../supabase/migrations/00000000000012_push_jobs.sql#L81-L123).

### Jobs efetivos

| Job                         | Agenda UTC    | Agenda BRT    | Status local                       |
| --------------------------- | ------------- | ------------- | ---------------------------------- |
| `create_next_weekly_match`  | sexta 23:00   | sexta 20:00   | SQL presente                       |
| `generate_monthly_payments` | dia 5 12:00   | dia 5 09:00   | SQL presente                       |
| `push_monthly_reminder`     | segunda 12:00 | segunda 09:00 | SQL presente                       |
| `push_recap_48h`            | terca 22:00   | terca 19:00   | SQL presente, sem match contextual |
| `push_match_reminder`       | quinta 21:00  | quinta 18:00  | SQL presente, sem match contextual |

As migrations tambem limpam quatro nomes legados de auto-match, mas eles nao sao jobs ativos. Portanto, o plano esta desatualizado ao dizer 4 jobs; o estado local define 5 jobs ativos.

## Findings

### CRITICAL-01 - Escalada de privilegio via `profiles` update

**Status:** corrigido na migration incremental `00000000000016_security_hardening.sql`.

`profiles_update_policy` foi recriada de forma idempotente e o trigger
`enforce_profile_update_security` bloqueia, para usuarios comuns, alteracoes
em `is_admin`, `group_id`, `user_type`, `phone_whatsapp` e timestamps. O
self-service fica limitado a `full_name` e `avatar_url`; admins continuam
podendo atualizar campos administrativos.

**Evidencia:** `profiles_update_policy` permite update quando `id = auth.uid()` e exige somente essa mesma condicao no novo registro: [RLS](../../../../supabase/migrations/00000000000007_rls.sql#L78-L81).

**Impacto:** qualquer usuario pode alterar seu proprio `is_admin`, `group_id` ou `user_type`; ao definir `is_admin=true`, passa a satisfazer `is_admin()` e controlar todas as superficies administrativas.

**Mitigacao:** restringir update a colunas de perfil nao privilegiadas, mover role/grupo para RPC admin-only e testar tentativa anon/authenticated de auto-promocao.

### CRITICAL-02 - Usuario pode aprovar ou adulterar o proprio pagamento

**Status:** corrigido na migration incremental `00000000000016_security_hardening.sql`.

O trigger `enforce_payment_update_security` torna imutaveis `user_id`,
`group_id`, `match_id`, `type`, `amount` e `created_at` para todos os papeis.
Usuarios comuns so podem alterar `marked_paid_at`; admins podem aprovar o
pagamento sem alterar identidade, grupo, valor ou tipo.

**Evidencia:** a policy permite update proprio com `USING (user_id = auth.uid() or public.is_admin())` e `WITH CHECK` equivalente, sem limitar colunas: [RLS](../../../../supabase/migrations/00000000000007_rls.sql#L268-L271).

**Impacto:** o usuario pode escrever `approved_at`, `paid_at`, `status`, `amount` e `group_id`, fraudando o saldo e a confirmacao dupla.

**Mitigacao:** separar RPC self-service que so altera `marked_paid_at`; reservar aprovacao, valor, grupo, status e timestamps finais para admin/RPC server-side.

### CRITICAL-03 - RPCs `SECURITY DEFINER` ficaram executaveis por `PUBLIC`

**Status:** corrigido na migration incremental `00000000000016_security_hardening.sql`.

As duas funcoes `SECURITY DEFINER` definidas em `00000000000012_push_jobs.sql`
(`get_active_push_tokens(uuid)` e `dispatch_push(text, uuid)`) agora revogam
`EXECUTE` de `PUBLIC`, `anon` e `authenticated`, com concessao explicita a
`postgres` (cron/owner) e `service_role`.

**Evidencia:** `get_active_push_tokens` e `dispatch_push` sao `SECURITY DEFINER` [push](../../../../supabase/migrations/00000000000012_push_jobs.sql#L144-L160), [dispatch](../../../../supabase/migrations/00000000000012_push_jobs.sql#L205-L224), mas nao ha `REVOKE EXECUTE FROM PUBLIC`; apenas walk-in revoga explicitamente [walk-in](../../../../supabase/migrations/00000000000015_sumula_walkin.sql#L89-L90).

**Impacto:** clientes anon/authenticated podem consultar tokens Expo e nomes de todos os grupos e podem disparar push para todos os tokens. O mesmo default afeta outras RPCs definer sem revoke explicito.

**Mitigacao:** revogar `EXECUTE` de `PUBLIC` em toda funcao definer; conceder somente ao role necessario; expor ao cliente apenas RPCs com gate explicito e entrada validada. Confirmar com `has_function_privilege` apos push.

### HIGH-01 - Update de RSVP permite mover registro para outro grupo

**Status:** corrigido na migration incremental `00000000000016_security_hardening.sql` e validado localmente.

**Evidencia:** insert valida `is_group_member` do match, mas update verifica somente `user_id` ou admin: [RLS](../../../../supabase/migrations/00000000000007_rls.sql#L183-L196).

**Impacto:** o usuario pode alterar `match_id` para partida de outro grupo e mudar status/horarios fora das regras de cutoff, afetando fila e capacidade.

**Mitigacao:** validar grupo do match no `WITH CHECK`, limitar transicoes e cutoff em RPC atomica; nao permitir update direto de `match_id`, `created_at` ou `confirmed_at` pelo cliente.

### HIGH-02 - Vault nao e criado pela migration local

**Evidencia:** T1.3a cria `pg_cron` e `pg_net`, mas nao `supabase_vault` [schema](../../../../supabase/migrations/00000000000001_schema.sql#L14-L21). T5.0 aborta se `supabase_vault` nao existir [Vault](../../../../supabase/migrations/00000000000010_vault.sql#L30-L42).

**Impacto:** `supabase db reset` ou `db push` falha em ambiente sem Vault previamente habilitado; o token real e o estado remoto continuam handoff nao verificado. Os jobs de push nao sao demonstrados como executaveis.

**Mitigacao:** habilitar Vault no projeto remoto/local antes de aplicar, documentar o pre-requisito como blocker operacional e validar `vault.decrypted_secrets` sem registrar o token.

### HIGH-03 - `draw_teams` nao garante o contrato 2 goleiros + 14 jogadores

**Status:** corrigido na migration `00000000000013_draw.sql` e validado localmente.

**Evidencia:** a funcao limita goleiros a 2 e usa todos os demais confirmados em `NTILE(2)`, sem exigir contagens 2 e 14 [draw](../../../../supabase/migrations/00000000000013_draw.sql#L75-L127). O plano exige exatamente 2 e 14 [plan](../../../../docs/plan/20260724-futamigos-mvp/plan.yaml#L936-L945).

**Impacto:** sorteio com lista incompleta, excesso de jogadores ou menos de dois goleiros ainda seta `matches.status='active'`, quebrando capacidade e a garantia de um goleiro por time.

**Mitigacao:** validar contagens antes do delete/insert, abortar sem alterar estado quando diferentes de 2/14 e restringir sorteio a status permitido.

### HIGH-04 - Paridade ERD quebrada apos T7.2 e pela tabela de auditoria

**Evidencia:** o DDL original declara `profiles.id references auth.users` [schema](../../../../supabase/migrations/00000000000001_schema.sql#L126-L129), mas T7.2 remove a FK [drop FK](../../../../supabase/migrations/00000000000014_drop_profiles_auth_fk.sql#L26-L28). T5.2 adiciona `push_log`, ausente do ERD/schema de oito tabelas [push_log](../../../../supabase/migrations/00000000000012_push_jobs.sql#L81-L96).

**Impacto:** a relacao 1:1 do ERD nao e mais garantida; perfis OAuth orfaos podem permanecer. A documentacao e os checks de cobertura subcontam tabelas.

**Mitigacao:** atualizar ERD para o modelo sem FK e incluir `push_log`; escolher explicitamente cleanup/soft-delete de perfis OAuth e validar a decisao no schema final.

### MEDIUM-01 - Erros Expo 429/400 nao sao logados

**Evidencia:** a propria migration declara `http_status` nulo em T5.2 e preenchimento futuro em T5.3 [push](../../../../supabase/migrations/00000000000012_push_jobs.sql#L47-L50), [colunas](../../../../supabase/migrations/00000000000012_push_jobs.sql#L95-L96).

**Impacto:** o acceptance criterion de erros de entrega nao foi atendido; auditoria registra tentativa/request_id, mas nao sucesso ou falha.

**Mitigacao:** implementar polling de `net._http_response` ou job equivalente, persistir status/body e invalidar tokens `DeviceNotRegistered`.

### MEDIUM-02 - Push semanal ignora contexto do jogo e envia mensalista para todos

**Evidencia:** `get_active_push_tokens(null)` busca todos os tokens [push](../../../../supabase/migrations/00000000000012_push_jobs.sql#L169-L180), e os tres jobs chamam `dispatch_push` com `p_match_id=null` [jobs](../../../../supabase/migrations/00000000000012_push_jobs.sql#L362-L383).

**Impacto:** o lembrete de mensalidade nao filtra mensalistas; recap e lembrete de jogo usam texto generico e nao a partida da semana.

**Mitigacao:** filtrar destinatarios por `user_type`/grupo e resolver match futuro dentro de cada job antes do dispatch.

### MEDIUM-03 - FIFO rejeita qualquer RSVP, nao somente pendente

**Evidencia:** `reject_pending_presence` carrega a linha por id e atualiza para `declined` sem checar status anterior [FIFO](../../../../supabase/migrations/00000000000009_fifo.sql#L124-L145).

**Impacto:** admin pode rejeitar confirmado ou recusado e disparar promocao indevida; a transicao nao reflete o contrato de `pending_approval`.

**Mitigacao:** exigir `status='pending_approval'` no select/update atomico e retornar erro para estados incompatíveis.

### MEDIUM-04 - Validacao do APK foi somente estaticamente configurada

**Evidencia:** o cliente le apenas `EXPO_PUBLIC_*` [client](../../../../lib/supabase.ts#L14-L16), e os perfis EAS listam somente essas tres variaveis [EAS](../../../../eas.json#L8-L18). Nao ha artefato APK nesta revisao.

**Impacto:** ausencia de `SERVICE_ROLE_KEY` e `EXPO_ACCESS_TOKEN` esta validada no source/config, mas nao no binario produzido por T5.4.

**Mitigacao:** gerar APK preview, extrair/grep strings do artefato e anexar o resultado ao gate T8.2; manter `.env.server` fora do bundle.

## Itens verificados

- Trigger Auth: `handle_new_user` usa `SECURITY DEFINER`, `search_path=public`, defaults explicitos e `ON CONFLICT DO NOTHING` [trigger](../../../../supabase/migrations/00000000000004_trigger.sql#L35-L67).
- FIFO usa `FOR UPDATE SKIP LOCKED`, mas precisa da validacao de estado apontada em MEDIUM-03 [FIFO](../../../../supabase/migrations/00000000000009_fifo.sql#L58-L95).
- Walk-in T6.2 valida admin, match ativo, grupo do jogador e revoga `PUBLIC EXECUTE` [walk-in](../../../../supabase/migrations/00000000000015_sumula_walkin.sql#L15-L57), [grants](../../../../supabase/migrations/00000000000015_sumula_walkin.sql#L89-L90).
- Nao foi encontrado token real versionado; o Vault usa placeholder e exige handoff real [Vault](../../../../supabase/migrations/00000000000010_vault.sql#L67-L83).
- Todas as 8 tabelas originais tem RLS explicito; `push_log` tambem tem RLS admin-only [RLS](../../../../supabase/migrations/00000000000007_rls.sql#L61-L350), [push RLS](../../../../supabase/migrations/00000000000012_push_jobs.sql#L119-L127).

## Blockers para T8.2

1. Aplicar `00000000000016_security_hardening.sql` e confirmar CRITICAL-01/02/03 com anon/authenticated em E2E.
2. Corrigir ou aceitar formalmente HIGH-01 e HIGH-03 antes de testar RSVP/sorteio.
3. Habilitar e validar Vault remoto; definir o token real fora do git.
4. Aplicar migrations e confirmar os 5 jobs em `cron.job` e execucoes em `cron.job_run_details`.
5. Produzir APK T5.4 e verificar o binario, nao apenas `eas.json`.
6. O ultimo `npx tsc --noEmit` informado no contexto terminou com exit code 1; resolver os erros antes do build/E2E.

## Validacao da correcao

- Migration criada: `supabase/migrations/00000000000016_security_hardening.sql`.
- Check: `npx supabase db reset --local --yes` passou com Docker Desktop.
- Checks SQL executados contra `supabase_db_futamigos-mvp`: RLS, grants, Vault, cron, trigger, FIFO, draw e hardening.
- O app foi apontado para a API local via `.env` ignorado pelo Git.

## Report JSON

```json
{
  "status": "needs_revision",
  "verified_ok": false,
  "findings": {
    "critical": 0,
    "high": 2,
    "medium": 3,
    "low": 0
  },
  "target_file": "docs/plan/20260724-futamigos-mvp/review.md",
  "blockers_for_T8_2": [
    "Validar Vault e cron no projeto remoto com token Expo real",
    "Corrigir telemetria de respostas 400/429 do Expo Push",
    "Corrigir filtragem contextual dos jobs push",
    "Atualizar paridade ERD incluindo push_log e o modelo profiles sem FK auth.users",
    "No APK artifact scan",
    "Executar E2E em APK Android real"
  ]
}
```
