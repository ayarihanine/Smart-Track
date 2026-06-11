-- ============================================================
-- FIX: production_history RLS Policy
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Enable RLS on production_history
ALTER TABLE production_history ENABLE ROW LEVEL SECURITY;

-- 2. Drop ALL existing policies (including conflicting/blocking ones)
DROP POLICY IF EXISTS "System insert events" ON production_history;
DROP POLICY IF EXISTS "anon_select_production_history" ON production_history;
DROP POLICY IF EXISTS "anon_insert_production_history" ON production_history;
DROP POLICY IF EXISTS "production_history_select" ON production_history;
DROP POLICY IF EXISTS "production_history_insert" ON production_history;
DROP POLICY IF EXISTS "production_history_update" ON production_history;

-- 3. Create new permissive policies for SELECT
CREATE POLICY "production_history_select"
  ON production_history FOR SELECT
  TO anon, authenticated
  USING (true);

-- 4. Create new permissive policies for INSERT
CREATE POLICY "production_history_insert"
  ON production_history FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- 5. Create UPDATE policy (for future modifications)
CREATE POLICY "production_history_update"
  ON production_history FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 6. Create DELETE policy
CREATE POLICY "production_history_delete"
  ON production_history FOR DELETE
  TO anon, authenticated
  USING (true);

-- 7. Verify policies are applied
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE tablename = 'production_history'
ORDER BY cmd;
