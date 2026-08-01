-- =====================================================================
-- Seed: supabase/seed.sql
-- Task: T1.3b - Seed GROUPS fixo (FutAmigos MVP)
-- Aplicado automaticamente por `supabase db reset` (pos-migrations).
--
-- Escopo: APENAS o registro do racha (public.groups).
--   - Goleiros e admin fake EXIGEM auth.users (gerenciado por GoTrue,
--     inacessivel via SQL puro). Sao criados por `supabase/seed-auth.ts`
--     com service_role (ver package.json > script `seed:auth`).
--
-- Convensao:
--   - ID numerico estavel hardcoded (facilmente copiavel para FK em dev).
--   - Idempotente via ON CONFLICT (id) DO UPDATE.
--   - PT-BR nos comentarios.
-- =====================================================================

insert into public.groups (
  id,
  name,
  day_of_week,
  monthly_fee,
  default_casual_fee,
  goalkeeper_expense,
  monthly_capacity,
  timezone
) values (
  1,
  'Racha Quintas',
  4,
  60.00,
  20.00,
  40.00,
  16,
  'America/Sao_Paulo'
)
on conflict (id) do update set
  name                = excluded.name,
  day_of_week         = excluded.day_of_week,
  monthly_fee         = excluded.monthly_fee,
  default_casual_fee  = excluded.default_casual_fee,
  goalkeeper_expense  = excluded.goalkeeper_expense,
  monthly_capacity    = excluded.monthly_capacity,
  timezone            = excluded.timezone;
