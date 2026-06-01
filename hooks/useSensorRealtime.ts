import { useState, useEffect, useCallback, useRef } from 'react';
import { getSupabaseClient } from '@/lib/supabase';

// etat_capteur: id, date_temps, capteur1 (0/1), capteur2 (0/1), capteur3 (0/1)

export interface SensorCounters {
  capteur1: number; // HIGH detection count today
  capteur2: number;
  capteur3: number;
}

export interface SensorActivity {
  capteur1: boolean;
  capteur2: boolean;
  capteur3: boolean;
}

export interface LiveLossCounters {
  produced: number;
  lost: number;
  zone1Loss: number;
  zone2Loss: number;
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

const ACTIVITY_WINDOW_MS = 10_000;

function computeLiveCounters(counters: SensorCounters): LiveLossCounters {
  return {
    produced: counters.capteur3,
    lost: Math.max(0, counters.capteur1 - counters.capteur3),
    zone1Loss: Math.max(0, counters.capteur1 - counters.capteur2),
    zone2Loss: Math.max(0, counters.capteur2 - counters.capteur3),
  };
}

export function useSensorRealtime(): UseSensorRealtimeResult {
  const [counters, setCounters] = useState<SensorCounters>({ capteur1: 0, capteur2: 0, capteur3: 0 });
  const [previousCounters, setPreviousCounters] = useState<SensorCounters>({ capteur1: 0, capteur2: 0, capteur3: 0 });
  const [activity, setActivity] = useState<SensorActivity>({ capteur1: false, capteur2: false, capteur3: false });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    if (!supabase) { setError('Supabase not configured'); setIsLoading(false); return; }

    try {
      const { data, error: dbError } = await supabase
        .from('sensor_data')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (dbError) throw dbError;

      if (data) {
        if (data.sensor_1_status) lastHighAt.current['capteur1'] = Date.now();
        if (data.sensor_2_status) lastHighAt.current['capteur2'] = Date.now();
        if (data.sensor_3_status) lastHighAt.current['capteur3'] = Date.now();
        
        setCounters({
          capteur1: Number(data.sensor_1_counter ?? 0),
          capteur2: Number(data.sensor_2_counter ?? 0),
          capteur3: Number(data.sensor_3_counter ?? 0),
        });
      }
      updateActivity();
    } catch (err: any) {
      console.error('useSensorRealtime fetchInitialCounters failed:', err);
      setError(err?.message ?? 'Failed to fetch sensor data');
    } finally {
      setIsLoading(false);
    }
  }, [updateActivity]);

  useEffect(() => { fetchInitialCounters(); }, [fetchInitialCounters]);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const channel = supabase
      .channel('sensor_live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sensor_data' },
        (payload) => {
          const row = payload.new as {
            sensor_1_status: boolean;
            sensor_2_status: boolean;
            sensor_3_status: boolean;
            sensor_1_counter: number;
            sensor_2_counter: number;
            sensor_3_counter: number;
          };

          if (row.sensor_1_status) lastHighAt.current['capteur1'] = Date.now();
          if (row.sensor_2_status) lastHighAt.current['capteur2'] = Date.now();
          if (row.sensor_3_status) lastHighAt.current['capteur3'] = Date.now();
          updateActivity();

          setPreviousCounters(countersRef.current);
          setCounters({
            capteur1: Number(row.sensor_1_counter ?? 0),
            capteur2: Number(row.sensor_2_counter ?? 0),
            capteur3: Number(row.sensor_3_counter ?? 0),
          });
        }
      )
      .subscribe();

    const activityTimer = setInterval(updateActivity, 5_000);
    return () => { supabase.removeChannel(channel); clearInterval(activityTimer); };
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
