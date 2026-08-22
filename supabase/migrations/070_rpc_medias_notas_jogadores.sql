-- 070_rpc_medias_notas_jogadores.sql
--
-- RPC para obter a média geral aparada das notas de cada jogador
-- agregada no servidor, substituindo o download integral da tabela `votes` no cliente.
--
-- Regra:
--   - Se o jogador tiver 3 ou mais notas recebidas, descarta 1 menor e 1 maior:
--     (SUM(rating) - MIN(rating) - MAX(rating))::numeric / (COUNT(*) - 2)
--   - Se tiver 1 ou 2 notas, calcula a média simples AVG(rating).
--   - Retorna array/linhas com jogador_id e media_nota arredondada para 2 casas decimais.

CREATE OR REPLACE FUNCTION obter_medias_notas_jogadores()
RETURNS TABLE (
  jogador_id bigint,
  media_nota numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    v.target_id AS jogador_id,
    ROUND(
      CASE
        WHEN COUNT(*) >= 3 THEN (SUM(v.rating) - MIN(v.rating) - MAX(v.rating))::numeric / (COUNT(*) - 2)
        ELSE AVG(v.rating)::numeric
      END,
      2
    ) AS media_nota
  FROM votes v
  GROUP BY v.target_id;
$$;

GRANT EXECUTE ON FUNCTION obter_medias_notas_jogadores() TO anon, authenticated;
