import { Redirect, router } from 'expo-router';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Button } from 'react-native';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { colors } from '@/constants/design';
import { getSupabaseClient } from '@/lib/supabase';
import { useSensorCounters } from '@/hooks/useSensorCounters';
import { useTodaysLosses } from '@/hooks/useTodaysLosses';

export default function Index() {
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const { sensors, produced, lost, zone1Loss, zone2Loss } = useSensorCounters();
  const { totalCost, totalCards, loading: lossesLoading } = useTodaysLosses('today');
  const [expected, setExpected] = useState(10);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    supabase
      .from('configuration')
      .select('expected_daily_production, nb_cartes_attendues')
      .single()
      .then(({ data }) => {
        if (data) {
          setExpected(
            Number(data.expected_daily_production ?? data.nb_cartes_attendues ?? 10) || 10
          );
        }
      });
  }, []);

  if (authLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.title}>📡 Capteurs</Text>
        {(['sensor1', 'sensor2', 'sensor3'] as const).map((id) => (
          <View key={id} style={styles.row}>
            <Text>{id}:</Text>
            <Text style={{ fontWeight: '600' }}>{sensors[id].counter}</Text>
            <Text style={{ color: sensors[id].active ? '#22c55e' : '#6b7280' }}>
              {sensors[id].active ? '●' : '○'}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.section}>
        <Text style={styles.title}>📊 Production</Text>
        <Text>
          Attendu: <Text style={styles.value}>{expected}</Text>
        </Text>
        <Text>
          Produit: <Text style={styles.value}>{produced}</Text>
        </Text>
        <Text>
          Perdu:{' '}
          <Text style={[styles.value, { color: lost > 0 ? '#ef4444' : '#22c55e' }]}>{lost}</Text>
        </Text>
        <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
          Zone 1: {zone1Loss} | Zone 2: {zone2Loss}
        </Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.title}>💰 Pertes (Aujourd'hui)</Text>
        {lossesLoading ? (
          <ActivityIndicator />
        ) : (
          <Text style={styles.cost}>{totalCost.toFixed(3)} TND</Text>
        )}
        <Text style={{ color: '#6b7280' }}>{totalCards} cartes</Text>
      </View>
      <View style={styles.nav}>
        <Button title="📊 Dashboard" onPress={() => router.push('/(tabs)/dashboard' as any)} />
        <Button title="📜 Historique" onPress={() => router.push('/(tabs)/pertes' as any)} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  section: { margin: 16, padding: 16, backgroundColor: '#f9fafb', borderRadius: 12 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  value: { fontWeight: '600', fontSize: 16 },
  cost: { fontSize: 28, fontWeight: '700', color: '#1f2937' },
  nav: { margin: 16, gap: 12, paddingBottom: 32 },
});
