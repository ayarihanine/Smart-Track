-- ============================================================
-- SmartTrack — Extended Test Data for Card Details Page
-- Run in Supabase SQL Editor to populate production history
-- and scan events for demonstration
-- ============================================================

-- Clear existing scan events and production history for test cards
-- UNCOMMENT THESE LINES IF YOU WANT TO RESET DATA:
-- DELETE FROM sensor_events WHERE card_id IN (
--   SELECT id FROM electronic_cards WHERE card_id IN ('CARD-2026-001', 'CARD-2026-002', 'CARD-2026-003', 'CARD-2026-004')
-- );
-- DELETE FROM production_history WHERE card_id IN ('CARD-2026-001', 'CARD-2026-002', 'CARD-2026-003', 'CARD-2026-004');

-- ============================================================
-- EXTENDED SCAN EVENTS (sensor_events) - Full production flow
-- ============================================================

-- CARD-2026-001: Complete flow with 6 scans
INSERT INTO public.sensor_events (id, card_id, event_type, machine_name, timestamp) VALUES
  ('f1000000-0000-0000-0000-000000000001', 'CARD-2026-001', 'machine_entry',       'Receiving',        NOW() - INTERVAL '4 hours'),
  ('f1000000-0000-0000-0000-000000000002', 'CARD-2026-001', 'sensor_1_passed',     'NPM-DX-1',         NOW() - INTERVAL '3 hours 50 minutes'),
  ('f1000000-0000-0000-0000-000000000003', 'CARD-2026-001', 'component_scan',      'NPM-DX-1',         NOW() - INTERVAL '3 hours 40 minutes'),
  ('f1000000-0000-0000-0000-000000000004', 'CARD-2026-001', 'sensor_2_passed',     'NPM-DX-1',         NOW() - INTERVAL '3 hours 20 minutes'),
  ('f1000000-0000-0000-0000-000000000005', 'CARD-2026-001', 'machine_exit',        'NPM-DX-1',         NOW() - INTERVAL '3 hours'),
  ('f1000000-0000-0000-0000-000000000006', 'CARD-2026-001', 'sensor_3_passed',     'AOI-Inspection',   NOW() - INTERVAL '2 hours 45 minutes'),
  ('f1000000-0000-0000-0000-000000000007', 'CARD-2026-001', 'quality_alert',       'QC-Final',         NOW() - INTERVAL '2 hours 30 minutes'),
  ('f1000000-0000-0000-0000-000000000008', 'CARD-2026-001', 'completed',           'QC-Final',         NOW() - INTERVAL '2 hours')
ON CONFLICT (id) DO NOTHING;

-- CARD-2026-002: Partial flow with 5 scans
INSERT INTO public.sensor_events (id, card_id, event_type, machine_name, timestamp) VALUES
  ('f1000000-0000-0000-0000-000000000010', 'CARD-2026-002', 'machine_entry',       'Receiving',        NOW() - INTERVAL '3 hours 30 minutes'),
  ('f1000000-0000-0000-0000-000000000011', 'CARD-2026-002', 'sensor_1_passed',     'NPM-DX-1',         NOW() - INTERVAL '3 hours 20 minutes'),
  ('f1000000-0000-0000-0000-000000000012', 'CARD-2026-002', 'component_scan',      'NPM-DX-1',         NOW() - INTERVAL '3 hours 10 minutes'),
  ('f1000000-0000-0000-0000-000000000013', 'CARD-2026-002', 'sensor_2_passed',     'NPM-DX-1',         NOW() - INTERVAL '2 hours 50 minutes'),
  ('f1000000-0000-0000-0000-000000000014', 'CARD-2026-002', 'machine_exit',        'NPM-DX-1',         NOW() - INTERVAL '2 hours 30 minutes')
ON CONFLICT (id) DO NOTHING;

-- CARD-2026-003: Quick completion flow with 4 scans
INSERT INTO public.sensor_events (id, card_id, event_type, machine_name, timestamp) VALUES
  ('f1000000-0000-0000-0000-000000000020', 'CARD-2026-003', 'machine_entry',       'Receiving',        NOW() - INTERVAL '3 hours'),
  ('f1000000-0000-0000-0000-000000000021', 'CARD-2026-003', 'sensor_1_passed',     'THT-Wave',         NOW() - INTERVAL '2 hours 45 minutes'),
  ('f1000000-0000-0000-0000-000000000022', 'CARD-2026-003', 'component_scan',      'THT-Wave',         NOW() - INTERVAL '2 hours 30 minutes'),
  ('f1000000-0000-0000-0000-000000000023', 'CARD-2026-003', 'completed',           'Packaging',        NOW() - INTERVAL '2 hours')
ON CONFLICT (id) DO NOTHING;

-- CARD-2026-004: Currently in production with 3 scans
INSERT INTO public.sensor_events (id, card_id, event_type, machine_name, timestamp) VALUES
  ('f1000000-0000-0000-0000-000000000030', 'CARD-2026-004', 'machine_entry',       'Receiving',        NOW() - INTERVAL '2 hours'),
  ('f1000000-0000-0000-0000-000000000031', 'CARD-2026-004', 'sensor_1_passed',     'NPM-DX-1',         NOW() - INTERVAL '1 hour 50 minutes'),
  ('f1000000-0000-0000-0000-000000000032', 'CARD-2026-004', 'machine_exit',        'NPM-DX-1',         NOW() - INTERVAL '1 hour 30 minutes'),
  ('f1000000-0000-0000-0000-000000000033', 'CARD-2026-004', 'sensor_2_passed',     'AOI-Inspection',   NOW() - INTERVAL '30 minutes'),
  ('f1000000-0000-0000-0000-000000000034', 'CARD-2026-004', 'component_scan',      'AOI-Inspection',   NOW() - INTERVAL '15 minutes')
ON CONFLICT (id) DO NOTHING;

-- CARD-2026-005: Stuck card with 3 scans
INSERT INTO public.sensor_events (id, card_id, event_type, machine_name, timestamp) VALUES
  ('f1000000-0000-0000-0000-000000000040', 'CARD-2026-005', 'machine_entry',       'Receiving',        NOW() - INTERVAL '2 hours 30 minutes'),
  ('f1000000-0000-0000-0000-000000000041', 'CARD-2026-005', 'sensor_1_passed',     'SMT-PickPlace',    NOW() - INTERVAL '2 hours 15 minutes'),
  ('f1000000-0000-0000-0000-000000000042', 'CARD-2026-005', 'blocking_anomaly',    'SMT-PickPlace',    NOW() - INTERVAL '45 minutes')
ON CONFLICT (id) DO NOTHING;

-- CARD-2026-006: On hold card with 2 scans
INSERT INTO public.sensor_events (id, card_id, event_type, machine_name, timestamp) VALUES
  ('f1000000-0000-0000-0000-000000000050', 'CARD-2026-006', 'machine_entry',       'Receiving',        NOW() - INTERVAL '1 hour 30 minutes'),
  ('f1000000-0000-0000-0000-000000000051', 'CARD-2026-006', 'sensor_1_passed',     'THT-Wave',         NOW() - INTERVAL '1 hour 15 minutes')
ON CONFLICT (id) DO NOTHING;

-- CARD-2026-009: Stuck on hold with 2 scans
INSERT INTO public.sensor_events (id, card_id, event_type, machine_name, timestamp) VALUES
  ('f1000000-0000-0000-0000-000000000060', 'CARD-2026-009', 'machine_entry',       'Receiving',        NOW() - INTERVAL '2 hours'),
  ('f1000000-0000-0000-0000-000000000061', 'CARD-2026-009', 'sensor_1_passed',     'SMT-PickPlace',    NOW() - INTERVAL '1 hour 50 minutes'),
  ('f1000000-0000-0000-0000-000000000062', 'CARD-2026-009', 'blocking_anomaly',    'Reflow-Oven',      NOW() - INTERVAL '25 minutes')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- EXTENDED PRODUCTION HISTORY - Detailed tracking
-- ============================================================

-- CARD-2026-001: Full journey with details
INSERT INTO public.production_history (id, card_id, event_type, machine_name, station, metadata, created_at) VALUES
  ('p1000000-0000-0000-0000-000000000001', 'CARD-2026-001', 'scan_entered',     'Receiving',        'Receiving',        '{"scannedBy":"Ahmed","badgeId":"EMP001"}', NOW() - INTERVAL '4 hours'),
  ('p1000000-0000-0000-0000-000000000002', 'CARD-2026-001', 'machine_placed',   'NPM-DX-1',         'SMT-PickPlace',    '{"operator":"Ahmed","feederConfig":"12-slot"}', NOW() - INTERVAL '3 hours 50 minutes'),
  ('p1000000-0000-0000-0000-000000000003', 'CARD-2026-001', 'component_scan',   'NPM-DX-1',         'SMT-PickPlace',    '{"parts":["IC-7805","CAP-100nF"],"count":24}', NOW() - INTERVAL '3 hours 40 minutes'),
  ('p1000000-0000-0000-0000-000000000004', 'CARD-2026-001', 'machine_exit',     'NPM-DX-1',         'NPM-DX-1',         '{"cycleTime":3000,"status":"success"}', NOW() - INTERVAL '3 hours'),
  ('p1000000-0000-0000-0000-000000000005', 'CARD-2026-001', 'stage_transition', 'Reflow-Oven',      'Reflow-Oven',      '{"from":"SMT-PickPlace","to":"Reflow-Oven","duration":"50min"}', NOW() - INTERVAL '2 hours 50 minutes'),
  ('p1000000-0000-0000-0000-000000000006', 'CARD-2026-001', 'machine_placed',   'AOI-Inspection',   'AOI',              '{"operator":"Sarra","inspectionMode":"full"}', NOW() - INTERVAL '2 hours 45 minutes'),
  ('p1000000-0000-0000-0000-000000000007', 'CARD-2026-001', 'quality_check',    'QC-Final',         'QC-Station-1',     '{"result":"pass","defects":0,"notes":"All components verified"}', NOW() - INTERVAL '2 hours 30 minutes'),
  ('p1000000-0000-0000-0000-000000000008', 'CARD-2026-001', 'completed',        'QC-Final',         'Packaging',        '{"packingMethod":"standard","weight":150,"notes":"Ready for shipment"}', NOW() - INTERVAL '2 hours')
ON CONFLICT (id) DO NOTHING;

-- CARD-2026-002: Partial journey
INSERT INTO public.production_history (id, card_id, event_type, machine_name, station, metadata, created_at) VALUES
  ('p1000000-0000-0000-0000-000000000010', 'CARD-2026-002', 'scan_entered',     'Receiving',        'Receiving',        '{"scannedBy":"Sarra","badgeId":"EMP002"}', NOW() - INTERVAL '3 hours 30 minutes'),
  ('p1000000-0000-0000-0000-000000000011', 'CARD-2026-002', 'machine_placed',   'NPM-DX-1',         'SMT-PickPlace',    '{"operator":"Sarra","feederConfig":"12-slot"}', NOW() - INTERVAL '3 hours 20 minutes'),
  ('p1000000-0000-0000-0000-000000000012', 'CARD-2026-002', 'component_scan',   'NPM-DX-1',         'SMT-PickPlace',    '{"parts":["IC-7805","RES-1k"],"count":32}', NOW() - INTERVAL '3 hours 10 minutes'),
  ('p1000000-0000-0000-0000-000000000013', 'CARD-2026-002', 'stage_transition', 'Reflow-Oven',      'Reflow-Oven',      '{"from":"SMT-PickPlace","to":"Reflow-Oven","duration":"55min"}', NOW() - INTERVAL '2 hours 50 minutes'),
  ('p1000000-0000-0000-0000-000000000014', 'CARD-2026-002', 'machine_placed',   'Reflow-Oven',      'Reflow-Oven',      '{"operator":"Ahmed","profileName":"standard","temp":"260C"}', NOW() - INTERVAL '2 hours 30 minutes')
ON CONFLICT (id) DO NOTHING;

-- CARD-2026-003: Quick flow
INSERT INTO public.production_history (id, card_id, event_type, machine_name, station, metadata, created_at) VALUES
  ('p1000000-0000-0000-0000-000000000020', 'CARD-2026-003', 'scan_entered',     'Receiving',        'Receiving',        '{"scannedBy":"Ahmed","badgeId":"EMP001"}', NOW() - INTERVAL '3 hours'),
  ('p1000000-0000-0000-0000-000000000021', 'CARD-2026-003', 'machine_placed',   'THT-Wave',         'Wave-Soldering',   '{"operator":"Sarra","tempProfile":"300C"}', NOW() - INTERVAL '2 hours 45 minutes'),
  ('p1000000-0000-0000-0000-000000000022', 'CARD-2026-003', 'machine_exit',     'THT-Wave',         'Wave-Soldering',   '{"cycleTime":2000,"status":"success"}', NOW() - INTERVAL '2 hours 30 minutes'),
  ('p1000000-0000-0000-0000-000000000023', 'CARD-2026-003', 'completed',        'Packaging',        'Packaging',        '{"result":"pass","defects":0}', NOW() - INTERVAL '2 hours')
ON CONFLICT (id) DO NOTHING;

-- CARD-2026-004: Current production
INSERT INTO public.production_history (id, card_id, event_type, machine_name, station, metadata, created_at) VALUES
  ('p1000000-0000-0000-0000-000000000030', 'CARD-2026-004', 'scan_entered',     'Receiving',        'Receiving',        '{"scannedBy":"Sarra","badgeId":"EMP002"}', NOW() - INTERVAL '2 hours'),
  ('p1000000-0000-0000-0000-000000000031', 'CARD-2026-004', 'machine_placed',   'NPM-DX-1',         'SMT-PickPlace',    '{"operator":"Ahmed","feederConfig":"12-slot"}', NOW() - INTERVAL '1 hour 50 minutes'),
  ('p1000000-0000-0000-0000-000000000032', 'CARD-2026-004', 'component_scan',   'NPM-DX-1',         'SMT-PickPlace',    '{"parts":["IC-7805"],"count":50}', NOW() - INTERVAL '1 hour 30 minutes'),
  ('p1000000-0000-0000-0000-000000000033', 'CARD-2026-004', 'stage_transition', 'AOI-Inspection',   'AOI-Inspection',   '{"from":"NPM-DX-1","to":"AOI-Inspection","duration":"60min"}', NOW() - INTERVAL '30 minutes'),
  ('p1000000-0000-0000-0000-000000000034', 'CARD-2026-004', 'quality_check',    'AOI-Inspection',   'AOI-Inspection',   '{"operator":"Sarra","defectsFound":0,"notes":"In progress"}', NOW() - INTERVAL '15 minutes')
ON CONFLICT (id) DO NOTHING;

-- CARD-2026-005: Stuck card
INSERT INTO public.production_history (id, card_id, event_type, machine_name, station, metadata, created_at) VALUES
  ('p1000000-0000-0000-0000-000000000040', 'CARD-2026-005', 'scan_entered',     'Receiving',        'Receiving',        '{"scannedBy":"Ahmed","badgeId":"EMP001"}', NOW() - INTERVAL '2 hours 30 minutes'),
  ('p1000000-0000-0000-0000-000000000041', 'CARD-2026-005', 'machine_placed',   'SMT-PickPlace',    'SMT-PickPlace',    '{"operator":"Sarra","feederConfig":"12-slot"}', NOW() - INTERVAL '2 hours 15 minutes'),
  ('p1000000-0000-0000-0000-000000000042', 'CARD-2026-005', 'blocking_anomaly', 'SMT-PickPlace',    'SMT-PickPlace',    '{"reason":"feeder_jam","machine":"SMT-PickPlace","severity":"high","notes":"Feeder #5 jammed"}', NOW() - INTERVAL '45 minutes')
ON CONFLICT (id) DO NOTHING;

-- CARD-2026-006: On hold
INSERT INTO public.production_history (id, card_id, event_type, machine_name, station, metadata, created_at) VALUES
  ('p1000000-0000-0000-0000-000000000050', 'CARD-2026-006', 'scan_entered',     'Receiving',        'Receiving',        '{"scannedBy":"Sarra","badgeId":"EMP002"}', NOW() - INTERVAL '1 hour 30 minutes'),
  ('p1000000-0000-0000-0000-000000000051', 'CARD-2026-006', 'machine_placed',   'THT-Wave',         'Wave-Soldering',   '{"operator":"Ahmed","tempProfile":"300C"}', NOW() - INTERVAL '1 hour 15 minutes'),
  ('p1000000-0000-0000-0000-000000000052', 'CARD-2026-006', 'blocking_anomaly', 'THT-Wave',         'Wave-Soldering',   '{"reason":"machine_maintenance","machine":"THT-Wave","severity":"medium","notes":"Scheduled maintenance started"}', NOW() - INTERVAL '30 minutes')
ON CONFLICT (id) DO NOTHING;

-- CARD-2026-009: Stuck on hold
INSERT INTO public.production_history (id, card_id, event_type, machine_name, station, metadata, created_at) VALUES
  ('p1000000-0000-0000-0000-000000000060', 'CARD-2026-009', 'scan_entered',     'Receiving',        'Receiving',        '{"scannedBy":"Ahmed","badgeId":"EMP001"}', NOW() - INTERVAL '2 hours'),
  ('p1000000-0000-0000-0000-000000000061', 'CARD-2026-009', 'machine_placed',   'SMT-PickPlace',    'SMT-PickPlace',    '{"operator":"Sarra","feederConfig":"12-slot"}', NOW() - INTERVAL '1 hour 50 minutes'),
  ('p1000000-0000-0000-0000-000000000062', 'CARD-2026-009', 'stage_transition', 'Reflow-Oven',      'Reflow-Oven',      '{"from":"SMT-PickPlace","to":"Reflow-Oven","duration":"50min"}', NOW() - INTERVAL '1 hour'),
  ('p1000000-0000-0000-0000-000000000063', 'CARD-2026-009', 'blocking_anomaly', 'Reflow-Oven',      'Reflow-Oven',      '{"reason":"temperature_alert","machine":"Reflow-Oven","severity":"high","notes":"Oven temp dropped to 240C"}', NOW() - INTERVAL '25 minutes')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- COMPONENT INSERTIONS - Detailed tracking for components
-- ============================================================

-- CARD-2026-001: Component insertions
INSERT INTO public.component_insertions (id, card_id, part_reference, inserted_quantity, machine_reference, timestamp, status, operator_id) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'IC-7805',     2,  'NPM-DX-1', NOW() - INTERVAL '3 hours 45 minutes', 'success', 'a0000000-0000-0000-0000-000000000001'),
  ('c1000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 'CAP-100nF',  10,  'NPM-DX-1', NOW() - INTERVAL '3 hours 40 minutes', 'success', 'a0000000-0000-0000-0000-000000000001'),
  ('c1000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'RES-1k',      8,  'NPM-DX-1', NOW() - INTERVAL '3 hours 35 minutes', 'success', 'a0000000-0000-0000-0000-000000000001'),
  ('c1000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 'LED-GREEN',   1,  'NPM-DX-1', NOW() - INTERVAL '3 hours 30 minutes', 'success', 'a0000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- CARD-2026-002: Component insertions
INSERT INTO public.component_insertions (id, card_id, part_reference, inserted_quantity, machine_reference, timestamp, status, operator_id) VALUES
  ('c1000000-0000-0000-0000-000000000010', 'e0000000-0000-0000-0000-000000000002', 'IC-7805',     2,  'NPM-DX-1', NOW() - INTERVAL '3 hours 15 minutes', 'success', 'a0000000-0000-0000-0000-000000000002'),
  ('c1000000-0000-0000-0000-000000000011', 'e0000000-0000-0000-0000-000000000002', 'RES-1k',      8,  'NPM-DX-1', NOW() - INTERVAL '3 hours 05 minutes', 'success', 'a0000000-0000-0000-0000-000000000002'),
  ('c1000000-0000-0000-0000-000000000012', 'e0000000-0000-0000-0000-000000000002', 'DIODE-BRIDGE', 4, 'NPM-DX-1', NOW() - INTERVAL '2 hours 55 minutes', 'success', 'a0000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

-- CARD-2026-003: Component insertions
INSERT INTO public.component_insertions (id, card_id, part_reference, inserted_quantity, machine_reference, timestamp, status, operator_id) VALUES
  ('c1000000-0000-0000-0000-000000000020', 'e0000000-0000-0000-0000-000000000003', 'CONN-2PIN',   1,  'THT-Wave', NOW() - INTERVAL '2 hours 40 minutes', 'success', 'a0000000-0000-0000-0000-000000000001'),
  ('c1000000-0000-0000-0000-000000000021', 'e0000000-0000-0000-0000-000000000003', 'XFMR-12V',    1,  'THT-Wave', NOW() - INTERVAL '2 hours 35 minutes', 'success', 'a0000000-0000-0000-0000-000000000001'),
  ('c1000000-0000-0000-0000-000000000022', 'e0000000-0000-0000-0000-000000000003', 'PHOTO-TRANS',1,  'THT-Wave', NOW() - INTERVAL '2 hours 30 minutes', 'success', 'a0000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- CARD-2026-004: Component insertions (in progress)
INSERT INTO public.component_insertions (id, card_id, part_reference, inserted_quantity, machine_reference, timestamp, status, operator_id) VALUES
  ('c1000000-0000-0000-0000-000000000030', 'e0000000-0000-0000-0000-000000000004', 'IC-7805',     2,  'NPM-DX-1', NOW() - INTERVAL '1 hour 45 minutes', 'success', 'a0000000-0000-0000-0000-000000000002'),
  ('c1000000-0000-0000-0000-000000000031', 'e0000000-0000-0000-0000-000000000004', 'CAP-100nF',  10,  'NPM-DX-1', NOW() - INTERVAL '1 hour 40 minutes', 'success', 'a0000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

-- CARD-2026-005: Component insertions (stuck)
INSERT INTO public.component_insertions (id, card_id, part_reference, inserted_quantity, machine_reference, timestamp, status, operator_id) VALUES
  ('c1000000-0000-0000-0000-000000000040', 'e0000000-0000-0000-0000-000000000005', 'IC-7805',     2,  'SMT-PickPlace', NOW() - INTERVAL '2 hours 10 minutes', 'success', 'a0000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;
