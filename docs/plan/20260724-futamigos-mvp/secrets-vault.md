# T5.0 - Supabase Vault: Expo Access Token

Resolve **blocker H3** e **B-H1**: armazena `EXPO_ACCESS_TOKEN` fora do APK e
fora de migrations versionadas. Token e lido em runtime por jobs `pg_cron` via
`vault.decrypted_secrets` e injetado em `current_setting('app.expo_token')`.

## Modelo de ameaca

| Superficie                | Risco                | Mitigacao                                                                       |
| ------------------------- | -------------------- | ------------------------------------------------------------------------------- |
| APK disassemblado         | Leak de token Expo   | Token **nunca** no APK / `.env.example` cliente                                 |
| Migration versionada      | Token em git history | Migration usa `PLACEHOLDER_SET_VIA_DASHBOARD`                                   |
| Logs / pg_stat_statements | Vazamento do setting | `SET LOCAL` (escopo transacao) + nunca `RAISE NOTICE` em `current_setting(...)` |
| Anon/authenticated        | Leitura via API      | `REVOKE` explicito + RLS do Vault                                               |

## Arquitetura

```
+-------------------+      create_secret()      +---------------------+
|  Migration 10 SQL |  -----------------------> |   vault.secrets     |
|  (placeholder)    |                            |  name=expo_access_  |
+-------------------+                            |       token         |
                                                 |  secret=<REAL>      |
                  dashboard/CLI                  |  (setado por user)  |
                 +----------------->             +---------------------+
                                                             ^
                                                             | vault.decrypted_secrets
                                                             |
+-------------------+   SET LOCAL app.expo_token=val       |
|  pg_cron job T5.2 |  ----------------------------------->| (leitura service_role)
|  (SECURITY        |   pg_net.http_post Authorization:    |
|   DEFINER)        |       Bearer current_setting(...)   |
+-------------------+   -> Expo Push API                    |
                                                              v
                                                   https://exp.host/api/v2/push/send
```

## Setup

### 1. Migration (commitada, idempotente)

`supabase/migrations/00000000000010_vault.sql` cria o secret com placeholder e
garante permissoes restritivas (`REVOKE` em `anon`/`authenticated`, `GRANT`
em `service_role`).

### 2. Setar token REAL (handoff - fora do commit)

**Local dev** (`supabase db reset` reaplica placeholder, re-setar a cada reset):

```sql
-- via Supabase Studio > SQL Editor ou psql direto
update vault.secrets
   set secret = '<COLE_AQUI_SEU_EXPO_ACCESS_TOKEN>'
 where name = 'expo_access_token';
```

**Remoto (producao)**: rode o mesmo `UPDATE` no SQL Editor do projeto Supabase
apos `supabase db push`. Token obtido em
`expo.dev > Account Settings > Access Tokens`.

> Alternativa: `psql` direto via `supabase/.env` (`SUPABASE_DB_URL`).

### 3. Validar

```sql
-- Deve retornar o bearer real apos o passo 2.
select decrypted_secret
  from vault.decrypted_secrets
 where name = 'expo_access_token';

-- Antes do passo 2, retorna 'PLACEHOLDER_SET_VIA_DASHBOARD'.
```

## Pattern de uso em jobs pg_cron (T5.2)

Qualquer job que faca dispatch Expo Push deve abrir com:

```sql
-- Injeta token na transacao corrente (nao persiste em pg_settings).
select decrypted_secret
  into v_expo_token
  from vault.decrypted_secrets
 where name = 'expo_access_token'
 limit 1;
perform set_config('app.expo_token', coalesce(v_expo_token, ''), true);

-- Exemplo: POST para Expo Push API via pg_net.
select net.http_post(
  url     := 'https://exp.host/api/v2/push/send',
  headers := jsonb_build_object(
    'Content-Type',  'application/json',
    'Authorization', 'Bearer ' || current_setting('app.expo_token')
  ),
  body    := jsonb_build_array(
    jsonb_build_object('to', t.token, 'title', 'Jogo as 19h', 'body', 'Bora!')
  )
)
from unnest(array['ExponentPushToken[xxx]']) as t(token);
```

### Por que `SET LOCAL` (nao `SET` ou `current_setting` direto)?

- **Escopo de transacao**: valor some ao final do job -> nao persiste entre
  conexoes, nao vaza em `pg_settings`.
- **Logs seguros**: ao contrario de `SET` (que apareceria em
  `pg_stat_statements`), `SET LOCAL` mantem o valor efemero.
- **Nao logar `current_setting(...)` em `RAISE NOTICE`**: evita token em
  `cron.job_run_details`.

## Env files

| Arquivo               | Conteudo                                                                          | bundle APK?            |
| --------------------- | --------------------------------------------------------------------------------- | ---------------------- |
| `.env.example`        | `EXPO_PUBLIC_*` apenas                                                            | Sim (seguro: anon/URL) |
| `.env.server.example` | `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `EXPO_ACCESS_TOKEN` (dev/migrations) | **Nao**                |
| `supabase/.env`       | `SUPABASE_PROJECT_REF`, `SUPABASE_DB_URL`, `GOOGLE_WEB_CLIENT_SECRET`             | **Nao** (CLI)          |

> `EXPO_ACCESS_TOKEN` em `.env.server.example` serve apenas para referencia de
> onde obte-lo - **nao** e read pelo APK. Operacionalmente o token vive no Vault.

## Acceptance checks

- [x] Migration `00000000000010_vault.sql` aplicavel (`supabase db reset`).
- [x] `SELECT decrypted_secret FROM vault.decrypted_secrets ...` retorna valor.
- [x] `anon`/`authenticated` recebem `permission denied` ao consultar Vault.
- [x] Pattern `SET LOCAL app.expo_token` documentado (consumido por T5.2).
- [x] Nenhum token Expo hardcoded em arquivos versionados.

## Handoff para operador

- [ ] Rodar `supabase db push` (aplica migration em projeto remoto).
- [ ] `UPDATE vault.secrets SET secret='<TOKEN>' WHERE name='expo_access_token'`.
- [ ] Confirmar leitura de `decrypted_secret` em `vault.decrypted_secrets` retorna
      token real.
- [ ] Registrar rotacao de token a cada 90 dias (derivar novo access token em
      expo.dev e re-rodar UPDATE). Dono: T5.2 dispatch.
