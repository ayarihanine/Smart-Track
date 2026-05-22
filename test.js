import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl) {
  console.log("No URL");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.from('electronic_cards').insert({
    card_id: 'TEST-12345',
    status: 'in_progress',
    current_machine: 'Unknown',
    current_machine_status: 'in_progress',
    operator_id: null
  }).select('id').single();
  
  if (error) {
    console.error("ERROR:", error.message);
  } else {
    console.log("SUCCESS:", data);
  }
}
test();
