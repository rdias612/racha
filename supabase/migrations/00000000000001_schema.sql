-- =====================================================================
-- Migration: 00000000000001_schema.sql
-- Task: T1.3a - Schema DDL FutAmigos MVP
-- Stack: PostgreSQL 15 / Supabase
-- Escopo: somente DDL (8 tabelas + 6 enums + FKs + indexes).
--         SEM seed (T1.3b), SEM RLS (T1.7), SEM functions/triggers (T1.5).
-- Convencao: COMMENTs em PT-BR (auditoria/documentacao).
-- Ordem: extensoes -> enums -> GROUPS -> PROFILES -> MATCHES -> dependentes
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. EXTENSOES
-- ---------------------------------------------------------------------
-- pg_cron: scheduler para jobs BRT (mensalidades dia 5, pushes Seg/Ter/Qui).
--          Supabase exige o schema `cron` explicito.
-- pg_net : cliente HTTP para dispatch Expo Push (chamado via T5.1/T5.2).
-- vault  : secret store nativo do Supabase (ja habilitado por default no
--          schema `vault`) - guarda EXPO_ACCESS_TOKEN em T5.0.

create extension if not exists "pg_cron" with schema cron;
create extension if not exists "pg_net";

comment on schema cron is 'Scheduler para jobs BRT (mensalidades dia 5, pushes Seg/Ter/Qui).';
comment on schema vault is 'Secret store para Expo access token (T5.0).';

-- ---------------------------------------------------------------------
-- 1. ENUMS (criar ANTES das tabelas que os referenciam)
-- ---------------------------------------------------------------------

create type user_type as enum (
  'mensalista',
  'avulso',
  'goleiro_pago'
);

create type match_status as enum (
  'scheduled',
  'active',
  'finished',
  'cancelled'
);

create type rsvp_status as enum (
  'confirmed',
  'waiting_list',
  'declined',
  'pending_approval'
);

create type payment_type as enum (
  'monthly',
  'casual'
);

create type payment_status as enum (
  'pending',
  'paid'
);

create type expense_type as enum (
  'goalkeeper',
  'field',
  'other'
);

comment on type user_type is 'Papel do usuario: mensalista, avulso, ou goleiro_pago (sem auth).';
comment on type match_status is 'Estado da partida: agendada, ativa (congela participantes), finalizada, cancelada.';
comment on type rsvp_status is 'Status do RSVP: confirmado, lista de espera (FIFO avulso), recusado, ou pendente de aprovacao do admin.';
comment on type payment_type is 'Tipo de cobranca: mensalidade (dia 5) ou avulsa (por partida).';
comment on type payment_status is 'Estado do pagamento: pendente (dupla confirmacao) ou pago.';
comment on type expense_type is 'Tipo de saida do caixa: goleiro, aluguel do campo, ou outra.';

-- ---------------------------------------------------------------------
-- 2. GROUPS (raiz do isolamento por group_id para RLS)
-- ---------------------------------------------------------------------

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  day_of_week integer not null default 4,
  monthly_fee numeric(10,2) not null default 0,
  default_casual_fee numeric(10,2) not null default 20.00,
  goalkeeper_expense numeric(10,2) not null default 40.00,
  monthly_capacity integer not null default 16,
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint groups_day_of_week_check
    check (day_of_week between 0 and 6),
  constraint groups_monthly_fee_check
    check (monthly_fee >= 0),
  constraint groups_default_casual_fee_check
    check (default_casual_fee >= 0),
  constraint groups_goalkeeper_expense_check
    check (goalkeeper_expense >= 0),
  constraint groups_monthly_capacity_check
    check (monthly_capacity between 1 and 100)
);

comment on table public.groups is 'Racha/pelada. Centraliza configuracao (dia, valores, timezone). 1 grupo fixo no MVP.';
comment on column public.groups.id is 'PK uuid (gen_random_uuid).';
comment on column public.groups.name is 'Nome do racha (PT-BR).';
comment on column public.groups.day_of_week is 'Dia da semana: 0=Domingo ... 4=Quinta ... 6=Sabado. Default 4.';
comment on column public.groups.monthly_capacity is 'Numero maximo de mensalistas/vagas confirmadas (PRD regra 1): default 16 (14 linha + 2 goleiros). CHECK 1..100.';
comment on column public.groups.monthly_fee is 'Mensalidade padrao (R$). Default 0 ate definicao do admin.';
comment on column public.groups.default_casual_fee is 'Taxa fixa de avulso por partida (R$). Default 20.00.';
comment on column public.groups.goalkeeper_expense is 'Custo total dos 2 goleiros pagos (R$). Default 40.00.';
comment on column public.groups.timezone is 'Fuso do racha. Default America/Sao_Paulo (BRT/UTC-3).';
comment on column public.groups.created_at is 'Timestamp UTC de criacao.';
comment on column public.groups.updated_at is 'Timestamp UTC da ultima atualizacao (atualizado via trigger em T1.5).';

-- ---------------------------------------------------------------------
-- 3. PROFILES (1:1 com auth.users; tambem abriga goleiro_pago sem auth)
-- ---------------------------------------------------------------------
-- RISCO DOCUMENTADO (handoff T1.3a):
--   PROFILES.id REFERENCES auth.users(id) ON DELETE CASCADE e a pratica
--   padrao Supabase. Contudo, goleiro_pago NAO possui entrada em auth.users
--   (nao faz login). Em DB com FK ativa, INSERT de goleiro_pago com UUID
--   arbitrario FALHARA nesta FK. O seed T1.3b deve:
--     (a) usar UUIDs reais de auth.users quando possivel, OU
--     (b) a planejamento deve reconsiderar: remover FK para auth.users OU
--         adicionar coluna nullable auth_user_id separada.
--   Assumido neste MVP: manter FK padrao; goleiro_pago sera criado via
--   UI admin (T7.2) com UUID real de auth.users ou service_role workaround.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  group_id uuid references public.groups(id) on delete set null,
  full_name text not null,
  phone_whatsapp text,
  user_type user_type not null default 'avulso',
  is_admin boolean not null default false,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Perfil do usuario (1:1 com auth.users). Abriga mensalistas, avulsos e goleiro_pago.';
comment on column public.profiles.id is 'PK uuid = auth.users.id (FK ON DELETE CASCADE). RISCO: goleiro_pago sem auth exige workaround (ver topo da migration).';
comment on column public.profiles.group_id is 'FK para groups. SET NULL se o grupo for removido (usuario fica sem racha).';
comment on column public.profiles.full_name is 'Nome completo (PT-BR). Obrigatorio.';
comment on column public.profiles.phone_whatsapp is 'Telefone WhatsApp formato E.164 (opcional).';
comment on column public.profiles.user_type is 'Papel do usuario (enum user_type). Default avulso.';
comment on column public.profiles.is_admin is 'Flag de administrador (multi-admin suportado). Default false.';
comment on column public.profiles.avatar_url is 'URL do avatar (Storage Supabase).';
comment on column public.profiles.created_at is 'Timestamp UTC de criacao.';
comment on column public.profiles.updated_at is 'Timestamp UTC da ultima atualizacao (trigger T1.5).';

create index if not exists profiles_group_id_idx on public.profiles(group_id);
create index if not exists profiles_user_type_idx on public.profiles(user_type);

-- ---------------------------------------------------------------------
-- 4. MATCHES (partidas do racha - sempre atreladas a um grupo)
-- ---------------------------------------------------------------------

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  date_time timestamptz not null,
  day_of_week integer not null default 4,
  team_scores jsonb not null default '{}'::jsonb,
  goalkeeper_expense numeric(10,2) not null default 40.00,
  status match_status not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint matches_goalkeeper_expense_check
    check (goalkeeper_expense >= 0),
  constraint matches_day_of_week_check
    check (day_of_week between 0 and 6)
);

comment on table public.matches is 'Partida agendada/ativa/finalizada/cancelada. Pertence sempre a um grupo.';
comment on column public.matches.id is 'PK uuid (gen_random_uuid).';
comment on column public.matches.group_id is 'FK para groups (NOT NULL - denormalizado para RLS). CASCADE no delete do grupo.';
comment on column public.matches.date_time is 'Data/hora UTC do jogo (Quinta 19:00 BRT => 22:00 UTC).';
comment on column public.matches.day_of_week is 'Dia da semana (snapshot do groups.day_of_week): 0=Domingo ... 4=Quinta ... 6=Sabado. Default 4.';
comment on column public.matches.team_scores is 'Placar final por time_group: {"1": 8, "2": 6}. JSONB.';
comment on column public.matches.goalkeeper_expense is 'Snapshot do custo de goleiros na epoca da partida (R$). Default 40.00.';
comment on column public.matches.status is 'Estado da partida (enum match_status). Quando -> active, congela participantes.';
comment on column public.matches.created_at is 'Timestamp UTC de criacao.';
comment on column public.matches.updated_at is 'Timestamp UTC da ultima atualizacao (trigger T1.5).';

create index if not exists matches_group_id_date_time_idx
  on public.matches(group_id, date_time desc);
create index if not exists matches_status_idx on public.matches(status);

-- ---------------------------------------------------------------------
-- 5. MATCH_PRESENCES (RSVP leve - presenca confirmada/fila/recusada)
-- ---------------------------------------------------------------------

create table if not exists public.match_presences (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status rsvp_status not null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint match_presences_match_id_user_id_key
    unique (match_id, user_id)
);

comment on table public.match_presences is 'RSVP por partida. 1 presenca por usuario por partida (unique).';
comment on column public.match_presences.id is 'PK uuid (gen_random_uuid).';
comment on column public.match_presences.match_id is 'FK para matches. CASCADE no delete da partida.';
comment on column public.match_presences.user_id is 'FK para profiles. CASCADE no delete do perfil.';
comment on column public.match_presences.status is 'Status do RSVP (enum rsvp_status).';
comment on column public.match_presences.confirmed_at is 'Quando o usuario confirmou presenca. NULL se recusou/fila.';
comment on column public.match_presences.created_at is 'Timestamp UTC de criacao.';
comment on column public.match_presences.updated_at is 'Timestamp UTC da ultima atualizacao (trigger T1.5).';

create index if not exists match_presences_match_id_status_idx
  on public.match_presences(match_id, status);
create index if not exists match_presences_user_id_idx
  on public.match_presences(user_id);

-- ---------------------------------------------------------------------
-- 6. MATCH_PARTICIPANTS (estatisticas congeladas em status=active)
-- ---------------------------------------------------------------------

create table if not exists public.match_participants (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  team_group integer not null,
  is_goalkeeper boolean not null default false,
  goals_scored integer not null default 0,
  goals_assisted integer not null default 0,
  own_goals integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint match_participants_match_id_player_id_key
    unique (match_id, player_id),
  constraint match_participants_team_group_check
    check (team_group >= 1),
  constraint match_participants_goals_scored_check
    check (goals_scored >= 0),
  constraint match_participants_goals_assisted_check
    check (goals_assisted >= 0),
  constraint match_participants_own_goals_check
    check (own_goals >= 0)
);

comment on table public.match_participants is 'Estatisticas dos jogadores que efetivamente jogaram. Populada quando match->active (congelamento da lista confirmada).';
comment on column public.match_participants.id is 'PK uuid (gen_random_uuid).';
comment on column public.match_participants.match_id is 'FK para matches. CASCADE no delete da partida.';
comment on column public.match_participants.player_id is 'FK para profiles. CASCADE no delete do perfil.';
comment on column public.match_participants.team_group is 'Numero do time (1, 2, ...). Sorteio aleatorio MVP.';
comment on column public.match_participants.is_goalkeeper is 'TRUE para os 2 goleiros pagos alocados ao time.';
comment on column public.match_participants.goals_scored is 'Gols marcados pelo jogador na partida.';
comment on column public.match_participants.goals_assisted is 'Assistencias dadas na partida.';
comment on column public.match_participants.own_goals is 'Gols contra na partida.';
comment on column public.match_participants.created_at is 'Timestamp UTC de criacao (costuma bater com match->active).';
comment on column public.match_participants.updated_at is 'Timestamp UTC da ultima atualizacao (trigger T1.5).';

create index if not exists match_participants_match_id_idx
  on public.match_participants(match_id);
create index if not exists match_participants_player_id_idx
  on public.match_participants(player_id);
create index if not exists match_participants_team_group_idx
  on public.match_participants(match_id, team_group);

-- ---------------------------------------------------------------------
-- 7. PAYMENTS (unificado: mensalidade dia 5 + taxa avulsa por partida)
-- ---------------------------------------------------------------------

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  match_id uuid references public.matches(id) on delete set null,
  group_id uuid not null references public.groups(id) on delete cascade,
  type payment_type not null,
  title text not null,
  amount numeric(10,2) not null,
  status payment_status not null default 'pending',
  marked_paid_at timestamptz,
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_amount_check
    check (amount >= 0)
);

comment on table public.payments is 'Cobrancas: mensalidade (dia 5, sem match_id) ou avulsa (por partida). Dupla confirmacao: jogador marca -> admin aprova.';
comment on column public.payments.id is 'PK uuid (gen_random_uuid).';
comment on column public.payments.user_id is 'FK para profiles. CASCADE no delete do perfil.';
comment on column public.payments.match_id is 'FK opcional para matches. SET NULL se partida apagada. So preenchido em type=casual.';
comment on column public.payments.group_id is 'FK NOT NULL para groups (denormalizado para RLS). Herda do match (casual) ou do user (monthly).';
comment on column public.payments.type is 'Tipo de cobranca (enum payment_type).';
comment on column public.payments.title is 'Descricao legivel (Ex: Mensalidade Julho/2026).';
comment on column public.payments.amount is 'Valor da cobranca (R$). Nao negativo.';
comment on column public.payments.status is 'Estado do pagamento (enum payment_status). paid_at snapshot final.';
comment on column public.payments.marked_paid_at is 'Quando o JOGADOR marcou como pago (1a confirmacao).';
comment on column public.payments.approved_at is 'Quando o ADMIN aprovou (2a confirmacao).';
comment on column public.payments.paid_at is 'Snapshot final efetivo (snapshot apos approved_at, modelado pela trigger de T1.5).';
comment on column public.payments.created_at is 'Timestamp UTC de criacao.';
comment on column public.payments.updated_at is 'Timestamp UTC da ultima atualizacao (trigger T1.5).';

-- Partial index: otimiza dashboard de adimplencia (questiona so pendentes)
create index if not exists payments_pending_idx
  on public.payments(user_id)
  where status = 'pending';

create index if not exists payments_user_id_status_idx
  on public.payments(user_id, status);
create index if not exists payments_group_id_status_idx
  on public.payments(group_id, status);

-- ---------------------------------------------------------------------
-- 8. EXPENSES (caixa do racha - saidas: goleiros, campo, outras)
-- ---------------------------------------------------------------------

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  match_id uuid references public.matches(id) on delete set null,
  type expense_type not null,
  description text,
  amount numeric(10,2) not null,
  paid_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expenses_amount_check
    check (amount >= 0)
);

comment on table public.expenses is 'Saidas do caixa do racha. Transparencia: legivel por todos do grupo (mutavel so por admin).';
comment on column public.expenses.id is 'PK uuid (gen_random_uuid).';
comment on column public.expenses.group_id is 'FK NOT NULL para groups (denormalizado para RLS). CASCADE no delete do grupo.';
comment on column public.expenses.match_id is 'FK opcional para matches. SET NULL se partida apagada.';
comment on column public.expenses.type is 'Tipo da saida (enum expense_type): goalkeeper, field, other.';
comment on column public.expenses.description is 'Descricao livre (Ex: Goleiros partida 24/07).';
comment on column public.expenses.amount is 'Valor da saida (R$). Default goleiros 40.00 total.';
comment on column public.expenses.paid_at is 'Quando o admin registrou saída / transferencia realizada.';
comment on column public.expenses.confirmed_at is 'Snapshot final apos confirmar a transferencia (toggle do admin).';
comment on column public.expenses.created_at is 'Timestamp UTC de criacao.';
comment on column public.expenses.updated_at is 'Timestamp UTC da ultima atualizacao (trigger T1.5).';

create index if not exists expenses_group_id_paid_at_idx
  on public.expenses(group_id, paid_at);
create index if not exists expenses_match_id_idx
  on public.expenses(match_id);

-- ---------------------------------------------------------------------
-- 9. DEVICE_TOKENS (push tokens Expo: 1:N com PROFILES)
-- ---------------------------------------------------------------------

create table if not exists public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expo_push_token text not null,
  created_at timestamptz not null default now(),
  constraint device_tokens_expo_push_token_key
    unique (expo_push_token)
);

comment on table public.device_tokens is 'Tokens Expo Push por dispositivo. Relacao 1:N com profiles (multiplos dispositivos por usuario).';
comment on column public.device_tokens.id is 'PK uuid (gen_random_uuid).';
comment on column public.device_tokens.user_id is 'FK para profiles. CASCADE no delete do perfil.';
comment on column public.device_tokens.expo_push_token is 'Token Expo Notifications (unico globalmente).';
comment on column public.device_tokens.created_at is 'Timestamp UTC de criacao.';

create index if not exists device_tokens_user_id_idx
  on public.device_tokens(user_id);

-- =====================================================================
-- FIM da migration T1.3a
-- Resumo:
--   Enums:     6 (user_type, match_status, rsvp_status, payment_type,
--                 payment_status, expense_type)
--   Tabelas:   8 (groups, profiles, matches, match_presences,
--                 match_participants, payments, expenses, device_tokens)
--   Indexes:   15 (incluindo partial index payments_pending_idx)
--   Extensões: pg_cron (schema cron), pg_net, vault (nativo Supabase)
--
-- RISCOS DOCUMENTADOS (revisar na Wave 1 / handoff T1.3b):
--   R1. profiles.id FK auth.users(id) ON DELETE CASCADE e padrao Supabase,
--       mas REJEITA goleiro_pago sem auth.users. Ver workaround no topo
--       da secao PROFILES. Seed T1.3b nao podera criar goleiro_pago com
--       UUID arbitrario nesta FK - decisao queda com planejamento.
--   R2. Sem triggers updated_at (T1.5) e sem updated_at real por enquanto;
--       as colunas existem mas nao sao auto-atualizadas ate T1.5.
-- =====================================================================
