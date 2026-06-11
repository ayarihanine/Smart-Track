const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspect() {
  const tables = ['profiles', 'articles', 'configuration', 'electronic_cards', 'sensor_events', 'production_history', 'losses', 'loss_root_causes', 'alerts', 'production_performance', 'daily_reports', 'sensor_data', 'loading_plans', 'component_insertions'];
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    console.log(`Table ${table}: count = ${count}, error = ${error ? error.message : 'none'}`);
  }
}

inspect();
