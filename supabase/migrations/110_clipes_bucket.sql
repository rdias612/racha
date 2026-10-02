-- 110_clipes_bucket.sql
-- Bucket `clipes` no Storage (P5: por migration, versionável; P4: leitura pública — RNF03).
-- Escrita: nenhuma policy de INSERT/UPDATE/DELETE é criada → nenhum role client escreve;
-- a Action usa service key (service_role bypassa RLS em storage.objects).

-- 1. Bucket (idempotente)
INSERT INTO storage.buckets (id, name, public)
VALUES ('clipes', 'clipes', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Leitura pública via API do Storage (a URL pública /object/public/ nem depende disto,
--    mas a policy cobre list/download pela API autenticada)
DROP POLICY IF EXISTS "Leitura publica dos clipes" ON storage.objects;
CREATE POLICY "Leitura publica dos clipes"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'clipes');
