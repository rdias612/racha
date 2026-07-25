-- =====================================================================
-- Migration: 00000000000016_security_hardening.sql
-- Escopo: restringe updates de profiles/payments e RPCs de push server-only.
-- Idempotente: pode ser reaplicada sem reescrever migrations historicas.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PROFILES: o proprio usuario so pode editar full_name/avatar_url.
--    Admin pode ajustar campos administrativos, mas id/criacao permanecem
--    imutaveis para preservar a identidade referenciada pelas FKs.
-- ---------------------------------------------------------------------
create or replace function public.enforce_profile_update_security()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from old.id
     or new.created_at is distinct from old.created_at then
    raise exception 'profile identity fields are immutable';
  end if;

  if auth.uid() is not null and not public.is_admin()
     and (new.phone_whatsapp is distinct from old.phone_whatsapp
       or new.group_id is distinct from old.group_id
       or new.user_type is distinct from old.user_type
       or new.is_admin is distinct from old.is_admin
       or new.updated_at is distinct from old.updated_at) then
    raise exception 'users may update only full_name and avatar_url';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_security_hardening on public.profiles;
create trigger profiles_security_hardening
before update on public.profiles
for each row execute function public.enforce_profile_update_security();

comment on function public.enforce_profile_update_security() is
  'Impede auto-promocao e troca de grupo/tipo; self-service limita-se a full_name/avatar_url.';

-- ---------------------------------------------------------------------
-- 2. PAYMENTS: identidade e valor sao imutaveis para todos os papeis.
--    Jogador so marca marked_paid_at; admin pode aprovar e atualizar o
--    estado, sem adulterar user_id/group_id/amount/type.
-- ---------------------------------------------------------------------
create or replace function public.enforce_payment_update_security()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id is distinct from old.id
     or new.user_id is distinct from old.user_id
     or new.group_id is distinct from old.group_id
     or new.match_id is distinct from old.match_id
     or new.type is distinct from old.type
     or new.amount is distinct from old.amount
     or new.created_at is distinct from old.created_at then
    raise exception 'payment identity and financial fields are immutable';
  end if;

  if auth.uid() is not null and not public.is_admin()
     and (new.title is distinct from old.title
       or new.status is distinct from old.status
       or new.approved_at is distinct from old.approved_at
       or new.paid_at is distinct from old.paid_at
       or new.updated_at is distinct from old.updated_at) then
    raise exception 'users may update only marked_paid_at';
  end if;

  return new;
end;
$$;

drop trigger if exists payments_security_hardening on public.payments;
create trigger payments_security_hardening
before update on public.payments
for each row execute function public.enforce_payment_update_security();

comment on function public.enforce_payment_update_security() is
  'Mantem identidade/valor/tipo do pagamento imutaveis e limita self-service a marked_paid_at.';

-- ---------------------------------------------------------------------
-- 3. PUSH: estas duas funcoes sao chamadas por pg_cron/server-side.
--    Owner postgres conserva EXECUTE; service_role e explicitamente
--    autorizado. PUBLIC/anon/authenticated nao podem invoca-las.
-- ---------------------------------------------------------------------
revoke execute on function public.get_active_push_tokens(uuid)
  from public, anon, authenticated;
grant execute on function public.get_active_push_tokens(uuid)
  to postgres, service_role;

revoke execute on function public.dispatch_push(text, uuid)
  from public, anon, authenticated;
grant execute on function public.dispatch_push(text, uuid)
  to postgres, service_role;

comment on function public.get_active_push_tokens(uuid) is
  'T5.2: server-only; EXECUTE revogado de PUBLIC, anon e authenticated em T8.1.';
comment on function public.dispatch_push(text, uuid) is
  'T5.2: server-only; EXECUTE revogado de PUBLIC, anon e authenticated em T8.1.';

-- ---------------------------------------------------------------------
-- 4. Policies continuam exigindo dono/admin; os triggers acima controlam
--    quais colunas cada papel pode efetivamente alterar.
-- ---------------------------------------------------------------------
drop policy if exists profiles_update_policy on public.profiles;
create policy profiles_update_policy on public.profiles
  for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists payments_update_policy on public.payments;
create policy payments_update_policy on public.payments
  for update
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

comment on policy profiles_update_policy on public.profiles is
  'Self-service limitado pelo trigger a full_name/avatar_url; admin pode atualizar campos administrativos.';
comment on policy payments_update_policy on public.payments is
  'Self-service limitado pelo trigger a marked_paid_at; admin pode aprovar sem alterar identidade/valor/tipo.';