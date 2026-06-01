-- ============================================================
-- SmartTrack — Test Data Seed (matches actual DB schema)
-- Run in Supabase SQL Editor
-- ============================================================
-- Before running the INSERTs below, delete existing data:
-- (uncomment and run these first if re-seeding)
-- DELETE FROM production_history;
-- DELETE FROM loss_root_causes;
-- DELETE FROM losses;
-- DELETE FROM alerts;
-- DELETE FROM sensor_events;
-- DELETE FROM sensor_data;
-- DELETE FROM daily_reports;
-- DELETE FROM production_performance;
-- DELETE FROM component_insertions;
-- DELETE FROM loading_plans;
-- DELETE FROM electronic_cards;
-- DELETE FROM articles;
-- DELETE FROM configuration;
-- DELETE FROM profiles;
-- ============================================================

-- 1. PROFILES ─────────────────────────────────────────────────
-- id MUST match auth.users.id (FK constraint). Use UUIDs you control.
INSERT INTO public.profiles (id, email, display_name, role) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'ahmed@factory.tn',   'Ahmed',  'operator'),
  ('a0000000-0000-0000-0000-000000000002', 'sarra@factory.tn',   'Sarra',  'operator'),
  ('a0000000-0000-0000-0000-000000000003', 'karim@factory.tn',   'Karim',  'supervisor'),
  ('a0000000-0000-0000-0000-000000000004', 'admin@factory.tn',   'Admin',  'admin')
ON CONFLICT (id) DO NOTHING;

-- 2. ARTICLES ─────────────────────────────────────────────────
-- Used by `losses.product_id` FK for cost-of-loss calculation.
-- unit_price in TND, assembly_count = qty used per board.
INSERT INTO public.articles (id, reference, designation, assembly_count, unit_price) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'IC-7805',     'Voltage Regulator 5V',      2,  1.50),
  ('c0000000-0000-0000-0000-000000000002', 'CAP-100nF',   'Ceramic Capacitor 100nF',  10, 0.20),
  ('c0000000-0000-0000-0000-000000000003', 'RES-1k',      'Resistor 1k Ohm',           8,  0.10),
  ('c0000000-0000-0000-0000-000000000004', 'CONN-2PIN',   '2-Pin Screw Terminal',      1,  0.80),
  ('c0000000-0000-0000-0000-000000000005', 'XFMR-12V',    '12V Transformer',           1,  4.50),
  ('c0000000-0000-0000-0000-000000000006', 'DIODE-BRIDGE','Bridge Rectifier',          4,  0.60),
  ('c0000000-0000-0000-0000-000000000007', 'LED-GREEN',   'Green LED',                 1,  0.30),
  ('c0000000-0000-0000-0000-000000000008', 'PHOTO-TRANS', 'Phototransistor',           1,  2.00)
ON CONFLICT (id) DO NOTHING;

-- 3. MACHINE CONFIG ───────────────────────────────────────────
INSERT INTO public.configuration (id, machine_name, expected_cards, cycle_time_seconds, sensor_1_gpio, sensor_2_gpio, sensor_3_gpio, loss_threshold, shift_start, shift_end) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'NPM-DX-1', 100, 45, 17, 26, 16, 3, '08:00', '17:00')
ON CONFLICT (id) DO NOTHING;

-- 4. ELECTRONIC CARDS ─────────────────────────────────────────
-- card_id is TEXT UNIQUE (FK target for sensor_events & production_history)
-- status one of: in_progress | completed | pending | on_hold | cancelled | removed
INSERT INTO public.electronic_cards (id, card_id, status, current_machine, current_machine_status, stage_entered_at, created_at, updated_at, product_id) VALUES
  -- 3 completed → dashboard shows in "Completed" bucket
  ('e0000000-0000-0000-0000-000000000001', 'CARD-2026-001', 'completed',  'NPM-DX-1',    'completed', NOW() - INTERVAL '4 hours',   NOW() - INTERVAL '4 hours',   NOW() - INTERVAL '3 hours', NULL),
  ('e0000000-0000-0000-0000-000000000002', 'CARD-2026-002', 'completed',  'NPM-DX-1',    'completed', NOW() - INTERVAL '3.5 hours', NOW() - INTERVAL '3.5 hours', NOW() - INTERVAL '2.5 hours', NULL),
  ('e0000000-0000-0000-0000-000000000003', 'CARD-2026-003', 'completed',  'THT-Wave',    'completed', NOW() - INTERVAL '3 hours',   NOW() - INTERVAL '3 hours',   NOW() - INTERVAL '2 hours',   NULL),

  -- 1 active (recent scan, NOT stuck)
  ('e0000000-0000-0000-0000-000000000004', 'CARD-2026-004', 'in_progress','AOI-Inspection','in_progress', NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '2 hours',   NOW() - INTERVAL '5 minutes', NULL),

  -- 3 STUCK (in_progress/on_hold >10min → stuck cards screen)
  ('e0000000-0000-0000-0000-000000000005', 'CARD-2026-005', 'in_progress','SMT-PickPlace','in_progress', NOW() - INTERVAL '45 minutes', NOW() - INTERVAL '2.5 hours', NOW() - INTERVAL '45 minutes', NULL),
  ('e0000000-0000-0000-0000-000000000006', 'CARD-2026-006', 'on_hold',    'THT-Wave',    'blocked',    NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '1.5 hours', NOW() - INTERVAL '30 minutes', NULL),
  ('e0000000-0000-0000-0000-000000000009', 'CARD-2026-009', 'on_hold',    'SMT-PickPlace','blocked',   NOW() - INTERVAL '25 minutes', NOW() - INTERVAL '2 hours',   NOW() - INTERVAL '25 minutes', NULL),

  -- 2 LOST (cancelled/removed → each with a product_id so cost calculation works)
  ('e0000000-0000-0000-0000-000000000007', 'CARD-2026-007', 'cancelled', 'QC-Final',    'blocked',    NOW() - INTERVAL '2 hours',   NOW() - INTERVAL '3 hours',   NOW() - INTERVAL '1 hour',  'c0000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000008', 'CARD-2026-008', 'removed',   'Receiving',   'blocked',    NOW() - INTERVAL '5 hours',   NOW() - INTERVAL '5 hours',   NOW() - INTERVAL '4 hours', 'c0000000-0000-0000-0000-000000000005')
ON CONFLICT (id) DO NOTHING;

-- 5. SENSOR EVENTS ───────────────────────────────────────────
-- card_id is TEXT FK → electronic_cards.card_id (the human-readable ID)
INSERT INTO public.sensor_events (id, card_id, event_type, machine_name, timestamp) VALUES
  -- CARD-001 completed flow
  ('f0000000-0000-0000-0000-000000000001', 'CARD-2026-001', 'sensor_1_passed', 'NPM-DX-1', NOW() - INTERVAL '4 hours'),
  ('f0000000-0000-0000-0000-000000000002', 'CARD-2026-001', 'sensor_2_passed', 'NPM-DX-1', NOW() - INTERVAL '3.8 hours'),
  ('f0000000-0000-0000-0000-000000000003', 'CARD-2026-001', 'sensor_3_passed', 'NPM-DX-1', NOW() - INTERVAL '3.5 hours'),
  ('f0000000-0000-0000-0000-000000000004', 'CARD-2026-001', 'completed',       'QC-Final', NOW() - INTERVAL '3 hours'),
  -- CARD-002
  ('f0000000-0000-0000-0000-000000000005', 'CARD-2026-002', 'sensor_1_passed', 'NPM-DX-1', NOW() - INTERVAL '3.5 hours'),
  ('f0000000-0000-0000-0000-000000000006', 'CARD-2026-002', 'sensor_2_passed', 'NPM-DX-1', NOW() - INTERVAL '3.2 hours'),
  -- CARD-004 active
  ('f0000000-0000-0000-0000-000000000007', 'CARD-2026-004', 'sensor_1_passed', 'NPM-DX-1', NOW() - INTERVAL '2 hours'),
  ('f0000000-0000-0000-0000-000000000008', 'CARD-2026-004', 'sensor_2_passed', 'NPM-DX-1', NOW() - INTERVAL '1.5 hours'),
  ('f0000000-0000-0000-0000-000000000009', 'CARD-2026-004', 'sensor_3_passed', 'AOI-Inspection', NOW() - INTERVAL '5 minutes'),
  -- CARD-005 stuck
  ('f0000000-0000-0000-0000-000000000010', 'CARD-2026-005', 'sensor_1_passed', 'SMT-PickPlace', NOW() - INTERVAL '2.5 hours'),
  -- CARD-006 on hold
  ('f0000000-0000-0000-0000-000000000011', 'CARD-2026-006', 'sensor_1_passed', 'THT-Wave', NOW() - INTERVAL '1.5 hours'),
  -- CARD-009 stuck on hold
  ('f0000000-0000-0000-0000-000000000012', 'CARD-2026-009', 'sensor_1_passed', 'SMT-PickPlace', NOW() - INTERVAL '2 hours'),
  ('f0000000-0000-0000-0000-000000000013', 'CARD-2026-009', 'sensor_2_passed', 'Reflow-Oven', NOW() - INTERVAL '1.5 hours')
ON CONFLICT (id) DO NOTHING;

-- 6. PRODUCTION HISTORY ──────────────────────────────────────
-- Records high-level card lifecycle events matching sensor_events
INSERT INTO public.production_history (id, card_id, event_type, machine_name, station, metadata, created_at) VALUES
  ('n0000000-0000-0000-0000-000000000001', 'CARD-2026-001', 'scan_entered',    'NPM-DX-1', 'Receiving',     '{"scannedBy":"Ahmed"}',         NOW() - INTERVAL '4 hours'),
  ('n0000000-0000-0000-0000-000000000002', 'CARD-2026-001', 'machine_placed',  'NPM-DX-1', 'SMT-PickPlace', '{"operator":"Ahmed"}',         NOW() - INTERVAL '4 hours'),
  ('n0000000-0000-0000-0000-000000000003', 'CARD-2026-001', 'quality_check',   'QC-Final',  'QC',            '{"result":"pass"}',            NOW() - INTERVAL '3 hours'),
  ('n0000000-0000-0000-0000-000000000004', 'CARD-2026-001', 'completed',       'QC-Final',  'QC',            '{"result":"pass"}',            NOW() - INTERVAL '3 hours'),
  ('n0000000-0000-0000-0000-000000000005', 'CARD-2026-002', 'scan_entered',    'NPM-DX-1', 'Receiving',     '{"scannedBy":"Sarra"}',        NOW() - INTERVAL '3.5 hours'),
  ('n0000000-0000-0000-0000-000000000006', 'CARD-2026-004', 'scan_entered',    'NPM-DX-1', 'Receiving',     '{"scannedBy":"Sarra"}',        NOW() - INTERVAL '2 hours'),
  ('n0000000-0000-0000-0000-000000000007', 'CARD-2026-004', 'machine_placed',  'NPM-DX-1', 'SMT-PickPlace', '{"operator":"Sarra"}',         NOW() - INTERVAL '2 hours'),
  ('n0000000-0000-0000-0000-000000000008', 'CARD-2026-005', 'scan_entered',    'NPM-DX-1', 'Receiving',     '{"scannedBy":"Ahmed"}',        NOW() - INTERVAL '2.5 hours'),
  ('n0000000-0000-0000-0000-000000000009', 'CARD-2026-005', 'machine_placed',  'NPM-DX-1', 'SMT-PickPlace', '{"operator":"Ahmed"}',         NOW() - INTERVAL '2.5 hours'),
  ('n0000000-0000-0000-0000-000000000010', 'CARD-2026-009', 'scan_entered',    'NPM-DX-1', 'Receiving',     '{"scannedBy":"Sarra"}',        NOW() - INTERVAL '2 hours'),
  ('n0000000-0000-0000-0000-000000000011', 'CARD-2026-009', 'machine_placed',  'SMT-PickPlace','SMT',       '{"operator":"Sarra"}',         NOW() - INTERVAL '2 hours')
ON CONFLICT (id) DO NOTHING;

-- 7. SCRAP LOSSES ────────────────────────────────────────────
-- product_id FK → articles(id) for cost-of-loss per product
INSERT INTO public.losses (id, machine_name, loss_count, cost_tnd, reason, loss_zone, product_id, created_at) VALUES
  ('h0000000-0000-0000-0000-000000000001', 'NPM-DX-1', 3, 12.50, 'Feeder jam — feeder #12 tape guide worn',   'Zone 1',    'c0000000-0000-0000-0000-000000000001', NOW() - INTERVAL '6 hours'),
  ('h0000000-0000-0000-0000-000000000002', 'NPM-DX-1', 1,  5.00, 'Component shortage — IC-7805 reel ran out', 'Zone 2',    'c0000000-0000-0000-0000-000000000003', NOW() - INTERVAL '4 hours'),
  ('h0000000-0000-0000-0000-000000000003', 'THT-Wave', 2,  8.20, 'Solder wave misalignment — conveyor drift',  'Zone 1to2', 'c0000000-0000-0000-0000-000000000004', NOW() - INTERVAL '2 hours')
ON CONFLICT (id) DO NOTHING;

-- 8. LOSS INSPECTIONS (root causes) ──────────────────────────
INSERT INTO public.loss_root_causes (id, loss_id, cause_category, cause_details, operator_id) VALUES
  ('i0000000-0000-0000-0000-000000000001', 'h0000000-0000-0000-0000-000000000001', 'feeder_jam',          'Feeder #12 tape guide worn, replaced it',        'a0000000-0000-0000-0000-000000000003'),
  ('i0000000-0000-0000-0000-000000000002', 'h0000000-0000-0000-0000-000000000002', 'component_shortage',  'IC-7805 reel ran out, no replacement in stock',  'a0000000-0000-0000-0000-000000000003')
ON CONFLICT (id) DO NOTHING;

-- 9. NOTIFICATIONS (alerts) ──────────────────────────────────
-- id is UUID (auto-generated), no card_id/related_card_id column exists
INSERT INTO public.alerts (id, type, title, message, severity, card_id, is_read, created_at) VALUES
  ('e0000000-0000-0000-0000-00000000000a', 'loss', 'Card CARD-2026-007 lost', 'Card CARD-2026-007 marked as cancelled.', 'high', 'CARD-2026-007', false, NOW() - INTERVAL '1 hour'),
  ('e0000000-0000-0000-0000-00000000000b', 'loss', 'Card CARD-2026-008 lost', 'Card CARD-2026-008 marked as removed.',  'high', 'CARD-2026-008', false, NOW() - INTERVAL '4 hours')
ON CONFLICT (id) DO NOTHING;

-- 10. PRODUCTION PERFORMANCE (OOE/OEE data for charts) ──────
INSERT INTO public.production_performance (id, machine_name, target_count, actual_count, good_count, loss_count, trg_percentage, trs_percentage, date) VALUES
  ('j0000000-0000-0000-0000-000000000001', 'NPM-DX-1', 100, 95, 92, 5,  95.0, 92.0, CURRENT_DATE),
  ('j0000000-0000-0000-0000-000000000002', 'THT-Wave', 80,  76, 74, 4,  95.0, 92.5, CURRENT_DATE),
  ('j0000000-0000-0000-0000-000000000003', 'NPM-DX-1', 100, 88, 82, 6,  88.0, 82.0, CURRENT_DATE - INTERVAL '1 day'),
  ('j0000000-0000-0000-0000-000000000004', 'THT-Wave', 80,  72, 70, 2,  90.0, 87.5, CURRENT_DATE - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

-- 11. DAILY REPORTS ──────────────────────────────────────────
INSERT INTO public.daily_reports (id, report_date, trg_percentage, trs_percentage, total_losses, file_url) VALUES
  ('k0000000-0000-0000-0000-000000000001', CURRENT_DATE,                   92.5, 90.0, 3, null),
  ('k0000000-0000-0000-0000-000000000002', CURRENT_DATE - INTERVAL '1 day', 88.0, 85.0, 5, null)
ON CONFLICT (id) DO NOTHING;

-- 12. SENSOR DATA (IoT readings for sensor_data subscription) ─
INSERT INTO public.sensor_data (id, node_id, sensor_1_status, sensor_2_status, sensor_3_status, sensor_1_counter, sensor_2_counter, sensor_3_counter, timestamp) VALUES
  ('p0000000-0000-0000-0000-000000000001', 'PI5-NODE-01', true, true, false, 150, 142, 0, NOW() - INTERVAL '1 minute'),
  ('p0000000-0000-0000-0000-000000000002', 'PI5-NODE-01', true, true, true,  150, 142, 5, NOW())
ON CONFLICT (id) DO NOTHING;
