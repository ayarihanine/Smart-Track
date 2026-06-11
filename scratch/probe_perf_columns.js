const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function probe() {
  // Fetch one row with all columns to see exact column names
  const { data, error } = await supabase
    .from('production_performance')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log('Table is EMPTY — no rows found.');

    // Try to insert a test row to discover real column names via error messages
    const { error: insErr } = await supabase
      .from('production_performance')
      .insert({
        machine_name: '__probe__',
        OOE_percentage: 50.0,
        OEE_percentage: 50.0,
        date: new Date().toISOString().split('T')[0],
        timestamp: new Date().toISOString(),
        target_count: 0,
        actual_count: 0,
        good_count: 0,
        loss_count: 0,
      });

    if (insErr) {
      console.log('Insert with OOE_percentage/OEE_percentage error:', insErr.message);
    } else {
      console.log('Insert with OOE_percentage/OEE_percentage succeeded!');
      // Fetch back and show column names
      const { data: d2 } = await supabase.from('production_performance').select('*').limit(1);
      if (d2 && d2.length > 0) {
        console.log('Column names:', Object.keys(d2[0]));
        console.log('Row data:', JSON.stringify(d2[0], null, 2));
      }
      // Cleanup
      await supabase.from('production_performance').delete().eq('machine_name', '__probe__');
    }
  } else {
    console.log('Column names:', Object.keys(data[0]));
    console.log('Sample row:', JSON.stringify(data[0], null, 2));
  }
}

probe().catch(console.error);
