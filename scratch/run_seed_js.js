#!/usr/bin/env node
/**
 * Seed today's test data into electronic_cards, losses, production_performance
 * Run: NODE_PATH=/home/ayari/smarttrack/node_modules node scratch/run_seed_js.js
 */
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gtjjxfwlixcrfniwvnzu.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0amp4ZndsaXhjcmZuaXd2bnp1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTg3MzkwNSwiZXhwIjoyMDg3NDQ5OTA1fQ.jqYF3PW0qGmhwzrNW1DidOH8aABt_5vU0_wXKinZT9g';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const now = new Date();
const ago = (min) => new Date(now.getTime() - min * 60 * 1000).toISOString();

async function run() {
  console.log('=== SmartTrack Seed Script ===\n');

  // 1. Seed articles (for cost calculation)
  console.log('1/4 Seeding articles...');
  const { error: artErr } = await supabase.from('articles').upsert([
    { id: 'c0000000-0000-0000-0000-000000000001', reference: 'IC-7805',     designation: 'Voltage Regulator 5V',   assembly_count: 2,  unit_price: 1.50 },
    { id: 'c0000000-0000-0000-0000-000000000002', reference: 'CAP-100nF',   designation: 'Ceramic Capacitor 100nF',assembly_count: 10, unit_price: 0.20 },
    { id: 'c0000000-0000-0000-0000-000000000003', reference: 'RES-1k',      designation: 'Resistor 1k Ohm',        assembly_count: 8,  unit_price: 0.10 },
    { id: 'c0000000-0000-0000-0000-000000000004', reference: 'CONN-2PIN',   designation: '2-Pin Screw Terminal',   assembly_count: 1,  unit_price: 0.80 },
    { id: 'c0000000-0000-0000-0000-000000000005', reference: 'XFMR-12V',    designation: '12V Transformer',        assembly_count: 1,  unit_price: 4.50 },
  ], { onConflict: 'id' });
  if (artErr) console.error('  ❌ Articles:', artErr.message);
  else console.log('  ✅ Articles seeded');

  // 2. Seed electronic_cards (today's cards)
  console.log('2/4 Seeding electronic_cards...');
  const { error: cardErr } = await supabase.from('electronic_cards').upsert([
    // 3 completed
    { id: 'e0000000-0000-0000-0000-000000000001', card_id: 'CARD-2026-001', status: 'completed',   current_machine: 'NPM-DX-1',     stage_entered_at: ago(240), created_at: ago(240), updated_at: ago(180), product_id: null },
    { id: 'e0000000-0000-0000-0000-000000000002', card_id: 'CARD-2026-002', status: 'completed',   current_machine: 'NPM-DX-1',     stage_entered_at: ago(210), created_at: ago(210), updated_at: ago(150), product_id: null },
    { id: 'e0000000-0000-0000-0000-000000000003', card_id: 'CARD-2026-003', status: 'completed',   current_machine: 'THT-Wave',     stage_entered_at: ago(180), created_at: ago(180), updated_at: ago(120), product_id: null },
    // 1 active (not stuck)
    { id: 'e0000000-0000-0000-0000-000000000004', card_id: 'CARD-2026-004', status: 'in_progress', current_machine: 'AOI-Inspection',stage_entered_at: ago(5),   created_at: ago(120), updated_at: ago(5),   product_id: null },
    // 2 stuck (in_progress > 10min)
    { id: 'e0000000-0000-0000-0000-000000000005', card_id: 'CARD-2026-005', status: 'in_progress', current_machine: 'SMT-PickPlace',stage_entered_at: ago(45),  created_at: ago(150), updated_at: ago(45),  product_id: null },
    { id: 'e0000000-0000-0000-0000-000000000006', card_id: 'CARD-2026-006', status: 'on_hold',     current_machine: 'THT-Wave',     stage_entered_at: ago(30),  created_at: ago(90),  updated_at: ago(30),  product_id: null },
    // 2 LOST (cancelled/removed) — with product_id for cost calculation
    { id: 'e0000000-0000-0000-0000-000000000007', card_id: 'CARD-2026-007', status: 'cancelled',   current_machine: 'QC-Final',     stage_entered_at: ago(120), created_at: ago(180), updated_at: ago(60),  product_id: 'c0000000-0000-0000-0000-000000000001' },
    { id: 'e0000000-0000-0000-0000-000000000008', card_id: 'CARD-2026-008', status: 'removed',     current_machine: 'Receiving',    stage_entered_at: ago(300), created_at: ago(300), updated_at: ago(240), product_id: 'c0000000-0000-0000-0000-000000000005' },
    // 1 blocked
    { id: 'e0000000-0000-0000-0000-000000000009', card_id: 'CARD-2026-009', status: 'blocked',     current_machine: 'NPM-DX-1',     stage_entered_at: ago(90),  created_at: ago(90),  updated_at: ago(60),  product_id: 'c0000000-0000-0000-0000-000000000003' },
  ], { onConflict: 'id' });
  if (cardErr) console.error('  ❌ Cards:', cardErr.message);
  else console.log('  ✅ 9 electronic_cards seeded (3 completed, 3 in progress, 3 lost/blocked)');

  // 3. Seed losses (scrap records today)
  console.log('3/4 Seeding losses (scrap)...');
  const { error: lossErr } = await supabase.from('losses').upsert([
    { id: 'h0000000-0000-0000-0000-000000000001', machine_name: 'NPM-DX-1', loss_count: 3, cost_tnd: 12.50, reason: 'Feeder jam — feeder #12 tape guide worn',   loss_zone: 'Zone 1',    product_id: 'c0000000-0000-0000-0000-000000000001', created_at: ago(360) },
    { id: 'h0000000-0000-0000-0000-000000000002', machine_name: 'NPM-DX-1', loss_count: 1, cost_tnd:  5.00, reason: 'Component shortage — IC-7805 reel ran out', loss_zone: 'Zone 2',    product_id: 'c0000000-0000-0000-0000-000000000003', created_at: ago(240) },
    { id: 'h0000000-0000-0000-0000-000000000003', machine_name: 'THT-Wave', loss_count: 2, cost_tnd:  8.20, reason: 'Solder wave misalignment — conveyor drift',  loss_zone: 'Zone 1to2', product_id: 'c0000000-0000-0000-0000-000000000004', created_at: ago(120) },
  ], { onConflict: 'id' });
  if (lossErr) console.error('  ❌ Losses:', lossErr.message);
  else console.log('  ✅ 3 scrap loss records seeded (total cost: 25.70 TND)');

  // 4. Seed production_performance (OEE/OOE for today)
  console.log('4/4 Seeding production_performance...');
  const today = now.toISOString().split('T')[0];
  const { error: perfErr } = await supabase.from('production_performance').upsert([
    {
      id: 'j0000000-0000-0000-0000-000000000001',
      machine_name: 'NPM-DX-1',
      target_count:  100,
      actual_count:   95,
      good_count:     92,
      loss_count:      5,
      trg_percentage: 95.0,   // OOE
      trs_percentage: 92.0,   // OEE
      date: today,
      timestamp: ago(0),
    },
    {
      id: 'j0000000-0000-0000-0000-000000000002',
      machine_name: 'THT-Wave',
      target_count: 80,
      actual_count:  76,
      good_count:    74,
      loss_count:     4,
      trg_percentage: 95.0,
      trs_percentage: 92.5,
      date: today,
      timestamp: ago(1),
    },
  ], { onConflict: 'id' });
  if (perfErr) console.error('  ❌ Production performance:', perfErr.message);
  else console.log('  ✅ 2 production_performance rows seeded (OOE: 95%, OEE: 92%)');

  // Summary
  console.log('\n=== Verification ===');
  const checks = [
    ['electronic_cards', 'id', null],
    ['losses', 'id', null],
    ['production_performance', 'id', null],
  ];
  for (const [table, sel] of checks) {
    const { data, error } = await supabase.from(table).select(sel).limit(20);
    if (error) console.log(`  ❌ ${table}: ${error.message}`);
    else console.log(`  ✅ ${table}: ${data.length} rows`);
  }

  console.log('\n🎉 Done! Reload the app to see updated metrics.');
}

run().catch(console.error);
