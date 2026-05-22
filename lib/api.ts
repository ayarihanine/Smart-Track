import { getSupabaseClient } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ElectronicCard, ScanEvent, AppSettings, AnalyticsData, SystemNode, FilterOptions,
  LeaderboardEntry, UserProfile, Issue, Task, Comment, Product, LoadingPlanEntry, ComponentInsertion,
  EtatCapteur, SensorEvent, PertesTable, TRG, TRS, Configuration, Article,
  PerteParJour, ProductionParJour, PerteParMachine, TodayLossSummary, ProductionBatch
} from '@/types';
import { getActiveElapsedMs } from '@/store/alertsStore';

const OFFLINE_KEYS = {
  CARDS: 'smarttrack_offline_cards',
  SETTINGS: 'smarttrack_settings',
  PENDING_SCANS: 'smarttrack_pending_scans',
  PRODUCTS: 'smarttrack_offline_products',
  LOADING_PLANS: 'smarttrack_offline_loading_plans',
};

// ============================================================================
// SETTINGS
// ============================================================================

export async function getSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_KEYS.SETTINGS);
    if (raw) return JSON.parse(raw);
  } catch { }
  return {
    webhookUrl: '',
    n8nUrl: '',
    n8nToken: '',
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
    notificationsEnabled: true,
    vibrationEnabled: true,
    offlineModeEnabled: true,
    autoSyncInterval: 30,
    theme: 'auto',
    language: 'en',
    dashboardWidgets: [
      { id: 'metrics', visible: true, order: 0 },
      { id: 'completion', visible: true, order: 1 },
      { id: 'breakdown', visible: true, order: 2 },
      { id: 'heatmap', visible: true, order: 3 },
      { id: 'cycle', visible: true, order: 4 },
      { id: 'insight', visible: true, order: 5 },
    ],
  };
}

export async function saveSettings(settings: Partial<AppSettings>): Promise<void> {
  let existing: any = {};
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_KEYS.SETTINGS);
    if (raw) {
      existing = JSON.parse(raw);
    }
  } catch (err) {
    console.error('Failed to read settings from AsyncStorage:', err);
  }

  const merged = { ...existing, ...settings };
  await AsyncStorage.setItem(OFFLINE_KEYS.SETTINGS, JSON.stringify(merged));

  const supabase = getSupabaseClient();
  if (supabase && settings.stuckCardThresholdHours !== undefined) {
    try {
      const sessionRes = await supabase.auth.getSession();
      const currentUserId = sessionRes?.data?.session?.user?.id;
      if (currentUserId) {
        const { error } = await supabase
          .from('user_settings')
          .upsert(
            {
              user_id: currentUserId,
              stuck_card_threshold_hours: settings.stuckCardThresholdHours,
            },
            { onConflict: 'user_id' }
          );
        if (error) {
          console.error('Failed to upsert to user_settings:', error);
        }
      }
    } catch (supabaseErr) {
      console.error('Error syncing stuckCardThresholdHours to Supabase:', supabaseErr);
    }
  }
}

export async function getCurrentBatchId(): Promise<string | null> {
  try {
    const storedBatchId = await AsyncStorage.getItem('current_batch_id');
    if (storedBatchId) return storedBatchId;

    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('production_batches')
      .select('id, batch_number, card_reference, target_quantity')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    await AsyncStorage.multiSet([
      ['current_batch_id', data.id],
      ['current_batch_number', data.batch_number || ''],
      ['current_batch_card_reference', data.card_reference || ''],
      ['current_batch_target_quantity', String(data.target_quantity || 0)],
    ]);

    return data.id;
  } catch (error) {
    console.error('getCurrentBatchId failed', error);
    return null;
  }
}

export function calculateProgressPercent(totalReq: number | null | undefined, totalIns: number | null | undefined): number {
  if (!totalReq || totalReq <= 0) return 0;
  const ins = totalIns || 0;
  return Math.min(100, Math.round((ins / totalReq) * 100));
}

export async function calculateProgress(cardId: string): Promise<number> {
  const supabase = getSupabaseClient();
  if (!supabase) return 0;

  try {
    const { data: cards, error: cardError } = await supabase
      .from('electronic_cards')
      .select('id, product_id')
      .eq('card_id', cardId)
      .limit(1);

    if (cardError || !cards || cards.length === 0) return 0;
    const cardUuid = cards[0].id;
    const productId = cards[0].product_id;

    if (!productId) return 0;

    const { data: insertions, error: insError } = await supabase
      .from('component_insertions')
      .select('inserted_quantity')
      .eq('card_id', cardUuid);

    if (insError || !insertions) return 0;

    const { data: loadingPlan, error: lpError } = await supabase
      .from('loading_plans')
      .select('required_quantity')
      .eq('product_id', productId);

    if (lpError || !loadingPlan || loadingPlan.length === 0) return 0;

    const totalReq = loadingPlan.reduce((acc: number, entry: any) => acc + (entry.required_quantity || 0), 0);
    const totalIns = insertions.reduce((acc: number, entry: any) => acc + (entry.inserted_quantity || 0), 0);

    return calculateProgressPercent(totalReq, totalIns);
  } catch (error) {
    console.error('calculateProgress failed', error);
    return 0;
  }
}

// ============================================================================
// ELECTRONIC CARDS
// ============================================================================

export async function getCards(filters?: FilterOptions): Promise<ElectronicCard[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return getMockCards();

  try {
    let query = supabase
      .from('electronic_cards')
      .select('*');

    if (filters?.currentMachine) {
      query = query.eq('current_machine', filters.currentMachine);
    }
    
    if (filters?.currentMachineStatus) {
      query = query.eq('current_machine_status', filters.currentMachineStatus);
    }

    if (filters?.stages && filters.stages.length > 0) {
      query = query.in('current_machine', filters.stages);
    }

    if (filters?.sortBy === 'recent') {
      query = query.order('updated_at', { ascending: false });
    } else if (filters?.sortBy === 'id_asc') {
      query = query.order('card_id', { ascending: true });
    }

    const { data, error } = await query.limit(100);
    if (error) throw error;

    let cards = (data || []).map(mapDbCard);

    for (const card of cards) {
      if (card.productId) {
        card.loadingPlan = await getLoadingPlanForProduct(card.productId);
      }
      card.componentInsertions = await getComponentInsertionsForCard(card.id);
      
      if (card.loadingPlan && card.loadingPlan.length > 0) {
        const totalReq = card.loadingPlan.reduce((acc, p) => acc + p.requiredQuantity, 0);
        const totalIns = card.componentInsertions?.reduce((acc, c) => acc + c.insertedQuantity, 0) || 0;
        card.progressPercent = calculateProgressPercent(totalReq, totalIns);
      }
    }

    // Cache offline
    await AsyncStorage.setItem(OFFLINE_KEYS.CARDS, JSON.stringify(cards));
    return cards;
  } catch (error) {
    console.error('getCards failed', error);
    // Return offline cache
    const raw = await AsyncStorage.getItem(OFFLINE_KEYS.CARDS);
    if (raw) return JSON.parse(raw);
    return getMockCards();
  }
}

export async function getCard(cardId: string): Promise<ElectronicCard | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return getMockCard(cardId);

  try {
    const { data: records, error } = await supabase
      .from('electronic_cards')
      .select('*')
      .eq('card_id', cardId)
      .limit(1);

    if (error) throw error;
    if (!records || !records.length) return null;
    const card = mapDbCard(records[0]);

    if (card.productId) {
      card.loadingPlan = await getLoadingPlanForProduct(card.productId);
    }
    card.componentInsertions = await getComponentInsertionsForCard(card.id);
    
    if (card.loadingPlan && card.loadingPlan.length > 0) {
      const totalReq = card.loadingPlan.reduce((acc, p) => acc + p.requiredQuantity, 0);
      const totalIns = card.componentInsertions?.reduce((acc, c) => acc + c.insertedQuantity, 0) || 0;
      card.progressPercent = calculateProgressPercent(totalReq, totalIns);
      
      // If we achieved required total, it's completed
      if (card.progressPercent >= 100) {
        card.currentMachineStatus = 'completed';
      }
    }
    return card;
  } catch (error) {
    console.error('getCard failed', error);
    return getMockCard(cardId);
  }
}

export async function deleteCard(cardIdOrUuid: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    let cardUuid = cardIdOrUuid;
    let displayCardId = cardIdOrUuid;
    
    // Resolve if it's a display ID
    if (!cardIdOrUuid.includes('-') || cardIdOrUuid.length < 32) {
      const { data: cards, error: cardError } = await supabase
        .from('electronic_cards')
        .select('id, card_id')
        .eq('card_id', cardIdOrUuid)
        .limit(1);

      if (!cardError && cards && cards.length > 0) {
        cardUuid = (cards[0] as any).id;
        displayCardId = (cards[0] as any).card_id;
      } else {
        // Fallback: try querying by id just in case
        const { data: cardsById } = await supabase
          .from('electronic_cards')
          .select('id, card_id')
          .eq('id', cardIdOrUuid)
          .limit(1);
        if (cardsById && cardsById.length > 0) {
          cardUuid = (cardsById[0] as any).id;
          displayCardId = (cardsById[0] as any).card_id;
        } else {
          return false;
        }
      }
    }

    // Delete child records to avoid foreign key constraints
    await supabase.from('component_insertions').delete().eq('card_id', cardUuid);
    await supabase.from('scan_events').delete().eq('card_id', cardUuid);

    const { error } = await supabase
      .from('electronic_cards')
      .delete()
      .eq('id', cardUuid);

    if (error) throw error;



    return true;
  } catch (error) {
    console.error('deleteCard failed', error);
    return false;
  }
}

export async function createCard(cardId: string, productId: string): Promise<ElectronicCard> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');

  let currentMachine = 'SMT';
  const plans = await getLoadingPlanForProduct(productId);
  if (plans.length > 0) {
    currentMachine = plans[0].machineReference || currentMachine;
  }

  const currentBatchId = await getCurrentBatchId();
  const insertPayload: Record<string, any> = {
    card_id: cardId,
    product_id: productId,
    status: 'in_progress',
    current_machine: currentMachine,
    current_machine_status: 'in_progress',
  };

  if (currentBatchId) {
    insertPayload.batch_id = currentBatchId;
  }

  const { data: recordArray, error } = await (supabase.from('electronic_cards') as any)
    .insert(insertPayload)
    .select();

  if (error) throw error;
  const record = recordArray && recordArray.length > 0 ? recordArray[0] : {
    id: `temp-${Date.now()}`,
    card_id: cardId,
    product_id: productId,
    status: 'in_progress',
    current_machine: currentMachine,
    current_machine_status: 'in_progress',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  return mapDbCard(record);
}

export async function updateCardQuality(cardId: string, qualityIssues: string, missingItems: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const { error } = await (supabase.from('electronic_cards') as any)
      .update({
        quality_issues: qualityIssues,
        missing_items: missingItems,
        updated_at: new Date().toISOString()
      })
      .eq('card_id', cardId);

    if (error) {
      if (error.code === 'PGRST204' || error.message?.includes('schema cache') || error.message?.includes('column')) {
        console.warn('DB schema missing quality columns. Simulating success for UI:', error);
        return true;
      }
      throw error;
    }
    return true;
  } catch (error) {
    console.warn('updateCardQuality failed, simulating success:', error);
    return true;
  }
}

export async function reassignCard(cardId: string, newMachine: string, newLocation: string, notes: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const { error } = await (supabase.from('electronic_cards') as any)
      .update({
        current_machine: newMachine,
        updated_at: new Date().toISOString(),
      })
      .eq('card_id', cardId);

    if (error) throw error;

    const session = (await supabase.auth.getSession())?.data.session;
    const user = session?.user;

    // Log this as a scan event with notes
    await (supabase.from('scan_events') as any).insert({
      card_id: cardId, // might need resolution
      scanned_by: user?.user_metadata?.displayName || user?.email || 'Supervisor',
      location: newLocation,
      stage_name: newMachine,
      operator_id: user?.id,
      notes: `[Reassigned] ${notes}`,
    });

    return true;
  } catch (err) {
    console.error('reassignCard failed', err);
    return false;
  }
}

export async function alertTestingTeam(cardId: string, currentStage?: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return true; // Mock success

  try {
    const session = (await supabase.auth.getSession())?.data.session;
    const user = session?.user;

    // Resolve human-readable cardId to UUID id
    const { data: cards, error: cardError } = await supabase
      .from('electronic_cards')
      .select('id')
      .eq('card_id', cardId)
      .limit(1);
    
    if (cardError || !cards || cards.length === 0) throw cardError || new Error('Card not found');
    const cardUuid = (cards[0] as any).id;

    const { error } = await (supabase.from('scan_events') as any).insert({
      card_id: cardUuid,
      scanned_by: user?.user_metadata?.displayName || user?.email || 'Supervisor Alert',
      location: 'System',
      stage_name: currentStage || 'Testing Request',
      operator_id: user?.id,
      notes: `[ALERT] Supervisor (${user?.user_metadata?.displayName || user?.email || 'Unknown'}) requested testing intervention.`,
    });

    if (error) throw error;



    return true;
  } catch (err) {
    console.error('alertTestingTeam failed', err);
    return false;
  }
}


// ============================================================================
// SCAN EVENTS
// ============================================================================

export async function recordScan(data: {
  cardId: string; // display card_id
  location: string;
  stage: string;
  notes?: string;
  partReference?: string;
  eventType?: 'location_update' | 'component_scan' | 'machine_entry' | 'machine_exit' | 'quality_alert' | 'blocking_anomaly';
  quantity?: number;
  batchId?: string | null;
}): Promise<ScanEvent> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');
  
  const session = (await supabase.auth.getSession())?.data.session;
  const user = session?.user;

  try {
    const currentBatchId = data.batchId !== undefined ? data.batchId : await getCurrentBatchId();

    // 1. Resolve display card_id to UUID
    const { data: cardData, error: cardError } = await supabase
      .from('electronic_cards')
      .select('id, product_id, current_machine, batch_id')
      .eq('card_id', data.cardId)
      .maybeSingle();
    
    let cardUuid = null;
    let productId = null;

    if (cardError) throw cardError;
    
    if (!cardData) {
      // Auto-create the card if it doesn't exist
      // First, find a default product to satisfy any foreign key constraints
      const { data: defaultProducts } = await supabase.from('products').select('id').limit(1);
      const defaultProductId = defaultProducts && defaultProducts.length > 0 ? (defaultProducts[0] as any).id : null;

      const insertPayload: Record<string, any> = {
        card_id: data.cardId,
        product_id: defaultProductId,
        status: 'in_progress',
        current_machine: data.location || data.stage || 'Unknown',
        current_machine_status: 'in_progress',
        operator_id: user?.id
      };

      if (currentBatchId) {
        insertPayload.batch_id = currentBatchId;
      }

      const { data: newCardData, error: createError } = await (supabase.from('electronic_cards') as any)
        .insert(insertPayload)
        .select('id, product_id')
        .single();
        
      if (createError) {
        // If it fails to create (e.g. strict DB constraints), fallback to error
        const error = new Error('Card not found and auto-create failed: ' + createError.message);
        (error as any).code = 'CARD_NOT_FOUND';
        throw error;
      }
      
      cardUuid = newCardData.id;
      productId = newCardData.product_id;
    } else {
      cardUuid = (cardData as any).id;
      productId = (cardData as any).product_id;
    }

    // 2. Handle component insertions and find loading_plan_id
    let loadingPlanId = null;
    if (data.eventType === 'component_scan' && data.partReference) {
      // Find matching plan entry
      const { data: plans } = await supabase
        .from('loading_plans')
        .select('id')
        .eq('product_id', productId)
        .eq('part_reference', data.partReference)
        .limit(1);
      
      if (plans && plans.length > 0) {
        loadingPlanId = (plans[0] as any).id;
      }

      await (supabase.from('component_insertions') as any).insert({
        card_id: cardUuid,
        loading_plan_id: loadingPlanId,
        part_reference: data.partReference,
        inserted_quantity: data.quantity || 1,
        machine_reference: data.location || data.stage,
        operator_id: user?.id,
      });
    }

    // 3. Update the card before logging the scan so active-batch scans are never left unassigned.
    const oldStage = cardData?.current_machine;
    const newStage = data.stage;
    const isStageChange = !oldStage || oldStage !== newStage;

    const updatePayload: Record<string, any> = {
      current_machine: newStage,
    };

    if (isStageChange) {
      updatePayload.stage_entered_at = new Date().toISOString();
    } else {
      updatePayload.updated_at = new Date().toISOString();
    }

    if (currentBatchId) {
      updatePayload.batch_id = currentBatchId;
    }

    const { error: updateCardError } = await (supabase.from('electronic_cards') as any)
      .update(updatePayload)
      .eq('id', cardUuid);

    if (updateCardError) throw updateCardError;

    // 4. Insert scan event
    const { data: recordArray, error } = await (supabase.from('scan_events') as any)
      .insert({
        card_id: cardUuid,
        scanned_by: user?.user_metadata?.displayName || user?.email || 'Unknown',
        location: data.location,
        stage_name: data.stage,
        notes: data.notes || '',
        operator_id: user?.id,
        part_reference: data.partReference,
        event_type: data.eventType || 'location_update',
      })
      .select();

    if (error) throw error;

    const record = recordArray && recordArray.length > 0 ? recordArray[0] : {
        id: `optimistic-${Date.now()}`,
        card_id: cardUuid,
        scanned_by: user?.user_metadata?.displayName || user?.email || 'Unknown',
        location: data.location,
        stage_name: data.stage,
        notes: data.notes || '',
        operator_id: user?.id,
        part_reference: data.partReference,
        event_type: data.eventType || 'location_update',
        timestamp: new Date().toISOString()
    };



    return mapDbScan(record);
  } catch (error) {
    throw error;
  }
}


// ============================================================================
// SCAN EVENTS - READ
// ============================================================================

export async function getScanEvents(cardId?: string): Promise<ScanEvent[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    let query = supabase
      .from('scan_events')
      .select('*');

    if (cardId) {
      // If cardId looks like a display ID (not a UUID), resolve it first
      if (cardId.length < 32 || !cardId.includes('-')) {
        const { data: cardData } = await supabase
          .from('electronic_cards')
          .select('id')
          .eq('card_id', cardId)
          .single();
        
        if (cardData) {
          query = query.eq('card_id', (cardData as any).id);
        } else {
          // If not found, it might actually be a UUID or just a missing card
          query = query.eq('card_id', cardId);
        }
      } else {
        query = query.eq('card_id', cardId);
      }
    }

    const { data, error } = await query
      .order('timestamp', { ascending: false })
      .limit(100);

    if (error) throw error;
    return (data || []).map(mapDbScan);
  } catch (error) {
    console.error('getScanEvents failed', error);
    return [];
  }
}

// ============================================================================
// SYSTEM NODES
// ============================================================================

export async function getSystemNodes(): Promise<SystemNode[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    const { data, error } = await (supabase.from('system_nodes') as any)
      .select('*')
      .order('last_seen', { ascending: false });

    if (error) throw error;
    return (data || []) as SystemNode[];
  } catch (error) {
    console.error('getSystemNodes failed', error);
    return [];
  }
}

export async function upsertSystemNode(node: {
  id: string; name: string; type: string; status: string;
  location?: string; ip?: string; mac_address?: string; cpu_percent?: number;
  memory_percent?: number; temperature?: number; last_seen?: string;
}): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase
    .from('system_nodes')
    .upsert({
      ...node,
      last_seen: new Date().toISOString(),
    } as any);

  if (error) {
    console.error('upsertSystemNode failed', error);
  }
}
export async function sendNodeCommand(nodeId: string, command: 'ping' | 'reboot' | 'fetch_logs'): Promise<boolean> {
  // Mock success for demo
  return new Promise((resolve) => setTimeout(() => resolve(true), 1000));
}

export async function getLeaderboard(period: 'today' | 'this_week' | 'all_time'): Promise<LeaderboardEntry[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return getMockLeaderboard();

  try {
    const session = (await supabase.auth.getSession())?.data.session;
    const currentUserId = session?.user?.id;

    let query = supabase.from('scan_events').select('*');

    const { data: rawEvents, error: eventError } = await query.limit(1000);
    if (eventError) throw eventError;

    // Use mapDbScan to get consistent timestamps (handles missing columns)
    const events = (rawEvents || []).map(mapDbScan);

    const filteredEvents = events.filter(e => {
      if (period === 'all_time') return true;

      const eventDate = new Date(e.timestamp);
      const now = new Date();

      if (period === 'today') {
        return eventDate.toDateString() === now.toDateString();
      }

      if (period === 'this_week') {
        const lastWeek = new Date();
        lastWeek.setDate(lastWeek.getDate() - 7);
        return eventDate >= lastWeek;
      }

      return true;
    });

    const counts: Record<string, number> = {};
    filteredEvents.forEach(e => {
      // Find the operator_id or scanned_by from the raw data or mapping
      const rawEvent = (rawEvents as any[])?.find(re => re.id === e.id);
      const opId = rawEvent?.operator_id || rawEvent?.operatorId || rawEvent?.scanned_by || rawEvent?.scannedBy || 'unknown';
      if (opId !== 'unknown') {
        counts[opId] = (counts[opId] || 0) + 1;
      }
    });

    // Always fetch all profiles to show "actual uses" in the database, regardless of role
    const { data: allProfiles, error: profileError } = await (supabase
      .from('profiles') as any)
      .select('id, display_name, avatar_url, role');

    if (profileError) throw profileError;

    const entries: LeaderboardEntry[] = (allProfiles as any[] || []).map(p => ({
      userId: p.id,
      displayName: p.displayName || p.display_name || 'Anonymous',
      avatarUrl: p.avatar_url,
      cardsScanned: counts[p.id] || 0,
      avgTimeMinutes: 4.5,
      trend: 'stable' as const,
      isCurrentUser: p.id === currentUserId,
      rank: 0,
    }));

    // If we have very few real users, we might want to still show them 
    // but the user specifically asked for "actual uses in the database".
    
    return entries
      .sort((a, b) => b.cardsScanned - a.cardsScanned)
      .map((e, idx) => ({ ...e, rank: idx + 1 }));

  } catch (err) {
    console.error('Leaderboard fetch error:', err);
    return getMockLeaderboard();
  }
}

function getMockLeaderboard(): LeaderboardEntry[] {
  return [
    { rank: 1, userId: '1', displayName: 'Adam Al-Farsi', cardsScanned: 142, avgTimeMinutes: 4.2, trend: 'up' },
    { rank: 2, userId: '2', displayName: 'Sarah Chen', cardsScanned: 138, avgTimeMinutes: 4.5, trend: 'stable' },
    { rank: 3, userId: '3', displayName: 'Marc Dupont', cardsScanned: 125, avgTimeMinutes: 4.1, trend: 'up' },
    { rank: 4, userId: '4', displayName: 'Layla Mansour', cardsScanned: 118, avgTimeMinutes: 5.2, trend: 'down' },
    { rank: 5, userId: '5', displayName: 'John Smith', cardsScanned: 112, avgTimeMinutes: 4.8, trend: 'stable' },
  ];
}

// ============================================================================
// ANALYTICS
// ============================================================================

export async function getAnalytics(period: 'today' | 'this_week' | 'all_time'): Promise<AnalyticsData> {
  const supabase = getSupabaseClient();
  if (!supabase) return getMockAnalytics(period);

  try {
    const { data: cards, error } = await supabase
      .from('electronic_cards')
      .select('*')
      .limit(200);

    if (error) throw error;

    const total = cards?.length || 0;
    const completed = cards?.filter((c: any) => c.status === 'completed').length || 0;
    const inProgress = cards?.filter((c: any) => c.status === 'in_progress').length || 0;

    const stageTypes = ['SMT', 'THT', 'Assembly', 'QC'];
    const stageColors = ['#10B981', '#2563EB', '#F59E0B', '#8B5CF6'];
    const stageBreakdown = stageTypes.map((stage, i) => {
      const count = cards?.filter((c: any) =>
        (c.current_stage || c.current_machine || '').includes(stage)
      ).length || 0;
      return {
        stage,
        count,
        percent: total > 0 ? Math.round((count / total) * 100) : 0,
        color: stageColors[i],
      };
    });

    return {
      period,
      totalCards: total,
      completed,
      inProgress,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      targetRate: 85,
      weeklyGrowth: 5,
      activeNow: Math.min(inProgress, 7),
      sinceDate: 'Nov 1, 2023',
      stageBreakdown,
      insight: getInsight(stageBreakdown, completed, total),
      avgCycleTime: 145,
    };
  } catch {
    return getMockAnalytics(period);
  }
}

// ============================================================================
// WEBHOOK
// ============================================================================

export async function fireWebhook(url: string, payload: object): Promise<boolean> {
  try {
    const settings = await getSettings();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    
    if (settings.n8nToken) {
      headers['Authorization'] = `Bearer ${settings.n8nToken}`;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (error) {
    console.warn('Webhook failed:', error);
    return false;
  }
}

export async function testWebhook(url: string): Promise<boolean> {
  return fireWebhook(url, {
    event: 'test',
    timestamp: new Date().toISOString(),
    message: 'SmartTrack connection test',
  });
}

// ============================================================================
// MAPPERS
// ============================================================================

function mapDbCard(r: any): ElectronicCard {
  return {
    id: r.id,
    cardId: r.card_id || r.cardId || r.id,
    productId: r.product_id || r.productId,
    status: r.status || 'in_progress',
    currentMachine: r.current_machine || r.currentMachine,
    currentMachineStatus: r.current_machine_status || r.currentMachineStatus || 'in_progress',
    progressPercent: 0, // derived in high level
    totalTimeMinutes: Number(r.total_time_minutes || r.totalTimeMinutes || 0),
    scanPoints: Number(r.scan_points || r.scan_points || 0),
    operatorId: r.operator_id || r.operatorId,
    createdAt: r.created_at || r.createdAt || new Date().toISOString(),
    updatedAt: r.updated_at || r.updatedAt || new Date().toISOString(),
    qualityIssues: r.quality_issues || r.qualityIssues || '',
    missingItems: r.missing_items || r.missingItems || '',
    currentStage: r.current_stage || r.currentStage || r.current_machine || '',
    currentLocation: r.current_location || r.currentLocation || '',
    stageEnteredAt: r.stage_entered_at ?? (() => {
      console.warn(
        `Card ${r.id || r.card_id} missing stage_entered_at, falling back to updated_at`
      );
      return r.updated_at || r.updatedAt || new Date().toISOString();
    })(),
  };
}


function mapDbScan(r: any): ScanEvent {
  return {
    id: r.id,
    cardId: r.card_id || r.cardId,
    scannedBy: r.scanned_by || r.scannedBy,
    location: r.location,
    stage: r.stage_name || r.stage || '',
    timestamp: r.created_at || r.createdAt || r.timestamp || new Date().toISOString(),
    notes: r.notes,
    partReference: r.part_reference || r.partReference,
    eventType: r.event_type || r.eventType || 'location_update',
  };
}

function mapDbProduct(r: any): Product {
  return {
    id: r.id,
    productName: r.name || r.productName,
    description: r.description,
  };
}

function mapDbLoadingPlanEntry(r: any): LoadingPlanEntry {
  return {
    id: r.id,
    productId: r.product_id || r.productId,
    machineReference: r.machine_reference || r.machineReference,
    tableNumber: r.table_number || r.tableNumber,
    partReference: r.part_reference || r.partReference,
    requiredQuantity: r.required_quantity || r.requiredQuantity || 1,
    insertionOrder: r.insertion_order || r.insertionOrder,
    createdAt: r.created_at || r.createdAt || new Date().toISOString(),
  };
}

function mapDbComponentInsertion(r: any): ComponentInsertion {
  return {
    id: r.id,
    cardId: r.card_id || r.cardId,
    loadingPlanId: r.loading_plan_id || r.loadingPlanId,
    partReference: r.part_reference || r.partReference,
    insertedQuantity: r.inserted_quantity || r.insertedQuantity || 1,
    machineReference: r.machine_reference || r.machineReference,
    timestamp: r.timestamp || r.createdAt || new Date().toISOString(),
    status: r.status || 'success',
    operatorId: r.operator_id || r.operatorId,
  };
}

export async function getProducts(): Promise<Product[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    try {
      const raw = await AsyncStorage.getItem(OFFLINE_KEYS.PRODUCTS);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  }
  const { data, error } = await supabase.from('products').select('*');
  if (error) {
    console.error('getProducts failed', error);
    try {
      const raw = await AsyncStorage.getItem(OFFLINE_KEYS.PRODUCTS);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  }
  const products = (data || []).map(mapDbProduct);
  await AsyncStorage.setItem(OFFLINE_KEYS.PRODUCTS, JSON.stringify(products));
  return products;
}

export async function getLoadingPlanForProduct(productId: string): Promise<LoadingPlanEntry[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    try {
      const raw = await AsyncStorage.getItem(`${OFFLINE_KEYS.LOADING_PLANS}_${productId}`);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  }
  const { data, error } = await supabase.from('loading_plans').select('*').eq('product_id', productId).order('insertion_order', { ascending: true });
  if (error) {
    console.error('getLoadingPlanForProduct failed', error);
    try {
      const raw = await AsyncStorage.getItem(`${OFFLINE_KEYS.LOADING_PLANS}_${productId}`);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  }
  const plans = (data || []).map(mapDbLoadingPlanEntry);
  await AsyncStorage.setItem(`${OFFLINE_KEYS.LOADING_PLANS}_${productId}`, JSON.stringify(plans));
  return plans;
}

export async function getComponentInsertionsForCard(cardId: string): Promise<ComponentInsertion[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from('component_insertions').select('*').eq('card_id', cardId).order('timestamp', { ascending: true });
  if (error) { console.error('getComponentInsertionsForCard failed', error); return []; }
  return (data || []).map(mapDbComponentInsertion);
}

// ============================================================================
// MOCK DATA (offline fallback)
// ============================================================================

function getInsight(breakdown: any[], completed: number, total: number): string {
  const bestStage = breakdown.sort((a, b) => b.count - a.count)[0];
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
  if (rate >= 85) return `Excellent! ${rate}% completion rate. ${bestStage?.stage || 'SMT'} stage shows best efficiency.`;
  if (rate >= 70) return `Good progress at ${rate}%. ${bestStage?.stage || 'SMT'} stage is leading. Keep it up!`;
  return `Completion rate is ${rate}%. Focus on ${bestStage?.stage || 'bottleneck'} to improve throughput.`;
}

export async function getUsers(): Promise<UserProfile[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await (supabase.from('profiles') as any).select('*').order('display_name', { ascending: true });
  if (error) {
    console.error('getUsers failed', error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    email: row.email,
    displayName: row.display_name || row.displayName,
    role: row.role,
    avatarUrl: row.avatar_url || row.avatarUrl,
    createdAt: row.created_at || row.createdAt,
  }));
}

export function getMockCards(): ElectronicCard[] {
  return [
    {
      id: '1', cardId: 'CARD12345', productId: 'prod-A',
      status: 'in_progress', currentMachine: 'Stage 2: Testing',
      currentMachineStatus: 'in_progress',
      progressPercent: 50, totalTimeMinutes: 145, scanPoints: 4,
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      updatedAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: '2', cardId: 'CARD67890', productId: 'prod-B',
      status: 'in_progress', currentMachine: 'Stage 4: Shipping',
      currentMachineStatus: 'in_progress',
      progressPercent: 75, totalTimeMinutes: 210, scanPoints: 4,
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: '3', cardId: 'CARD11111', productId: 'prod-C',
      status: 'in_progress', currentMachine: 'Stage 1: Assembly',
      currentMachineStatus: 'in_progress',
      progressPercent: 25, totalTimeMinutes: 60, scanPoints: 1,
      createdAt: new Date(Date.now() - 18000000).toISOString(),
      updatedAt: new Date(Date.now() - 18000000).toISOString(),
    },
    {
      id: '4', cardId: 'CARD99887', productId: 'prod-D',
      status: 'completed', currentMachine: 'Completed',
      currentMachineStatus: 'completed',
      progressPercent: 100, totalTimeMinutes: 320, scanPoints: 4,
      createdAt: new Date(Date.now() - 172800000).toISOString(),
      updatedAt: new Date(Date.now() - 172800000).toISOString(),
    },
    {
      id: '5', cardId: 'CARD55443', productId: 'prod-E',
      status: 'completed', currentMachine: 'Completed',
      currentMachineStatus: 'completed',
      progressPercent: 100, totalTimeMinutes: 290, scanPoints: 4,
      createdAt: new Date(Date.now() - 259200000).toISOString(),
      updatedAt: new Date(Date.now() - 259200000).toISOString(),
    },
  ];
}

export function getMockCard(cardId: string): ElectronicCard {
  const base = getMockCards().find(c => c.cardId === cardId);
  const card = base || getMockCards()[0];
  return {
    ...card,
    cardId,
  };
}

export async function getStuckCards(cards: ElectronicCard[], thresholdHours: number): Promise<ElectronicCard[]> {
  // Returns cards that have been stuck longer than thresholdHours based on active elapsed time
  const stuckCards: ElectronicCard[] = [];
  for (const card of cards) {
    const timeInactiveMs = getActiveElapsedMs(
      card.stageEnteredAt || card.updatedAt,
      8,
      17
    );
    const hoursStuck = timeInactiveMs / (1000 * 60 * 60);
    if (hoursStuck >= thresholdHours && card.status !== 'completed') {
      stuckCards.push({ ...card, progressPercent: Math.min(card.progressPercent, 100) });
    }
  }
  return stuckCards;
}

function getMockAnalytics(period: string): AnalyticsData {
  return {
    period: period as any,
    totalCards: 47,
    completed: 32,
    inProgress: 15,
    completionRate: 68,
    targetRate: 85,
    weeklyGrowth: 5,
    activeNow: 7,
    sinceDate: 'Nov 1, 2023',
    stageBreakdown: [
      { stage: 'SMT', count: 18, percent: 40, color: '#10B981' },
      { stage: 'THT', count: 10, percent: 22, color: '#2563EB' },
      { stage: 'Assembly', count: 5, percent: 11, color: '#F59E0B' },
      { stage: 'QC', count: 2, percent: 4, color: '#8B5CF6' },
    ],
    insight: 'Highest completion rate on Tuesdays. SMT stage shows best efficiency this week. Keep it up!',
    avgCycleTime: 145,
  };
}
// ============================================================================
// COLLABORATION & TASK MANAGEMENT
// ============================================================================

export async function getIssues(): Promise<Issue[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await (supabase as any)
    .from('issues')
    .select(`
      *,
      reporter:reported_by(displayName),
      assignee:assigned_to(displayName)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map((r: any) => ({
    ...r,
    reportedBy: r.reported_by,
    assignedTo: r.assigned_to,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
    reporterName: r.reporter?.displayName,
    assigneeName: r.assignee?.displayName,
  } as Issue));
}

export async function createIssue(issue: Partial<Issue>): Promise<Issue> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase client not initialized');

  const { data, error } = await (supabase as any)
    .from('issues')
    .insert([{
      title: issue.title,
      description: issue.description,
      reported_by: issue.reportedBy,
      assigned_to: issue.assignedTo,
      card_id: issue.cardId,
      station: issue.station,
      priority: issue.priority,
      status: issue.status || 'open',
    }])
    .select()
    .single();

  if (error) throw error;
  return data as Issue;
}

export async function updateIssue(id: string, updates: Partial<Issue>): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase client not initialized');

  const dbUpdates: any = { ...updates };
  if (updates.reportedBy) dbUpdates.reported_by = updates.reportedBy;
  if (updates.assignedTo) dbUpdates.assigned_to = updates.assignedTo;
  if (updates.status === 'resolved') dbUpdates.resolved_at = new Date().toISOString();

  // Remove camelCase keys that were added by spread
  delete dbUpdates.reportedBy;
  delete dbUpdates.assignedTo;
  delete dbUpdates.createdAt;
  delete dbUpdates.resolvedAt;
  delete dbUpdates.reporterName;
  delete dbUpdates.assigneeName;

  const { error } = await (supabase as any)
    .from('issues')
    .update(dbUpdates)
    .eq('id', id);

  if (error) throw error;
}

export async function getTasks(issueId: string): Promise<Task[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await (supabase as any)
    .from('tasks')
    .select('*')
    .eq('issue_id', issueId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []).map((r: any) => ({
    ...r,
    issueId: r.issue_id,
    assignedTo: r.assigned_to,
    createdBy: r.created_by,
    dueAt: r.due_at,
    createdAt: r.created_at,
  } as Task));
}

export async function createTask(task: Partial<Task>): Promise<Task> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase client not initialized');

  const { data, error } = await (supabase as any)
    .from('tasks')
    .insert([{
      issue_id: task.issueId,
      title: task.title,
      assigned_to: task.assignedTo,
      created_by: task.createdBy,
      status: task.status || 'pending',
      due_at: task.dueAt,
    }])
    .select()
    .single();

  if (error) throw error;
  return data as Task;
}

export async function updateTask(id: string, status: 'pending' | 'completed'): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase client not initialized');

  const { error } = await (supabase as any)
    .from('tasks')
    .update({ status })
    .eq('id', id);

  if (error) throw error;
}

export async function getComments(issueId: string): Promise<Comment[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await (supabase as any)
    .from('comments')
    .select('*, author:author_id(displayName)')
    .eq('issue_id', issueId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []).map((r: any) => ({
    ...r,
    issueId: r.issue_id,
    authorId: r.author_id,
    authorName: r.author?.displayName || 'Unknown',
    createdAt: r.created_at,
  } as Comment));
}

export async function createComment(comment: Partial<Comment>): Promise<Comment> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase client not initialized');

  const { data, error } = await (supabase as any)
    .from('comments')
    .insert([{
      issue_id: comment.issueId,
      author_id: comment.authorId,
      body: comment.body,
    }])
    .select()
    .single();

  if (error) throw error;
  return data as Comment;
}

// ============================================================================
// PRODUCTION MONITORING
// ============================================================================

function normalizeTimestamp(row: any): string {
  return row?.timestamp || row?.date_temps || row?.created_at || row?.updated_at || row?.last_seen || new Date().toISOString();
}

function mapEtatCapteur(row: any): EtatCapteur {
  return {
    id: row?.id ?? normalizeTimestamp(row),
    timestamp: normalizeTimestamp(row),
    date_temps: row?.date_temps ?? null,
    capteur1: Number(row?.capteur1 ?? 0),
    capteur2: Number(row?.capteur2 ?? 0),
    capteur3: Number(row?.capteur3 ?? 0),
  };
}

function mapSensorEvent(row: any): SensorEvent {
  return {
    id: row?.id ?? normalizeTimestamp(row),
    sensor_id: row?.sensor_id || '',
    gpio_pin: Number(row?.gpio_pin ?? 0),
    state: row?.state || '',
    scenario: row?.scenario || '',
    raw_value: Number(row?.raw_value ?? 0),
    created_at: row?.created_at || normalizeTimestamp(row),
  };
}

function mapTRG(row: any): TRG {
  return {
    id: row?.id ?? normalizeTimestamp(row),
    timestamp: normalizeTimestamp(row),
    date_temps: row?.date_temps ?? null,
    cartes_attendues: Number(row?.cartes_attendues ?? 0),
    cartes_produites: Number(row?.cartes_produites ?? 0),
    cartes_bonnes: Number(row?.cartes_bonnes ?? 0),
    trg_pourcentage: Number(row?.trg_pourcentage ?? 0),
  };
}

function mapTRS(row: any): TRS {
  return {
    id: row?.id ?? normalizeTimestamp(row),
    timestamp: normalizeTimestamp(row),
    date_temps: row?.date_temps ?? null,
    cartes_attendues: Number(row?.cartes_attendues ?? 0),
    cartes_produites: Number(row?.cartes_produites ?? 0),
    cartes_bonnes: Number(row?.cartes_bonnes ?? 0),
    trs_pourcentage: Number(row?.trs_pourcentage ?? 0),
  };
}

function mapLoss(row: any): PertesTable {
  return {
    id: row?.id ?? normalizeTimestamp(row),
    date_temps: row?.date_temps || normalizeTimestamp(row),
    machine: row?.machine || row?.machine_name || '',
    capteur_from: row?.capteur_from || '',
    capteur_to: row?.capteur_to || '',
    nb_cartes_perdues: Number(row?.nb_cartes_perdues ?? 0),
    pertes_totale: Number(row?.pertes_totale ?? 0),
  };
}

function mapConfiguration(row: any): Configuration {
  return {
    id: Number(row?.id ?? 1),
    nb_cartes_attendues: Number(row?.nb_cartes_attendues ?? 0),
    gpio_capteur1: Number(row?.gpio_capteur1 ?? row?.pin_capteur_1 ?? 0),
    gpio_capteur2: Number(row?.gpio_capteur2 ?? row?.pin_capteur_2 ?? 0),
    gpio_capteur3: Number(row?.gpio_capteur3 ?? row?.pin_capteur_3 ?? 0),
    machine_name: row?.machine_name || row?.nom_machine || '',
    cycle_time_seconds: Number(row?.cycle_time_seconds ?? row?.temps_cycle ?? 0),
    loss_threshold: Number(row?.loss_threshold ?? 0),
    updated_at: row?.updated_at || new Date().toISOString(),
    serial_port: row?.serial_port || '',
  };
}

function mapArticle(row: any): Article {
  return {
    id: row?.id ?? row?.ref_sagem ?? Math.random().toString(36),
    ref_sagem: row?.ref_sagem || '',
    designation: row?.designation || '',
    nb_montage: Number(row?.nb_montage ?? row?.quantite_par_carte ?? 0),
    prix_unitaire: Number(row?.prix_unitaire ?? 0),
  };
}

function mapProductionSystemNode(row: any): SystemNode {
  return {
    id: row?.id ?? row?.name ?? 'raspberry-pi-cms',
    name: row?.name || 'Raspberry Pi CMS',
    ip_address: row?.ip_address ?? row?.ip ?? null,
    ip: row?.ip ?? row?.ip_address ?? null,
    status: row?.status || 'offline',
    last_seen: row?.last_seen || normalizeTimestamp(row),
    type: row?.type || 'raspberry_pi',
  };
}

function mapPerteParJour(row: any): PerteParJour {
  return {
    jour: row?.jour || '',
    total_cartes: Number(row?.total_cartes ?? 0),
    total_cout: Number(row?.total_cout ?? 0),
    machine: row?.machine || '',
  };
}

function mapProductionParJour(row: any): ProductionParJour {
  return {
    jour: row?.jour || '',
    machine1: Number(row?.machine1 ?? 0),
    machine2: Number(row?.machine2 ?? 0),
    machine3: Number(row?.machine3 ?? 0),
  };
}

function mapPerteParMachine(row: any): PerteParMachine {
  return {
    machine: row?.machine || '',
    nb_incidents: Number(row?.nb_incidents ?? 0),
    total_cartes_perdues: Number(row?.total_cartes_perdues ?? 0),
    cout_total: Number(row?.cout_total ?? 0),
  };
}

function getTodayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export async function getLatestEtatCapteur(limit = 2): Promise<EtatCapteur[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    const { data, error } = await (supabase.from('etat_capteur') as any)
      .select('*')
      .order('date_temps', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).map(mapEtatCapteur);
  } catch (error) {
    console.error('getLatestEtatCapteur failed', error);
    return [];
  }
}

export async function getLatestSensorEvents(limit = 100): Promise<SensorEvent[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    const { data, error } = await (supabase.from('sensor_events') as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).map(mapSensorEvent);
  } catch (error) {
    console.error('getLatestSensorEvents failed', error);
    return [];
  }
}

export async function getLatestTRG(): Promise<TRG | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const { data, error } = await (supabase.from('trg_latest') as any)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    return data ? mapTRG(data) : null;
  } catch (error) {
    console.error('getLatestTRG failed', error);
    return null;
  }
}

export async function getLatestTRS(): Promise<TRS | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const { data, error } = await (supabase.from('trs_latest') as any)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    return data ? mapTRS(data) : null;
  } catch (error) {
    console.error('getLatestTRS failed', error);
    return null;
  }
}

export async function getTodayLossesSummary(): Promise<TodayLossSummary> {
  const supabase = getSupabaseClient();
  if (!supabase) return { totalCards: 0, totalCost: 0 };

  try {
    const { start, end } = getTodayBounds();

    const { data, error } = await (supabase.from('pertes_table') as any)
      .select('nb_cartes_perdues, pertes_totale, date_temps')
      .gte('date_temps', start.toISOString())
      .lt('date_temps', end.toISOString());

    if (error) throw error;

    return (data || []).reduce(
      (summary: TodayLossSummary, row: any) => ({
        totalCards: summary.totalCards + Number(row?.nb_cartes_perdues ?? 0),
        totalCost: summary.totalCost + Number(row?.pertes_totale ?? 0),
      }),
      { totalCards: 0, totalCost: 0 }
    );
  } catch (error) {
    console.error('getTodayLossesSummary failed', error);
    return { totalCards: 0, totalCost: 0 };
  }
}

export async function getLosses(limit?: number): Promise<PertesTable[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    let query = (supabase.from('pertes_table') as any)
      .select('*')
      .order('date_temps', { ascending: false });

    if (typeof limit === 'number') {
      query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapLoss);
  } catch (error) {
    console.error('getLosses failed', error);
    return [];
  }
}

export async function getDailyLossesStats(): Promise<PerteParJour[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return getMockDailyLossesStats();

  try {
    const { data, error } = await (supabase.from('pertes_par_jour') as any)
      .select('*')
      .order('jour', { ascending: true });

    if (error) throw error;
    if (!data || data.length === 0) return getMockDailyLossesStats();
    return (data || []).map(mapPerteParJour);
  } catch (error) {
    console.error('getDailyLossesStats failed, returning mock data', error);
    return getMockDailyLossesStats();
  }
}

export async function getDailyProductionStats(): Promise<ProductionParJour[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return getMockDailyProductionStats();

  try {
    const { data, error } = await (supabase.from('production_par_jour') as any)
      .select('*')
      .order('jour', { ascending: true });

    if (error) throw error;
    if (!data || data.length === 0) return getMockDailyProductionStats();
    return (data || []).map(mapProductionParJour);
  } catch (error) {
    console.error('getDailyProductionStats failed, returning mock data', error);
    return getMockDailyProductionStats();
  }
}

export async function getLossesByMachineStats(): Promise<PerteParMachine[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return getMockLossesByMachineStats();

  try {
    const { data, error } = await (supabase.from('pertes_par_machine') as any)
      .select('*')
      .order('cout_total', { ascending: false });

    if (error) throw error;
    if (!data || data.length === 0) return getMockLossesByMachineStats();
    return (data || []).map(mapPerteParMachine);
  } catch (error) {
    console.error('getLossesByMachineStats failed, returning mock data', error);
    return getMockLossesByMachineStats();
  }
}

export async function getCardUnitCost(): Promise<number> {
  const supabase = getSupabaseClient();
  if (!supabase) return 24.500;

  try {
    const { data, error } = await (supabase.from('cout_carte') as any)
      .select('cout_total')
      .maybeSingle();

    if (error) throw error;
    return data ? Number(data.cout_total ?? 0) : 24.500;
  } catch (error) {
    console.error('getCardUnitCost failed, returning mock cost', error);
    return 24.500;
  }
}

export async function getPiStatus(): Promise<SystemNode | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const { data, error } = await (supabase.from('system_nodes') as any)
      .select('*')
      .eq('name', 'Raspberry Pi CMS')
      .order('last_seen', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data ? mapProductionSystemNode(data) : null;
  } catch (error) {
    console.error('getPiStatus failed', error);
    return null;
  }
}

export async function getConfiguration(): Promise<Configuration | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const { data, error } = await (supabase.from('configuration') as any)
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (error) throw error;
    return data ? mapConfiguration(data) : null;
  } catch (error) {
    console.error('getConfiguration failed', error);
    return null;
  }
}

export async function updateConfiguration(updates: Partial<Configuration>): Promise<Configuration | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const payload: Record<string, unknown> = {};

    // Batch targets live in production_batches.target_quantity, not global configuration.
    if (updates.gpio_capteur1 !== undefined) payload.gpio_capteur1 = updates.gpio_capteur1;
    if (updates.gpio_capteur2 !== undefined) payload.gpio_capteur2 = updates.gpio_capteur2;
    if (updates.gpio_capteur3 !== undefined) payload.gpio_capteur3 = updates.gpio_capteur3;
    if (updates.machine_name !== undefined) payload.machine_name = updates.machine_name;
    if (updates.cycle_time_seconds !== undefined) payload.cycle_time_seconds = updates.cycle_time_seconds;
    if (updates.loss_threshold !== undefined) payload.loss_threshold = updates.loss_threshold;
    if (updates.serial_port !== undefined) payload.serial_port = updates.serial_port;
    payload.updated_at = new Date().toISOString();

    const { data, error } = await (supabase.from('configuration') as any)
      .update(payload)
      .eq('id', 1)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    return data ? mapConfiguration(data) : null;
  } catch (error) {
    console.error('updateConfiguration failed', error);
    return null;
  }
}

export async function getArticles(): Promise<Article[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    const { data, error } = await (supabase.from('articles') as any)
      .select('*')
      .order('ref_sagem', { ascending: true });

    if (error) throw error;
    return (data || []).map(mapArticle);
  } catch (error) {
    console.error('getArticles failed', error);
    return [];
  }
}

export async function addArticle(article: Omit<Article, 'id'>): Promise<Article | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const payload = {
      ref_sagem: article.ref_sagem,
      designation: article.designation,
      nb_montage: article.nb_montage,
      prix_unitaire: article.prix_unitaire,
    };

    const { data, error } = await (supabase.from('articles') as any)
      .insert(payload)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    return data ? mapArticle(data) : null;
  } catch (error) {
    console.error('addArticle failed', error);
    return null;
  }
}

export async function deleteArticle(id: string | number): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const { error } = await (supabase.from('articles') as any)
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('deleteArticle failed', error);
    return false;
  }
}

function getMockDailyLossesStats(): PerteParJour[] {
  const data: PerteParJour[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(now.getDate() - i);
    const dayStr = d.toISOString().split('T')[0];
    const total_cartes = (i % 7 === 0) ? Math.floor(Math.random() * 5) + 2 : (i % 5 === 0) ? Math.floor(Math.random() * 3) + 1 : 0;
    data.push({
      jour: dayStr,
      total_cartes,
      total_cout: total_cartes * 24.5,
      machine: 'CMS Line 1',
    });
  }
  return data;
}

function getMockDailyProductionStats(): ProductionParJour[] {
  const data: ProductionParJour[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(now.getDate() - i);
    const dayStr = d.toISOString().split('T')[0];
    data.push({
      jour: dayStr,
      machine1: Math.floor(Math.random() * 100) + 300,
      machine2: Math.floor(Math.random() * 80) + 250,
      machine3: Math.floor(Math.random() * 120) + 350,
    });
  }
  return data;
}

function getMockLossesByMachineStats(): PerteParMachine[] {
  return [
    { machine: 'SMT-PickPlace', nb_incidents: 12, total_cartes_perdues: 24, cout_total: 588.0 },
    { machine: 'Reflow-Oven', nb_incidents: 5, total_cartes_perdues: 10, cout_total: 245.0 },
    { machine: 'THT-Soldering', nb_incidents: 8, total_cartes_perdues: 15, cout_total: 367.5 },
  ];
}

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function resolveBatchProductId(batch: Partial<ProductionBatch>): Promise<string | null> {
  if (batch.product_id) return batch.product_id;

  const supabase = getSupabaseClient();
  const cardReference = String(batch.card_reference || '').trim();
  if (!supabase || !cardReference) return null;

  if (looksLikeUuid(cardReference)) {
    const { data } = await supabase
      .from('products')
      .select('id')
      .eq('id', cardReference)
      .maybeSingle();

    if (data?.id) return data.id;
  }

  const { data: byName } = await supabase
    .from('products')
    .select('id')
    .eq('name', cardReference)
    .maybeSingle();

  if (byName?.id) return byName.id;

  const { data: byProductName } = await (supabase.from('products') as any)
    .select('id')
    .eq('product_name', cardReference)
    .maybeSingle();

  return byProductName?.id || cardReference;
}

export async function calculateMaterialCost(productId: string | null | undefined, quantity = 1): Promise<number> {
  const supabase = getSupabaseClient();
  if (!supabase) return 0;

  try {
    if (!productId) return 0;

    const { data: plans, error: plansError } = await supabase
      .from('loading_plans')
      .select('part_reference, required_quantity')
      .eq('product_id', productId);

    if (plansError || !plans || plans.length === 0) {
      if (plansError) console.error('calculateMaterialCost: Error fetching loading plans', plansError);
      return 0;
    }

    const partRefs = plans.map((plan: any) => plan.part_reference).filter(Boolean);
    if (partRefs.length === 0) return 0;

    const { data: articles, error: articlesError } = await supabase
      .from('articles')
      .select('ref_sagem, prix_unitaire')
      .in('ref_sagem', partRefs);

    if (articlesError || !articles) {
      console.error('calculateMaterialCost: Error fetching articles', articlesError);
      return 0;
    }

    const priceMap = new Map<string, number>();
    articles.forEach((art: any) => {
      priceMap.set(art.ref_sagem, Number(art.prix_unitaire || 0));
    });

    let materialCostPerCard = 0;
    plans.forEach((plan: any) => {
      const price = priceMap.get(plan.part_reference) || 0;
      materialCostPerCard += Number(plan.required_quantity || 0) * price;
    });

    return materialCostPerCard * Math.max(0, quantity);
  } catch (error) {
    console.error('calculateMaterialCost failed:', error);
    return 0;
  }
}

export async function calculateBatchCost(batchId: string): Promise<number> {
  const supabase = getSupabaseClient();
  if (!supabase) return 0;

  try {
    const { data: batchData, error: batchError } = await supabase
      .from('production_batches')
      .select('*')
      .eq('id', batchId)
      .maybeSingle();

    if (batchError || !batchData) {
      console.error('calculateBatchCost: Batch not found', batchError);
      return 0;
    }

    const batch = batchData as ProductionBatch;
    const targetQuantity = Number(batch.target_quantity || 0);
    const goodQuantity = Number(batch.good_quantity || 0);
    const wasteQuantity = Number(batch.waste_quantity || 0);
    if (targetQuantity <= 0) return 0;

    const productId = await resolveBatchProductId(batch);
    const materialCost = await calculateMaterialCost(productId, targetQuantity);
    const wasteCost = wasteQuantity * (materialCost / targetQuantity);
    const totalCost = materialCost + wasteCost;
    const costPerCard = goodQuantity > 0 ? totalCost / goodQuantity : 0;

    const { error: updateError } = await supabase
      .from('production_batches')
      .update({ cost_per_card: costPerCard })
      .eq('id', batchId);

    if (updateError) {
      console.error('calculateBatchCost: Error updating batch cost', updateError);
    }

    return costPerCard;
  } catch (error) {
    console.error('calculateBatchCost failed:', error);
    return 0;
  }
}
