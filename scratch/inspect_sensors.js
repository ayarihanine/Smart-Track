const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gtjjxfwlixcrfniwvnzu.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0amp4ZndsaXhjcmZuaXd2bnp1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTg3MzkwNSwiZXhwIjoyMDg3NDQ5OTA1fQ.jqYF3PW0qGmhwzrNW1DidOH8aABt_5vU0_wXKinZT9g';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  console.log('--- ETAT CAPTEUR ---');
  const { data: etats, error: err1 } = await supabase.from('etat_capteur').select('*').order('date_temps', { ascending: false }).limit(5);
  if (err1) console.error('Error fetching etat_capteur:', err1);
  else console.log(etats);

  console.log('--- SENSOR EVENTS ---');
  const { data: events, error: err2 } = await supabase.from('sensor_events').select('*').order('created_at', { ascending: false }).limit(5);
  if (err2) console.error('Error fetching sensor_events:', err2);
  else console.log(events);
}

run();
