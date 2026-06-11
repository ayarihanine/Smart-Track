const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  const email = `test_seeder_${Date.now()}@example.com`;
  const password = 'TestPassword123!';

  console.log('Signing up user:', email);
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        displayName: 'Seeder User',
        role: 'admin',
      }
    }
  });

  if (authError) {
    console.error('Sign up failed:', authError.message);
    return;
  }

  console.log('Sign up successful, user ID:', authData.user.id);

  // Let's query loading_plans and component_insertions
  const lp = await supabase.from('loading_plans').select('*');
  console.log('loading_plans SELECT result:', {
    dataLength: lp.data ? lp.data.length : null,
    error: lp.error ? lp.error.message : null
  });

  const ci = await supabase.from('component_insertions').select('*');
  console.log('component_insertions SELECT result:', {
    dataLength: ci.data ? ci.data.length : null,
    error: ci.error ? ci.error.message : null
  });
}

run();
