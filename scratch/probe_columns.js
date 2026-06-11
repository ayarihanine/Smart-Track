#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');

const SUPABASE_URL = 'https://phcgnjbjvffzurcnbmnl.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoY2duamJqdmZmenVyY25ibW5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MTE5ODYsImV4cCI6MjA5NTQ4Nzk4Nn0.6PMQntoQqip6Xa8rWR5hDC3vnfILsPLPi75i_8zQuj4';

const supabase = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const now = new Date();
const ago = (min) => new Date(now.getTime() - min * 60 * 1000).toISOString();
const today = now.toISOString().split('T')[0];

async function probeInsert(table, row) {
  console.log(`\n--- ${table} ---`);
  const { data, error } = await supabase.from(table).insert(row).select('*');
  if (error) {
    console.log(`  ❌ ${error.message}`);
    return null;
  }
  const cols = Object.keys(data[0]);
  console.log(`  ✅ Columns: ${cols.join(', ')}`);
  console.log(`  Sample: ${JSON.stringify(data[0]).slice(0, 250)}`);
  // Cleanup probe row
  const pkVal = data[0].id || data[0].card_id;
  if (data[0].id) await supabase.from(table).delete().eq('id', data[0].id);
  return cols;
}

async function run() {
  console.log('=== Probing column schemas (correct Supabase project) ===\n');

  // Probe electronic_cards — omit id to let DB auto-generate
  await probeInsert('electronic_cards', {
    card_id: '__PROBE__',
    status: 'in_progress',
    created_at: ago(1),
    updated_at: ago(1),
  });

  // Probe articles
  await probeInsert('articles', {
    reference: '__PROBE__',
  });

  // Probe losses
  await probeInsert('losses', {
    machine_name: '__PROBE__',
    loss_count: 0,
    cost_tnd: 0,
    created_at: ago(1),
  });

  // Probe production_performance
  await probeInsert('production_performance', {
    machine_name: '__PROBE__',
    target_count: 1,
    actual_count: 1,
    good_count: 1,
    loss_count: 0,
    trg_percentage: 100,
    trs_percentage: 100,
    date: today,
  });

  // Probe configuration
  await probeInsert('configuration', {
    machine_name: '__PROBE__',
  });

  // Probe sensor_data
  await probeInsert('sensor_data', {
    node_id: '__PROBE__',
    sensor_1_status: false,
    sensor_2_status: false,
    sensor_3_status: false,
    sensor_1_counter: 0,
    sensor_2_counter: 0,
    sensor_3_counter: 0,
    timestamp: ago(1),
  });

  console.log('\n=== Done ===');
}

run().catch(console.error);
