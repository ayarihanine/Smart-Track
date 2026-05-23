import { supabase } from '@/lib/supabase';
import { useState, useEffect } from 'react';

export interface SensorState {
  capteur1: { counter: number; lastSeen: string };
  capteur2: { counter: number; lastSeen: string };
  capteur3: { counter: number; lastSeen: string };
}

export function useSensorCounters() {
  const [sensors, setSensors] = useState<SensorState>({
    capteur1: { counter: 0, lastSeen: '' },
    capteur2: { counter: 0, lastSeen: '' },
    capteur3: { counter: 0, lastSeen: '' },
  });

  useEffect(() => {
    const fetchLatest = async () => {
      const { data, error } = await supabase
        .from('sensor_events')
        .select('sensor_id, counter, recorded_at')
        .order('recorded_at', { ascending: false })
        .limit(3);

      if (!error && data) {
        setSensors((prev) => {
          const next = { ...prev };
          data.forEach((row) => {
            if (row.sensor_id in next) {
              next[row.sensor_id as keyof SensorState] = {
                counter: row.counter,
                lastSeen: new Date(row.recorded_at).toLocaleTimeString(),
              };
            }
          });
          return next;
        });
      }
    };

    fetchLatest();
    const channel = supabase
      .channel('sensor_live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sensor_events' }, fetchLatest)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return sensors;
}
