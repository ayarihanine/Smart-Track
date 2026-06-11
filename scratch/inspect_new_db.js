#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://phcgnjbjvffzurcnbmnl.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoY2duamJqdmZmenVyY25ibW5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MTE5ODYsImV4cCI6MjA5NTQ4Nzk4Nn0.6PMQntoQqip6Xa8rWR5hDC3vnfILsPLPi75i_8zQuj4';

const supabase = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const TABLES = [
  'electronic_cards',
  'losses',
  'production_performance',
  'daily_losses',
  'articles',
  'configuration',
  'sensor_data',
  'sensor_events',
  'alerts',
  'profiles',
  'loss_root_causes',
  'production_history',
];

async function run() {
  console.log(`=== Inspecting: ${SUPABASE_URL} ===\n`);

  for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select('*').limit(3);
    if (error) {
      console.log(`❌  ${table}: ${error.message}`);
    } else {
      const cols = data && data.length > 0 ? Object.keys(data[0]).join(', ') : '(empty)';
      console.log(`✅  ${table} [${data.length} rows] → ${cols}`);
      if (data && data.length > 0) {
        console.log(`    Sample:`, JSON.stringify(data[0]).slice(0, 200));
      }
    }
  }
  console.log('\n=== Done ===');
}

run().catch(console.error);
