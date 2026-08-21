-- 066_rpc_excluir_partida.sql
--
-- Exclui uma partida do histórico, independente do status (draft, live,
-- published, closed). Uso: tela de Jogos (botão de lixeira visível só para
-- admins), para apagar partidas criadas por engano ou de teste.
--
-- O que é removido:
--   * dividas com partida_id = X (pagas E não pagas — decisão do app: excluir
--     a partida é remover todo o rastro dela, incluindo o financeiro);
--     o delete vem ANTES do da partida porque a FK é ON DELETE SET NULL
--     (migration 051) e deixaria dívidas órfãs.
--   * a própria partida; CASCADE já remove partidas_participantes, votes,
--     partida_eventos e push_reminder_deliveries (migrations 005/006/047/036).
--   * Views derivadas (partida_placar, partida_notas, view_ranking,
--     stats_jogador, resumo_ano) recalculam sozinhas.
--
-- Gate de admin server-side (padrão migration 057): valida is_admin em
-- jogadores. Superadmins (seed 022/024) têm is_admin = true no banco.
--
-- Segurança relaxada (Regra 6): sem RLS, gate de admin apenas aqui — coerente
-- com admin_definir_confirmacao.

CREATE OR REPLACE FUNCTION excluir_partida(
  p_partida_id bigint,
  p_admin_id   bigint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admin gate (padrão migration 057).
  IF NOT EXISTS (SELECT 1 FROM jogadores WHERE id = p_admin_id AND is_admin) THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM partidas WHERE id = p_partida_id) THEN
    RETURN false;
  END IF;

  DELETE FROM dividas WHERE partida_id = p_partida_id;
  DELETE FROM partidas WHERE id = p_partida_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION excluir_partida(bigint, bigint) TO anon, authenticated;
