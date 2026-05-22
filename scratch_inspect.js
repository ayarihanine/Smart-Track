const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gtjjxfwlixcrfniwvnzu.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0amp4ZndsaXhjcmZuaXd2bnp1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTg3MzkwNSwiZXhwIjoyMDg3NDQ5OTA1fQ.jqYF3PW0qGmhwzrNW1DidOH8aABt_5vU0_wXKinZT9g';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  const { data, error } = await supabase.from('electronic_cards').select('*').limit(1);
  if (error) {
    console.error('Error fetching card:', error);
  } else {
    console.log('Columns:', data && data.length > 0 ? Object.keys(data[0]) : 'No data in table');
    console.log('Sample Row:', data && data.length > 0 ? data[0] : 'None');
  }
}

run();
