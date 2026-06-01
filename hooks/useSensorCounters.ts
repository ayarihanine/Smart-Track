import { useState, useEffect, useCallback } from 'react'
import { getSupabaseClient } from '@/lib/supabase'
import { getTodayBounds } from '@/lib/dates'

// sensor_data: id, node_id, sensor_1_status, sensor_2_status, sensor_3_status, sensor_1_counter, sensor_2_counter, sensor_3_counter, timestamp
type SensorDataRow = {
  id: string
  node_id: string
  sensor_1_status: boolean
  sensor_2_status: boolean
  sensor_3_status: boolean
  sensor_1_counter: number
  sensor_2_counter: number
  sensor_3_counter: number
  timestamp: string
}

type SensorState = {
  lastSeen: string
  status: boolean   // true = HIGH (1), false = LOW (0)
  detections: number // cumulative counter value from DB
}

type SensorData = {
  sensor1: SensorState
  sensor2: SensorState
  sensor3: SensorState
}

type TodayPerformance = {
  trg: number
  trs: number
  cards_started: number
  cards_good: number
  cards_target: number
  loss_count: number
}

export function useSensorCounters() {
  const [sensors, setSensors] = useState<SensorData>({
    sensor1: { detections: 0, lastSeen: '-', status: false },
    sensor2: { detections: 0, lastSeen: '-', status: false },
    sensor3: { detections: 0, lastSeen: '-', status: false },
  })
  const [performance, setPerformance] = useState<TodayPerformance>({
    trg: 0, trs: 0, cards_started: 0, cards_good: 0, cards_target: 0, loss_count: 0,
  })
  const [loading, setLoading] = useState(true)

  const fetchSensors = useCallback(async () => {
    const supabase = getSupabaseClient()
    if (!supabase) return

    try {
      // 1. Latest sensor row (counters + statuses)
      const { data, error } = await supabase
        .from('sensor_data')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw error

      const latest = data as SensorDataRow | null

      setSensors({
        sensor1: {
          detections: latest ? Number(latest.sensor_1_counter ?? 0) : 0,
          lastSeen: latest ? new Date(latest.timestamp).toLocaleTimeString('fr-FR') : '-',
          status: latest ? !!latest.sensor_1_status : false,
        },
        sensor2: {
          detections: latest ? Number(latest.sensor_2_counter ?? 0) : 0,
          lastSeen: latest ? new Date(latest.timestamp).toLocaleTimeString('fr-FR') : '-',
          status: latest ? !!latest.sensor_2_status : false,
        },
        sensor3: {
          detections: latest ? Number(latest.sensor_3_counter ?? 0) : 0,
          lastSeen: latest ? new Date(latest.timestamp).toLocaleTimeString('fr-FR') : '-',
          status: latest ? !!latest.sensor_3_status : false,
        },
      })

      // 2. Compute TRG/TRS from electronic_cards + losses (reliable source)
      const { start, end } = getTodayBounds()

      const [{ data: cards }, { data: losses }, { data: config }] = await Promise.all([
        supabase.from('electronic_cards').select('status').gte('created_at', start.toISOString()).lt('created_at', end.toISOString()),
        supabase.from('losses').select('loss_count').gte('created_at', start.toISOString()).lt('created_at', end.toISOString()),
        supabase.from('configuration').select('expected_cards').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      ])

      const started = cards?.length ?? 0
      const good = cards?.filter(c => c.status === 'completed').length ?? 0
      const target = Number(config?.expected_cards ?? 0)
      const lost = (losses ?? []).reduce((sum, r) => sum + Math.max(0, Number(r.loss_count ?? 0)), 0)
      const trg = target > 0 ? Math.round((good / target) * 100) : 0
      const trs = started > 0 ? Math.round((good / started) * 100) : 0

      setPerformance({ trg, trs, cards_started: started, cards_good: good, cards_target: target, loss_count: lost })
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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sensor_data' }, () => fetchSensors())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'electronic_cards' }, () => fetchSensors())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'losses' }, () => fetchSensors())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchSensors])

  const produced = sensors.sensor1.detections
  const goodCards = sensors.sensor3.detections

  return {
    sensors,
    logical: {
      entry: sensors.sensor1.detections,
      middle: sensors.sensor2.detections,
      exit: sensors.sensor3.detections,
    },
    produced,
    goodCards,
    trg: performance.trg,
    trs: performance.trs,
    totalLosses: performance.loss_count,
    expected: performance.cards_target,
    zone1Loss: 0,
    zone2Loss: 0,
    loading,
    refresh: fetchSensors,
  }
}
