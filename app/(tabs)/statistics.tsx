import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart } from 'react-native-chart-kit';
import { borderRadius, spacing, typography } from '@/constants/design';
import { useTheme } from '@/components/ThemeProvider';
import {
  computeKPIs,
  fetchConfiguration,
  fetchLatestSensorStates,
  ProductionKPIs,
} from '@/lib/api';
import { getSupabaseClient } from '@/lib/supabase';

const screenWidth = Dimensions.get('window').width;

function getSensorPosition(sensorId: string): 1 | 2 | 3 | null {
  if (sensorId === 'capteur1' || sensorId === 'sensor1') return 1;
  if (sensorId === 'capteur2' || sensorId === 'sensor2') return 2;
  if (sensorId === 'capteur3' || sensorId === 'sensor3') return 3;
  return null;
}

export default function StatisticsScreen() {
  const { palette, isDark } = useTheme();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [eventCounts, setEventCounts] = useState<{ label: string; count: number }[]>([]);
  const [kpis, setKpis] = useState<ProductionKPIs | null>(null);

  const loadData = async () => {
    try {
      setError(null);

      const supabase = getSupabaseClient();
      if (!supabase) return;

      const start = new Date();
      start.setHours(0, 0, 0, 0);

      // Fetch sensor events today
      const { data: events, error: eventsError } = await supabase
        .from('sensor_events')
        .select('sensor_id, state, recorded_at')
        .in('sensor_id', ['capteur1', 'capteur2', 'capteur3', 'sensor1', 'sensor2', 'sensor3'])
        .gte('recorded_at', start.toISOString())
        .order('recorded_at', { ascending: false });

      if (eventsError) throw eventsError;

      // Fetch current sensor states & config to compute KPIs
      const [sensorsData, configData] = await Promise.all([
        fetchLatestSensorStates(),
        fetchConfiguration(),
      ]);

      // Process event counts
      const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
      if (events) {
        for (const ev of events) {
          const pos = getSensorPosition(ev.sensor_id);
          if (pos) {
            counts[pos]++;
          }
        }
      }

      setEventCounts([
        { label: 'Capteur 1', count: counts[1] },
        { label: 'Capteur 2', count: counts[2] },
        { label: 'Capteur 3', count: counts[3] },
      ]);

      const expectedVal = Number(configData?.nb_cartes_attendues || 10);
      const machineName = String(configData?.machine_name || 'NPM-DX-1');
      const shiftStart = String(configData?.shift_start || '08:00:00');
      const shiftEnd = String(configData?.shift_end || '16:00:00');

      setKpis(
        computeKPIs(sensorsData, {
          nb_cartes_attendues: expectedVal,
          machine_name: machineName,
          shift_start: shiftStart,
          shift_end: shiftEnd,
        })
      );
    } catch (err) {
      console.error('statistics loadData error:', err);
      setError('Failed to load statistics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadData();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  const totalEventsCount = eventCounts.reduce((acc, curr) => acc + curr.count, 0);
  const showEmpty = totalEventsCount === 0;

  const barChartData = useMemo(() => {
    if (showEmpty) return null;
    return {
      labels: eventCounts.map((e) => e.label.replace('Capteur ', 'C')),
      datasets: [{ data: eventCounts.map((e) => Math.max(e.count, 0)) }],
    };
  }, [eventCounts, showEmpty]);

  const barChartConfig = {
    backgroundGradientFrom: palette.background,
    backgroundGradientTo: palette.background,
    decimalPlaces: 0,
    color: () => palette.primary,
    labelColor: () => palette.textSecondary,
    barPercentage: 0.55,
    propsForBackgroundLines: { stroke: palette.border },
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: palette.backgroundSecondary }]}>
        <ActivityIndicator size="large" color={palette.primary} />
      </SafeAreaView>
    );
  }

  if (error || !kpis) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: palette.backgroundSecondary }]}>
        <Text style={[styles.errorText, { color: '#ef4444' }]}>{error || 'Error loading analytics.'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => { setLoading(true); loadData(); }}>
          <Text style={styles.retryText}>Tap to retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.backgroundSecondary }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: palette.background, borderBottomColor: palette.border }]}>
        <Text style={[styles.title, { color: palette.text }]}>Analytics</Text>
        <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
          Sensor activity and live KPIs
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={palette.primary}
          />
        }
      >
        {/* ── Sensor Events Bar Chart ──────────────────────────── */}
        <View style={[styles.card, { backgroundColor: palette.background, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Events today by sensor</Text>
          {barChartData ? (
            <BarChart
              data={barChartData}
              width={screenWidth - spacing.lg * 2 - spacing.md * 2}
              height={220}
              chartConfig={barChartConfig}
              style={styles.chart}
              fromZero
              showValuesOnTopOfBars
              yAxisLabel=""
              yAxisSuffix=""
            />
          ) : (
            <Text style={[styles.empty, { color: palette.textSecondary }]}>
              No sensor activity recorded today.
            </Text>
          )}
        </View>

        {/* ── Current KPI Summary ──────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: palette.background, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Current KPI summary</Text>
          <View style={styles.kpiTiles}>
            <View style={[styles.kpiTile, { backgroundColor: isDark ? palette.backgroundTertiary : palette.backgroundSecondary }]}>
              <Text style={[styles.kpiLabel, { color: palette.textSecondary }]}>TRG</Text>
              <Text style={[styles.kpiValue, { color: palette.text }]}>{kpis.trgPercent}%</Text>
            </View>
            <View style={[styles.kpiTile, { backgroundColor: isDark ? palette.backgroundTertiary : palette.backgroundSecondary }]}>
              <Text style={[styles.kpiLabel, { color: palette.textSecondary }]}>TRS</Text>
              <Text style={[styles.kpiValue, { color: palette.text }]}>{kpis.trsPercent}%</Text>
            </View>
            <View style={[styles.kpiTile, { backgroundColor: isDark ? palette.backgroundTertiary : palette.backgroundSecondary }]}>
              <Text style={[styles.kpiLabel, { color: palette.textSecondary }]}>Produced</Text>
              <Text style={[styles.kpiValue, { color: palette.text }]}>{kpis.cardsProduced}</Text>
            </View>
            <View style={[styles.kpiTile, { backgroundColor: isDark ? palette.backgroundTertiary : palette.backgroundSecondary }]}>
              <Text style={[styles.kpiLabel, { color: palette.textSecondary }]}>Losses</Text>
              <Text style={[styles.kpiValue, { color: '#ef4444' }]}>{kpis.totalLosses}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  errorText: { fontSize: 16, marginBottom: 16, textAlign: 'center' },
  retryButton: { backgroundColor: '#3b82f6', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: '600' },
  header: { padding: spacing.md, borderBottomWidth: 1 },
  title: { ...typography.h3, fontWeight: '700' },
  subtitle: { ...typography.small, marginTop: 4 },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  card: { borderRadius: borderRadius.lg, borderWidth: 1, padding: spacing.md },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  chart: { marginLeft: -spacing.sm, borderRadius: borderRadius.md },
  empty: { ...typography.body, textAlign: 'center', paddingVertical: spacing.lg },
  kpiTiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiTile: { width: '47%', borderRadius: borderRadius.md, padding: spacing.md },
  kpiLabel: { ...typography.tiny, fontWeight: '500' },
  kpiValue: { ...typography.h4, fontWeight: '700', marginTop: 4 },
});
