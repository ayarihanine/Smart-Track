const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

const statuses = ['in_progress', 'completed', 'pending', 'on_hold', 'cancelled', 'removed', 'lost'];

async function checkStatuses() {
  console.log('Testing statuses against check constraint:');
  for (const status of statuses) {
    const id = 'ee000000-0000-0000-0000-' + Math.random().toString(16).substr(2, 12).padEnd(12, '0');
    const { error } = await supabase.from('electronic_cards').insert([{
      id,
      card_id: 'TEST-' + status.toUpperCase(),
      status,
      current_machine: 'NPM-DX-1',
      current_machine_status: 'in_progress',
      stage_entered_at: new Date().toISOString()
    }]);

    if (error) {
      console.log(`- '${status}': FAILED: ${error.message} (${error.code})`);
    } else {
      console.log(`- '${status}': SUCCESS!`);
      // Delete it
      await supabase.from('electronic_cards').delete().eq('id', id);
    }
  }
}

checkStatuses();
