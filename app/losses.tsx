import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { useState, useEffect } from 'react'
import { getSupabaseClient } from '@/lib/supabase'

type Period = 'today' | 'week' | 'month'

export default function LossesScreen() {
  const [period, setPeriod] = useState<Period>('today')
  const [data, setData] = useState<any[]>([])
  const [summary, setSummary] = useState({ totalCost: 0, totalCards: 0, zone1: 0, zone2: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLosses = async () => {
      setLoading(true)
      const supabase = getSupabaseClient()
      if (!supabase) return

      const now = new Date()
      let startDate = new Date()

      if (period === 'week') startDate.setDate(now.getDate() - 7)
      else if (period === 'month') startDate.setMonth(now.getMonth() - 1)
      else startDate.setHours(0, 0, 0, 0)

      try {
        const { data: records, error } = await supabase
          .from('production_losses')
          .select('*')
          .gte('loss_date', startDate.toISOString())
          .order('loss_date', { ascending: false })

        if (error) throw error

        let totalCost = 0, totalCards = 0, zone1 = 0, zone2 = 0
        records?.forEach(row => {
          totalCost += Number(row.estimated_cost_tnd || 0)
          totalCards += Number(row.quantity || 0)
          if (row.zone_from === 'capteur1') zone1 += Number(row.quantity || 0)
          if (row.zone_from === 'capteur2') zone2 += Number(row.quantity || 0)
        })

        setData(records || [])
        setSummary({ totalCost, totalCards, zone1, zone2 })
      } catch (err) {
        console.error('Losses fetch error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchLosses()
  }, [period])

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Losses History</Text>
        <View style={styles.summaryPill}>
          <Text style={styles.pillText}>{summary.totalCards} lost cards → {summary.totalCost.toFixed(3)} TND</Text>
        </View>
      </View>

      <View style={styles.financialCard}>
        <Text style={styles.financialLabel}>TOTAL FINANCIAL COST</Text>
        <Text style={styles.financialValue}>{summary.totalCost.toFixed(3)} <Text style={styles.currency}>TND</Text></Text>
        <Text style={styles.financialSub}>{summary.totalCards} lost cards</Text>
        <Text style={styles.zoneBreakdown}>Zone 1 (Entry → Middle): {summary.zone1}</Text>
        <Text style={styles.zoneBreakdown}>Zone 2 (Middle → Exit): {summary.zone2}</Text>
      </View>

      <View style={styles.tabs}>
        {(['today', 'week', 'month'] as const).map(p => (
          <TouchableOpacity
            key={p}
            style={[styles.tab, period === p && styles.tabActive]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[styles.tabText, period === p && styles.tabTextActive]}>
              {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.listContainer}>
        {data.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}><Text style={{fontSize: 32}}>✅</Text></View>
            <Text style={styles.emptyTitle}>No losses detected</Text>
            <Text style={styles.emptySub}>No losses recorded for this period.</Text>
          </View>
        ) : (
          data.map((item, idx) => (
            <View key={item.id || idx} style={styles.lossCard}>
              <View style={styles.lossHeader}>
                <Text style={styles.lossDate}>{new Date(item.loss_date).toLocaleDateString('fr-FR')}</Text>
                <Text style={styles.lossCost}>{Number(item.estimated_cost_tnd).toFixed(3)} TND</Text>
              </View>
              <View style={styles.lossDetails}>
                <Text style={styles.lossZone}>Zone: {item.zone_from}</Text>
                <Text style={styles.lossQty}>{item.quantity} cards</Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: { backgroundColor: '#fff', padding: 20, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  headerTitle: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  summaryPill: { backgroundColor: '#fef2f2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, alignSelf: 'flex-start' },
  pillText: { color: '#dc2626', fontWeight: '600', fontSize: 13 },
  financialCard: { backgroundColor: '#fff', margin: 16, padding: 20, borderRadius: 16 },
  financialLabel: { fontSize: 12, color: '#6b7280', marginBottom: 4, fontWeight: '600' },
  financialValue: { fontSize: 32, fontWeight: '700', color: '#111827' },
  currency: { color: '#ef4444', fontSize: 20 },
  financialSub: { fontSize: 14, color: '#374151', marginTop: 4 },
  zoneBreakdown: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 16, padding: 4, borderRadius: 12, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: '#ef4444' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  tabTextActive: { color: '#fff' },
  listContainer: { paddingHorizontal: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  emptySub: { color: '#6b7280' },
  lossCard: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  lossHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  lossDate: { fontSize: 14, fontWeight: '600' },
  lossCost: { fontSize: 14, fontWeight: '700', color: '#ef4444' },
  lossDetails: { flexDirection: 'row', justifyContent: 'space-between' },
  lossZone: { fontSize: 13, color: '#6b7280' },
  lossQty: { fontSize: 13, fontWeight: '600' },
})
