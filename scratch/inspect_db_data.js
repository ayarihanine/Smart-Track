const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SERVICE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function run() {
  console.log('--- SUPABASE DATA ---');

  // 1. Configuration
  const { data: config } = await supabase.from('configuration').select('*');
  console.log('Configuration rows:', config);

  // 2. Latest 5 Sensor Data
  const { data: sensors } = await supabase.from('sensor_data').select('*').order('timestamp', { ascending: false }).limit(5);
  console.log('Latest Sensor Data rows:', sensors);

  // 3. Latest 5 Production Performance
  const { data: performance } = await supabase.from('production_performance').select('*').order('timestamp', { ascending: false }).limit(5);
  console.log('Latest Production Performance rows:', performance);

  // 4. Latest 5 Losses
  const { data: losses } = await supabase.from('losses').select('*').order('created_at', { ascending: false }).limit(5);
  console.log('Latest Losses rows:', losses);
}

run();
