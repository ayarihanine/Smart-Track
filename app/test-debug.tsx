import { View, Text, ScrollView, Button } from 'react-native'
import { getSupabaseClient } from '@/lib/supabase'
import { useRouter } from 'expo-router'
import { useState } from 'react'

export default function TestDebug() {
  const router = useRouter()
  const [results, setResults] = useState<string[]>([])

  const runAllTests = async () => {
    const supabase = getSupabaseClient()
    if (!supabase) {
      setResults(prev => [...prev, '❌ Supabase client is null'])
      return
    }

    setResults(['🔄 Running tests...'])

    // Test 1: Can we connect?
    const { data: user, error: authErr } = await supabase.auth.getUser()
    setResults(prev => [...prev, `🔐 Auth: ${authErr ? 'ERROR' : user?.user ? 'logged in' : 'anon'}`])

    // Test 2: Raw sensor query (NO filters)
    const { data: sensors, error: sErr } = await supabase
      .from('sensor_events')
      .select('sensor_id,counter,recorded_at')
      .order('recorded_at', { ascending: false })
      .limit(3)
    setResults(prev => [...prev, `📡 Sensors: ${sErr ? `ERROR: ${sErr.message}` : `✓ ${sensors?.length || 0} rows`}`])
    if (sensors?.[0]) setResults(prev => [...prev, `   └─ Sample: ${JSON.stringify(sensors[0])}`])

    // Test 3: Raw losses query (NO date filter)
    const { data: losses, error: lErr } = await supabase
      .from('production_losses')
      .select('zone_from,quantity,estimated_cost_tnd,loss_date')
      .order('loss_date', { ascending: false })
      .limit(3)
    setResults(prev => [...prev, `💰 Losses: ${lErr ? `ERROR: ${lErr.message}` : `✓ ${losses?.length || 0} rows`}`])
    if (losses?.[0]) setResults(prev => [...prev, `   └─ Sample: ${JSON.stringify(losses[0])}`])

    // Test 4: Try with TODAY filter (like your hook)
    const startOfToday = new Date()
    startOfToday.setUTCHours(0, 0, 0, 0)
    const todayFilter = startOfToday.toISOString()
    const { data: todayLosses, error: tlErr } = await supabase
      .from('production_losses')
      .select('estimated_cost_tnd')
      .gte('loss_date', todayFilter)
    setResults(prev => [...prev, `📅 Today filter: ${tlErr ? `ERROR: ${tlErr.message}` : `✓ ${todayLosses?.length || 0} rows`}`])

    // Test 5: Sum calculation (like your hook)
    if (todayLosses && !tlErr) {
      const sum = todayLosses.reduce((acc, row) => acc + Number(row.estimated_cost_tnd || 0), 0)
      setResults(prev => [...prev, `🧮 Sum calculation: ${sum.toFixed(3)} TND`])
    }

    setResults(prev => [...prev, '✅ Tests complete'])
  }

  return (
    <ScrollView style={{ flex: 1, padding: 16, backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 16 }}>🧪 Supabase Debug Test</Text>
      
      <Button title="Run All Tests" onPress={runAllTests} />
      
      <View style={{ marginTop: 20 }}>
        {results.map((line, i) => (
          <Text key={i} style={{ fontFamily: 'monospace', fontSize: 12, marginBottom: 4 }}>
            {line}
          </Text>
        ))}
      </View>

      <Button title="← Back to Home" onPress={() => router.back()} />
    </ScrollView>
  )
}
