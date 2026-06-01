const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Parse .env.local to get Supabase credentials
const envPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const lines = envContent.split('\n');
let supabaseUrl = '';
let supabaseKey = '';

for (const line of lines) {
  if (line.startsWith('EXPO_PUBLIC_SUPABASE_URL=')) {
    supabaseUrl = line.split('=')[1].trim();
  }
  if (line.startsWith('EXPO_PUBLIC_SUPABASE_ANON_KEY=')) {
    supabaseKey = line.split('=')[1].trim();
  }
}

console.log('Supabase URL:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const tables = [
  'articles',
  'losses',
  'production_performance',
  'configuration',
  'sensor_data',
  'trg_latest',
  'trs_latest',
  'daily_losses'
];

async function inspect() {
  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        console.error(`Error querying [${table}]:`, error.message);
      } else {
        console.log(`\nTable [${table}] columns:`, data.length > 0 ? Object.keys(data[0]) : 'Empty');
        if (data.length > 0) {
          console.log(`Sample row:`, data[0]);
        }
      }
    } catch (e) {
      console.error(`Failed to inspect [${table}]:`, e);
    }
  }
}

inspect();
