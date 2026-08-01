# Plano: Autenticação via `profiles` (username + senha, texto puro)

Objetivo: remover Supabase Auth `auth.users` por jogador. Login direto contra
`profiles.username` + `profiles.password` (texto puro). Sessão guardada no
celular (Secure Store). Admin técnico = um `profile` com `is_admin = true`.

---

## 0. Decisão de bloqueio (DECIDIR ANTES DE CODAR)

As policies RLS atuais usam `auth.uid()` (Supabase Auth). Sem Auth,
`auth.uid()` é sempre `NULL` → **todas as policies bloqueiam tudo**.

Duas opções:

### Opção A — DESATIVAR RLS (alinhada a "app de amigos, simples")

- `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` nas tabelas do app.
- App usa só a `anon key` para tudo.
- `is_admin()` deixa de ler `auth.uid()`; vira parâmetro ou checagem no app.
- **Tradeoff:** quem tiver a `anon key` (dentro do APK) pode ler/gravar tudo,
  inclusive senhas e pagamentos. Aceitável só porque o APK circula entre
  amigos de confiança.
- Recomendado para o pedido atual.

### Opção B — MANTER RLS via JWT custom (não recomendado agora)

- Edge Function assina JWT com o JWT secret do projeto (`sub = profile.id`).
- Client envia esse JWT; `auth.uid()` volta a funcionar; RLS inteiro reinado.
- Mais setup (vault + função + header no client). Descartado por "desnecessário".

> Esse plano **assume a Opção A**. Mudar para B depois implica reativar RLS.

---

## Fase 1 — Banco (nova migration `*_plain_auth`)

Arquivo: `supabase/migrations/00000000000018_plain_auth.sql`

1. `alter table public.profiles add column password text not null default '';`
2. Comentar coluna (`'Senha em texto puro (app de amigos). Login direto.'`).
3. **Opção A:** desativar RLS em `profiles, groups, matches, match_presences,
match_participants, payments, expenses, device_tokens, push_log`.
4. Reescrever `is_admin()` e `is_group_member()` para não depender de
   `auth.uid()` (parametrizar por `p_user_id uuid`) — usados por RPCs Admin
   e triggers que ainda chamam essas funções.
5. Revisar trigger `enforce_profile_update_security()` (mig 17): hoje checa
   `auth.uid()`; sem Auth, `auth.uid()` é NULL → a guarda de self-service
   some. Decidir: soltar o trigger ou adaptar.
6. Criar RPC de login (evita expor a coluna `password` ao client):
   ```sql
   create or replace function public.login(p_username text, p_password text)
   returns table (id uuid, username text, user_type user_type,
                  is_admin boolean, group_id uuid)
   language sql security definer set search_path = public as $$
     select id, username, user_type, is_admin, group_id
     from public.profiles
     where username = lower(p_username)
       and password = p_password
     limit 1;
   $$;
   ```
7. Seed admin `dico` (senha definida por você) + grupo já existe.

Aplicar via MCP (`apply_migration`) ou `supabase db push`.

---

## Fase 2 — Remover Supabase Auth do app

| Arquivo                  | Ação                                                                                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/auth-local.ts`      | Remover `localAuthEmail`. Manter `normalizeUsername`.                                                                                              |
| `lib/secure-store.ts`    | Trocar tipo guardado de `Session` → `AuthProfile` (id/username/is_admin). Renomear chave p/ `active-profile`.                                      |
| `hooks/useAuth.ts`       | Reescrever: chamar `supabase.rpc('login', {...})`; em sucesso gravar profile; sem `signInWithPassword`/`setSession`/`onAuthStateChange`/`getUser`. |
| `app/_layout.tsx`        | `session` vira `profile                                                                                                                            | null`. Gating mantém igual. |
| `app/(tabs)/_layout.tsx` | Trocar `supabase.auth.getUser()` por leitura do profile ativo (hook/secure-store).                                                                 |
| `app/(tabs)/perfil.tsx`  | Trocar `supabase.auth.updateUser({password})` por `update profiles set password`.                                                                  |
| `lib/pushToken.ts`       | Trocar `supabase.auth.getUser()` por id do profile ativo.                                                                                          |
| `hooks/useIsAdmin.ts`    | Já lê `profiles.is_admin`; continua ok.                                                                                                            |
| `types/`                 | Adicionar `AuthProfile`.                                                                                                                           |

`lib/supabase.ts`: manter `persistSession:false`; remover dependência de auth
(refresh token etc.).

---

## Fase 3 — Limpeza de provisionamento Auth

| Arquivo                                      | Ação                                                                              |
| -------------------------------------------- | --------------------------------------------------------------------------------- |
| `supabase/seed-auth.ts`                      | Excluir (criava `auth.users`).                                                    |
| `supabase/functions/provision-user/index.ts` | Reescrever p/ só `INSERT into profiles` (sem `auth.admin.createUser`).            |
| `supabase/functions/_shared/auth-local.ts`   | Remover `localAuthEmail`.                                                         |
| `package.json`                               | Revisar/remover script `seed:auth`.                                               |
| `.env.server.example`                        | Remover `LOCAL_AUTH_DEFAULT_PASSWORD` (ou vira senha default de novos jogadores). |
| `README.md`, `implementation_plan.md`        | Atualizar fluxo de auth.                                                          |

---

## Fase 4 — Validação

1. `npm run tsc` → 0 erros.
2. Aplicar migration; confirmar `profiles.password` + RPC `login`.
3. Smoke: `select * from public.login('dico','<senha>');` retorna linha.
4. App: login, persistência após reabrir, logout, troca de senha.
5. Admin: criar jogador via UI (edge function reescrita).

---

## Fora de escopo (YAGNI)

- Hash de senha (decisão do dono).
- JWT customizado / reativação de RLS (Opção B).
- Tabela `app_sessions` / revogação.
- OAuth Google/Apple.
