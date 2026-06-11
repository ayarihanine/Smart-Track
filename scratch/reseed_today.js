#!/usr/bin/env node
/**
 * Re-seed today's data: production_performance, sensor_data, and one 'lost' card
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON_KEY     = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const now   = new Date();
const today = now.toISOString().split('T')[0];
const ago   = (min) => new Date(now.getTime() - min * 60 * 1000).toISOString();

async function run() {
  console.log(`\n=== SmartTrack Today Re-Seed (${today}) ===\n`);

  // 1. Upsert today's production_performance rows (valid hex-only UUIDs)
  console.log('1/3 Seeding production_performance for today...');
  const { error: perfErr } = await supabase
    .from('production_performance')
    .upsert([
      {
        id:              'a1000000-0000-0000-0000-000000000001',
        machine_name:    'NPM-DX-1',
        target_count:    100,
        actual_count:     95,
        good_count:       92,
        loss_count:        5,
        trg_percentage:   95.0,
        trs_percentage:   92.0,
        date:             today,
        timestamp:        ago(0),
      },
      {
        id:              'a1000000-0000-0000-0000-000000000002',
        machine_name:    'THT-Wave',
        target_count:     80,
        actual_count:     76,
        good_count:       74,
        loss_count:        4,
        trg_percentage:   95.0,
        trs_percentage:   92.5,
        date:             today,
        timestamp:        ago(1),
      },
    ], { onConflict: 'id' });

  if (perfErr) console.error('  ❌ production_performance:', perfErr.message);
  else         console.log('  ✅ production_performance seeded (OOE: 95%, OEE: 92%)');

  // 2. Upsert fresh sensor_data row (timestamp = NOW so dashboard shows "Live")
  console.log('2/3 Seeding sensor_data...');
  const { error: sensorErr } = await supabase
    .from('sensor_data')
    .upsert([
      {
        id:               'b2000000-0000-0000-0000-000000000001',
        node_id:          'PI5-NODE-01',
        sensor_1_status:  true,
        sensor_2_status:  true,
        sensor_3_status:  true,
        sensor_1_counter: 152,
        sensor_2_counter: 144,
        sensor_3_counter:   6,
        timestamp:        ago(0),
      },
    ], { onConflict: 'id' });

  if (sensorErr) console.error('  ❌ sensor_data:', sensorErr.message);
  else           console.log('  ✅ sensor_data seeded (all sensors HIGH, counters live)');

  // 3. Upsert a card with status='lost' (today's range)
  console.log('3/3 Seeding one "lost" electronic_card...');
  const { error: cardErr } = await supabase
    .from('electronic_cards')
    .upsert([
      {
        id:                     'c3000000-0000-0000-0000-000000000001',
        card_id:                'CARD-LOST-TODAY-001',
        status:                 'lost',
        current_machine:        'QC-Final',
        current_machine_status: 'in_progress',
        stage_entered_at:       ago(60),
        created_at:             ago(120),
        updated_at:             ago(30),
        product_id:             null,
      },
    ], { onConflict: 'id' });

  if (cardErr) console.error('  ❌ electronic_cards (lost):', cardErr.message);
  else         console.log('  ✅ "lost" card seeded (CARD-LOST-TODAY-001)');

  // 4. Verify
  console.log('\n=== Verification ===');
  const [perfCheck, sensorCheck, lostCheck] = await Promise.all([
    supabase.from('production_performance').select('id,date,trg_percentage,trs_percentage').eq('date', today),
    supabase.from('sensor_data').select('id,timestamp,sensor_1_counter').order('timestamp', { ascending: false }).limit(1),
    supabase.from('electronic_cards').select('card_id,status,created_at').in('status', ['lost','cancelled','removed']).order('created_at', { ascending: false }).limit(5),
  ]);

  if (perfCheck.error)   console.log('  ❌ production_performance check:', perfCheck.error.message);
  else console.log(`  ✅ production_performance today: ${perfCheck.data.length} row(s) | OOE=${perfCheck.data[0]?.trg_percentage}% OEE=${perfCheck.data[0]?.trs_percentage}%`);

  if (sensorCheck.error) console.log('  ❌ sensor_data check:', sensorCheck.error.message);
  else console.log(`  ✅ sensor_data latest: ts=${sensorCheck.data?.[0]?.timestamp}  s1_counter=${sensorCheck.data?.[0]?.sensor_1_counter}`);

  if (lostCheck.error)   console.log('  ❌ lost cards check:', lostCheck.error.message);
  else console.log(`  ✅ lost/cancelled/removed: ${lostCheck.data.length} card(s) → ${lostCheck.data.map(c => c.card_id).join(', ')}`);

  console.log('\n🎉 Done! Reload the app to see live metrics.');
}

run().catch(console.error);
