const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
  const lp = await supabase.from('loading_plans').select('*');
  console.log('loading_plans SELECT result:', {
    dataLength: lp.data ? lp.data.length : null,
    data: lp.data,
    error: lp.error ? lp.error.message : null
  });

  const ci = await supabase.from('component_insertions').select('*');
  console.log('component_insertions SELECT result:', {
    dataLength: ci.data ? ci.data.length : null,
    data: ci.data,
    error: ci.error ? ci.error.message : null
  });
}

check();
