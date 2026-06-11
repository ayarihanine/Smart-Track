-- ============================================================
-- FIX: sensor_events + production_history RLS Policies
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Enable RLS on sensor_events
ALTER TABLE sensor_events ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies (including the blocking "System insert events")
DROP POLICY IF EXISTS "System insert events" ON sensor_events;
DROP POLICY IF EXISTS "anon_select_sensor_events" ON sensor_events;
DROP POLICY IF EXISTS "anon_insert_sensor_events" ON sensor_events;
DROP POLICY IF EXISTS "sensor_events_insert" ON sensor_events;
DROP POLICY IF EXISTS "sensor_events_select" ON sensor_events;
DROP POLICY IF EXISTS "sensor_events_update" ON sensor_events;

-- 3. Create new permissive policies for SELECT
CREATE POLICY "sensor_events_select"
  ON sensor_events FOR SELECT
  TO anon, authenticated
  USING (true);

-- 4. Create new permissive policies for INSERT
CREATE POLICY "sensor_events_insert"
  ON sensor_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- 5. Create UPDATE policy (for future modifications)
CREATE POLICY "sensor_events_update"
  ON sensor_events FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 6. Create DELETE policy
CREATE POLICY "sensor_events_delete"
  ON sensor_events FOR DELETE
  TO anon, authenticated
  USING (true);

-- ============================================================
-- production_history RLS Policies (triggered by sensor_events inserts)
-- ============================================================

-- 7. Enable RLS on production_history
ALTER TABLE production_history ENABLE ROW LEVEL SECURITY;

-- 8. Drop ALL existing policies on production_history
DROP POLICY IF EXISTS "System insert events" ON production_history;
DROP POLICY IF EXISTS "anon_select_production_history" ON production_history;
DROP POLICY IF EXISTS "anon_insert_production_history" ON production_history;
DROP POLICY IF EXISTS "production_history_select" ON production_history;
DROP POLICY IF EXISTS "production_history_insert" ON production_history;
DROP POLICY IF EXISTS "production_history_update" ON production_history;
DROP POLICY IF EXISTS "production_history_delete" ON production_history;

-- 9. Create new permissive policies for SELECT
CREATE POLICY "production_history_select"
  ON production_history FOR SELECT
  TO anon, authenticated
  USING (true);

-- 10. Create new permissive policies for INSERT
CREATE POLICY "production_history_insert"
  ON production_history FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- 11. Create UPDATE policy (for future modifications)
CREATE POLICY "production_history_update"
  ON production_history FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 12. Create DELETE policy
CREATE POLICY "production_history_delete"
  ON production_history FOR DELETE
  TO anon, authenticated
  USING (true);

-- ============================================================
-- 13. Verify policies are applied
-- ============================================================
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE tablename IN ('sensor_events', 'production_history')
ORDER BY tablename, cmd;

