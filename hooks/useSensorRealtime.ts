import { useState, useEffect, useCallback, useRef } from 'react';
import { getSupabaseClient } from '@/lib/supabase';

export interface SensorCounters {
  capteur1: number; // Entry  (GPIO 17)
  capteur2: number; // Middle (GPIO 26)
  capteur3: number; // Exit   (GPIO 16)
}

export interface SensorActivity {
  capteur1: boolean; // HIGH in last 10s
  capteur2: boolean;
  capteur3: boolean;
}

export interface LiveLossCounters {
  produced: number;       // = capteur3 latest counter
  lost: number;           // = MAX(0, capteur1 - capteur3)
  zone1Loss: number;      // = MAX(0, capteur1 - capteur2)
  zone2Loss: number;      // = MAX(0, capteur2 - capteur3)
}

export interface UseSensorRealtimeResult {
  counters: SensorCounters;
  previousCounters: SensorCounters;
  activity: SensorActivity;
  liveCounters: LiveLossCounters;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

const SENSOR_IDS = ['capteur1', 'capteur2', 'capteur3'] as const;
const ALT_SENSOR_IDS = ['sensor1', 'sensor2', 'sensor3'] as const;
const ACTIVITY_WINDOW_MS = 10_000; // 10 seconds

/** Normalize sensor1/2/3 to capteur1/2/3 */
function normalizeSensorId(sid: string): string | null {
  const idx = ALT_SENSOR_IDS.indexOf(sid as any);
  if (idx !== -1) return SENSOR_IDS[idx];
  if (SENSOR_IDS.includes(sid as any)) return sid;
  return null;
}

function computeLiveCounters(counters: SensorCounters): LiveLossCounters {
  return {
    produced: counters.capteur3,
    lost: Math.max(0, counters.capteur1 - counters.capteur3),
    zone1Loss: Math.max(0, counters.capteur1 - counters.capteur2),
    zone2Loss: Math.max(0, counters.capteur2 - counters.capteur3),
  };
}

export function useSensorRealtime(): UseSensorRealtimeResult {
  const [counters, setCounters] = useState<SensorCounters>({
    capteur1: 0,
    capteur2: 0,
    capteur3: 0,
  });
  const [previousCounters, setPreviousCounters] = useState<SensorCounters>({
    capteur1: 0,
    capteur2: 0,
    capteur3: 0,
  });
  const [activity, setActivity] = useState<SensorActivity>({
    capteur1: false,
    capteur2: false,
    capteur3: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track last HIGH event timestamp per sensor
  const lastHighAt = useRef<Record<string, number>>({});
  const countersRef = useRef(counters);
  countersRef.current = counters;

  const updateActivity = useCallback(() => {
    const now = Date.now();
    setActivity({
      capteur1: now - (lastHighAt.current['capteur1'] ?? 0) < ACTIVITY_WINDOW_MS,
      capteur2: now - (lastHighAt.current['capteur2'] ?? 0) < ACTIVITY_WINDOW_MS,
      capteur3: now - (lastHighAt.current['capteur3'] ?? 0) < ACTIVITY_WINDOW_MS,
    });
  }, []);

  const fetchInitialCounters = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const supabase = getSupabaseClient();
    if (!supabase) {
      setError('Supabase not configured');
      setIsLoading(false);
      return;
    }

    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const { data, error: dbError } = await supabase
        .from('sensor_events')
        .select('sensor_id, counter, state, recorded_at')
        .in('sensor_id', [...SENSOR_IDS, ...ALT_SENSOR_IDS])
        .gte('recorded_at', startOfDay.toISOString())
        .order('recorded_at', { ascending: false })
        .limit(9); // up to 3 per sensor

      if (dbError) throw dbError;

      const rows = data ?? [];
      const result: SensorCounters = { capteur1: 0, capteur2: 0, capteur3: 0 };
      const seen = new Set<string>();

      for (const row of rows) {
        const sid = row.sensor_id as keyof SensorCounters;
        if (!seen.has(sid)) {
          seen.add(sid);
          result[sid] = Number(row.counter ?? 0);

          // Mark activity based on recent HIGH events
          if (row.state === 'HIGH') {
            const ts = new Date(row.recorded_at).getTime();
            lastHighAt.current[sid] = Math.max(lastHighAt.current[sid] ?? 0, ts);
          }
        }
      }

      setCounters(result);
      updateActivity();
    } catch (err: any) {
      console.error('useSensorRealtime fetchInitialCounters failed:', err);
      setError(err?.message ?? 'Failed to fetch sensor data');
    } finally {
      setIsLoading(false);
    }
  }, [updateActivity]);

  useEffect(() => {
    fetchInitialCounters();
  }, [fetchInitialCounters]);

  // Realtime subscription
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const channel = supabase
      .channel('sensor_live')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sensor_events',
        },
        (payload) => {
          const row = payload.new as {
            sensor_id: string;
            counter: number;
            state: string;
            recorded_at: string;
          };

          const sid = normalizeSensorId(row.sensor_id);
          if (!sid) return;

          const counter = Number(row.counter ?? 0);

          // Track activity
          if (row.state === 'HIGH') {
            lastHighAt.current[sid] = Date.now();
          }
          updateActivity();

          setPreviousCounters(countersRef.current);
          setCounters((current) => ({ ...current, [sid]: counter }));
        }
      )
      .subscribe();

    // Refresh activity badge every 5 seconds
    const activityTimer = setInterval(updateActivity, 5_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(activityTimer);
    };
  }, [updateActivity]);

  return {
    counters,
    previousCounters,
    activity,
    liveCounters: computeLiveCounters(counters),
    isLoading,
    error,
    refetch: fetchInitialCounters,
  };
}
