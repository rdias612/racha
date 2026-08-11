-- 053_view_dividas_resumo.sql
-- View de totais por jogador: total devido (soma das dívidas em aberto) + qtd.
-- Fonte de verdade para a lista da tela Administrador (substitui a agregação em TS).
-- Inclui todos os jogadores (LEFT JOIN); quem nada deve fica com total_devido = 0,
-- e a UI filtra total_devido > 0.

CREATE OR REPLACE VIEW dividas_resumo AS
SELECT
  j.id            AS jogador_id,
  j.nome          AS nome,
  j.username      AS username,
  j.is_mensalista AS is_mensalista,
  COALESCE(SUM(d.valor) FILTER (WHERE d.paga = false), 0)::numeric AS total_devido,
  COUNT(d.id)     FILTER (WHERE d.paga = false)::bigint          AS qtd_dividas
FROM jogadores j
LEFT JOIN dividas d ON d.jogador_id = j.id
GROUP BY j.id, j.nome, j.username, j.is_mensalista;

GRANT SELECT ON dividas_resumo TO anon, authenticated;
