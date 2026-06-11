const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function getTodayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

async function verifyDashboardQueries() {
  console.log('\n--- VERIFYING DASHBOARD PAGE QUERIES ---');
  const { start, end } = getTodayBounds();

  // 1. fetchConfiguration
  const configRes = await supabase
    .from('configuration')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  console.log('1. configuration query:', {
    success: !configRes.error,
    data: configRes.data,
    error: configRes.error ? configRes.error.message : null
  });

  // 2. sensor_data query
  const sensorRes = await supabase
    .from('sensor_data')
    .select('sensor_1_status, sensor_1_counter, sensor_2_status, sensor_2_counter, sensor_3_status, sensor_3_counter, timestamp')
    .order('timestamp', { ascending: false })
    .limit(1)
    .maybeSingle();
  console.log('2. sensor_data query:', {
    success: !sensorRes.error,
    data: sensorRes.data,
    error: sensorRes.error ? sensorRes.error.message : null
  });

  // 3. electronic_cards query (today's cards)
  const cardsRes = await supabase
    .from('electronic_cards')
    .select('status')
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString());
  console.log('3. electronic_cards (today\'s bounds) query:', {
    success: !cardsRes.error,
    count: cardsRes.data ? cardsRes.data.length : null,
    error: cardsRes.error ? cardsRes.error.message : null
  });

  // 4. production_performance query (latest)
  const perfRes = await supabase
    .from('production_performance')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(1)
    .maybeSingle();
  console.log('4. production_performance (latest) query:', {
    success: !perfRes.error,
    data: perfRes.data,
    error: perfRes.error ? perfRes.error.message : null
  });

  // 5. active cards hook query
  const activeCardsRes = await supabase
    .from('electronic_cards')
    .select('*')
    .in('status', ['in_progress', 'on_hold'])
    .order('updated_at', { ascending: false });
  console.log('5. active cards query:', {
    success: !activeCardsRes.error,
    count: activeCardsRes.data ? activeCardsRes.data.length : null,
    error: activeCardsRes.error ? activeCardsRes.error.message : null
  });

  // 6. today\'s losses query
  const todayLossesRes = await supabase
    .from('losses')
    .select('id, cost_tnd')
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString());
  console.log('6. today\'s losses query:', {
    success: !todayLossesRes.error,
    count: todayLossesRes.data ? todayLossesRes.data.length : null,
    error: todayLossesRes.error ? todayLossesRes.error.message : null
  });
}

async function verifyStatisticsQueries() {
  console.log('\n--- VERIFYING STATISTICS PAGE QUERIES ---');

  // 1. daily_losses query (from view)
  const dailyLossesRes = await supabase
    .from('daily_losses')
    .select('day, total_cards, total_cost')
    .order('day', { ascending: true });
  console.log('1. daily_losses (view) query:', {
    success: !dailyLossesRes.error,
    count: dailyLossesRes.data ? dailyLossesRes.data.length : null,
    sample: dailyLossesRes.data && dailyLossesRes.data.length > 0 ? dailyLossesRes.data[0] : null,
    error: dailyLossesRes.error ? dailyLossesRes.error.message : null
  });

  // 2. production_performance history query
  const perfHistRes = await supabase
    .from('production_performance')
    .select('date, actual_count, OOE_percentage, OEE_percentage, timestamp')
    .order('timestamp', { ascending: false })
    .limit(20);
  console.log('2. production_performance (history) query:', {
    success: !perfHistRes.error,
    count: perfHistRes.data ? perfHistRes.data.length : null,
    sample: perfHistRes.data && perfHistRes.data.length > 0 ? perfHistRes.data[0] : null,
    error: perfHistRes.error ? perfHistRes.error.message : null
  });
}

async function runAll() {
  try {
    await verifyDashboardQueries();
    await verifyStatisticsQueries();
  } catch (err) {
    console.error('Unexpected error running checks:', err);
  }
}

runAll();
