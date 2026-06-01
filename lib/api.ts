import { getSupabaseClient } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ElectronicCard, ScanEvent, AppSettings, AnalyticsData, SystemNode, FilterOptions,
  LeaderboardEntry, UserProfile, Issue, Task, Comment, Product, LoadingPlanEntry, ComponentInsertion,
  SensorDataRow, LossRow, ProductionPerformanceRow, Configuration, Article,
  TodayLossSummary, ProductionBatch, SensorData, DailyReport,
  InspectedLoss, RootCauseCategory,
} from '@/types';
import { getActiveElapsedMs } from '@/store/alertsStore';
import { getTodayBounds as sharedGetTodayBounds } from '@/lib/dates';

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
    return null;
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

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const sortBy = filters?.sortBy ?? 'recent';
    if (sortBy === 'recent') {
      query = query
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false });
    } else if (sortBy === 'oldest') {
      query = query.order('created_at', { ascending: true });
    } else if (sortBy === 'id_asc') {
      query = query.order('card_id', { ascending: true });
    } else if (sortBy === 'stage_order') {
      query = query.order('updated_at', { ascending: false });
    }

    const { data, error } = await query.limit(100);
    if (error) throw error;

    let cards = (data || []).map(mapDbCard);

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
    await supabase.from('sensor_events').delete().eq('card_id', cardUuid);

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

  const insertPayload: Record<string, any> = {
    card_id: cardId,
    product_id: productId,
    status: 'in_progress',
    current_machine: currentMachine,
    current_machine_status: 'in_progress',
  };

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
        return true;
      }
      throw error;
    }
    return true;
  } catch (error) {
    if ((error as any)?.code === 'PGRST204') return true;
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

    // Log this as a scan event (sensor_events columns: card_id TEXT FK, event_type, machine_name)
    await (supabase.from('sensor_events') as any).insert({
      card_id: cardId,
      event_type: 'machine_placed',
      machine_name: newMachine || newLocation,
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

    const { error } = await (supabase.from('sensor_events') as any).insert({
      card_id: cardId,
      event_type: 'error',
      machine_name: currentStage || 'Unknown',
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
    // 1. Resolve display card_id to UUID (case-insensitive to match frontend lookup)
    const { data: cardData, error: cardError } = await supabase
      .from('electronic_cards')
      .select('id, product_id, current_machine')
      .ilike('card_id', data.cardId)
      .maybeSingle();
    
    let cardUuid = null;
    let productId = null;
    let resolvedCard = null;

    if (cardError) throw cardError;

    resolvedCard = cardData as any;

    if (!resolvedCard) {
      // ilike missed — try exact match before auto-creating
      const { data: exactCard } = await supabase
        .from('electronic_cards')
        .select('id, product_id, current_machine')
        .eq('card_id', data.cardId)
        .maybeSingle();

      if (exactCard) {
        resolvedCard = exactCard as any;
        cardUuid = resolvedCard.id;
        productId = resolvedCard.product_id;
      } else {
        // Auto-create the card if it doesn't exist
        const { data: defaultProducts } = await supabase.from('products').select('id').limit(1);
        const defaultProductId = defaultProducts && defaultProducts.length > 0 ? (defaultProducts[0] as any).id : null;

        const insertPayload: Record<string, any> = {
          card_id: data.cardId,
          product_id: defaultProductId,
          status: 'in_progress',
          current_machine: data.location || data.stage || 'Unknown',
        };

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
      }
    } else {
      cardUuid = resolvedCard.id;
      productId = resolvedCard.product_id;
    }

    // 2. Handle component insertions (silently skip if tables don't exist)
    if (data.eventType === 'component_scan' && data.partReference) {
      try {
        await (supabase.from('component_insertions') as any).insert({
          card_id: cardUuid,
          part_reference: data.partReference,
          inserted_quantity: data.quantity || 1,
          machine_reference: data.location || data.stage,
          operator_id: user?.id,
        });
      } catch {
        // component_insertions table may not exist in this schema
      }
    }

    // 3. Update the card before logging the scan so active-batch scans are never left unassigned.
    const oldStage = resolvedCard?.current_machine;
    const newStage = data.stage;
    const isStageChange = !oldStage || oldStage !== newStage;

    const updatePayload: Record<string, any> = {
      current_machine: newStage,
      updated_at: new Date().toISOString(),
    };

    if (isStageChange) {
      updatePayload.stage_entered_at = new Date().toISOString();
    }

    const { error: updateCardError } = await (supabase.from('electronic_cards') as any)
      .update(updatePayload)
      .eq('id', cardUuid);

    if (updateCardError) throw updateCardError;

    // 4. Insert scan event (sensor_events column: card_id TEXT FK, event_type, machine_name, timestamp)
    const { data: recordArray, error } = await (supabase.from('sensor_events') as any)
      .insert({
        card_id: data.cardId,
        event_type: data.eventType || 'location_update',
        machine_name: data.location || data.stage || 'Unknown',
      })
      .select();

    if (error) throw error;

    const record = recordArray && recordArray.length > 0 ? recordArray[0] : {
        id: `optimistic-${Date.now()}`,
        card_id: data.cardId,
        event_type: data.eventType || 'location_update',
        machine_name: data.location || data.stage || 'Unknown',
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
    // First, try to get data from production_history (which has more detail)
    let historyQuery = supabase
      .from('production_history')
      .select('*');

    if (cardId) {
      historyQuery = historyQuery.eq('card_id', cardId);
    }

    const { data: historyData, error: historyError } = await historyQuery
      .order('created_at', { ascending: false })
      .limit(100);

    if (historyError) throw historyError;

    // If we have production_history, use it (more complete data)
    if (historyData && historyData.length > 0) {
      return (historyData || []).map(mapDbProductionHistoryToScanEvent);
    }

    // Fallback to sensor_events if no production_history
    let query = supabase
      .from('sensor_events')
      .select('*');

    if (cardId) {
      // If cardId looks like a display ID (not a UUID), resolve it first
      if (cardId.length < 32 || !cardId.includes('-')) {
        const { data: cardData } = await supabase
          .from('electronic_cards')
          .select('id')
          .eq('card_id', cardId)
          .maybeSingle();
        
        if (cardData) {
          // sensor_events.card_id stores the electronic_cards UUID
          query = query.eq('card_id', (cardData as any).id);
        } else {
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
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('system_nodes')
      .update({ pending_command: command })
      .eq('node_id', nodeId);

    if (error) {
      console.error('sendNodeCommand failed', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('sendNodeCommand error', err);
    return false;
  }
}

export async function getLeaderboard(period: 'today' | 'this_week' | 'all_time'): Promise<LeaderboardEntry[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return getMockLeaderboard();

  try {
    const session = (await supabase.auth.getSession())?.data.session;
    const currentUserId = session?.user?.id;

    let query = supabase.from('sensor_events').select('*');

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

function normalizeN8nRows(payload: any): any[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.cards)) return payload.cards;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.data?.cards)) return payload.data.cards;
  if (Array.isArray(payload?.items)) {
    return payload.items.map((item: any) => item?.json ?? item).filter(Boolean);
  }
  return [];
}

export async function fetchN8nReportData(scope: 'all' | 'in_progress' | 'completed' = 'all'): Promise<any[]> {
  const settings = await getSettings();
  const workflowUrl = settings.n8nUrl || settings.webhookUrl;

  if (!workflowUrl) {
    throw new Error('N8N workflow URL is not configured.');
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (settings.n8nToken) {
    headers.Authorization = `Bearer ${settings.n8nToken}`;
  }

  const response = await fetch(workflowUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      event: 'export_report',
      scope,
      source: 'smarttrack-app',
      generatedAt: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error(`N8N workflow request failed (${response.status}).`);
  }

  const payload = await response.json().catch(() => null);
  const rows = normalizeN8nRows(payload);
  if (!rows.length) {
    throw new Error('N8N workflow returned no report data.');
  }

  if (scope === 'all') return rows;
  return rows.filter((row) => String(row?.status || '').toLowerCase() === scope);
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
    productName: r.product_name || r.productName,
    status: r.status || 'in_progress',
    currentMachine: r.current_machine || r.currentMachine,
    currentMachineStatus: r.current_machine_status || r.currentMachineStatus || 'in_progress',
    currentStage: r.current_stage || r.currentStage,
    currentLocation: r.current_location || r.currentLocation,
    stageEnteredAt: r.stage_entered_at || r.stageEnteredAt,
    createdAt: r.created_at || r.createdAt || new Date().toISOString(),
    updatedAt: r.updated_at || r.updatedAt || new Date().toISOString(),
    progressPercent: r.progress_percent ?? r.progressPercent,
    totalTimeMinutes: r.total_time_minutes ?? r.totalTimeMinutes,
    scanPoints: r.scan_points ?? r.scanPoints,
    qualityIssues: r.quality_issues || r.qualityIssues || '',
    missingItems: r.missing_items || r.missingItems || '',
  };
}


function mapDbScan(r: any): ScanEvent {
  return {
    id: r.id,
    cardId: r.card_id || r.cardId,
    scannedBy: '',
    location: r.machine_name || '',
    stageName: r.event_type || '',
    timestamp: r.timestamp || r.created_at || new Date().toISOString(),
    notes: '',
    partReference: '',
    eventType: r.event_type || r.eventType || 'location_update',
  };
}

function mapDbProductionHistoryToScanEvent(r: any): ScanEvent {
  const metadata = r.metadata ? (typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata) : {};
  return {
    id: r.id,
    cardId: r.card_id || r.cardId,
    scannedBy: metadata.scannedBy || metadata.operator || '',
    location: r.machine_name || r.station || '',
    stageName: r.event_type || '',
    timestamp: r.created_at || new Date().toISOString(),
    notes: metadata.notes || r.event_type || '',
    partReference: metadata.partReference || '',
    eventType: r.event_type || 'location_update',
  };
}

function mapDbProduct(r: any): Product {
  return {
    id: r.id,
    productName: r.product_name || r.name || r.productName,
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
  if (error) { return []; }
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

export async function getStuckCards(cards: ElectronicCard[], thresholdMinutes: number): Promise<ElectronicCard[]> {
  const stuckCards: ElectronicCard[] = [];
  const limitMinutes = Math.min(10, thresholdMinutes ?? 10);
  for (const card of cards) {
    if (card.status === 'completed' || card.cardId?.startsWith('TEST-')) continue;
    const timeInactiveMs = getActiveElapsedMs(
      card.stageEnteredAt || card.updatedAt,
      8,
      16
    );
    const minutesStuck = timeInactiveMs / (1000 * 60);
    if (minutesStuck >= limitMinutes) {
      stuckCards.push({ ...card, progressPercent: Math.min(card.progressPercent || 0, 100) });
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
      photo_url: issue.photoUrl,
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

function mapSensorDataRow(row: any): SensorDataRow {
  return {
    id: row?.id ?? '',
    nodeId: row?.node_id || '',
    sensor_1_status: Boolean(row?.sensor_1_status ?? false),
    sensor_2_status: Boolean(row?.sensor_2_status ?? false),
    sensor_3_status: Boolean(row?.sensor_3_status ?? false),
    sensor_1_counter: Number(row?.sensor_1_counter ?? 0),
    sensor_2_counter: Number(row?.sensor_2_counter ?? 0),
    sensor_3_counter: Number(row?.sensor_3_counter ?? 0),
    timestamp: row?.timestamp || new Date().toISOString(),
  };
}

function mapLossRow(row: any): LossRow {
  return {
    id: row?.id ?? '',
    machineName: row?.machine_name || '',
    lossCount: Number(row?.loss_count ?? 0),
    reason: row?.reason || '',
    lossZone: row?.loss_zone || '',
    costTnd: Number(row?.cost_tnd ?? 0),
    createdAt: row?.created_at || new Date().toISOString(),
  };
}

function mapConfiguration(row: any): Configuration {
  return {
    id: row?.id ?? '',
    machine_name: row?.machine_name || 'NPM-DX-1',
    expected_cards: Number(row?.expected_cards ?? 0),
    cycle_time_seconds: Number(row?.cycle_time_seconds ?? 0),
    sensor_1_gpio: Number(row?.sensor_1_gpio ?? 17),
    sensor_2_gpio: Number(row?.sensor_2_gpio ?? 26),
    sensor_3_gpio: Number(row?.sensor_3_gpio ?? 16),
    loss_threshold: Number(row?.loss_threshold ?? 0),
    updated_at: row?.updated_at || new Date().toISOString(),
  };
}

function mapArticle(row: any): Article {
  return {
    id: row?.id ?? '',
    reference: row?.reference || '',
    designation: row?.designation || '',
    assembly_count: Number(row?.assembly_count ?? 1),
    unit_price: Number(row?.unit_price ?? 0),
  };
}

function mapProductionSystemNode(row: any): SystemNode {
  return {
    id: row?.id ?? row?.name ?? 'raspberry-pi-cms',
    name: row?.name || 'Raspberry Pi CMS',
    type: row?.type || 'raspberry_pi',
    status: row?.status || 'offline',
    location: row?.location ?? null,
    ip_address: row?.ip_address ?? null,
    mac_address: row?.mac_address ?? null,
    cpu_usage: row?.cpu_usage ?? null,
    memory_usage: row?.memory_usage ?? null,
    temperature: row?.temperature ?? null,
    last_seen: row?.last_seen || normalizeTimestamp(row),
  };
}

function getTodayBounds() {
  return sharedGetTodayBounds();
}

export async function getLatestSensorState(): Promise<SensorDataRow> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      id: '',
      nodeId: 'PI5-NODE-01',
      sensor_1_status: false,
      sensor_2_status: false,
      sensor_3_status: false,
      sensor_1_counter: 0,
      sensor_2_counter: 0,
      sensor_3_counter: 0,
      timestamp: new Date().toISOString(),
    };
  }

  try {
    const { data, error } = await supabase
      .from('sensor_data')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data ? mapDbSensorEvent(data) : {
      id: '',
      nodeId: 'sensor_data',
      sensor_1_status: false,
      sensor_2_status: false,
      sensor_3_status: false,
      sensor_1_counter: 0,
      sensor_2_counter: 0,
      sensor_3_counter: 0,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('getLatestSensorState failed', error);
    return {
      id: '',
      nodeId: 'sensor_data',
      sensor_1_status: false,
      sensor_2_status: false,
      sensor_3_status: false,
      sensor_1_counter: 0,
      sensor_2_counter: 0,
      sensor_3_counter: 0,
      timestamp: new Date().toISOString(),
    };
  }
}

export async function getLatestSensorStates(limit = 2): Promise<SensorDataRow[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('sensor_data')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).map(mapDbSensorEvent);
  } catch (error) {
    console.error('getLatestSensorStates failed', error);
    return [];
  }
}

export async function getLatestSensorEvents(limit = 100): Promise<SensorDataRow[]> {
  return getLatestSensorStates(limit);
}

export async function getLatestProductionPerformance(): Promise<ProductionPerformanceRow | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('production_performance')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data ? mapProductionPerformanceRow(data) : null;
  } catch (error) {
    console.error('getLatestProductionPerformance failed', error);
    return null;
  }
}

export async function getLatestOOE(): Promise<ProductionPerformanceRow | null> {
  return getLatestProductionPerformance();
}

export async function getLatestOEE(): Promise<ProductionPerformanceRow | null> {
  return getLatestProductionPerformance();
}

export async function getTodayLossesSummary(): Promise<TodayLossSummary> {
  const supabase = getSupabaseClient();
  if (!supabase) return { totalCards: 0, totalCost: 0 };

  try {
    const { start, end } = getTodayBounds();
    const { data: lostCards, error: lostError } = await supabase
      .from('electronic_cards')
      .select('id, product_id')
      .in('status', ['cancelled', 'blocked', 'removed'])
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString());

    if (lostError) throw lostError;

    const totalCards = (lostCards || []).length;
    let totalCost = 0;

    if (totalCards > 0) {
      const productIds = [...new Set(lostCards.map((c: any) => c.product_id).filter(Boolean))];
      const { data: articles, error: articlesError } = await supabase
        .from('articles')
        .select('unit_price, assembly_count')
        .in('id', productIds.length > 0 ? productIds : ['none']);
      if (!articlesError && articles && articles.length > 0) {
        const costPerCard = articles.reduce(
          (sum, a) => sum + (Number(a.unit_price || 0) * Number(a.assembly_count || 0)),
          0
        );
        totalCost = totalCards * costPerCard;
      }
    }

    return { totalCards, totalCost };
  } catch (error) {
    console.error('getTodayLossesSummary failed', error);
    return { totalCards: 0, totalCost: 0 };
  }
}

export async function getLosses(limit?: number): Promise<LossRow[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    let query = supabase
      .from('losses')
      .select('*')
      .order('created_at', { ascending: false });

    if (typeof limit === 'number') {
      query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapLossRow);
  } catch (error) {
    console.error('getLosses failed', error);
    return [];
  }
}

/**
 * Enforces dynamic cost calculation logic for all losses,
 * preventing manual cost overrides by querying the articles table
 * for accurate unit prices and assembly counts.
 */
export async function recordLoss(loss: {
  machineName: string;
  lossZone: string;
  lossCount: number;
  reason?: string;
  productId?: string;
}): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    let costTnd: number | undefined;

    if (loss.productId) {
      costTnd = await calculateMaterialCost(loss.productId, loss.lossCount);
    }

    // Fallback: sum unit_price * assembly_count for the specific product's article
    // Used when no productId given, or the loading_plans table doesn't exist
    if (!costTnd) {
      const productIds = loss.productId ? [loss.productId] : [];
      const articleQuery = supabase.from('articles').select('unit_price, assembly_count');
      if (productIds.length > 0) {
        articleQuery.in('id', productIds);
      }
      const { data: articles, error: articlesError } = await articleQuery;
      if (articlesError) throw articlesError;
      const costPerCard = (articles || []).reduce(
        (sum, a) => sum + (Number(a.unit_price || 0) * Number(a.assembly_count || 0)),
        0
      );
      costTnd = loss.lossCount * costPerCard;
    }

    const { error } = await supabase
      .from('losses')
      .insert({
        machine_name: loss.machineName,
        loss_zone: loss.lossZone,
        loss_count: loss.lossCount,
        cost_tnd: costTnd,
        reason: loss.reason || null,
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('recordLoss failed:', error);
    return false;
  }
}

function mapProductionPerformanceRow(row: any): ProductionPerformanceRow {
  return {
    id: row?.id ?? '',
    machine_name: row?.machine_name || '',
    target_count: Number(row?.target_count ?? 0),
    actual_count: Number(row?.actual_count ?? 0),
    good_count:   Number(row?.good_count ?? 0),
    loss_count: Number(row?.loss_count ?? 0),
    trg_percentage: Number(row?.OOE_percentage ?? row?.trg_percentage ?? 0),
    trs_percentage: Number(row?.OEE_percentage ?? row?.trs_percentage ?? 0),
    date: row?.date || '',
    timestamp: row?.timestamp || new Date().toISOString(),
  };
}

export async function getDailyLossesStats(): Promise<{ jour: string; total_cartes: number; machine: string; total_cout: number }[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('daily_losses')
      .select('day, total_cards, total_cost')
      .order('day', { ascending: true });

    if (error) throw error;
    return (data || []).map((row: any) => ({
      jour: (row.day || '').split('T')[0],
      total_cartes: Number(row.total_cards ?? 0),
      total_cout: Number(row.total_cost ?? 0),
      machine: 'NPM-DX-1',
    }));
  } catch (error) {
    console.error('getDailyLossesStats failed, trying fallback', error);
    try {
      // Include both scrap losses and lost electronic_cards
      const [lossesData, cardsData, articlesData] = await Promise.all([
        supabase.from('losses').select('created_at, loss_count, cost_tnd'),
        supabase.from('electronic_cards').select('status, product_id, created_at').in('status', ['cancelled', 'blocked', 'removed']),
        supabase.from('articles').select('id, unit_price, assembly_count'),
      ]);

      const dayMap = new Map<string, { cartes: number; cout: number }>();

      // Add scrap losses
      for (const row of lossesData.data || []) {
        const jour = (row.created_at || '').split('T')[0];
        const existing = dayMap.get(jour) || { cartes: 0, cout: 0 };
        existing.cartes += Number(row.loss_count ?? 0);
        existing.cout += Number(row.cost_tnd ?? 0);
        dayMap.set(jour, existing);
      }

      // Compute cost per article (used for lost cards without product cost)
      const articles = articlesData.data || [];
      const articleCostMap = new Map<string, number>();
      let totalAllArticlesCost = 0;
      for (const a of articles) {
        const cost = Number(a.unit_price || 0) * Number(a.assembly_count || 0);
        articleCostMap.set(a.id, cost);
        totalAllArticlesCost += cost;
      }

      // Add lost cards
      for (const row of cardsData.data || []) {
        const jour = (row.created_at || '').split('T')[0];
        const existing = dayMap.get(jour) || { cartes: 0, cout: 0 };
        existing.cartes += 1;
        const productCost = row.product_id ? articleCostMap.get(row.product_id) : null;
        existing.cout += productCost ?? totalAllArticlesCost;
        dayMap.set(jour, existing);
      }

      return Array.from(dayMap.entries())
        .map(([jour, v]) => ({
          jour,
          total_cartes: v.cartes,
          total_cout: v.cout,
          machine: 'NPM-DX-1',
        }))
        .sort((a, b) => a.jour.localeCompare(b.jour));
    } catch (fallbackError) {
      console.error('Fallback getDailyLossesStats failed', fallbackError);
      return [];
    }
  }
}

export async function getDailyProductionStats(): Promise<{ jour: string; total: number; machine: string }[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('production_performance')
      .select('date, actual_count, machine_name')
      .order('date', { ascending: true });

    if (error) throw error;
    if (!data || data.length === 0) return [];

    return data.map((row: any) => ({
      jour: row.date,
      total: Number(row.actual_count ?? 0),
      machine: row.machine_name || 'NPM-DX-1',
    }));
  } catch (error) {
    console.error('getDailyProductionStats failed', error);
    return [];
  }
}

export async function getLossesByMachineStats(): Promise<{ machine: string; nb_incidents: number; total_cartes_perdues: number }[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('losses')
      .select('machine_name, loss_count')
      .order('machine_name', { ascending: true });

    if (error) throw error;
    if (!data || data.length === 0) return [];

    const machineMap = new Map<string, { incidents: number; cards: number }>();
    for (const row of data) {
      const m = row.machine_name || 'Unknown';
      const existing = machineMap.get(m) || { incidents: 0, cards: 0 };
      existing.incidents += 1;
      existing.cards += Number(row.loss_count ?? 0);
      machineMap.set(m, existing);
    }

    return Array.from(machineMap.entries()).map(([machine, stats]) => ({
      machine,
      nb_incidents: stats.incidents,
      total_cartes_perdues: stats.cards,
    }));
  } catch (error) {
    console.error('getLossesByMachineStats failed', error);
    return [];
  }
}

export async function getCardUnitCost(): Promise<number> {
  const supabase = getSupabaseClient();
  if (!supabase) return 0;

  try {
    const { data, error } = await supabase
      .from('articles')
      .select('unit_price')
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data ? Number(data.unit_price ?? 0) : 0;
  } catch (error) {
    console.error('getCardUnitCost failed', error);
    return 0;
  }
}

export async function getPiStatus(): Promise<SystemNode | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('system_nodes')
      .select('*')
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
    const { data, error } = await supabase
      .from('configuration')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
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
    const current = await getConfiguration();
    if (!current) return null;

    const payload: Record<string, unknown> = {};

    if (updates.expected_cards !== undefined) payload.expected_cards = updates.expected_cards;
    if (updates.sensor_1_gpio !== undefined) payload.sensor_1_gpio = updates.sensor_1_gpio;
    if (updates.sensor_2_gpio !== undefined) payload.sensor_2_gpio = updates.sensor_2_gpio;
    if (updates.sensor_3_gpio !== undefined) payload.sensor_3_gpio = updates.sensor_3_gpio;
    if (updates.machine_name !== undefined) payload.machine_name = updates.machine_name;
    if (updates.cycle_time_seconds !== undefined) payload.cycle_time_seconds = updates.cycle_time_seconds;
    if (updates.loss_threshold !== undefined) payload.loss_threshold = updates.loss_threshold;
    payload.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('configuration')
      .update(payload)
      .eq('id', current.id)
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
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .order('reference', { ascending: true });

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
      reference: article.reference,
      designation: article.designation,
      assembly_count: article.assembly_count,
      unit_price: article.unit_price,
    };

    const { data, error } = await supabase
      .from('articles')
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
    const { error } = await supabase
      .from('articles')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('deleteArticle failed', error);
    return false;
  }
}

interface PerteParJour {
  jour: string;
  total_cartes: number;
  total_cout: number;
  machine: string;
}

interface ProductionParJour {
  jour: string;
  machine1: number;
  machine2: number;
  machine3: number;
}

interface PerteParMachine {
  machine: string;
  nb_incidents: number;
  total_cartes_perdues: number;
  cout_total: number;
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
      return 0;
    }

    const partRefs = plans.map((plan: any) => plan.part_reference).filter(Boolean);
    if (partRefs.length === 0) return 0;

    const { data: articles, error: articlesError } = await supabase
      .from('articles')
      .select('reference, unit_price')
      .in('reference', partRefs);

    if (articlesError || !articles) {
      console.error('calculateMaterialCost: Error fetching articles', articlesError);
      return 0;
    }

    const priceMap = new Map<string, number>();
    articles.forEach((art: any) => {
      priceMap.set(art.reference, Number(art.unit_price || 0));
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
  return 0;
}

export function sensorIdToPosition(sensorId: string): 1 | 2 | 3 | null {
  if (sensorId === 'capteur1' || sensorId === 'sensor1' || sensorId === 'sensor_1_status') return 1;
  if (sensorId === 'capteur2' || sensorId === 'sensor2' || sensorId === 'sensor_2_status') return 2;
  if (sensorId === 'capteur3' || sensorId === 'sensor3' || sensorId === 'sensor_3_status') return 3;
  return null;
}

export interface SensorReading {
  position: 1 | 2 | 3;
  sensorId: string;
  state: 'HIGH' | 'LOW' | 'UNKNOWN';
  counter: number;
  recordedAt: string | null;
  gpioPin: number;
}

function emptyReading(position: 1 | 2 | 3): SensorReading {
  return {
    position,
    sensorId: `capteur${position}`,
    state: 'UNKNOWN',
    counter: 0,
    recordedAt: null,
    gpioPin: position === 1 ? 17 : position === 2 ? 26 : 16,
  };
}

export async function fetchLatestSensorStates(): Promise<SensorReading[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [emptyReading(1), emptyReading(2), emptyReading(3)];

  const { data, error } = await supabase
    .from('sensor_data')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return [emptyReading(1), emptyReading(2), emptyReading(3)];

  return [
    { position: 1, sensorId: 'sensor1', state: data.sensor_1_status ? 'HIGH' : 'LOW', counter: Number(data.sensor_1_counter ?? 0), recordedAt: data.timestamp, gpioPin: 17 },
    { position: 2, sensorId: 'sensor2', state: data.sensor_2_status ? 'HIGH' : 'LOW', counter: Number(data.sensor_2_counter ?? 0), recordedAt: data.timestamp, gpioPin: 26 },
    { position: 3, sensorId: 'sensor3', state: data.sensor_3_status ? 'HIGH' : 'LOW', counter: Number(data.sensor_3_counter ?? 0), recordedAt: data.timestamp, gpioPin: 16 },
  ];
}

export interface ProductionKPIs {
  cardsProduced: number;
  cardsGood: number;
  cardsExpected: number;
  totalLosses: number;
  lossZone1to2: number;
  lossZone2to3: number;
  trgPercent: number;
  trsPercent: number;
  machineName: string;
}

export function computeKPIs(
  sensors: SensorReading[],
  config: {
    expected_cards: number;
    machine_name: string;
  }
): ProductionKPIs {
  const c1 = sensors.find(s => s.position === 1)?.counter ?? 0;
  const c2 = sensors.find(s => s.position === 2)?.counter ?? 0;
  const c3 = sensors.find(s => s.position === 3)?.counter ?? 0;

  const lossZone1to2 = Math.max(0, c1 - c2);
  const lossZone2to3 = Math.max(0, c2 - c3);
  const totalLosses = lossZone1to2 + lossZone2to3;
  // cardsProduced = c1: how many cards ENTERED the line (started production)
  // cardsGood     = c3: how many cards EXITED  the line (finished successfully)
  const cardsProduced = c1;
  const cardsGood = c3;
  const cardsExpected = config.expected_cards;

  // OOE: good finished output vs the expected batch target

  // OEE: yield rate — what fraction of entered cards made it out successfully
  const trsPercent = cardsProduced > 0
    ? Math.min(100, Math.round((cardsGood / cardsProduced) * 100))
    : 0;

  return {
    cardsProduced, cardsGood, cardsExpected,
    totalLosses, lossZone1to2, lossZone2to3,
    trgPercent, trsPercent,
    machineName: config.machine_name,
  };
}

export interface SensorEventCountToday {
  position: 1 | 2 | 3;
  label: string;
  count: number;
}

export async function fetchSensorEventCountsToday(): Promise<SensorEventCountToday[]> {
  const supabase = getSupabaseClient();
  const labels: Record<number, string> = { 1: 'Capteur 1', 2: 'Capteur 2', 3: 'Capteur 3' };
  const empty = ([1, 2, 3] as const).map((position) => ({
    position,
    label: labels[position],
    count: 0,
  }));

  if (!supabase) return empty;

  const { data, error } = await supabase
    .from('sensor_data')
    .select('sensor_1_counter, sensor_2_counter, sensor_3_counter')
    .order('timestamp', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return empty;

  return [
    { position: 1, label: labels[1], count: Number(data.sensor_1_counter ?? 0) },
    { position: 2, label: labels[2], count: Number(data.sensor_2_counter ?? 0) },
    { position: 3, label: labels[3], count: Number(data.sensor_3_counter ?? 0) },
  ];
}

export async function fetchSensorEventsLast24h() {
  return [];
}

export interface TodayProductionStats {
  totalProduced: number;
  totalLosses: number;
  lossZone1to2: number;
  lossZone2to3: number;
}

export async function fetchTodayProductionStats(): Promise<TodayProductionStats> {
  const sensor = await getLatestSensorState();
  const c1 = sensor.sensor_1_counter ?? 0;
  const c2 = sensor.sensor_2_counter ?? 0;
  const c3 = sensor.sensor_3_counter ?? 0;

  const lossZone1to2 = Math.max(0, c1 - c2);
  const lossZone2to3 = Math.max(0, c2 - c3);

  const supabase = getSupabaseClient();
  let totalLosses = lossZone1to2 + lossZone2to3;
  if (supabase) {
    const { start, end } = getTodayBounds();
    const { data } = await supabase
      .from('losses')
      .select('loss_count')
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString());
    if (data) {
      totalLosses = data.reduce((sum, row) => sum + Number(row.loss_count ?? 0), 0);
    }
  }

  const totalProduced = c3;
  return { totalProduced, totalLosses, lossZone1to2, lossZone2to3 };
}

export interface DailyReportSummary {
  id: number;
  report_type: string;
  status: string;
  period_start: string;
  period_end?: string;
  total_produced: number;
  total_good: number;
  total_bad: number;
  trg: number;
  trs: number;
  total_losses: number;
  created_at: string;
}

export async function fetchDailyReportSummaries(limit = 10): Promise<DailyReportSummary[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('report_summaries')
    .select('*')
    .eq('report_type', 'daily')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as DailyReportSummary[];
}

function mapDbSensorEvent(row: any): SensorDataRow {
  return {
    id: row?.id || '',
    nodeId: row?.node_id || row?.nodeId || '',
    sensor_1_status: !!row?.sensor_1_status,
    sensor_2_status: !!row?.sensor_2_status,
    sensor_3_status: !!row?.sensor_3_status,
    sensor_1_counter: Number(row?.sensor_1_counter ?? 0),
    sensor_2_counter: Number(row?.sensor_2_counter ?? 0),
    sensor_3_counter: Number(row?.sensor_3_counter ?? 0),
    timestamp: row?.timestamp || new Date().toISOString(),
  };
}

export async function fetchSensorHistory(limit = 100) {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('sensor_data')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(limit);

  if (error || !data) { console.error('fetchSensorHistory error:', error); return []; }
  return data.map(mapDbSensorEvent);
}

// ============================================================================
// STEP 1 PLAN FUNCTIONS — canonical DB-wired fetches
// ============================================================================

/** Step 1B: fetchConfiguration — reads the single row with id=1 */
export async function fetchConfiguration() {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('configuration')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

/** Step 1C-E: Performance & losses from schema */
export async function fetchLatestOOE() {
  return getLatestProductionPerformance();
}

export async function fetchOOEHistory(limit = 20) {

  const { data, error } = await supabase
    .from('production_performance')
    .select('date, actual_count, trg_percentage, trs_percentage')
    .order('date', { ascending: false })
    .limit(limit);

  if (!data) return [];
  return data.map((row: any) => ({
    date: row.date,
    actual_count: Number(row.actual_count ?? 0),
    trg_percentage: Number(row.trg_percentage ?? 0),
    trs_percentage: Number(row.trs_percentage ?? 0),
  }));
}

export async function fetchLatestOEE() {
  return getLatestProductionPerformance();
}

export async function fetchOEEHistory(limit = 20) {
  return fetchOOEHistory(limit);
}

export async function fetchLossesHistory(limit = 50) {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('losses')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data || []).map(mapLossRow);
}

export async function fetchLossesByDay() {
  return getDailyLossesStats();
}

export async function fetchLossesByMachine() {
  return getLossesByMachineStats();
}

export async function fetchProductionByDay() {
  return getDailyProductionStats();
}

/** Step 1G: Alerts from alerts table */
export async function fetchAlerts(unreadOnly = false) {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  let query = supabase
    .from('alerts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (unreadOnly) {
    query = query.eq('is_read', false);
  }

  const { data, error } = await query;
  return data ?? [];
}

export async function markAlertRead(alertId: string) {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  await supabase
    .from('alerts')
    .update({ is_read: true })
    .eq('id', alertId);
}

/** Step 1H: fetchSensorCounters — gets current counter per sensor */
export async function fetchSensorCounters(): Promise<{
  capteur1: number;
  capteur2: number;
  capteur3: number;
}> {
  const supabase = getSupabaseClient();
  if (!supabase) return { capteur1: 0, capteur2: 0, capteur3: 0 };

  const { data, error } = await supabase
    .from('sensor_data')
    .select('sensor_1_counter, sensor_2_counter, sensor_3_counter')
    .order('timestamp', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return { capteur1: 0, capteur2: 0, capteur3: 0 };

  return {
    capteur1: Number(data.sensor_1_counter ?? 0),
    capteur2: Number(data.sensor_2_counter ?? 0),
    capteur3: Number(data.sensor_3_counter ?? 0),
  };
}

export async function getDailyReports(): Promise<DailyReport[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('daily_reports')
      .select('*')
      .order('report_date', { ascending: false });

    if (error) throw error;
    return (data || []).map((r: any) => ({
      id: r.id,
      report_date: r.report_date,
      trg_percentage: Number(r.trg_percentage),
      trs_percentage: Number(r.trs_percentage),
      total_losses: Number(r.total_losses),
      file_url: r.file_url,
      created_at: r.created_at,
    }));
  } catch (error) {
    console.error('getDailyReports failed', error);
    return [];
  }
}

export async function savePushToken(token: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    const session = (await supabase.auth.getSession())?.data.session;
    if (!session?.user?.id) return;

    const { error } = await (supabase.from('profiles') as any)
      .update({ push_token: token })
      .eq('id', session.user.id);

    if (error) {
      console.error('savePushToken failed', error);
    }
  } catch (error) {
    console.error('savePushToken error', error);
  }
}

export async function clearPushToken(): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    const session = (await supabase.auth.getSession())?.data.session;
    if (!session?.user?.id) return;

    const { error } = await (supabase.from('profiles') as any)
      .update({ push_token: null })
      .eq('id', session.user.id);

    if (error) {
      console.error('clearPushToken failed', error);
    }
  } catch (error) {
    console.error('clearPushToken error', error);
  }
}

export async function fetchInspectedLosses(
  start: string,
  end: string
): Promise<InspectedLoss[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('losses')
      .select('*, root_cause:loss_root_causes(*)')
      .gte('created_at', start)
      .lt('created_at', end)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map((r: any) => ({
      id: r.id,
      machine_name: r.machine_name || '',
      loss_count: Number(r.loss_count) || 0,
      reason: r.reason || null,
      loss_zone: r.loss_zone || null,
      cost_tnd: Number(r.cost_tnd) || 0,
      created_at: r.created_at,
      root_cause: r.root_cause
        ? {
            id: r.root_cause.id,
            loss_id: r.root_cause.loss_id,
            cause_category: r.root_cause.cause_category,
            cause_details: r.root_cause.cause_details || null,
            photo_url: r.root_cause.photo_url || null,
            operator_id: r.root_cause.operator_id,
            created_at: r.root_cause.created_at,
          }
        : null,
    }));
  } catch (error) {
    console.error('fetchInspectedLosses failed', error);
    return [];
  }
}

export async function submitInspection(params: {
  lossId: string;
  category: RootCauseCategory;
  details?: string;
  operatorId: string;
  photoUri?: string;
}): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: 'Database not configured' };

  try {
    let photoUrl: string | null = null;

    if (params.photoUri) {
      const ext = params.photoUri.split('.').pop() || 'jpg';
      const fileName = `inspection_${params.lossId}_${Date.now()}.${ext}`;
      try {
        const response = await fetch(params.photoUri);
        const blob = await response.blob();
        const uploadResult = await supabase.storage
          .from('inspection_photos')
          .upload(fileName, blob, { contentType: `image/${ext}` });

        if (uploadResult.error) {
          console.error('Photo upload failed', uploadResult.error);
        } else {
          const { data: urlData } = supabase.storage.from('inspection_photos').getPublicUrl(fileName);
          photoUrl = urlData?.publicUrl || null;
        }
      } catch (uploadErr) {
        console.error('Photo upload exception', uploadErr);
      }
    }

    const { error: insertError } = await supabase.from('loss_root_causes').insert({
      loss_id: params.lossId,
      cause_category: params.category,
      cause_details: params.details || null,
      photo_url: photoUrl,
      operator_id: params.operatorId,
    });

    if (insertError) throw insertError;

    // Non-blocking: mark related alert as read
    supabase
      .from('alerts')
      .update({ is_read: true })
      .eq('type', 'loss')
      .eq('card_id', params.lossId)
      .then().catch(() => {});

    return { success: true };
  } catch (error: any) {
    console.error('submitInspection failed', error);
    return { success: false, error: error?.message || 'Failed to submit inspection' };
  }
}

export async function getCurrentUserProfile(): Promise<{
  id: string;
  displayName: string;
  role: string;
} | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const session = (await supabase.auth.getSession())?.data.session;
    if (!session?.user?.id) return null;

    const { data, error } = await (supabase.from('profiles') as any)
      .select('id, display_name, role')
      .eq('id', session.user.id)
      .maybeSingle();

    if (error) {
      console.error('getCurrentUserProfile failed', error);
      return null;
    }
    if (!data) return null;

    return {
      id: data.id,
      displayName: data.display_name || 'User',
      role: data.role || 'operator',
    };
  } catch (error) {
    console.error('getCurrentUserProfile error', error);
    return null;
  }
}

export async function fetchPendingInspectionsCount(start: string, end: string): Promise<number> {
  const supabase = getSupabaseClient();
  if (!supabase) return 0;

  try {
    const { count, error } = await supabase
      .from('losses')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', start)
      .lt('created_at', end)
      .is('reason', null);

    if (error) throw error;
    return count ?? 0;
  } catch (error) {
    console.error('fetchPendingInspectionsCount failed', error);
    return 0;
  }
}
