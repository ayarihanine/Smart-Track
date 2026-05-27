import { useState, useEffect, useCallback } from 'react'
import { getSupabaseClient } from '@/lib/supabase'
import { useMachineConfig } from './useMachineConfig'

type SensorState = {
  counter: number
  lastSeen: string
  state: string
}

type SensorData = {
  sensor1: SensorState
  sensor2: SensorState
  sensor3: SensorState
}

export function useSensorCounters() {
  const [sensors, setSensors] = useState<SensorData>({
    sensor1: { counter: 0, lastSeen: '-', state: 'LOW' },
    sensor2: { counter: 0, lastSeen: '-', state: 'LOW' },
    sensor3: { counter: 0, lastSeen: '-', state: 'LOW' },
  })
  const [loading, setLoading] = useState(true)
  const { expected } = useMachineConfig()

  const fetchSensors = useCallback(async () => {
    const supabase = getSupabaseClient()
    if (!supabase) return

    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    try {
      // Fetch recent events to calculate today's max
      const { data: events, error } = await supabase
        .from('sensor_events')
        .select('sensor_id, counter, state, created_at')
        .gte('created_at', startOfDay.toISOString())
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) throw error

      const latest: SensorData = {
        sensor1: { counter: 0, lastSeen: '-', state: 'LOW' },
        sensor2: { counter: 0, lastSeen: '-', state: 'LOW' },
        sensor3: { counter: 0, lastSeen: '-', state: 'LOW' },
      }

      // Aggregate to find the HIGHEST counter seen today for each sensor
      if (events) {
        for (const e of events) {
          const id = e.sensor_id as keyof SensorData
          if (id in latest && e.counter > latest[id].counter) {
            latest[id] = {
              counter: e.counter,
              lastSeen: new Date(e.created_at).toLocaleTimeString('fr-FR'),
              state: e.state || 'LOW',
            }
          }
        }
      }

      setSensors(latest)
    } catch (err) {
      console.error('Sensor fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSensors()

    const supabase = getSupabaseClient()
    if (!supabase) return

    const channel = supabase
      .channel('sensor_realtime_updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'sensor_events'
      }, () => {
        // Refetch when any change occurs to get accurate max counts
        fetchSensors()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchSensors])

  // --- CALCULATIONS ---
  const produced = sensors.sensor3.counter
  const totalInput = sensors.sensor1.counter

  // Zone losses based on sensor deltas
  const zone1Loss = Math.max(0, sensors.sensor1.counter - sensors.sensor2.counter)
  const zone2Loss = Math.max(0, sensors.sensor2.counter - sensors.sensor3.counter)

  // Total losses = cards that entered but never exited
  const totalLosses = zone1Loss + zone2Loss

  // Good cards = produced minus loss-adjusted estimate
  const goodCards = Math.max(0, produced - totalLosses)

  // TRG (OEE) = Good / Expected, clamped to [0, 100]
  const trg = expected > 0 ? Math.min(100, Math.round((goodCards / expected) * 100)) : 0

  // TRS = Good / Produced (quality rate), clamped to [0, 100]
  const trs = produced > 0 ? Math.min(100, Math.round((goodCards / produced) * 100)) : 0

  return {
    sensors,
    logical: {
      entry: sensors.sensor1.counter,
      middle: sensors.sensor2.counter,
      exit: sensors.sensor3.counter,
    },
    produced,
    totalLosses,
    zone1Loss,
    zone2Loss,
    goodCards,
    expected,
    trg,
    trs,
    loading,
    refresh: fetchSensors,
  }
}