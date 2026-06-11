const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function seed() {
  const cards = [
    {
      id: 'e0000000-0000-0000-0000-000000000001',
      card_id: 'CARD-2026-001',
      status: 'completed',
      current_machine: 'NPM-DX-1',
      current_machine_status: 'completed',
      stage_entered_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      product_id: null
    },
    {
      id: 'e0000000-0000-0000-0000-000000000002',
      card_id: 'CARD-2026-002',
      status: 'in_progress',
      current_machine: 'NPM-DX-1',
      current_machine_status: 'in_progress',
      stage_entered_at: new Date(Date.now() - 3.5 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 3.5 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString(),
      product_id: null
    },
    {
      id: 'e0000000-0000-0000-0000-000000000003',
      card_id: 'CARD-2026-003',
      status: 'completed',
      current_machine: 'THT-Wave',
      current_machine_status: 'completed',
      stage_entered_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      product_id: null
    },
    {
      id: 'e0000000-0000-0000-0000-000000000004',
      card_id: 'CARD-2026-004',
      status: 'in_progress',
      current_machine: 'AOI-Inspection',
      current_machine_status: 'in_progress',
      stage_entered_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      product_id: null
    },
    {
      id: 'e0000000-0000-0000-0000-000000000005',
      card_id: 'CARD-2026-005',
      status: 'in_progress',
      current_machine: 'SMT-PickPlace',
      current_machine_status: 'in_progress',
      stage_entered_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      product_id: null
    },
    {
      id: 'e0000000-0000-0000-0000-000000000006',
      card_id: 'CARD-2026-006',
      status: 'on_hold',
      current_machine: 'THT-Wave',
      current_machine_status: 'blocked',
      stage_entered_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      product_id: null
    },
    {
      id: 'e0000000-0000-0000-0000-000000000009',
      card_id: 'CARD-2026-009',
      status: 'on_hold',
      current_machine: 'SMT-PickPlace',
      current_machine_status: 'blocked',
      stage_entered_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      product_id: null
    },
    {
      id: 'e0000000-0000-0000-0000-000000000007',
      card_id: 'CARD-2026-007',
      status: 'cancelled',
      current_machine: 'QC-Final',
      current_machine_status: 'blocked',
      stage_entered_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      product_id: null
    },
    {
      id: 'e0000000-0000-0000-0000-000000000008',
      card_id: 'CARD-2026-008',
      status: 'removed',
      current_machine: 'Receiving',
      current_machine_status: 'blocked',
      stage_entered_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      product_id: null
    }
  ];

  console.log('Inserting electronic_cards...');
  const { data, error } = await supabase
    .from('electronic_cards')
    .upsert(cards, { onConflict: 'id' });

  if (error) {
    console.error('Failed to seed electronic_cards:', error.message);
  } else {
    console.log('Successfully seeded electronic_cards!');
  }
}

seed();
