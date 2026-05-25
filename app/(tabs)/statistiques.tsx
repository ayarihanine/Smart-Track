import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';

import { borderRadius, spacing, typography } from '@/constants/design';
import { useTheme } from '@/components/ThemeProvider';
import {
  computeKPIs,
  fetchConfiguration,
  fetchLatestSensorStates,
  fetchSensorEventCountsToday,
  fetchSensorEventsLast24h,
  ProductionKPIs,
} from '@/lib/api';
import { SensorEvent } from '@/types';

const screenWidth = Dimensions.get('window').width;

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function StatisticsScreen() {
  const { palette, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [eventCounts, setEventCounts] = useState<{ label: string; count: number }[]>([]);
  const [timeline, setTimeline] = useState<SensorEvent[]>([]);
  const [kpis, setKpis] = useState<ProductionKPIs | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [counts, events, sensors, config] = await Promise.all([
        fetchSensorEventCountsToday(),
        fetchSensorEventsLast24h(),
        fetchLatestSensorStates(),
        fetchConfiguration(),
      ]);

      setEventCounts(counts.map((c) => ({ label: c.label, count: c.count })));
      setTimeline(events);
      setKpis(
        computeKPIs(sensors, {
          nb_cartes_attendues: Number(config?.nb_cartes_attendues ?? 10),
          machine_name: String(config?.machine_name ?? 'NPM-DX-1'),
          shift_start: String(config?.shift_start ?? '08:00:00'),
          shift_end: String(config?.shift_end ?? '16:00:00'),
        })
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const barChart = useMemo(() => {
    if (eventCounts.length === 0) return null;
    return {
      labels: eventCounts.map((e) => e.label.replace('Capteur ', 'C')),
      datasets: [{ data: eventCounts.map((e) => Math.max(e.count, 0)) }],
    };
  }, [eventCounts]);

  const chartConfig = {
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
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={palette.primary} />
        }
      >
        <View style={[styles.card, { backgroundColor: palette.background, borderColor: palette.border }]}>
          <Text style={[styles.cardTitle, { color: palette.text }]}>Events today by sensor</Text>
          {barChart && barChart.datasets[0].data.some((v) => v > 0) ? (
            <BarChart
              data={barChart}
              width={screenWidth - spacing.lg * 2}
              height={200}
              chartConfig={chartConfig}
              style={styles.chart}
              fromZero
              showValuesOnTopOfBars
              yAxisLabel=""
              yAxisSuffix=""
            />
          ) : (
            <Text style={[styles.empty, { color: palette.textSecondary }]}>No sensor events recorded today.</Text>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: palette.background, borderColor: palette.border }]}>
          <Text style={[styles.cardTitle, { color: palette.text }]}>Last 24 hours activity</Text>
          {timeline.length === 0 ? (
            <Text style={[styles.empty, { color: palette.textSecondary }]}>
              No sensor activity in the last 24 hours.
            </Text>
          ) : (
            timeline.slice(-40).map((event) => (
              <View key={event.id} style={[styles.timelineRow, { borderBottomColor: palette.border }]}>
                <Text style={[styles.timelineSensor, { color: palette.text }]}>{event.sensor_id}</Text>
                <View style={[styles.stateBadge, { backgroundColor: event.state === 'HIGH' ? '#D1FAE5' : '#FEE2E2' }]}>
                  <Text style={{ color: event.state === 'HIGH' ? '#065F46' : '#991B1B', fontSize: 11, fontWeight: '700' }}>
                    {event.state}
                  </Text>
                </View>
                <Text style={[styles.timelineTime, { color: palette.textTertiary }]}>
                  {formatTime(event.recorded_at)}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={[styles.card, { backgroundColor: palette.background, borderColor: palette.border }]}>
          <Text style={[styles.cardTitle, { color: palette.text }]}>Current KPI summary</Text>
          <View style={styles.kpiTiles}>
            <View style={[styles.kpiTile, { backgroundColor: isDark ? palette.backgroundTertiary : palette.backgroundSecondary }]}>
              <Text style={[styles.kpiLabel, { color: palette.textSecondary }]}>TRG</Text>
              <Text style={[styles.kpiValue, { color: palette.text }]}>{kpis?.trgPercent ?? 0}%</Text>
            </View>
            <View style={[styles.kpiTile, { backgroundColor: isDark ? palette.backgroundTertiary : palette.backgroundSecondary }]}>
              <Text style={[styles.kpiLabel, { color: palette.textSecondary }]}>TRS</Text>
              <Text style={[styles.kpiValue, { color: palette.text }]}>{kpis?.trsPercent ?? 0}%</Text>
            </View>
            <View style={[styles.kpiTile, { backgroundColor: isDark ? palette.backgroundTertiary : palette.backgroundSecondary }]}>
              <Text style={[styles.kpiLabel, { color: palette.textSecondary }]}>Produced</Text>
              <Text style={[styles.kpiValue, { color: palette.text }]}>{kpis?.cardsProduced ?? 0}</Text>
            </View>
            <View style={[styles.kpiTile, { backgroundColor: isDark ? palette.backgroundTertiary : palette.backgroundSecondary }]}>
              <Text style={[styles.kpiLabel, { color: palette.textSecondary }]}>Losses</Text>
              <Text style={[styles.kpiValue, { color: '#F59E0B' }]}>{kpis?.totalLosses ?? 0}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { padding: spacing.md, borderBottomWidth: 1 },
  title: { ...typography.h3, fontWeight: '700' },
  subtitle: { ...typography.small, marginTop: 4 },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  card: { borderRadius: borderRadius.lg, borderWidth: 1, padding: spacing.md },
  cardTitle: { ...typography.bodyBold, marginBottom: spacing.md },
  chart: { marginLeft: -spacing.sm, borderRadius: borderRadius.md },
  empty: { ...typography.body, textAlign: 'center', paddingVertical: spacing.lg },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  timelineSensor: { flex: 1, ...typography.smallBold },
  stateBadge: { borderRadius: borderRadius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  timelineTime: { ...typography.tiny },
  kpiTiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiTile: { width: '47%', borderRadius: borderRadius.md, padding: spacing.md },
  kpiLabel: { ...typography.tiny },
  kpiValue: { ...typography.h4, fontWeight: '700', marginTop: 4 },
});
