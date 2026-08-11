-- 052_seed_divida_tadeu.sql
-- Seed inicial do controle financeiro: tadeu (mensalista) deve 1 mensalidade
-- de R$ 90,00 (referência ago/2026).
--
-- Idempotente: ON CONFLICT DO NOTHING + o índice único uq_dividas_mensalidade_mes
-- garantem que re-aplicar a migration não duplica a dívida.

INSERT INTO dividas (jogador_id, tipo, valor, referencia, data_divida, descricao)
SELECT id, 'mensalidade', 90.00, '2026-08', current_date, 'Mensalidade Agosto/2026'
  FROM jogadores
 WHERE username = 'tadeu'
ON CONFLICT DO NOTHING;
