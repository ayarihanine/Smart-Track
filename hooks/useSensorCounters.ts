import { getSupabaseClient } from '@/lib/supabase';
import { useState, useEffect } from 'react';

export interface SensorSlot {
  counter: number;
  lastSeen: string;
  active: boolean;
  state: string;
}

export interface SensorData {
  sensor1: SensorSlot;
  sensor2: SensorSlot;
  sensor3: SensorSlot;
}

const INITIAL_SENSORS: SensorData = {
  sensor1: { counter: 0, lastSeen: '-', active: false, state: 'LOW' },
  sensor2: { counter: 0, lastSeen: '-', active: false, state: 'LOW' },
  sensor3: { counter: 0, lastSeen: '-', active: false, state: 'LOW' },
};

const SENSOR_IDS = [
  'sensor1', 'sensor2', 'sensor3',
  'capteur1', 'capteur2', 'capteur3',
] as const;

function toSlotKey(sensorId: string): keyof SensorData | null {
  if (sensorId === 'sensor1' || sensorId === 'capteur1') return 'sensor1';
  if (sensorId === 'sensor2' || sensorId === 'capteur2') return 'sensor2';
  if (sensorId === 'sensor3' || sensorId === 'capteur3') return 'sensor3';
  return null;
}

export function useSensorCounters() {
  const [sensors, setSensors] = useState<SensorData>({ ...INITIAL_SENSORS });
  const [expected, setExpected] = useState(10);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    supabase
      .from('configuration')
      .select('nb_cartes_attendues')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.nb_cartes_attendues != null) {
          setExpected(Number(data.nb_cartes_attendues) || 10);
        }
      });
  }, []);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const fetchLatest = async () => {
      const { data: events, error } = await supabase
        .from('sensor_events')
        .select('sensor_id, counter, state, recorded_at')
        .in('sensor_id', [...SENSOR_IDS])
        .order('recorded_at', { ascending: false })
        .limit(100);

      if (error || !events?.length) return;

      const latest: Partial<Record<keyof SensorData, { counter: number; state: string; recorded_at: string }>> = {};

      for (const e of events) {
        const slot = toSlotKey(e.sensor_id);
        if (!slot) continue;
        const existing = latest[slot];
        if (!existing || new Date(e.recorded_at).getTime() > new Date(existing.recorded_at).getTime()) {
          latest[slot] = e;
        }
      }

      const now = new Date();
      const next: SensorData = {
        sensor1: { ...INITIAL_SENSORS.sensor1 },
        sensor2: { ...INITIAL_SENSORS.sensor2 },
        sensor3: { ...INITIAL_SENSORS.sensor3 },
      };

      (['sensor1', 'sensor2', 'sensor3'] as const).forEach((id) => {
        const e = latest[id];
        if (e) {
          const age = (now.getTime() - new Date(e.recorded_at).getTime()) / 1000;
          next[id] = {
            counter: e.counter || 0,
            lastSeen: new Date(e.recorded_at).toLocaleTimeString('fr-FR'),
            active: age < 30,
            state: e.state || 'LOW',
          };
        }
      });

      setSensors(next);
    };

    fetchLatest();
    const interval = setInterval(fetchLatest, 2000);
    const channel = supabase
      .channel('sensor_rt')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sensor_events' },
        fetchLatest
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const rawEntry = sensors.sensor1.counter;
  const rawMiddle = sensors.sensor2.counter;
  const rawExit = sensors.sensor3.counter;

  const logicalEntry = rawEntry;
  const logicalMiddle = Math.min(rawEntry, rawMiddle);
  const logicalExit = Math.min(logicalMiddle, rawExit);

  const zone1Loss = Math.max(0, logicalEntry - logicalMiddle);
  const zone2Loss = Math.max(0, logicalMiddle - logicalExit);
  const totalLosses = zone1Loss + zone2Loss;

  const produced = logicalExit;
  const goodCards = Math.max(0, produced - totalLosses);

  const trg = expected > 0 ? (goodCards / expected) * 100 : 0;
  const trs = trg * 0.85;

  return {
    sensors,
    raw: { entry: rawEntry, middle: rawMiddle, exit: rawExit },
    logical: { entry: logicalEntry, middle: logicalMiddle, exit: logicalExit },
    produced,
    expected,
    goodCards,
    zone1Loss,
    zone2Loss,
    totalLosses,
    trg,
    trs,
    lost: totalLosses,
    activeCount: Object.values(sensors).filter((s) => s.active).length,
    detecting: Object.values(sensors).filter((s) => s.state === 'HIGH' && s.active).length,
  };
}
