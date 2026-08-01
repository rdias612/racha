-- =====================================================================
-- Migration: 00000000000018_sequential_ids.sql
-- Converte groups.id e profiles.id para bigint alimentado por sequences.
-- As colunas dependentes sao convertidas para manter as FKs existentes.
-- =====================================================================

-- O login atual e local e nao fornece auth.uid() ao PostgREST. As policies
-- antigas nao podem comparar bigint com uuid e, por decisao do MVP, sao
-- removidas ate existir uma sessao JWT com identidade verificavel.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  end loop;
end;
$$;

alter table public.groups disable row level security;
alter table public.profiles disable row level security;
alter table public.matches disable row level security;
alter table public.match_presences disable row level security;
alter table public.match_participants disable row level security;
alter table public.payments disable row level security;
alter table public.expenses disable row level security;
alter table public.device_tokens disable row level security;
alter table public.push_log disable row level security;

create sequence if not exists public.groups_id_seq as bigint;
create sequence if not exists public.profiles_id_seq as bigint;

create temporary table groups_id_map (
  old_id uuid primary key,
  new_id bigint not null unique
) on commit drop;

create temporary table profiles_id_map (
  old_id uuid primary key,
  new_id bigint not null unique
) on commit drop;

insert into groups_id_map (old_id, new_id)
select id, row_number() over (order by id)
from public.groups;

insert into profiles_id_map (old_id, new_id)
select id, row_number() over (order by id)
from public.profiles;

alter table public.groups add column id_new bigint;
update public.groups groups
set id_new = groups_id_map.new_id
from groups_id_map
where groups.id = groups_id_map.old_id;
alter table public.groups alter column id_new set not null;

alter table public.profiles add column id_new bigint;
update public.profiles profiles
set id_new = profiles_id_map.new_id
from profiles_id_map
where profiles.id = profiles_id_map.old_id;
alter table public.profiles alter column id_new set not null;

alter table public.profiles add column group_id_new bigint;
update public.profiles profiles
set group_id_new = groups_id_map.new_id
from groups_id_map
where profiles.group_id = groups_id_map.old_id;

alter table public.matches add column group_id_new bigint;
update public.matches matches
set group_id_new = groups_id_map.new_id
from groups_id_map
where matches.group_id = groups_id_map.old_id;

alter table public.match_presences add column user_id_new bigint;
update public.match_presences presences
set user_id_new = profiles_id_map.new_id
from profiles_id_map
where presences.user_id = profiles_id_map.old_id;

alter table public.match_participants add column player_id_new bigint;
update public.match_participants participants
set player_id_new = profiles_id_map.new_id
from profiles_id_map
where participants.player_id = profiles_id_map.old_id;

alter table public.payments add column user_id_new bigint;
alter table public.payments add column group_id_new bigint;
update public.payments payments
set user_id_new = profiles_id_map.new_id
from profiles_id_map
where payments.user_id = profiles_id_map.old_id;
update public.payments payments
set group_id_new = groups_id_map.new_id
from groups_id_map
where payments.group_id = groups_id_map.old_id;

alter table public.expenses add column group_id_new bigint;
update public.expenses expenses
set group_id_new = groups_id_map.new_id
from groups_id_map
where expenses.group_id = groups_id_map.old_id;

alter table public.device_tokens add column user_id_new bigint;
update public.device_tokens tokens
set user_id_new = profiles_id_map.new_id
from profiles_id_map
where tokens.user_id = profiles_id_map.old_id;

alter table public.push_log add column user_id_new bigint;
update public.push_log push_log
set user_id_new = profiles_id_map.new_id
from profiles_id_map
where push_log.user_id = profiles_id_map.old_id;

alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles drop constraint if exists profiles_group_id_fkey;
alter table public.matches drop constraint if exists matches_group_id_fkey;
alter table public.match_presences drop constraint if exists match_presences_match_id_user_id_key;
alter table public.match_presences drop constraint if exists match_presences_user_id_fkey;
alter table public.match_participants drop constraint if exists match_participants_match_id_player_id_key;
alter table public.match_participants drop constraint if exists match_participants_player_id_fkey;
alter table public.payments drop constraint if exists payments_user_id_fkey;
alter table public.payments drop constraint if exists payments_group_id_fkey;
alter table public.expenses drop constraint if exists expenses_group_id_fkey;
alter table public.device_tokens drop constraint if exists device_tokens_user_id_fkey;
alter table public.push_log drop constraint if exists push_log_user_id_fkey;

alter table public.groups drop constraint if exists groups_pkey;
alter table public.profiles drop constraint if exists profiles_pkey;

alter table public.groups drop column id;
alter table public.groups rename column id_new to id;
alter table public.groups alter column id set default nextval('public.groups_id_seq');
alter table public.groups add constraint groups_pkey primary key (id);

alter table public.profiles drop column id;
alter table public.profiles rename column id_new to id;
alter table public.profiles alter column id set default nextval('public.profiles_id_seq');
alter table public.profiles add constraint profiles_pkey primary key (id);

alter table public.profiles drop column group_id;
alter table public.profiles rename column group_id_new to group_id;
alter table public.matches drop column group_id;
alter table public.matches rename column group_id_new to group_id;
alter table public.match_presences drop column user_id;
alter table public.match_presences rename column user_id_new to user_id;
alter table public.match_participants drop column player_id;
alter table public.match_participants rename column player_id_new to player_id;
alter table public.payments drop column user_id;
alter table public.payments rename column user_id_new to user_id;
alter table public.payments drop column group_id;
alter table public.payments rename column group_id_new to group_id;
alter table public.expenses drop column group_id;
alter table public.expenses rename column group_id_new to group_id;
alter table public.device_tokens drop column user_id;
alter table public.device_tokens rename column user_id_new to user_id;
alter table public.push_log drop column user_id;
alter table public.push_log rename column user_id_new to user_id;

alter table public.profiles
  add constraint profiles_group_id_fkey
  foreign key (group_id) references public.groups(id) on delete set null;
alter table public.matches
  add constraint matches_group_id_fkey
  foreign key (group_id) references public.groups(id) on delete cascade;
alter table public.match_presences
  add constraint match_presences_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;
alter table public.match_participants
  add constraint match_participants_player_id_fkey
  foreign key (player_id) references public.profiles(id) on delete cascade;
alter table public.payments
  add constraint payments_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;
alter table public.payments
  add constraint payments_group_id_fkey
  foreign key (group_id) references public.groups(id) on delete cascade;
alter table public.expenses
  add constraint expenses_group_id_fkey
  foreign key (group_id) references public.groups(id) on delete cascade;
alter table public.device_tokens
  add constraint device_tokens_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;
alter table public.push_log
  add constraint push_log_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.match_presences
  add constraint match_presences_match_id_user_id_key unique (match_id, user_id);
alter table public.match_participants
  add constraint match_participants_match_id_player_id_key unique (match_id, player_id);

create index if not exists profiles_group_id_idx on public.profiles(group_id);
create index if not exists matches_group_id_date_time_idx on public.matches(group_id, date_time desc);
create index if not exists match_presences_user_id_idx on public.match_presences(user_id);
create index if not exists match_participants_player_id_idx on public.match_participants(player_id);
create index if not exists payments_user_id_status_idx on public.payments(user_id, status);
create index if not exists payments_group_id_status_idx on public.payments(group_id, status);
create index if not exists expenses_group_id_paid_at_idx on public.expenses(group_id, paid_at);
create index if not exists device_tokens_user_id_idx on public.device_tokens(user_id);

select setval(
  'public.groups_id_seq',
  coalesce((select max(id) from public.groups), 1),
  exists (select 1 from public.groups)
);
select setval(
  'public.profiles_id_seq',
  coalesce((select max(id) from public.profiles), 1),
  exists (select 1 from public.profiles)
);

comment on column public.groups.id is 'PK bigint alimentada por public.groups_id_seq.';
comment on column public.profiles.id is 'PK bigint alimentada por public.profiles_id_seq. Sem vinculo com auth.users.';