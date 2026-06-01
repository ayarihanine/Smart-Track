import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  ActivityIndicator, ScrollView, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTheme } from '@/components/ThemeProvider';
import { getSupabaseClient } from '@/lib/supabase';
import { borderRadius, shadows, spacing, typography } from '@/constants/design';

type SensorDataRow = {
  id: string;
  timestamp: string;
  sensor_1_status: boolean;
  sensor_2_status: boolean;
  sensor_3_status: boolean;
  sensor_1_counter: number;
  sensor_2_counter: number;
  sensor_3_counter: number;
};

const MODULES = [
  { id: 'sensor1', name: 'Sensor 1', loc: 'Entry', icon: 'enter-outline', statusKey: 'sensor_1_status' as const, counterKey: 'sensor_1_counter' as const, accentColor: '#3B82F6' },
  { id: 'sensor2', name: 'Sensor 2', loc: 'Middle', icon: 'git-merge-outline', statusKey: 'sensor_2_status' as const, counterKey: 'sensor_2_counter' as const, accentColor: '#8B5CF6' },
  { id: 'sensor3', name: 'Sensor 3', loc: 'Exit', icon: 'exit-outline', statusKey: 'sensor_3_status' as const, counterKey: 'sensor_3_counter' as const, accentColor: '#10B981' },
];

export default function SensorsScreen() {
  const router = useRouter();
  const { palette, isDark } = useTheme();
  const [rows, setRows] = useState<SensorDataRow[]>([]);
  const [latest, setLatest] = useState<SensorDataRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    setError(null);
    const supabase = getSupabaseClient();
    if (!supabase) { setError('Supabase not configured'); setLoading(false); return; }
    try {
      const { data, error: dbError } = await supabase
        .from('sensor_data')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(50);
      if (dbError) throw dbError;
      const fetched = (data || []) as SensorDataRow[];
      setRows(fetched);
      if (fetched.length > 0) setLatest(fetched[0]);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch sensor data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const channel = supabase
      .channel('sensors_live_v2')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sensor_data' }, () => { fetchData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const piOnline = latest !== null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.backgroundSecondary }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: palette.background, borderBottomColor: palette.border }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: isDark ? '#1e293b' : '#F3F4F6' }]}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={20} color={palette.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.headerTitle, { color: palette.text }]}>Sensor Monitor</Text>
          <Text style={[styles.headerSub, { color: palette.textSecondary }]}>Real-time GPIO acquisition</Text>
        </View>
        <View style={[styles.onlineBadge, { backgroundColor: piOnline ? (isDark ? '#14532d' : '#DCFCE7') : (isDark ? '#1e293b' : '#F3F4F6') }]}>
          <View style={[styles.onlineDot, { backgroundColor: piOnline ? '#22C55E' : '#9CA3AF' }]} />
          <Text style={[styles.onlineText, { color: piOnline ? '#15803D' : '#6B7280' }]}>
            {piOnline ? 'Live' : 'Offline'}
          </Text>
        </View>
      </View>

      {loading && rows.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={palette.primary} />
          <Text style={[styles.loadingText, { color: palette.textSecondary }]}>Loading sensor data…</Text>
        </View>
      ) : error && rows.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={[styles.errorText, { color: '#EF4444' }]}>{error}</Text>
          <TouchableOpacity style={[styles.retryBtn, { backgroundColor: palette.primary }]} onPress={() => { setLoading(true); fetchData(); }}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={palette.primary} />}
        >
          {/* Live Status Cards */}
          <View style={styles.sensorRow}>
            {MODULES.map((m) => {
              const isHigh = latest ? latest[m.statusKey] : false;
              const counter = latest ? Number(latest[m.counterKey] ?? 0) : 0;
              const dotColor = isHigh ? '#22C55E' : '#EF4444';
              const bg = isHigh
                ? (isDark ? '#14532d' : '#DCFCE7')
                : (isDark ? '#450a0a' : '#FEF2F2');

              return (
                <LinearGradient
                  key={m.id}
                  colors={isHigh
                    ? (isDark ? ['#14532d', '#166534'] : ['#F0FDF4', '#DCFCE7'])
                    : (isDark ? ['#450a0a', '#7f1d1d'] : ['#FEF2F2', '#FEE2E2'])}
                  style={[styles.sensorCard, { borderColor: dotColor + '44' }]}
                >
                  <View style={[styles.sensorIconBox, { backgroundColor: m.accentColor + '22' }]}>
                    <Ionicons name={m.icon as any} size={18} color={m.accentColor} />
                  </View>
                  <View style={[styles.sensorDot, { backgroundColor: dotColor }]} />
                  <Text style={[styles.sensorName, { color: palette.text }]}>{m.name}</Text>
                  <Text style={[styles.sensorLoc, { color: palette.textSecondary }]}>{m.loc}</Text>
                  <Text style={[styles.sensorState, { color: dotColor }]}>{isHigh ? 'HIGH' : 'LOW'}</Text>
                  <View style={[styles.counterBadge, { backgroundColor: isDark ? '#1e293b' : '#F1F5F9' }]}>
                    <Text style={[styles.counterText, { color: palette.text }]}>×{counter}</Text>
                  </View>
                </LinearGradient>
              );
            })}
          </View>

          {/* Event Log */}
          <View style={[styles.logCard, { backgroundColor: palette.background, borderColor: palette.border }]}>
            <View style={styles.logHeader}>
              <Text style={[styles.logTitle, { color: palette.text }]}>Event Log</Text>
              <View style={[styles.logBadge, { backgroundColor: isDark ? '#334155' : '#EFF6FF' }]}>
                <Text style={[styles.logBadgeText, { color: palette.primary }]}>{rows.length} records</Text>
              </View>
            </View>

            {/* Table Header */}
            <View style={[styles.tableHead, { backgroundColor: isDark ? '#1e293b' : '#F8FAFC', borderColor: palette.border }]}>
              <Text style={[styles.th, { color: palette.textSecondary, flex: 2 }]}>Time</Text>
              <Text style={[styles.th, { color: palette.textSecondary, textAlign: 'center' }]}>S1</Text>
              <Text style={[styles.th, { color: palette.textSecondary, textAlign: 'center' }]}>S2</Text>
              <Text style={[styles.th, { color: palette.textSecondary, textAlign: 'center' }]}>S3</Text>
            </View>

            {rows.slice(0, 30).map((item, idx) => (
              <View
                key={String(item.id)}
                style={[
                  styles.tableRow,
                  { borderBottomColor: palette.border },
                  idx === 0 && { backgroundColor: isDark ? '#1e3a5f22' : '#EFF6FF55' },
                ]}
              >
                <View style={{ flex: 2 }}>
                  <Text style={[styles.tdDate, { color: palette.text }]}>
                    {new Date(item.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </Text>
                  <Text style={[styles.tdDateSub, { color: palette.textTertiary }]}>
                    {new Date(item.timestamp).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                  </Text>
                </View>
                {[item.sensor_1_status, item.sensor_2_status, item.sensor_3_status].map((s, i) => (
                  <View key={i} style={[styles.tdCenter]}>
                    <View style={[styles.statusDot, { backgroundColor: s ? '#22C55E' : '#EF4444' }]} />
                    <Text style={[styles.tdState, { color: s ? '#22C55E' : '#EF4444' }]}>{s ? 'H' : 'L'}</Text>
                  </View>
                ))}
              </View>
            ))}

            {rows.length === 0 && (
              <View style={styles.emptyLog}>
                <Ionicons name="pulse-outline" size={32} color={palette.border} />
                <Text style={[styles.emptyLogText, { color: palette.textSecondary }]}>No sensor events recorded</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { ...typography.h4, fontWeight: '800' },
  headerSub: { ...typography.tiny, marginTop: 2 },
  onlineBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: borderRadius.full,
  },
  onlineDot: { width: 7, height: 7, borderRadius: 4 },
  onlineText: { ...typography.tiny, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { ...typography.small },
  errorText: { ...typography.body, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: borderRadius.md },
  retryText: { color: '#fff', fontWeight: '700' },
  scrollContent: { padding: spacing.md, gap: spacing.md, paddingBottom: 40 },
  sensorRow: { flexDirection: 'row', gap: 8 },
  sensorCard: {
    flex: 1, borderRadius: borderRadius.xl, borderWidth: 1,
    padding: spacing.sm, alignItems: 'center', gap: 4, ...shadows.xs,
  },
  sensorIconBox: {
    width: 32, height: 32, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  sensorDot: { width: 8, height: 8, borderRadius: 4 },
  sensorName: { ...typography.tiny, fontWeight: '800' },
  sensorLoc: { fontSize: 9, fontWeight: '600' },
  sensorState: { ...typography.tiny, fontWeight: '800', textTransform: 'uppercase' },
  counterBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: borderRadius.full, marginTop: 2 },
  counterText: { fontSize: 10, fontWeight: '700' },
  logCard: {
    borderRadius: borderRadius.xl, borderWidth: 1,
    overflow: 'hidden', ...shadows.sm,
  },
  logHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.md, paddingBottom: spacing.sm,
  },
  logTitle: { ...typography.bodyBold, fontSize: 16 },
  logBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: borderRadius.full },
  logBadgeText: { ...typography.tiny, fontWeight: '800' },
  tableHead: {
    flexDirection: 'row', paddingHorizontal: spacing.md, paddingVertical: 8,
    borderTopWidth: 1, borderBottomWidth: 1,
  },
  th: { ...typography.tiny, fontWeight: '800', textTransform: 'uppercase', flex: 1 },
  tableRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: 8,
    borderBottomWidth: 1,
  },
  tdDate: { ...typography.tiny, fontWeight: '700' },
  tdDateSub: { fontSize: 9, marginTop: 1 },
  tdCenter: { flex: 1, alignItems: 'center', gap: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  tdState: { fontSize: 9, fontWeight: '800' },
  emptyLog: { alignItems: 'center', gap: 8, paddingVertical: 32 },
  emptyLogText: { ...typography.small },
});
