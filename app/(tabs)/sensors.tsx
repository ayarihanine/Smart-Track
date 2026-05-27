import { View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator, ScrollView } from 'react-native'
import { useState, useEffect, useCallback } from 'react'
import { getSupabaseClient } from '@/lib/supabase'

type SensorLog = { id: string; sensor_id: string; state: string; created_at: string; recorded_at?: string }
type Module = { id: string; altIds: string[]; name: string }

const MODULES: Module[] = [
  { id: 'sensor1', altIds: ['sensor1', 'capteur1'], name: 'Capteur 1 (Entry)' },
  { id: 'sensor2', altIds: ['sensor2', 'capteur2'], name: 'Capteur 2 (Middle)' },
  { id: 'sensor3', altIds: ['sensor3', 'capteur3'], name: 'Capteur 3 (Exit)' },
]

function getModuleId(sensorId: string): string | null {
  for (const m of MODULES) {
    if (m.altIds.includes(sensorId)) return m.id
  }
  return null
}

export default function SensorsScreen() {
  const [logs, setLogs] = useState<Record<string, SensorLog[]>>({})
  const [states, setStates] = useState<Record<string, string>>({ sensor1: 'FALSE', sensor2: 'FALSE', sensor3: 'FALSE' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async () => {
    setError(null)
    setLoading(true)
    const supabase = getSupabaseClient()
    if (!supabase) {
      setError('Supabase not configured')
      setLoading(false)
      return
    }

    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    try {
      const { data, error: dbError } = await supabase
        .from('sensor_events')
        .select('id, sensor_id, state, created_at, recorded_at')
        .gte('created_at', startOfDay.toISOString())
        .order('created_at', { ascending: false })
        .limit(150)

      if (dbError) throw dbError

      const grouped: Record<string, SensorLog[]> = { sensor1: [], sensor2: [], sensor3: [] }
      const latestState: Record<string, string> = { sensor1: 'FALSE', sensor2: 'FALSE', sensor3: 'FALSE' }

      ;(data || []).forEach(row => {
        const moduleId = getModuleId(row.sensor_id)
        if (moduleId) grouped[moduleId].push(row as SensorLog)
      })

      MODULES.forEach(m => {
        const sensorLogs = grouped[m.id]
        if (sensorLogs && sensorLogs.length > 0) {
          latestState[m.id] = sensorLogs[0].state === 'HIGH' ? 'TRUE' : 'FALSE'
        }
      })

      setLogs(grouped)
      setStates(latestState)
    } catch (err: any) {
      console.error('Sensor fetch error:', err)
      setError(err?.message || 'Failed to fetch sensor data')
    }
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Realtime subscription
  useEffect(() => {
    const supabase = getSupabaseClient()
    if (!supabase) return

    const channel = supabase
      .channel('sensors_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sensor_events' }, () => {
        fetchData()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchData])

  const renderLogItem = ({ item }: { item: SensorLog }) => (
    <View style={styles.logRow}>
      <Text style={styles.logDate}>{new Date(item.created_at || item.recorded_at).toLocaleDateString('fr-FR')}</Text>
      <Text style={styles.logTime}>{new Date(item.created_at || item.recorded_at).toLocaleTimeString('fr-FR')}</Text>
      <Text style={[styles.logState, { color: item.state === 'HIGH' ? '#22c55e' : '#ef4444' }]}>
        {item.state === 'HIGH' ? 'TRUE' : 'FALSE'}
      </Text>
    </View>
  )

  if (loading && !refreshing && Object.keys(logs).length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Interface d'acquisition</Text>
          <Text style={styles.headerSub}>Real-time sensor state monitoring</Text>
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading sensors...</Text>
        </View>
      </View>
    )
  }

  if (error && Object.keys(logs).length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Interface d'acquisition</Text>
          <Text style={styles.headerSub}>Real-time sensor state monitoring</Text>
        </View>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Interface d'acquisition</Text>
        <Text style={styles.headerSub}>Real-time sensor state monitoring</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.modulesList}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData() }} />}
      >
        {MODULES.map(m => (
          <View key={m.id} style={styles.moduleCard}>
            <View style={styles.moduleHeader}>
              <Text style={styles.moduleTitle}>{m.name}</Text>
              <View style={[styles.indicator, { backgroundColor: states[m.id] === 'TRUE' ? '#22c55e' : '#ef4444' }]} />
            </View>
            <FlatList
              data={logs[m.id] || []}
              renderItem={renderLogItem}
              keyExtractor={(log) => log.id}
              style={styles.logList}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={<Text style={styles.emptyLog}>No events recorded today</Text>}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: { backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerSub: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  modulesList: { padding: 12, gap: 16 },
  moduleCard: { backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  moduleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  moduleTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  indicator: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#fff' },
  logList: { maxHeight: 220, backgroundColor: '#f9fafb', borderRadius: 8 },
  logRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  logDate: { fontSize: 11, color: '#6b7280', width: '32%' },
  logTime: { fontSize: 11, color: '#374151', width: '32%' },
  logState: { fontSize: 11, fontWeight: '600', width: '36%', textAlign: 'right' },
  emptyLog: { padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 12 },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 12, fontSize: 15, color: '#6b7280' },
  errorText: { fontSize: 16, color: '#ef4444', textAlign: 'center' },
})
