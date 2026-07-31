-- =====================================================================
-- Migration: 00000000000009_fifo.sql
-- Task: T3.1 - Promocao FIFO automatica e manual (avulso -> confirmed).
-- Stack: PostgreSQL 15 / Supabase
--
-- Componentes:
--   1. Function public.promote_next_casual(p_match_id uuid)
--      SECURITY DEFINER + transactional: localiza o avulso mais antigo
--      em waiting_list (ORDER BY created_at ASC) e o promove para
--      'confirmed'. Usa FOR UPDATE SKIP LOCKED p/ concorrencia.
--      Retorna o user_id promovido, ou NULL se fila vazia.
--   2. Helper public.reject_pending_presence(p_presence_id uuid)
--      Admin marca pendente (pending_approval) como declined e dispara
--      promocao FIFO caso existam avulsos aguardando.
--
-- Dependencias: T1.3a (schema + индекс match_presences_match_id_status_idx),
--               T1.7 (RLS is_admin + policies).
-- Idempotente: promocao so ocorre se existir waiting_list; re-run seguro.
--
-- RLS bypass: SECURITY DEFINER executa como owner -> admin via auth.uid()
-- RW policies ja permitem mutacao; SECURITY DEFINEROnly necessario se a
-- promocao mutar linha de outro user_id (caso comum: admin promove avulso).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Conforto: indice composto (match_id, status, created_at) para FIFO
-- ---------------------------------------------------------------------
-- O indice existente (match_id, status) atende filtros, mas o ORDER BY
-- created_at ASC dentro do subset exige sort. Acrescentamos indice que
-- cobre a janela de promocao (offset/limit eficientemente sem scan total).
-- `if not exists` torna re-executavel.
create index if not exists match_presences_match_id_status_created_at_idx
  on public.match_presences(match_id, status, created_at asc);

comment on index public.match_presences_match_id_status_created_at_idx is
  'T3.1: indice de cobertura FIFO - promove_next_casual ORDER BY created_at ASC sem sort.';

-- ---------------------------------------------------------------------
-- 1. Function: promote_next_casual (SECURITY DEFINER)
-- ---------------------------------------------------------------------
-- Logica (executada dentro de BEGIN implicito do PL/pgSQL -> atomico):
--   * SELECT id, user_id FROM match_presences
--       WHERE match_id = p_match_id
--         AND status = 'waiting_list'
--       ORDER BY created_at ASC
--       LIMIT 1
--       FOR UPDATE SKIP LOCKED   -- ignora linhas lockadas por outra tx
--   * Se vazio: retorna null (sem promocao, sem erro).
--   * Senao: UPDATE status='confirmed', confirmed_at=now(), updated_at=now()
--   * RETURN user_id promovido.
--
-- gate: apenas admin (is_admin()) pode chamar. Erro 42501 se nao admin.
--       A function executa como SECURITY DEFINER, mas mantemos o gate para
--       clareza de contrato (defense in depth; RLS da policy update ja
--       permite admin mutar linhas de qualquer user_id).
drop function if exists public.promote_next_casual(uuid);

create or replace function public.promote_next_casual(p_match_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_promoted_id uuid;
  v_user_id     uuid;
begin
  -- Gate de permissao (defense in depth).
  if not public.is_admin() then
    raise exception 'Apenas administradores podem promover avulsos.'
      using errcode = '42501';
  end if;

  -- Selecao atômica do proximo avulso (lock de linha, skip locked).
  select mp.id, mp.user_id
    into v_promoted_id, v_user_id
  from public.match_presences mp
  where mp.match_id = p_match_id
    and mp.status = 'waiting_list'
  order by mp.created_at asc
  limit 1
  for update skip locked;

  -- Sem avulso na fila -> vaga aberta, sem erro (AC: sem avulso OK).
  if v_promoted_id is null then
    return null;
  end if;

  -- Promove para confirmed (slot garantido agora).
  update public.match_presences
    set status = 'confirmed',
        confirmed_at = now(),
        updated_at = now()
  where id = v_promoted_id;

  return v_user_id;
end;
$$;

comment on function public.promote_next_casual(uuid) is
  'T3.1: Promove o avulso mais antigo em waiting_list para confirmed (FIFO). SECURITY DEFINER. Retorna user_id ou NULL se vazia.';

-- ---------------------------------------------------------------------
-- 2. Function: reject_pending_presence (SECURITY DEFINER)
-- ---------------------------------------------------------------------
-- Logica:
--   * Valida gate admin.
--   * UPDATE da presence p_presence_id -> status='declined'.
--   * Aciona promote_next_casual(match_id da presence) para preencher vaga
--     com o proximo avulso em waiting_list (cenario recursivo implicito:
--     se fila vazia, promote retorna null sem erro).
--
-- Recursividade explicita pelo client admin:
--   A UI pode chamar promote_next_casual N vezes apos N rejeicoes; a
--   fila desce naturalmente ate esgotar. Aqui encapsulamos 1 passo.
drop function if exists public.reject_pending_presence(uuid);

create or replace function public.reject_pending_presence(p_presence_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match_id uuid;
  v_promoted uuid;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem rejeitar pendentes.'
      using errcode = '42501';
  end if;

  select match_id into v_match_id
  from public.match_presences
  where id = p_presence_id
    and status = 'pending_approval';

  if v_match_id is null then
    raise exception 'Presence nao encontrada.'
      using errcode = 'P0002';
  end if;

  update public.match_presences
    set status = 'declined',
        confirmed_at = null,
        updated_at = now()
  where id = p_presence_id;

  -- Tenta promover o proximo da fila (null se vazia - nao erro).
  v_promoted := public.promote_next_casual(v_match_id);

  return v_promoted;
end;
$$;

grant execute on function public.promote_next_casual(uuid) to authenticated;
grant execute on function public.reject_pending_presence(uuid) to authenticated;

comment on function public.reject_pending_presence(uuid) is
  'T3.1: Admin rejeita presence pendente (declined) e dispara promocao FIFO (se houver). Retorna user_id promovido ou NULL.';

-- =====================================================================
-- FIM da migration T3.1
-- Resumo:
--   Indice: 1 (match_id, status, created_at ASC).
--   Functions: 2 SECURITY DEFINER (promote_next_casual, reject_pending_presence).
--   Gates: is_admin() (defense in depth; RLS ja protege).
-- =====================================================================
