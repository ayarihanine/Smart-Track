const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

const candidates = [
  'in_progress', 'completed', 'blocked', 'on_hold', 'pending',
  'cancelled', 'removed', 'active', 'paused', 'failed', 'error',
  'processing', 'done', 'rejected', 'held',
];

async function probe() {
  console.log('Probing allowed status values for electronic_cards...\n');
  const allowed = [], blocked = [];
  for (const status of candidates) {
    const id = `ee000000-0000-0000-0000-${String(candidates.indexOf(status) + 1).padStart(12, '0')}`;
    const { error } = await supabase.from('electronic_cards').insert([{
      id, card_id: `PROBE-${status}`, status,
      current_machine: 'TEST', current_machine_status: 'TEST',
      stage_entered_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }]);
    if (!error) {
      allowed.push(status);
      await supabase.from('electronic_cards').delete().eq('id', id);
    } else if (error.message.includes('check constraint')) {
      blocked.push(status);
    } else {
      // Other error (FK, RLS, etc.) means status itself was accepted
      allowed.push(`${status} (other err: ${error.code})`);
    }
  }
  console.log('✅ Allowed statuses:', allowed);
  console.log('❌ Rejected by check:', blocked);
}
probe();
