-- ============================================================
-- SmartTrack: Seed production_performance with today's data
-- Project: phcgnjbjvffzurcnbmnl.supabase.co
-- Run this in: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- STEP 1: Ensure RLS allows anon/authenticated to read & write
ALTER TABLE production_performance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "perf_select"  ON production_performance;
DROP POLICY IF EXISTS "perf_insert"  ON production_performance;
DROP POLICY IF EXISTS "perf_update"  ON production_performance;
DROP POLICY IF EXISTS "perf_delete"  ON production_performance;

CREATE POLICY "perf_select" ON production_performance
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "perf_insert" ON production_performance
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "perf_update" ON production_performance
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "perf_delete" ON production_performance
  FOR DELETE TO anon, authenticated USING (true);

-- Same for other tables blocked earlier
ALTER TABLE articles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuration ENABLE ROW LEVEL SECURITY;
ALTER TABLE electronic_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensor_data   ENABLE ROW LEVEL SECURITY;
ALTER TABLE losses        ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "articles_select"  ON articles;
DROP POLICY IF EXISTS "articles_insert"  ON articles;
CREATE POLICY "articles_select" ON articles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "articles_insert" ON articles FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "articles_update" ON articles FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_configuration" ON configuration;
DROP POLICY IF EXISTS "anon_insert_configuration" ON configuration;
CREATE POLICY "anon_select_configuration" ON configuration FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_configuration" ON configuration FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_configuration" ON configuration FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_electronic_cards" ON electronic_cards;
DROP POLICY IF EXISTS "anon_insert_electronic_cards" ON electronic_cards;
CREATE POLICY "anon_select_electronic_cards"  ON electronic_cards FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_electronic_cards"  ON electronic_cards FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_electronic_cards"  ON electronic_cards FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_electronic_cards"  ON electronic_cards FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "sensor_data_select" ON sensor_data;
DROP POLICY IF EXISTS "sensor_data_insert" ON sensor_data;
CREATE POLICY "sensor_data_select" ON sensor_data FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "sensor_data_insert" ON sensor_data FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "sensor_data_update" ON sensor_data FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "losses_select" ON losses;
DROP POLICY IF EXISTS "losses_insert" ON losses;
CREATE POLICY "losses_select" ON losses FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "losses_insert" ON losses FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "losses_update" ON losses FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- STEP 2: Check what columns production_performance actually has
-- (Run this first to verify column names)
-- ============================================================
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'production_performance'
ORDER BY ordinal_position;

-- ============================================================
-- STEP 3: Seed today's production performance data
-- Uses both column name variants — adjust based on STEP 2 output
-- ============================================================

-- If your table has OOE_percentage / OEE_percentage columns:
INSERT INTO production_performance
  (machine_name, target_count, actual_count, good_count, loss_count,
   "OOE_percentage", "OEE_percentage", date, timestamp)
VALUES
  ('NPM-DX-1', 100, 95, 92, 5,  95.0, 92.0, CURRENT_DATE, NOW()),
  ('THT-Wave',  80, 76, 74, 4,  95.0, 92.5, CURRENT_DATE, NOW() - INTERVAL '1 minute')
ON CONFLICT DO NOTHING;

-- ALTERNATIVE: If your table has trg_percentage / trs_percentage columns, use this instead:
-- INSERT INTO production_performance
--   (machine_name, target_count, actual_count, good_count, loss_count,
--    trg_percentage, trs_percentage, date, timestamp)
-- VALUES
--   ('NPM-DX-1', 100, 95, 92, 5, 95.0, 92.0, CURRENT_DATE, NOW()),
--   ('THT-Wave',  80, 76, 74, 4, 95.0, 92.5, CURRENT_DATE, NOW() - INTERVAL '1 minute')
-- ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 4: Seed sensor_data (for live sensor display)
-- ============================================================
INSERT INTO sensor_data
  (node_id, sensor_1_status, sensor_2_status, sensor_3_status,
   sensor_1_counter, sensor_2_counter, sensor_3_counter, timestamp)
VALUES
  ('PI5-NODE-01', true, true, true, 152, 144, 6, NOW())
ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 5: Verify row counts
-- ============================================================
SELECT 'production_performance' AS tbl, COUNT(*) FROM production_performance
UNION ALL SELECT 'sensor_data',          COUNT(*) FROM sensor_data
UNION ALL SELECT 'electronic_cards',     COUNT(*) FROM electronic_cards
UNION ALL SELECT 'losses',               COUNT(*) FROM losses;
