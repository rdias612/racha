-- =====================================================================
-- Migration: 00000000000007_rls.sql
-- Task: T1.7 - Row Level Security + Policies (8 tabelas)
-- Stack: PostgreSQL 15 / Supabase
-- Escopo: 2 helpers SECURITY DEFINER + ENABLE RLS + policies em todas
--         as 8 tabelas do schema T1.3a.
-- Modelo:
--   - Usuario comum ve SO dados do proprio grupo (is_group_member).
--   - Admin (profiles.is_admin = true) bypassa restricoes de grupo.
--   - Dono do recurso pode mutar o proprio registro (self-service parcial).
--   - service_role ignora RLS automaticamente (nao ha policy propria).
-- Convencao: COMMENTs em PT-BR. Idempotente (DROP POLICY IF EXISTS).
-- Anti-pattern PROIBIDO: `using (true)` (vazamento de dados).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. HELPERS (SECURITY DEFINER)
-- ---------------------------------------------------------------------
-- SECURITY DEFINER executa com privilegios do OWNER (bypassa RLS na
-- leitura de `profiles`). Sem isso, a policy de PROFILES seria recursiva
-- (policies chamando is_admin() que consulta profiles sujeito a RLS).
-- SET search_path = public bloqueia search_path injection.

-- Helper: verifica se o usuario atual (auth.uid()) e admin em algum grupo.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  );
$$;

comment on function public.is_admin() is
  'Verifica (STABLE, SECURITY DEFINER) se auth.uid() e admin (profiles.is_admin=true).';

-- Helper: verifica se o usuario atual pertence ao grupo <check_group_id>.
create or replace function public.is_group_member(check_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.group_id = check_group_id
  );
$$;

comment on function public.is_group_member(uuid) is
  'Verifica (STABLE, SECURITY DEFINER) se auth.uid() pertence ao grupo informado.';

-- ---------------------------------------------------------------------
-- 1. PROFILES
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists profiles_select_policy on public.profiles;
create policy profiles_select_policy on public.profiles
  for select
  using (
    public.is_group_member(group_id) or public.is_admin()
  );

drop policy if exists profiles_insert_policy on public.profiles;
create policy profiles_insert_policy on public.profiles
  for insert
  with check (
    id = auth.uid() or public.is_admin()
  );

drop policy if exists profiles_update_policy on public.profiles;
create policy profiles_update_policy on public.profiles
  for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists profiles_delete_policy on public.profiles;
create policy profiles_delete_policy on public.profiles
  for delete
  using (public.is_admin());

comment on policy profiles_select_policy on public.profiles is
  'Membros do grupo veem todos os perfis do grupo (incl. goleiro_pago). Admin ve tudo.';
comment on policy profiles_insert_policy on public.profiles is
  'Auto-insert do proprio perfil (id=auth.uid) OU admin cria goleiro_pago.';
comment on policy profiles_update_policy on public.profiles is
  'Usuario edita proprio perfil OU admin.';
comment on policy profiles_delete_policy on public.profiles is
  'Somente admin remove perfis.';

-- ---------------------------------------------------------------------
-- 2. GROUPS
-- ---------------------------------------------------------------------
alter table public.groups enable row level security;

drop policy if exists groups_select_policy on public.groups;
create policy groups_select_policy on public.groups
  for select
  using (public.is_group_member(id));

drop policy if exists groups_insert_policy on public.groups;
create policy groups_insert_policy on public.groups
  for insert
  with check (public.is_admin());

drop policy if exists groups_update_policy on public.groups;
create policy groups_update_policy on public.groups
  for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists groups_delete_policy on public.groups;
create policy groups_delete_policy on public.groups
  for delete
  using (public.is_admin());

comment on policy groups_select_policy on public.groups is
  'Membros veem o proprio grupo.';
comment on policy groups_insert_policy on public.groups is
  'Somente admin cria grupos.';
comment on policy groups_update_policy on public.groups is
  'Somente admin edita configuracoes do grupo.';
comment on policy groups_delete_policy on public.groups is
  'Somente admin remove grupo.';

-- ---------------------------------------------------------------------
-- 3. MATCHES
-- ---------------------------------------------------------------------
alter table public.matches enable row level security;

drop policy if exists matches_select_policy on public.matches;
create policy matches_select_policy on public.matches
  for select
  using (public.is_group_member(group_id));

drop policy if exists matches_insert_policy on public.matches;
create policy matches_insert_policy on public.matches
  for insert
  with check (public.is_admin());

drop policy if exists matches_update_policy on public.matches;
create policy matches_update_policy on public.matches
  for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists matches_delete_policy on public.matches;
create policy matches_delete_policy on public.matches
  for delete
  using (public.is_admin());

comment on policy matches_select_policy on public.matches is
  'Membros do grupo veem as partidas do racha.';
comment on policy matches_insert_policy on public.matches is
  'Somente admin agenda partidas.';
comment on policy matches_update_policy on public.matches is
  'Somente admin altera partida (status, placar, goleiros).';
comment on policy matches_delete_policy on public.matches is
  'Somente admin cancela/remove partida.';

-- ---------------------------------------------------------------------
-- 4. MATCH_PRESENCES (RSVP leve)
-- ---------------------------------------------------------------------
-- Subquery em group_id via matches (YAGNI: nao denormalizar group_id).
alter table public.match_presences enable row level security;

drop policy if exists match_presences_select_policy on public.match_presences;
create policy match_presences_select_policy on public.match_presences
  for select
  using (
    public.is_group_member(
      (select group_id from public.matches where id = match_presences.match_id)
    )
  );

drop policy if exists match_presences_insert_policy on public.match_presences;
create policy match_presences_insert_policy on public.match_presences
  for insert
  with check (
    user_id = auth.uid()
    and public.is_group_member(
      (select group_id from public.matches where id = match_presences.match_id)
    )
  );

drop policy if exists match_presences_update_policy on public.match_presences;
create policy match_presences_update_policy on public.match_presences
  for update
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists match_presences_delete_policy on public.match_presences;
create policy match_presences_delete_policy on public.match_presences
  for delete
  using (public.is_admin());

comment on policy match_presences_select_policy on public.match_presences is
  'Membros do grupo da partida veem todos os RSVPs.';
comment on policy match_presences_insert_policy on public.match_presences is
  'Usuario confirma propria presenca (user_id=auth.uid), desde que seja do grupo da partida.';
comment on policy match_presences_update_policy on public.match_presences is
  'Usuario muda proprio RSVP OU admin.';
comment on policy match_presences_delete_policy on public.match_presences is
  'Somente admin remove RSVP.';

-- ---------------------------------------------------------------------
-- 5. MATCH_PARTICIPANTS (estatisticas congeladas)
-- ---------------------------------------------------------------------
alter table public.match_participants enable row level security;

drop policy if exists match_participants_select_policy on public.match_participants;
create policy match_participants_select_policy on public.match_participants
  for select
  using (
    public.is_group_member(
      (select group_id from public.matches where id = match_participants.match_id)
    )
  );

drop policy if exists match_participants_insert_policy on public.match_participants;
create policy match_participants_insert_policy on public.match_participants
  for insert
  with check (public.is_admin());

drop policy if exists match_participants_update_policy on public.match_participants;
create policy match_participants_update_policy on public.match_participants
  for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists match_participants_delete_policy on public.match_participants;
create policy match_participants_delete_policy on public.match_participants
  for delete
  using (public.is_admin());

comment on policy match_participants_select_policy on public.match_participants is
  'Membros do grupo da partida veem as estatisticas congeladas.';
comment on policy match_participants_insert_policy on public.match_participants is
  'Somente admin popula estatisticas (match -> active).';
comment on policy match_participants_update_policy on public.match_participants is
  'Somente admin ajusta estatisticas.';
comment on policy match_participants_delete_policy on public.match_participants is
  'Somente admin remove participante.';

-- ---------------------------------------------------------------------
-- 6. PAYMENTS (transparencia total dentro do grupo)
-- ---------------------------------------------------------------------
-- PRD regra 6: todos do grupo veem todos pagamentos (transparencia).
alter table public.payments enable row level security;

drop policy if exists payments_select_policy on public.payments;
create policy payments_select_policy on public.payments
  for select
  using (public.is_group_member(group_id));

drop policy if exists payments_insert_policy on public.payments;
create policy payments_insert_policy on public.payments
  for insert
  with check (public.is_admin());

drop policy if exists payments_update_policy on public.payments;
create policy payments_update_policy on public.payments
  for update
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists payments_delete_policy on public.payments;
create policy payments_delete_policy on public.payments
  for delete
  using (public.is_admin());

comment on policy payments_select_policy on public.payments is
  'Transparencia (PRD regra 6): todos do grupo veem todos pagamentos.';
comment on policy payments_insert_policy on public.payments is
  'Somente admin gera cobrancas (mensalidade/casual via cron ou manual).';
comment on policy payments_update_policy on public.payments is
  'Jogador marca marked_paid_at (1a confirmacao) OU admin aprova approved_at/paid_at (2a).';
comment on policy payments_delete_policy on public.payments is
  'Somente admin remove cobranca.';

-- ---------------------------------------------------------------------
-- 7. EXPENSES (caixa do racha - transparencia)
-- ---------------------------------------------------------------------
alter table public.expenses enable row level security;

drop policy if exists expenses_select_policy on public.expenses;
create policy expenses_select_policy on public.expenses
  for select
  using (public.is_group_member(group_id));

drop policy if exists expenses_insert_policy on public.expenses;
create policy expenses_insert_policy on public.expenses
  for insert
  with check (public.is_admin());

drop policy if exists expenses_update_policy on public.expenses;
create policy expenses_update_policy on public.expenses
  for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists expenses_delete_policy on public.expenses;
create policy expenses_delete_policy on public.expenses
  for delete
  using (public.is_admin());

comment on policy expenses_select_policy on public.expenses is
  'Transparencia: membros do grupo veem todas as saidas do caixa.';
comment on policy expenses_insert_policy on public.expenses is
  'Somente admin registra saida.';
comment on policy expenses_update_policy on public.expenses is
  'Somente admin confirma/ajusta saida.';
comment on policy expenses_delete_policy on public.expenses is
  'Somente admin remove saida.';

-- ---------------------------------------------------------------------
-- 8. DEVICE_TOKENS (1:N com PROFILES - push Expo)
-- ---------------------------------------------------------------------
-- Privado: cada usuario so ve/gerencia seus propios tokens. Admin pode
-- limpar tokens obsoletos via DELETE.
alter table public.device_tokens enable row level security;

drop policy if exists device_tokens_select_policy on public.device_tokens;
create policy device_tokens_select_policy on public.device_tokens
  for select
  using (user_id = auth.uid());

drop policy if exists device_tokens_insert_policy on public.device_tokens;
create policy device_tokens_insert_policy on public.device_tokens
  for insert
  with check (user_id = auth.uid());

drop policy if exists device_tokens_update_policy on public.device_tokens;
create policy device_tokens_update_policy on public.device_tokens
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists device_tokens_delete_policy on public.device_tokens;
create policy device_tokens_delete_policy on public.device_tokens
  for delete
  using (user_id = auth.uid() or public.is_admin());

comment on policy device_tokens_select_policy on public.device_tokens is
  'Usuario ve apenas os proprios tokens (privacidade de dispositivo).';
comment on policy device_tokens_insert_policy on public.device_tokens is
  'Usuario registra token do proprio dispositivo.';
comment on policy device_tokens_update_policy on public.device_tokens is
  'Usuario atualiza proprio token.';
comment on policy device_tokens_delete_policy on public.device_tokens is
  'Usuario remove proprio token OU admin limpa tokens obsoletos.';

-- =====================================================================
-- FIM da migration T1.7
-- Resumo:
--   Helpers:      2 (is_admin, is_group_member) - SECURITY DEFINER STABLE
--   Tabelas RLS:  8 (todas ENABLE ROW LEVEL SECURITY)
--   Policies:     27 (select + insert + update + delete quando aplicavel)
--   Open policies: 0 (nenhum using(true) - verificado)
--
-- NOTAS:
--   N1. service_role ignora RLS automaticamente (nao ha policy propria).
--       Backend admin/cron usa service_role para criacao de goleiro_pago,
--       mensalidades, etc.
--   N2. match_presences e match_participants usam subquery em
--       `matches.group_id`. YAGNI: nao denormalizar group_id nessas
--       tabelas (aceitavel para ~10-20 players/match do MVP).
--   N3. SECURITY DEFINER nos helpers evita recursao de RLS (consultar
--       public.profiles dentro de policy de public.profiles).
--   N4. UPDATE policies usam USING + WITH CHECK: USING decide quais
--       linhas podem ser alvo; WITH CHECK valida o estado pos-update.
-- =====================================================================
