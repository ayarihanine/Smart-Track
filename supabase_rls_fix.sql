-- ============================================================
-- RLS FIX: SmartTrack Production Tables
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. production_batches: allow anon to read and write
ALTER TABLE production_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_production_batches" ON production_batches;
DROP POLICY IF EXISTS "anon_insert_production_batches" ON production_batches;
DROP POLICY IF EXISTS "anon_update_production_batches" ON production_batches;
DROP POLICY IF EXISTS "anon_delete_production_batches" ON production_batches;

CREATE POLICY "anon_select_production_batches"
  ON production_batches FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "anon_insert_production_batches"
  ON production_batches FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "anon_update_production_batches"
  ON production_batches FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "anon_delete_production_batches"
  ON production_batches FOR DELETE
  TO anon, authenticated
  USING (true);

-- 2. electronic_cards: allow anon to read and write
ALTER TABLE electronic_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_electronic_cards" ON electronic_cards;
DROP POLICY IF EXISTS "anon_insert_electronic_cards" ON electronic_cards;
DROP POLICY IF EXISTS "anon_update_electronic_cards" ON electronic_cards;
DROP POLICY IF EXISTS "anon_delete_electronic_cards" ON electronic_cards;

CREATE POLICY "anon_select_electronic_cards"
  ON electronic_cards FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "anon_insert_electronic_cards"
  ON electronic_cards FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "anon_update_electronic_cards"
  ON electronic_cards FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "anon_delete_electronic_cards"
  ON electronic_cards FOR DELETE
  TO anon, authenticated
  USING (true);

-- 3. configuration: allow anon to read and write
ALTER TABLE configuration ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_configuration" ON configuration;
DROP POLICY IF EXISTS "anon_insert_configuration" ON configuration;
DROP POLICY IF EXISTS "anon_update_configuration" ON configuration;

CREATE POLICY "anon_select_configuration"
  ON configuration FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "anon_insert_configuration"
  ON configuration FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "anon_update_configuration"
  ON configuration FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 4. etat_capteur: allow anon to read and insert (sensors write data)
ALTER TABLE etat_capteur ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_etat_capteur" ON etat_capteur;
DROP POLICY IF EXISTS "anon_insert_etat_capteur" ON etat_capteur;

CREATE POLICY "anon_select_etat_capteur"
  ON etat_capteur FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "anon_insert_etat_capteur"
  ON etat_capteur FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- 5. pertes_table: allow anon to read and insert
ALTER TABLE pertes_table ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_pertes_table" ON pertes_table;
DROP POLICY IF EXISTS "anon_insert_pertes_table" ON pertes_table;
DROP POLICY IF EXISTS "anon_update_pertes_table" ON pertes_table;

CREATE POLICY "anon_select_pertes_table"
  ON pertes_table FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "anon_insert_pertes_table"
  ON pertes_table FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "anon_update_pertes_table"
  ON pertes_table FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 6. sensor_events: allow anon to read and insert (acquisition interface + simulator)
ALTER TABLE sensor_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_sensor_events" ON sensor_events;
DROP POLICY IF EXISTS "anon_insert_sensor_events" ON sensor_events;

CREATE POLICY "anon_select_sensor_events"
  ON sensor_events FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "anon_insert_sensor_events"
  ON sensor_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- ============================================================
-- OPTIONAL VERIFICATION: Check policies are applied
-- ============================================================
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE tablename IN (
  'production_batches',
  'electronic_cards',
  'configuration',
  'etat_capteur',
  'pertes_table',
  'sensor_events'
)
ORDER BY tablename, cmd;
