-- =====================================================================
-- Migration: 00000000000004_trigger.sql
-- Task: T1.5 - Trigger auth.users -> PROFILES (defaults explicitos)
-- Stack: PostgreSQL 15 / Supabase
--
-- Objetivo:
--   Apos Supabase Auth criar usuario em auth.users, dispara trigger que
--   insere linha correspondente em PROFILES. Defaults EXPLICITOS (regra M2):
--     - id            = NEW.id (FK auth.users)
--     - group_id      = UUID fixo do seed GROUPS T1.3b (0000...-0001)
--     - full_name     = COALESCE(raw meta full_name, parte local email)
--     - user_type     = 'avulso' (regra PRD M2)
--     - is_admin      = false     (regra PRD secao 6)
--     - avatar_url    = raw meta avatar_url (default NULL)
--
-- Idempotente:
--   - ON CONFLICT (id) DO NOTHING (nao duplica nem sobrescreve edicoes manuais).
--   - DROP TRIGGER IF EXISTS antes de criar (re-run seguro).
--
-- Seguranca:
--   - SECURITY DEFINER + SET search_path = public (regra Supabase Auth).
--     Evita search_path hijack.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Cleanup idempotente
-- ---------------------------------------------------------------------

drop trigger if exists on_auth_user_created on auth.users;

-- function antiga (se existir de run anterior)
drop function if exists public.handle_new_user();

-- ---------------------------------------------------------------------
-- 1. Function handle_new_user (SECURITY DEFINER)
-- ---------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    group_id,
    full_name,
    avatar_url,
    user_type,
    is_admin
  ) values (
    new.id,
    '00000000-0000-0000-0000-000000000001'::uuid,           -- seed GROUPS T1.3b
    coalesce(
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data->>'avatar_url',                   -- NULL se ausente
    'avulso'::user_type,                                     -- DEFAULT EXPLICITO (PRD M2)
    false                                                    -- DEFAULT EXPLICITO (PRD secao 6)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'T1.5: Trigger apos INSERT em auth.users. Cria perfil em PROFILES com defaults explicitos (user_type=avulso, is_admin=false). Idempotente via ON CONFLICT (id) DO NOTHING.';

-- ---------------------------------------------------------------------
-- 2. Trigger
-- ---------------------------------------------------------------------

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- FIM da migration T1.5
--
-- Notas operacionais:
--   * seed-auth.ts (T1.3b) continua funcionando: seu upsert (ON CONFLICT
--     id DO UPDATE) e compativel com este trigger (DO NOTHING). Se o
--     trigger ja criou a linha, seed apenas promove para mensalista/goleiro.
--   * Para promocao manual de role (mensalista/goleiro_pago), usar UPDATE
--     direto em PROFILES (UI admin T7.2 / seed-auth.ts).
--
-- Teste rapido (opcional, em dev):
--   insert into auth.users (id, email, instance_id, aud, role)
--   values (gen_random_uuid(), 'teste@futamigos.local',
--           '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
--   select id, full_name, user_type, is_admin from public.profiles
--   where email = 'teste@futamigos.local';
-- =====================================================================
