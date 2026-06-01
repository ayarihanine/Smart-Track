#!/usr/bin/env node

/**
 * Database Seed Script for Card Details Test Data
 * Run: node populate_db.js
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required');
  console.error('Make sure your .env or .env.local file has these variables set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  console.log('🚀 Starting database population...\n');

  try {
    // Prepare test data
    const testData = {
      scanEvents: [
        // CARD-2026-001: 8 scans
        { id: 'f1000000-0000-0000-0000-000000000001', card_id: 'CARD-2026-001', event_type: 'machine_entry', machine_name: 'Receiving', timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString() },
        { id: 'f1000000-0000-0000-0000-000000000002', card_id: 'CARD-2026-001', event_type: 'sensor_1_passed', machine_name: 'NPM-DX-1', timestamp: new Date(Date.now() - 3.83 * 60 * 60 * 1000).toISOString() },
        { id: 'f1000000-0000-0000-0000-000000000003', card_id: 'CARD-2026-001', event_type: 'component_scan', machine_name: 'NPM-DX-1', timestamp: new Date(Date.now() - 3.67 * 60 * 60 * 1000).toISOString() },
        { id: 'f1000000-0000-0000-0000-000000000004', card_id: 'CARD-2026-001', event_type: 'sensor_2_passed', machine_name: 'NPM-DX-1', timestamp: new Date(Date.now() - 3.33 * 60 * 60 * 1000).toISOString() },
        { id: 'f1000000-0000-0000-0000-000000000005', card_id: 'CARD-2026-001', event_type: 'machine_exit', machine_name: 'NPM-DX-1', timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() },
        { id: 'f1000000-0000-0000-0000-000000000006', card_id: 'CARD-2026-001', event_type: 'sensor_3_passed', machine_name: 'AOI-Inspection', timestamp: new Date(Date.now() - 2.75 * 60 * 60 * 1000).toISOString() },
        { id: 'f1000000-0000-0000-0000-000000000007', card_id: 'CARD-2026-001', event_type: 'quality_alert', machine_name: 'QC-Final', timestamp: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString() },
        { id: 'f1000000-0000-0000-0000-000000000008', card_id: 'CARD-2026-001', event_type: 'completed', machine_name: 'QC-Final', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
        
        // CARD-2026-002: 5 scans
        { id: 'f1000000-0000-0000-0000-000000000010', card_id: 'CARD-2026-002', event_type: 'machine_entry', machine_name: 'Receiving', timestamp: new Date(Date.now() - 3.5 * 60 * 60 * 1000).toISOString() },
        { id: 'f1000000-0000-0000-0000-000000000011', card_id: 'CARD-2026-002', event_type: 'sensor_1_passed', machine_name: 'NPM-DX-1', timestamp: new Date(Date.now() - 3.33 * 60 * 60 * 1000).toISOString() },
        { id: 'f1000000-0000-0000-0000-000000000012', card_id: 'CARD-2026-002', event_type: 'component_scan', machine_name: 'NPM-DX-1', timestamp: new Date(Date.now() - 3.17 * 60 * 60 * 1000).toISOString() },
        { id: 'f1000000-0000-0000-0000-000000000013', card_id: 'CARD-2026-002', event_type: 'sensor_2_passed', machine_name: 'NPM-DX-1', timestamp: new Date(Date.now() - 2.83 * 60 * 60 * 1000).toISOString() },
        { id: 'f1000000-0000-0000-0000-000000000014', card_id: 'CARD-2026-002', event_type: 'machine_exit', machine_name: 'NPM-DX-1', timestamp: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString() },
        
        // CARD-2026-003: 4 scans
        { id: 'f1000000-0000-0000-0000-000000000020', card_id: 'CARD-2026-003', event_type: 'machine_entry', machine_name: 'Receiving', timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() },
        { id: 'f1000000-0000-0000-0000-000000000021', card_id: 'CARD-2026-003', event_type: 'sensor_1_passed', machine_name: 'THT-Wave', timestamp: new Date(Date.now() - 2.75 * 60 * 60 * 1000).toISOString() },
        { id: 'f1000000-0000-0000-0000-000000000022', card_id: 'CARD-2026-003', event_type: 'component_scan', machine_name: 'THT-Wave', timestamp: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString() },
        { id: 'f1000000-0000-0000-0000-000000000023', card_id: 'CARD-2026-003', event_type: 'completed', machine_name: 'Packaging', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
        
        // CARD-2026-004: 5 scans
        { id: 'f1000000-0000-0000-0000-000000000030', card_id: 'CARD-2026-004', event_type: 'machine_entry', machine_name: 'Receiving', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
        { id: 'f1000000-0000-0000-0000-000000000031', card_id: 'CARD-2026-004', event_type: 'sensor_1_passed', machine_name: 'NPM-DX-1', timestamp: new Date(Date.now() - 1.83 * 60 * 60 * 1000).toISOString() },
        { id: 'f1000000-0000-0000-0000-000000000032', card_id: 'CARD-2026-004', event_type: 'machine_exit', machine_name: 'NPM-DX-1', timestamp: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString() },
        { id: 'f1000000-0000-0000-0000-000000000033', card_id: 'CARD-2026-004', event_type: 'sensor_2_passed', machine_name: 'AOI-Inspection', timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
        { id: 'f1000000-0000-0000-0000-000000000034', card_id: 'CARD-2026-004', event_type: 'component_scan', machine_name: 'AOI-Inspection', timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString() },
      ],
      productionHistory: [
        // CARD-2026-001
        { id: 'p1000000-0000-0000-0000-000000000001', card_id: 'CARD-2026-001', event_type: 'scan_entered', machine_name: 'Receiving', station: 'Receiving', metadata: JSON.stringify({ scannedBy: 'Ahmed', badgeId: 'EMP001' }), created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString() },
        { id: 'p1000000-0000-0000-0000-000000000002', card_id: 'CARD-2026-001', event_type: 'machine_placed', machine_name: 'NPM-DX-1', station: 'SMT-PickPlace', metadata: JSON.stringify({ operator: 'Ahmed', feederConfig: '12-slot' }), created_at: new Date(Date.now() - 3.83 * 60 * 60 * 1000).toISOString() },
        { id: 'p1000000-0000-0000-0000-000000000003', card_id: 'CARD-2026-001', event_type: 'component_scan', machine_name: 'NPM-DX-1', station: 'SMT-PickPlace', metadata: JSON.stringify({ parts: ['IC-7805', 'CAP-100nF'], count: 24 }), created_at: new Date(Date.now() - 3.67 * 60 * 60 * 1000).toISOString() },
        { id: 'p1000000-0000-0000-0000-000000000004', card_id: 'CARD-2026-001', event_type: 'machine_exit', machine_name: 'NPM-DX-1', station: 'NPM-DX-1', metadata: JSON.stringify({ cycleTime: 3000, status: 'success' }), created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() },
        { id: 'p1000000-0000-0000-0000-000000000005', card_id: 'CARD-2026-001', event_type: 'stage_transition', machine_name: 'Reflow-Oven', station: 'Reflow-Oven', metadata: JSON.stringify({ from: 'SMT-PickPlace', to: 'Reflow-Oven', duration: '50min' }), created_at: new Date(Date.now() - 2.83 * 60 * 60 * 1000).toISOString() },
        { id: 'p1000000-0000-0000-0000-000000000006', card_id: 'CARD-2026-001', event_type: 'machine_placed', machine_name: 'AOI-Inspection', station: 'AOI', metadata: JSON.stringify({ operator: 'Sarra', inspectionMode: 'full' }), created_at: new Date(Date.now() - 2.75 * 60 * 60 * 1000).toISOString() },
        { id: 'p1000000-0000-0000-0000-000000000007', card_id: 'CARD-2026-001', event_type: 'quality_check', machine_name: 'QC-Final', station: 'QC-Station-1', metadata: JSON.stringify({ result: 'pass', defects: 0, notes: 'All components verified' }), created_at: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString() },
        { id: 'p1000000-0000-0000-0000-000000000008', card_id: 'CARD-2026-001', event_type: 'completed', machine_name: 'QC-Final', station: 'Packaging', metadata: JSON.stringify({ packingMethod: 'standard', weight: 150, notes: 'Ready for shipment' }), created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
        
        // CARD-2026-002
        { id: 'p1000000-0000-0000-0000-000000000010', card_id: 'CARD-2026-002', event_type: 'scan_entered', machine_name: 'Receiving', station: 'Receiving', metadata: JSON.stringify({ scannedBy: 'Sarra', badgeId: 'EMP002' }), created_at: new Date(Date.now() - 3.5 * 60 * 60 * 1000).toISOString() },
        { id: 'p1000000-0000-0000-0000-000000000011', card_id: 'CARD-2026-002', event_type: 'machine_placed', machine_name: 'NPM-DX-1', station: 'SMT-PickPlace', metadata: JSON.stringify({ operator: 'Sarra', feederConfig: '12-slot' }), created_at: new Date(Date.now() - 3.33 * 60 * 60 * 1000).toISOString() },
        { id: 'p1000000-0000-0000-0000-000000000012', card_id: 'CARD-2026-002', event_type: 'component_scan', machine_name: 'NPM-DX-1', station: 'SMT-PickPlace', metadata: JSON.stringify({ parts: ['IC-7805', 'RES-1k'], count: 32 }), created_at: new Date(Date.now() - 3.17 * 60 * 60 * 1000).toISOString() },
        { id: 'p1000000-0000-0000-0000-000000000013', card_id: 'CARD-2026-002', event_type: 'stage_transition', machine_name: 'Reflow-Oven', station: 'Reflow-Oven', metadata: JSON.stringify({ from: 'SMT-PickPlace', to: 'Reflow-Oven', duration: '55min' }), created_at: new Date(Date.now() - 2.83 * 60 * 60 * 1000).toISOString() },
        { id: 'p1000000-0000-0000-0000-000000000014', card_id: 'CARD-2026-002', event_type: 'machine_placed', machine_name: 'Reflow-Oven', station: 'Reflow-Oven', metadata: JSON.stringify({ operator: 'Ahmed', profileName: 'standard', temp: '260C' }), created_at: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString() },
        
        // CARD-2026-003
        { id: 'p1000000-0000-0000-0000-000000000020', card_id: 'CARD-2026-003', event_type: 'scan_entered', machine_name: 'Receiving', station: 'Receiving', metadata: JSON.stringify({ scannedBy: 'Ahmed', badgeId: 'EMP001' }), created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() },
        { id: 'p1000000-0000-0000-0000-000000000021', card_id: 'CARD-2026-003', event_type: 'machine_placed', machine_name: 'THT-Wave', station: 'Wave-Soldering', metadata: JSON.stringify({ operator: 'Sarra', tempProfile: '300C' }), created_at: new Date(Date.now() - 2.75 * 60 * 60 * 1000).toISOString() },
        { id: 'p1000000-0000-0000-0000-000000000022', card_id: 'CARD-2026-003', event_type: 'machine_exit', machine_name: 'THT-Wave', station: 'Wave-Soldering', metadata: JSON.stringify({ cycleTime: 2000, status: 'success' }), created_at: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString() },
        { id: 'p1000000-0000-0000-0000-000000000023', card_id: 'CARD-2026-003', event_type: 'completed', machine_name: 'Packaging', station: 'Packaging', metadata: JSON.stringify({ result: 'pass', defects: 0 }), created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
        
        // CARD-2026-004
        { id: 'p1000000-0000-0000-0000-000000000030', card_id: 'CARD-2026-004', event_type: 'scan_entered', machine_name: 'Receiving', station: 'Receiving', metadata: JSON.stringify({ scannedBy: 'Sarra', badgeId: 'EMP002' }), created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
        { id: 'p1000000-0000-0000-0000-000000000031', card_id: 'CARD-2026-004', event_type: 'machine_placed', machine_name: 'NPM-DX-1', station: 'SMT-PickPlace', metadata: JSON.stringify({ operator: 'Ahmed', feederConfig: '12-slot' }), created_at: new Date(Date.now() - 1.83 * 60 * 60 * 1000).toISOString() },
        { id: 'p1000000-0000-0000-0000-000000000032', card_id: 'CARD-2026-004', event_type: 'component_scan', machine_name: 'NPM-DX-1', station: 'SMT-PickPlace', metadata: JSON.stringify({ parts: ['IC-7805'], count: 50 }), created_at: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString() },
        { id: 'p1000000-0000-0000-0000-000000000033', card_id: 'CARD-2026-004', event_type: 'stage_transition', machine_name: 'AOI-Inspection', station: 'AOI-Inspection', metadata: JSON.stringify({ from: 'NPM-DX-1', to: 'AOI-Inspection', duration: '60min' }), created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
        { id: 'p1000000-0000-0000-0000-000000000034', card_id: 'CARD-2026-004', event_type: 'quality_check', machine_name: 'AOI-Inspection', station: 'AOI-Inspection', metadata: JSON.stringify({ operator: 'Sarra', defectsFound: 0, notes: 'In progress' }), created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString() },
      ],
    };

    // Insert sensor events
    console.log('📝 Inserting sensor events...');
    const { error: scanError } = await supabase
      .from('sensor_events')
      .upsert(testData.scanEvents, { onConflict: 'id' });

    if (scanError) {
      console.error('❌ Error inserting sensor events:', scanError);
      throw scanError;
    }
    console.log('✅ Sensor events inserted successfully');

    // Insert production history
    console.log('\n📝 Inserting production history...');
    const { error: historyError } = await supabase
      .from('production_history')
      .upsert(testData.productionHistory, { onConflict: 'id' });

    if (historyError) {
      console.error('❌ Error inserting production history:', historyError);
      throw historyError;
    }
    console.log('✅ Production history inserted successfully');

    console.log('\n🎉 Database population completed!');
    console.log('\nTest cards:');
    console.log('  - CARD-2026-001 (8 scans, completed)');
    console.log('  - CARD-2026-002 (5 scans, in progress)');
    console.log('  - CARD-2026-003 (4 scans, completed)');
    console.log('  - CARD-2026-004 (5 scans, in progress)');
    console.log('\nYou can now view the card details page with populated production history!');

  } catch (error) {
    console.error('\n❌ Database population failed:', error.message);
    process.exit(1);
  }
}

main();
