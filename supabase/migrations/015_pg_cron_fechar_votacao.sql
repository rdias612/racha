-- 015_pg_cron_fechar_votacao.sql
-- Agenda via pg_cron um job que roda a cada 1 minuto para fechar partidas
-- expiradas: status published -> closed quando voting_closes_at < now().
--
-- IMPORTANTE:
--   - pg_cron roda no banco de dados do Supabase (nao na aplicacao). A extensao
--     precisa estar habilitada no painel do Supabase (Database > Extensions).
--   - O BLOQUEIO EFETIVO de votos fora do prazo JA e garantido pela RPC
--     `registrar_votos` (migration 014), que valida status='published' E
--     voting_closes_at > now() ANTES de gravar - independente deste cron.
--     Este job apenas SINCRONIZA o status para 'closed' para a UI mostrar
--     "Encerrada" e revelar notas/craque na tela de detalhe.
--   - Rodar a cada 1 minuto (e nao a cada hora) reduz a janela em que a UI
--     mostra uma partida como "publicada" apos o prazo - defasagem maxima ~60s.
--
-- Idempotente: o SELECT no cron.schedule levanta erro se o job ja existe com
-- o mesmo nome. Se precisar re-aplicar, faca cron.unschedule('fechar-votacao-1min')
-- antes. Em migrations novas do Supabase isso costuma ser aceitavel rodar uma
-- unica vez.

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'fechar-votacao-1min',
  '* * * * *',
  $$UPDATE partidas SET status = 'closed' WHERE status = 'published' AND voting_closes_at < now();$$
);
