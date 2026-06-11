const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const candidateTypes = [
  'scan_entered',
  'machine_placed',
  'component_scan',
  'machine_exit',
  'stage_transition',
  'quality_check',
  'completed',
  'blocking_anomaly',
  'quality_alert',
  'sensor_1_passed',
  'sensor_2_passed',
  'sensor_3_passed',
  'machine_entry',
  
  // Additional typical event types
  'in_progress',
  'blocked',
  'on_hold',
  'pending',
  'cancelled',
  'removed',
  'start',
  'stop',
  'pause',
  'resume',
  'alert',
  'issue',
  'comment',
  'scan',
  'card_created',
  'entered',
  'exited',
  'anomaly'
];

async function checkAllowed() {
  console.log('Checking which event types are allowed by the constraint:');
  const allowed = [];
  const blocked = [];

  for (const type of candidateTypes) {
    const testRow = {
      id: 'b0000000-0000-0000-0000-1111111111' + Math.floor(Math.random() * 90 + 10),
      card_id: 'CARD-TEST-CHECK',
      event_type: type,
      machine_name: 'TEST-MACHINE',
      station: 'TEST-STATION',
      metadata: {},
      created_at: new Date().toISOString()
    };
    
    const { error } = await supabase.from('production_history').insert([testRow]);
    if (error) {
      if (error.message.includes('foreign key constraint')) {
        // Passed the event type check, but failed foreign key (which is fine, it means the event type is allowed!)
        allowed.push(type);
      } else {
        blocked.push(type);
      }
    } else {
      allowed.push(type);
      await supabase.from('production_history').delete().eq('id', testRow.id);
    }
  }

  console.log('\nAllowed event types:', allowed);
  console.log('Blocked event types:', blocked);
}

checkAllowed();
