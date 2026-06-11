const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('Error: EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY not found in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const now = new Date();
const ago = (min) => new Date(now.getTime() - min * 60 * 1000).toISOString();

async function run() {
  console.log('=== SmartTrack Active DB Seed Script ===');
  console.log(`URL: ${SUPABASE_URL}\n`);

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

  // 2. Seed configuration
  console.log('Seeding configuration...');
  const { error: confErr } = await supabase.from('configuration').upsert([
    { id: 'd0000000-0000-0000-0000-000000000001', machine_name: 'NPM-DX-1', expected_cards: 100, cycle_time_seconds: 45, loss_threshold: 3, shift_start: '08:00', shift_end: '17:00' }
  ], { onConflict: 'id' });
  if (confErr) console.error('  ❌ Configuration:', confErr.message);
  else console.log('  ✅ Configuration seeded');

  // 3. Seed electronic_cards (today's cards)
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
  else console.log('  ✅ 9 electronic_cards seeded');

  // 4. Seed losses (scrap records today)
  console.log('3/4 Seeding losses (scrap)...');
  const { error: lossErr } = await supabase.from('losses').upsert([
    { id: 'h0000000-0000-0000-0000-000000000001', machine_name: 'NPM-DX-1', loss_count: 3, cost_tnd: 12.50, reason: 'Feeder jam — feeder #12 tape guide worn',   loss_zone: 'Zone 1',    product_id: 'c0000000-0000-0000-0000-000000000001', created_at: ago(360) },
    { id: 'h0000000-0000-0000-0000-000000000002', machine_name: 'NPM-DX-1', loss_count: 1, cost_tnd:  5.00, reason: 'Component shortage — IC-7805 reel ran out', loss_zone: 'Zone 2',    product_id: 'c0000000-0000-0000-0000-000000000003', created_at: ago(240) },
    { id: 'h0000000-0000-0000-0000-000000000003', machine_name: 'THT-Wave', loss_count: 2, cost_tnd:  8.20, reason: 'Solder wave misalignment — conveyor drift',  loss_zone: 'Zone 1to2', product_id: 'c0000000-0000-0000-0000-000000000004', created_at: ago(120) },
  ], { onConflict: 'id' });
  if (lossErr) console.error('  ❌ Losses:', lossErr.message);
  else console.log('  ✅ 3 scrap loss records seeded');

  // 5. Seed production_performance (OEE/OOE for today)
  console.log('4/4 Seeding production_performance...');
  const today = now.toISOString().split('T')[0];
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const { error: perfErr } = await supabase.from('production_performance').upsert([
    {
      id: 'j0000000-0000-0000-0000-000000000001',
      machine_name: 'NPM-DX-1',
      target_count:  100,
      actual_count:   95,
      good_count:     92,
      loss_count:      5,
      OOE_percentage: 95.0,
      OEE_percentage: 92.0,
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
      OOE_percentage: 95.0,
      OEE_percentage: 92.5,
      date: today,
      timestamp: ago(1),
    },
    {
      id: 'j0000000-0000-0000-0000-000000000003',
      machine_name: 'NPM-DX-1',
      target_count:  100,
      actual_count:   88,
      good_count:     82,
      loss_count:      6,
      OOE_percentage: 88.0,
      OEE_percentage: 82.0,
      date: yesterday,
      timestamp: ago(1440),
    },
    {
      id: 'j0000000-0000-0000-0000-000000000004',
      machine_name: 'THT-Wave',
      target_count: 80,
      actual_count:  72,
      good_count:    70,
      loss_count:     2,
      OOE_percentage: 90.0,
      OEE_percentage: 87.5,
      date: yesterday,
      timestamp: ago(1441),
    },
  ], { onConflict: 'id' });
  if (perfErr) console.error('  ❌ Production performance:', perfErr.message);
  else console.log('  ✅ 4 production_performance rows seeded');

  // 6. Seed sensor_data
  console.log('Seeding sensor_data...');
  const { error: sensErr } = await supabase.from('sensor_data').upsert([
    {
      id: 'p0000000-0000-0000-0000-000000000001',
      node_id: 'PI5-NODE-01',
      sensor_1_status: true,
      sensor_2_status: true,
      sensor_3_status: false,
      sensor_1_counter: 150,
      sensor_2_counter: 142,
      sensor_3_counter: 0,
      timestamp: ago(1),
    },
    {
      id: 'p0000000-0000-0000-0000-000000000002',
      node_id: 'PI5-NODE-01',
      sensor_1_status: true,
      sensor_2_status: true,
      sensor_3_status: true,
      sensor_1_counter: 152,
      sensor_2_counter: 144,
      sensor_3_counter: 6,
      timestamp: ago(0),
    }
  ], { onConflict: 'id' });
  if (sensErr) console.error('  ❌ Sensor data:', sensErr.message);
  else console.log('  ✅ Sensor data seeded');

  // Summary
  console.log('\n=== Verification ===');
  const checks = [
    ['electronic_cards', 'id'],
    ['losses', 'id'],
    ['production_performance', 'id'],
  ];
  for (const [table, sel] of checks) {
    const { data, error } = await supabase.from(table).select(sel).limit(20);
    if (error) console.log(`  ❌ ${table}: ${error.message}`);
    else console.log(`  ✅ ${table}: ${data.length} rows`);
  }

  console.log('\n🎉 Done seeding active DB!');
}

run().catch(console.error);
