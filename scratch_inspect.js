const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SERVICE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  console.log('--- DB INSPECTION START ---');
  
  const tables = [
    'sensor_data',
    'losses',
    'production_performance',
    'daily_losses',
    'scan_events',
    'etat_capteur',
    'pertes_table',
    'production_batches',
    'issues',
    'production_par_jour',
    'configuration',
    'electronic_cards',
    'alerts',
    'articles'
  ];

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(20);
    if (error) {
      console.log(`Table '${table}': ERROR:`, error.message);
    } else {
      console.log(`Table '${table}': EXISTS, count=${data ? data.length : 0}, Columns:`, data && data.length > 0 ? Object.keys(data[0]) : '(empty table)');
      if (data && data.length > 0) {
        console.log(`Table '${table}' Sample:`, data[0]);
        if (table === 'pertes_table') {
          console.log('ALL pertes_table rows:', data);
        }
        if (table === 'scan_events') {
          console.log('scan_events count:', data.length);
          console.log('ALL scan_events rows:', data);
        }
      }
    }
  }

  console.log('--- DB INSPECTION END ---');
}

run();
