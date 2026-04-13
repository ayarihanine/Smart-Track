const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gtjjxfwlixcrfniwvnzu.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0amp4ZndsaXhjcmZuaXd2bnp1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTg3MzkwNSwiZXhwIjoyMDg3NDQ5OTA1fQ.jqYF3PW0qGmhwzrNW1DidOH8aABt_5vU0_wXKinZT9g';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  console.log('--- Starting Database Seeder ---');
  
  const cards = [
    {
      card_id: 'PRD-001-SMT',
      product_name: 'Smart Motherboard Rev C',
      status: 'in_progress',
      current_stage: 'SMT Load',
      current_location: 'Line 1 SMT',
      total_stages: 5,
      completed_stages: 2,
      progress_percent: 40,
      quality_issues: '',
      missing_items: '',
      scan_points: 3,
      total_time_minutes: 45
    },
    {
      card_id: 'PRD-002-ASM',
      product_name: 'IoT Sensor Node Base',
      status: 'completed',
      current_stage: 'Final Inspection',
      current_location: 'QC Station 4',
      total_stages: 4,
      completed_stages: 4,
      progress_percent: 100,
      quality_issues: 'Minor scratch on casing',
      missing_items: '',
      scan_points: 5,
      total_time_minutes: 180
    },
    {
      card_id: 'PRD-003-THT',
      product_name: 'Power Module Beta',
      status: 'in_progress',
      current_stage: 'Through-Hole',
      current_location: 'Station B',
      total_stages: 3,
      completed_stages: 0,
      progress_percent: 0,
      quality_issues: '',
      missing_items: 'Need capacitors 10uF',
      scan_points: 1,
      total_time_minutes: 10
    }
  ];

  console.log('Pushing Electronic Cards...');
  const { error: cardsErr, data: cardsData } = await supabase.from('electronic_cards').upsert(cards, { onConflict: 'card_id' }).select('id, card_id');
  
  if (cardsErr) {
    console.error('❌ Failed to insert cards:', cardsErr.message);
    if (cardsErr.code === 'PGRST205') {
       console.log('\nMake sure you have created the electronic_cards table first!');
    }
    return;
  }
  console.log(`✅ Loaded ${cards.length} dummy cards.`);

  if (cardsData && cardsData.length > 0) {
    const scanEvents = [];
    const stages = [];
    
    // Create history for PRD-001
    const p1 = cardsData.find(c => c.card_id === 'PRD-001-SMT');
    if (p1) {
      scanEvents.push({ card_id: p1.card_id, scanned_by: 'seed_script', location: 'Warehouse Array', stage_name: 'Inventory Scan', notes: 'Initial intake' });
      scanEvents.push({ card_id: p1.card_id, scanned_by: 'operator_john', location: 'Line 1 SMT', stage_name: 'SMT Load', notes: 'Paste applied' });
      
      stages.push({ card_id: p1.id, stage_name: 'Inventory', stage_order: 1, status: 'completed', location: 'Warehouse Array' });
      stages.push({ card_id: p1.id, stage_name: 'SMT Load', stage_order: 2, status: 'current', location: 'Line 1 SMT' });
      stages.push({ card_id: p1.id, stage_name: 'Reflow', stage_order: 3, status: 'pending' });
    }

    // Create history for PRD-002
    const p2 = cardsData.find(c => c.card_id === 'PRD-002-ASM');
    if (p2) {
      scanEvents.push({ card_id: p2.card_id, scanned_by: 'supervisor_sam', location: 'QC Station 4', stage_name: 'Final Inspection', notes: 'Approved for shipping' });
      stages.push({ card_id: p2.id, stage_name: 'Final Inspection', stage_order: 4, status: 'completed', location: 'QC Station 4' });
    }

    console.log('Pushing Events and Stages...');
    
    const { error: eventsErr } = await supabase.from('scan_events').insert(scanEvents);
    if (eventsErr) console.error('⚠️ Could not insert scan_events:', eventsErr.message);
    else console.log(`✅ Loaded ${scanEvents.length} dummy scan events.`);
    
    const { error: stagesErr } = await supabase.from('card_stages').insert(stages);
    if (stagesErr) console.error('⚠️ Could not insert card_stages:', stagesErr.message);
    else console.log(`✅ Loaded ${stages.length} dummy card stages.`);
  }

  console.log('\n🎉 Finished Seeding!');
}

main();
