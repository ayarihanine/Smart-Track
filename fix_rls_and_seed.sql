-- ============================================================
-- SmartTrack: Full RLS Fix + Seed Data
-- Project: phcgnjbjvffzurcnbmnl.supabase.co
-- Run this in: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── PART 1: FIX MISSING RLS POLICIES ──────────────────────

-- articles
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "articles_select" ON articles;
DROP POLICY IF EXISTS "articles_insert" ON articles;
DROP POLICY IF EXISTS "articles_update" ON articles;
DROP POLICY IF EXISTS "articles_delete" ON articles;
CREATE POLICY "articles_select" ON articles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "articles_insert" ON articles FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "articles_update" ON articles FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "articles_delete" ON articles FOR DELETE TO anon, authenticated USING (true);

-- losses
ALTER TABLE losses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "losses_select" ON losses;
DROP POLICY IF EXISTS "losses_insert" ON losses;
DROP POLICY IF EXISTS "losses_update" ON losses;
DROP POLICY IF EXISTS "losses_delete" ON losses;
CREATE POLICY "losses_select" ON losses FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "losses_insert" ON losses FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "losses_update" ON losses FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "losses_delete" ON losses FOR DELETE TO anon, authenticated USING (true);

-- production_performance
ALTER TABLE production_performance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "perf_select" ON production_performance;
DROP POLICY IF EXISTS "perf_insert" ON production_performance;
DROP POLICY IF EXISTS "perf_update" ON production_performance;
DROP POLICY IF EXISTS "perf_delete" ON production_performance;
CREATE POLICY "perf_select" ON production_performance FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "perf_insert" ON production_performance FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "perf_update" ON production_performance FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "perf_delete" ON production_performance FOR DELETE TO anon, authenticated USING (true);

-- sensor_data
ALTER TABLE sensor_data ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sensor_data_select" ON sensor_data;
DROP POLICY IF EXISTS "sensor_data_insert" ON sensor_data;
DROP POLICY IF EXISTS "sensor_data_update" ON sensor_data;
CREATE POLICY "sensor_data_select" ON sensor_data FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "sensor_data_insert" ON sensor_data FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "sensor_data_update" ON sensor_data FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- configuration
ALTER TABLE configuration ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_configuration" ON configuration;
DROP POLICY IF EXISTS "anon_insert_configuration" ON configuration;
DROP POLICY IF EXISTS "anon_update_configuration" ON configuration;
CREATE POLICY "anon_select_configuration" ON configuration FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_configuration" ON configuration FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_configuration" ON configuration FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- electronic_cards (ensure insert/update/delete exist)
ALTER TABLE electronic_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_electronic_cards" ON electronic_cards;
DROP POLICY IF EXISTS "anon_insert_electronic_cards" ON electronic_cards;
DROP POLICY IF EXISTS "anon_update_electronic_cards" ON electronic_cards;
DROP POLICY IF EXISTS "anon_delete_electronic_cards" ON electronic_cards;
CREATE POLICY "anon_select_electronic_cards" ON electronic_cards FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_electronic_cards" ON electronic_cards FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_electronic_cards" ON electronic_cards FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_electronic_cards" ON electronic_cards FOR DELETE TO anon, authenticated USING (true);

-- loss_root_causes
ALTER TABLE loss_root_causes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lrc_select" ON loss_root_causes;
DROP POLICY IF EXISTS "lrc_insert" ON loss_root_causes;
DROP POLICY IF EXISTS "lrc_update" ON loss_root_causes;
CREATE POLICY "lrc_select" ON loss_root_causes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "lrc_insert" ON loss_root_causes FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "lrc_update" ON loss_root_causes FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);


-- ── PART 2: SEED TEST DATA ────────────────────────────────
-- Idempotent: uses ON CONFLICT DO NOTHING

-- 1. Articles (for cost-of-loss calculation)
INSERT INTO articles (id, reference, designation, assembly_count, unit_price) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'IC-7805',      'Voltage Regulator 5V',     2,  1.50),
  ('c0000000-0000-0000-0000-000000000002', 'CAP-100nF',    'Ceramic Capacitor 100nF', 10,  0.20),
  ('c0000000-0000-0000-0000-000000000003', 'RES-1k',       'Resistor 1k Ohm',          8,  0.10),
  ('c0000000-0000-0000-0000-000000000004', 'CONN-2PIN',    '2-Pin Screw Terminal',     1,  0.80),
  ('c0000000-0000-0000-0000-000000000005', 'XFMR-12V',     '12V Transformer',          1,  4.50),
  ('c0000000-0000-0000-0000-000000000006', 'DIODE-BRIDGE', 'Bridge Rectifier',         4,  0.60)
ON CONFLICT (reference) DO UPDATE
  SET id = EXCLUDED.id, designation = EXCLUDED.designation,
      assembly_count = EXCLUDED.assembly_count, unit_price = EXCLUDED.unit_price;

-- 2. Machine configuration
INSERT INTO configuration (id, machine_name, expected_cards, cycle_time_seconds, loss_threshold, shift_start, shift_end) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'NPM-DX-1', 100, 45, 3, '08:00', '17:00')
ON CONFLICT (id) DO NOTHING;

-- 3. Electronic cards (today's production)
INSERT INTO electronic_cards (id, card_id, status, current_machine, current_machine_status, stage_entered_at, created_at, updated_at, product_id) VALUES
  -- 3 completed
  ('e0000000-0000-0000-0000-000000000001', 'CARD-2026-001', 'completed',   'NPM-DX-1',      'completed',   NOW()-INTERVAL '4 hours',   NOW()-INTERVAL '4 hours',   NOW()-INTERVAL '3 hours',   NULL),
  ('e0000000-0000-0000-0000-000000000002', 'CARD-2026-002', 'completed',   'NPM-DX-1',      'completed',   NOW()-INTERVAL '3.5 hours', NOW()-INTERVAL '3.5 hours', NOW()-INTERVAL '2.5 hours', NULL),
  ('e0000000-0000-0000-0000-000000000003', 'CARD-2026-003', 'completed',   'THT-Wave',      'completed',   NOW()-INTERVAL '3 hours',   NOW()-INTERVAL '3 hours',   NOW()-INTERVAL '2 hours',   NULL),
  -- 1 active (entered stage 5 min ago — not stuck)
  ('e0000000-0000-0000-0000-000000000004', 'CARD-2026-004', 'in_progress', 'AOI-Inspection','in_progress', NOW()-INTERVAL '5 minutes', NOW()-INTERVAL '2 hours',   NOW()-INTERVAL '5 minutes', NULL),
  -- 2 stuck (in_progress/on_hold > 10min at current stage)
  ('e0000000-0000-0000-0000-000000000005', 'CARD-2026-005', 'in_progress', 'SMT-PickPlace', 'in_progress', NOW()-INTERVAL '45 minutes',NOW()-INTERVAL '2.5 hours', NOW()-INTERVAL '45 minutes',NULL),
  ('e0000000-0000-0000-0000-000000000006', 'CARD-2026-006', 'on_hold',     'THT-Wave',      'blocked',     NOW()-INTERVAL '30 minutes',NOW()-INTERVAL '1.5 hours', NOW()-INTERVAL '30 minutes',NULL),
  -- 3 LOST — product_id refs articles.id (set by upsert above)
  ('e0000000-0000-0000-0000-000000000007', 'CARD-2026-007', 'cancelled',   'QC-Final',      'blocked',     NOW()-INTERVAL '2 hours',   NOW()-INTERVAL '3 hours',   NOW()-INTERVAL '1 hour',    (SELECT id FROM articles WHERE reference='IC-7805' LIMIT 1)),
  ('e0000000-0000-0000-0000-000000000008', 'CARD-2026-008', 'removed',     'Receiving',     'blocked',     NOW()-INTERVAL '5 hours',   NOW()-INTERVAL '5 hours',   NOW()-INTERVAL '4 hours',   (SELECT id FROM articles WHERE reference='XFMR-12V' LIMIT 1)),
  ('e0000000-0000-0000-0000-000000000009', 'CARD-2026-009', 'blocked',     'NPM-DX-1',      'blocked',     NOW()-INTERVAL '90 minutes',NOW()-INTERVAL '90 minutes',NOW()-INTERVAL '60 minutes',(SELECT id FROM articles WHERE reference='RES-1k' LIMIT 1))
ON CONFLICT (card_id) DO UPDATE
  SET status = EXCLUDED.status, current_machine = EXCLUDED.current_machine,
      current_machine_status = EXCLUDED.current_machine_status,
      stage_entered_at = EXCLUDED.stage_entered_at, updated_at = EXCLUDED.updated_at,
      product_id = EXCLUDED.product_id;

-- 4. Scrap losses (losses table)
INSERT INTO losses (id, machine_name, loss_count, cost_tnd, reason, loss_zone, product_id, created_at) VALUES
  ('h0000000-0000-0000-0000-000000000001', 'NPM-DX-1', 3, 12.50, 'Feeder jam — feeder #12 tape guide worn',   'Zone 1',    (SELECT id FROM articles WHERE reference='IC-7805'   LIMIT 1), NOW()-INTERVAL '6 hours'),
  ('h0000000-0000-0000-0000-000000000002', 'NPM-DX-1', 1,  5.00, 'Component shortage — IC-7805 reel ran out', 'Zone 2',    (SELECT id FROM articles WHERE reference='RES-1k'    LIMIT 1), NOW()-INTERVAL '4 hours'),
  ('h0000000-0000-0000-0000-000000000003', 'THT-Wave', 2,  8.20, 'Solder wave misalignment — conveyor drift',  'Zone 1to2', (SELECT id FROM articles WHERE reference='CONN-2PIN' LIMIT 1), NOW()-INTERVAL '2 hours')
ON CONFLICT (id) DO NOTHING;

-- 5. Production performance (OOE / OEE source of truth)
INSERT INTO production_performance (id, machine_name, target_count, actual_count, good_count, loss_count, trg_percentage, trs_percentage, date) VALUES
  ('j0000000-0000-0000-0000-000000000001', 'NPM-DX-1', 100, 95, 92, 5,  95.0, 92.0, CURRENT_DATE),
  ('j0000000-0000-0000-0000-000000000002', 'THT-Wave',  80, 76, 74, 4,  95.0, 92.5, CURRENT_DATE),
  ('j0000000-0000-0000-0000-000000000003', 'NPM-DX-1', 100, 88, 82, 6,  88.0, 82.0, CURRENT_DATE-INTERVAL '1 day'),
  ('j0000000-0000-0000-0000-000000000004', 'THT-Wave',  80, 72, 70, 2,  90.0, 87.5, CURRENT_DATE-INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

-- 6. Sensor data (latest reading for dashboard live indicators)
INSERT INTO sensor_data (id, node_id, sensor_1_status, sensor_2_status, sensor_3_status, sensor_1_counter, sensor_2_counter, sensor_3_counter, timestamp) VALUES
  ('p0000000-0000-0000-0000-000000000001', 'PI5-NODE-01', true, true, false, 150, 142, 0, NOW()-INTERVAL '1 minute'),
  ('p0000000-0000-0000-0000-000000000002', 'PI5-NODE-01', true, true, true,  152, 144, 6, NOW())
ON CONFLICT (id) DO NOTHING;

-- 7. Loss root causes for the scrap records
INSERT INTO loss_root_causes (id, loss_id, cause_category, cause_details) VALUES
  ('i0000000-0000-0000-0000-000000000001', 'h0000000-0000-0000-0000-000000000001', 'feeder_jam',         'Feeder #12 tape guide worn — replaced'),
  ('i0000000-0000-0000-0000-000000000002', 'h0000000-0000-0000-0000-000000000002', 'component_shortage', 'IC-7805 reel ran out, no replacement in stock')
ON CONFLICT (id) DO NOTHING;

-- 8. Alerts
INSERT INTO alerts (id, type, title, message, severity, card_id, is_read, created_at) VALUES
  ('e0000000-0000-0000-0000-00000000000a', 'loss', 'Card CARD-2026-007 lost', 'Card CARD-2026-007 marked as cancelled.', 'high', 'CARD-2026-007', false, NOW()-INTERVAL '1 hour'),
  ('e0000000-0000-0000-0000-00000000000b', 'loss', 'Card CARD-2026-008 lost', 'Card CARD-2026-008 marked as removed.',   'high', 'CARD-2026-008', false, NOW()-INTERVAL '4 hours')
ON CONFLICT (id) DO NOTHING;


-- ── PART 3: VERIFY ───────────────────────────────────────
SELECT 'electronic_cards' AS tbl, count(*) FROM electronic_cards
UNION ALL SELECT 'losses',                count(*) FROM losses
UNION ALL SELECT 'production_performance',count(*) FROM production_performance
UNION ALL SELECT 'articles',              count(*) FROM articles
UNION ALL SELECT 'configuration',         count(*) FROM configuration
UNION ALL SELECT 'sensor_data',           count(*) FROM sensor_data
UNION ALL SELECT 'loss_root_causes',      count(*) FROM loss_root_causes
ORDER BY tbl;
