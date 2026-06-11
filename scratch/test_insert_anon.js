const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testInserts() {
  console.log('--- Testing inserts with valid UUIDs ---');

  // Test electronic_cards insert
  const cardTest = {
    id: 'e0000000-0000-0000-0000-111111111111',
    card_id: 'CARD-TEST-RLS',
    status: 'in_progress',
    current_machine: 'NPM-DX-1',
    current_machine_status: 'in_progress',
    stage_entered_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const cardRes = await supabase.from('electronic_cards').insert([cardTest]);
  console.log('electronic_cards insert result:', {
    error: cardRes.error ? cardRes.error.message : 'SUCCESS',
    code: cardRes.error ? cardRes.error.code : null
  });

  // Test configuration insert
  const configTest = {
    id: 'd0000000-0000-0000-0000-111111111111',
    machine_name: 'TEST-MACHINE',
    expected_cards: 100,
    cycle_time_seconds: 45,
    loss_threshold: 3,
  };
  const configRes = await supabase.from('configuration').insert([configTest]);
  console.log('configuration insert result:', {
    error: configRes.error ? configRes.error.message : 'SUCCESS',
    code: configRes.error ? configRes.error.code : null
  });

  // Test sensor_data insert
  const sensorTest = {
    id: 'a0000000-0000-0000-0000-111111111111',
    node_id: 'PI5-NODE-01',
    sensor_1_status: true,
    sensor_2_status: true,
    sensor_3_status: true,
    sensor_1_counter: 10,
    sensor_2_counter: 10,
    sensor_3_counter: 10,
    timestamp: new Date().toISOString(),
  };
  const sensorRes = await supabase.from('sensor_data').insert([sensorTest]);
  console.log('sensor_data insert result:', {
    error: sensorRes.error ? sensorRes.error.message : 'SUCCESS',
    code: sensorRes.error ? sensorRes.error.code : null
  });

  // Test production_performance insert
  const perfTest = {
    id: 'b0000000-0000-0000-0000-111111111111',
    machine_name: 'NPM-DX-1',
    target_count: 100,
    actual_count: 95,
    good_count: 92,
    loss_count: 5,
    trg_percentage: 95.0,
    trs_percentage: 92.0,
    date: new Date().toISOString().split('T')[0],
  };
  const perfRes = await supabase.from('production_performance').insert([perfTest]);
  console.log('production_performance insert result:', {
    error: perfRes.error ? perfRes.error.message : 'SUCCESS',
    code: perfRes.error ? perfRes.error.code : null
  });

  // Test losses insert
  const lossTest = {
    id: 'c0000000-0000-0000-0000-111111111111',
    machine_name: 'NPM-DX-1',
    loss_count: 3,
    cost_tnd: 12.5,
    reason: 'RLS TEST',
    loss_zone: 'Zone 1',
  };
  const lossRes = await supabase.from('losses').insert([lossTest]);
  console.log('losses insert result:', {
    error: lossRes.error ? lossRes.error.message : 'SUCCESS',
    code: lossRes.error ? lossRes.error.code : null
  });
}

testInserts();
