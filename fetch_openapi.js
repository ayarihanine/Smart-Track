require('dotenv').config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

async function run() {
  const url = `${SUPABASE_URL}/rest/v1/`;
  console.log('Fetching OpenAPI spec from:', url);
  const response = await fetch(url, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    }
  });

  if (!response.ok) {
    console.error('Failed to fetch:', response.statusText);
    return;
  }

  const spec = await response.json();
  console.log('Paths exposed in schema:');
  const paths = Object.keys(spec.paths);
  paths.forEach(p => {
    console.log('  ', p);
  });
}

run();
