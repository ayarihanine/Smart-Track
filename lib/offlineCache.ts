/**
 * offlineCache.ts
 * Lightweight offline cache manager + sync queue using AsyncStorage.
 *
 * Usage:
 *   import { offlineCache } from '@/lib/offlineCache';
 *   await offlineCache.cacheSensorEvents(events);
 *   const cached = await offlineCache.getSensorEvents();
 *   await offlineCache.enqueuePendingInsert('pertes_table', row);
 *   await offlineCache.flushPendingInserts(); // call on reconnect
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient } from './supabase';

// ─── Storage Keys ──────────────────────────────────────────────────────────────
const KEYS = {
  SENSOR_EVENTS: 'offline_sensor_events',
  LOSS_HISTORY:  'offline_loss_history',
  PERF_METRICS:  'offline_perf_metrics',
  PENDING_QUEUE: 'offline_pending_queue',
} as const;

const MAX_SENSOR_EVENTS = 50;

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface PendingInsert {
  id: string;           // uuid v4-ish (Date.now + Math.random)
  table: string;
  row: Record<string, unknown>;
  enqueuedAt: number;
  attempts: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
async function read<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function write(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('offlineCache write failed:', key, err);
  }
}

// ─── Sensor Events Cache ───────────────────────────────────────────────────────
async function cacheSensorEvents(events: unknown[]): Promise<void> {
  const trimmed = events.slice(0, MAX_SENSOR_EVENTS);
  await write(KEYS.SENSOR_EVENTS, trimmed);
}

async function getSensorEvents(): Promise<unknown[]> {
  return (await read<unknown[]>(KEYS.SENSOR_EVENTS)) ?? [];
}

// ─── Loss History Cache ────────────────────────────────────────────────────────
async function cacheLossHistory(rows: unknown[]): Promise<void> {
  await write(KEYS.LOSS_HISTORY, rows);
}

async function getLossHistory(): Promise<unknown[]> {
  return (await read<unknown[]>(KEYS.LOSS_HISTORY)) ?? [];
}

// ─── Performance Metrics Cache ─────────────────────────────────────────────────
async function cachePerfMetrics(metrics: unknown): Promise<void> {
  await write(KEYS.PERF_METRICS, metrics);
}

async function getPerfMetrics(): Promise<unknown | null> {
  return read<unknown>(KEYS.PERF_METRICS);
}

// ─── Pending Insert Queue ──────────────────────────────────────────────────────
async function enqueuePendingInsert(
  table: string,
  row: Record<string, unknown>
): Promise<void> {
  const queue = (await read<PendingInsert[]>(KEYS.PENDING_QUEUE)) ?? [];

  const item: PendingInsert = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    table,
    row,
    enqueuedAt: Date.now(),
    attempts: 0,
  };

  queue.push(item);
  await write(KEYS.PENDING_QUEUE, queue);
}

async function getPendingQueue(): Promise<PendingInsert[]> {
  return (await read<PendingInsert[]>(KEYS.PENDING_QUEUE)) ?? [];
}

/**
 * flushPendingInserts — attempt to replay all queued inserts.
 * Call this when NetInfo reports isConnected === true.
 * Failed inserts are kept in the queue with incremented attempts.
 * Items with attempts >= 5 are discarded to prevent infinite loops.
 */
async function flushPendingInserts(): Promise<{ flushed: number; failed: number }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { flushed: 0, failed: 0 };

  const queue = await getPendingQueue();
  if (queue.length === 0) return { flushed: 0, failed: 0 };

  const remaining: PendingInsert[] = [];
  let flushed = 0;
  let failed = 0;

  for (const item of queue) {
    if (item.attempts >= 5) {
      console.warn('offlineCache: dropping item after 5 attempts', item);
      continue; // discard
    }

    try {
      const { error } = await supabase.from(item.table as any).insert(item.row as any);
      if (error) throw error;
      flushed++;
    } catch (err) {
      console.warn('offlineCache: flush failed for item', item.id, err);
      remaining.push({ ...item, attempts: item.attempts + 1 });
      failed++;
    }
  }

  await write(KEYS.PENDING_QUEUE, remaining);
  return { flushed, failed };
}

async function clearAll(): Promise<void> {
  await AsyncStorage.multiRemove(Object.values(KEYS));
}

// ─── Exported Singleton ────────────────────────────────────────────────────────
export const offlineCache = {
  cacheSensorEvents,
  getSensorEvents,
  cacheLossHistory,
  getLossHistory,
  cachePerfMetrics,
  getPerfMetrics,
  enqueuePendingInsert,
  getPendingQueue,
  flushPendingInserts,
  clearAll,
};
