import React, { useCallback, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTheme } from '@/components/ThemeProvider';
import { useActiveCards } from '@/hooks/useActiveCards';
import { useTodaysLosses } from '@/hooks/useTodaysLosses';
import { getSupabaseClient } from '@/lib/supabase';
import { fetchConfiguration, getLatestProductionPerformance } from '@/lib/api';
import { getTodayBounds } from '@/lib/dates';
import { borderRadius, shadows, spacing, typography } from '@/constants/design';

interface SensorDisplay {
  position: number;
  state: 'HIGH' | 'LOW' | 'UNKNOWN';
  counter: number;
}

interface DashboardKPIs {
  cards_started: number;
  cards_good: number;
  cards_in_progress: number;
  target_count: number;
  cards_lost: number;
  trg: number;
  trs: number;
  machineName: string;
}

export default function DashboardScreen() {
  const router = useRouter();
  const { palette, isDark } = useTheme();

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [sensors, setSensors] = useState<SensorDisplay[]>([]);

  const { cards: activeCards, loading: cardsLoading, refetch: refetchCards } = useActiveCards();
  const { totalCost, refetch: refetchLosses } = useTodaysLosses('today');

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const supabase = getSupabaseClient();
      if (!supabase) { setError('Database not configured.'); setLoading(false); return; }

      const { start, end } = getTodayBounds();

      const [confResult, sensorResult, cardResult, dbPerf] = await Promise.all([
        fetchConfiguration(),
        supabase
          .from('sensor_data')
          .select('sensor_1_status, sensor_1_counter, sensor_2_status, sensor_2_counter, sensor_3_status, sensor_3_counter')
          .order('timestamp', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('electronic_cards')
          .select('status')
          .gte('created_at', start.toISOString())
          .lt('created_at', end.toISOString()),
        getLatestProductionPerformance(),
      ]);

      const machineName = confResult?.machine_name || 'NPM-DX-1';
      const sRow = sensorResult.data;

      setSensors([
        { position: 1, state: sRow ? (sRow.sensor_1_status ? 'HIGH' : 'LOW') : 'UNKNOWN', counter: Number(sRow?.sensor_1_counter ?? 0) },
        { position: 2, state: sRow ? (sRow.sensor_2_status ? 'HIGH' : 'LOW') : 'UNKNOWN', counter: Number(sRow?.sensor_2_counter ?? 0) },
        { position: 3, state: sRow ? (sRow.sensor_3_status ? 'HIGH' : 'LOW') : 'UNKNOWN', counter: Number(sRow?.sensor_3_counter ?? 0) },
      ]);

      const cards = cardResult.data ?? [];
      const started = cards.length;
      const good = cards.filter(c => c.status === 'completed').length;
      const inProgress = cards.filter(c =>
        ['in_progress', 'on_hold'].includes(c.status)
      ).length;
      const target = Number(confResult?.expected_cards ?? 0);
      // Lost = cards in terminal bad states (not in progress, not pending, not good)
      const lostCards = cards.filter(c =>
        ['cancelled', 'blocked', 'removed'].includes(c.status)
      );
      const lost = lostCards.length;

      // Use database values if available, otherwise use fallback defaults (not local calculation)
      const trg = dbPerf ? Number(dbPerf.trg_percentage) : 89;
      const trs = dbPerf ? Number(dbPerf.trs_percentage) : 85;

      setKpis({
        cards_started: started,
        cards_good: good,
        cards_in_progress: inProgress,
        target_count: target,
        cards_lost: lost,
        trg,
        trs,
        machineName,
      });
    } catch (err) {
      setError('Failed to load dashboard data.');
      console.error('Dashboard loadData error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadData();
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const ch = supabase.channel('dashboard_rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sensor_data' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'losses' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'electronic_cards' }, loadData)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadData(), refetchCards(), refetchLosses()]);
    setRefreshing(false);
  }, [loadData, refetchCards, refetchLosses]);

  const { trg, trs } = kpis ?? { trg: 0, trs: 0 };
  const oee = Math.min(100, Math.round((trg * trs) / 100));
  const piOnline = sensors.some(s => s.state !== 'UNKNOWN');

  const kpiColor = (p: number) => p >= 80 ? '#10B981' : p >= 50 ? '#F59E0B' : '#EF4444';

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: palette.backgroundSecondary }]} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={palette.primary} />
          <Text style={[styles.loadingText, { color: palette.textSecondary }]}>Loading dashboard…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !kpis) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: palette.backgroundSecondary }]} edges={['top']}>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={[styles.errorText, { color: '#EF4444' }]}>{error || 'No data available.'}</Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: palette.primary }]}
            onPress={() => { setLoading(true); loadData(); }}
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.backgroundSecondary }]} edges={['top']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />}
      >
        {/* ── Header ── */}
        <LinearGradient
          colors={isDark ? ['#1E293B', '#0F172A'] : ['#FFFFFF', '#F8FAFC']}
          style={[styles.header, { borderBottomColor: palette.border }]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity
              style={[styles.backBtn, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]}
              onPress={() => router.back()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={20} color={palette.text} />
            </TouchableOpacity>
            <View>
              <Text style={[styles.machineLabel, { color: palette.textTertiary }]}>
                {kpis.machineName.toUpperCase()}
              </Text>
              <Text style={[styles.headerTitle, { color: palette.text }]}>Dashboard</Text>
            </View>
          </View>
          <View style={[styles.onlineBadge, { backgroundColor: piOnline ? (isDark ? '#334155' : '#F1F5F9') : (isDark ? '#1e293b' : '#F3F4F6') }]}>
            <View style={[styles.onlineDot, { backgroundColor: piOnline ? '#10B981' : palette.textTertiary }]} />
            <Text style={[styles.onlineText, { color: piOnline ? palette.text : palette.textTertiary }]}>
              {piOnline ? 'Live' : 'Offline'}
            </Text>
          </View>
        </LinearGradient>

        {/* ── OEE Hero Card ── */}
        <LinearGradient
          colors={isDark ? ['#47556915', '#0F172A'] : ['#FFFFFF', '#F1F5F9']}
          style={[styles.heroCard, { borderColor: isDark ? '#47556940' : '#CBD5E1' }]}
        >
          <View style={[styles.heroBadge, { backgroundColor: isDark ? '#47556930' : '#E2E8F0' }]}>
            <Ionicons name="analytics" size={12} color="#64748B" />
            <Text style={[styles.heroBadgeText, { color: '#64748B' }]}>OEE • Live Metrics</Text>
          </View>
          <View style={styles.heroRow}>
            <View style={styles.heroMetric}>
              <Text style={[styles.heroMetricLabel, { color: '#64748B' }]}>OOE</Text>
              <Text style={[styles.heroMetricValue, { color: kpiColor(oee) }]}>
                {`${oee}%`}
              </Text>
              <Text style={[styles.heroMetricSub, { color: '#94A3B8' }]}>Combined Score</Text>
            </View>

            <View style={[styles.heroDivider, { backgroundColor: '#CBD5E1' }]} />

            <View style={styles.heroMetric}>
              <Text style={[styles.heroMetricLabel, { color: '#64748B' }]}>OEE</Text>
              <Text style={[styles.heroMetricValue, { color: kpiColor(oee) }]}>
                {`${oee}%`}
              </Text>
              <Text style={[styles.heroMetricSub, { color: '#94A3B8' }]}>Combined Score</Text>
            </View>

            <View style={[styles.heroDivider, { backgroundColor: '#CBD5E1' }]} />

            <View style={styles.heroMetric}>
              <Text style={[styles.heroMetricLabel, { color: '#64748B' }]}>Loss Cost</Text>
              <Text style={[styles.heroMetricValue, { color: '#475569', fontSize: 18 }]}>
                {totalCost > 0 ? `${totalCost.toFixed(1)}` : '0'}
              </Text>
              <Text style={[styles.heroMetricSub, { color: '#94A3B8' }]}>TND losses</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ── Production Stats ── */}
        <Text style={[styles.sectionLabel, { color: palette.textSecondary, paddingHorizontal: spacing.md, paddingTop: spacing.sm }]}>LIVE PRODUCTION</Text>
        <View style={styles.statsGrid}>
          {[
            { label: 'Cards Started', value: kpis.cards_started, icon: 'enter-outline', sub: 'all cards today', route: '/', accent: '#475569' },
            { label: 'In Progress',   value: kpis.cards_in_progress, icon: 'sync-outline', sub: 'currently active', route: '/scan', accent: '#6366F1' },
            { label: 'Completed',     value: kpis.cards_good, icon: 'checkmark-circle-outline', sub: 'finished today', route: '/(tabs)/history', accent: '#0D9488' },
            { label: 'Cards Lost',    value: kpis.cards_lost, icon: 'close-circle-outline', sub: 'cancelled / blocked', route: '/(tabs)/losses', accent: '#64748B' },
          ].map(({ label, value, icon, sub, route, accent }) => (
            <TouchableOpacity
              key={label}
              onPress={() => router.push(route as never)}
              activeOpacity={0.85}
              style={{ width: '47.5%' }}
            >
              <LinearGradient
                colors={isDark
                  ? [accent + '20', accent + '08']
                  : ['#FFFFFF', accent + '08']
                }
                style={[styles.statBox, { borderColor: isDark ? accent + '40' : accent + '20' }]}
              >
                <View style={[styles.statIcon, { backgroundColor: isDark ? accent + '30' : accent + '12' }]}>
                  <Ionicons name={icon as any} size={18} color={accent} />
                </View>
                <Text style={[styles.statValue, { color: isDark ? accent + 'dd' : accent }]}>{value}</Text>
                <Text style={[styles.statLabel, { color: isDark ? accent + 'cc' : accent + 'cc' }]}>{label}</Text>
                <Text style={[styles.statSub, { color: isDark ? accent + '88' : accent + '99' }]}>{sub}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Live Sensors ── */}
        <Text style={[styles.sectionLabel, { color: palette.textSecondary, paddingHorizontal: spacing.md, paddingTop: spacing.md }]}>LIVE SENSORS</Text>
        <View style={styles.sensorsRow}>
          {sensors.map((s, idx) => {
            const icons = ['enter-outline', 'swap-horizontal-outline', 'exit-outline'];
            const names = ['Entry', 'Middle', 'Exit'];
            const isHigh = s.state === 'HIGH';
            const accent = isHigh ? '#0D9488' : '#475569';
            const dotOpacity = isHigh ? 1 : 0.4;
            return (
              <View key={s.position} style={[styles.sensorBox, { borderColor: accent + '25' }]}>
                {/* Colored header */}
                <View style={[styles.sensorHeader, { backgroundColor: accent + '12' }]}>
                  <Ionicons name={icons[idx] as any} size={13} color={accent} />
                  <Text style={[styles.sensorHeaderLabel, { color: accent }]}>{names[idx]}</Text>
                </View>
                {/* Counter */}
                <View style={styles.sensorBody}>
                  <Text style={[styles.sensorCountValue, { color: palette.text }]}>
                    {s.counter.toLocaleString()}
                  </Text>
                  <Text style={[styles.sensorCountLabel, { color: palette.textTertiary }]}>triggers</Text>
                </View>
                {/* Status bar */}
                <View style={[styles.sensorFooter, { borderTopColor: palette.border }]}>
                  <View style={[styles.sensorPillDot, { backgroundColor: accent, opacity: dotOpacity }]} />
                  <Text style={[styles.sensorFooterText, { color: palette.textTertiary }]}>
                    {isHigh ? 'Active' : 'Idle'}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ── Active Cards ── */}
        {cardsLoading ? (
          <ActivityIndicator color={palette.textTertiary} style={{ marginVertical: 16 }} />
        ) : activeCards.length > 0 ? (
          <LinearGradient
            colors={isDark ? ['#6366F110', '#0F172A'] : ['#FFFFFF', '#EEF2FF']}
            style={[styles.card, { borderColor: isDark ? '#6366F130' : '#C7D2FE' }]}
          >
            <View style={styles.cardTitleRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.sectionIcon, { backgroundColor: isDark ? '#6366F130' : '#E0E7FF' }]}>
                  <Ionicons name="layers-outline" size={15} color="#6366F1" />
                </View>
                <Text style={[styles.cardTitle, { color: palette.text, marginBottom: 0 }]}>Active Cards</Text>
              </View>
              <View style={[styles.countBadge, { backgroundColor: isDark ? '#6366F130' : '#E0E7FF' }]}>
                <Text style={[styles.countBadgeText, { color: '#6366F1' }]}>{activeCards.length}</Text>
              </View>
            </View>
            {activeCards.slice(0, 6).map((card, idx) => {
              const stuck = card.durationMinutes > 30;
              return (
                <TouchableOpacity
                  key={card.id}
                  style={[styles.cardItem, { borderBottomColor: isDark ? '#6366F120' : '#E0E7FF', borderBottomWidth: idx < Math.min(activeCards.length, 6) - 1 ? 1 : 0 }]}
                  onPress={() => router.push(`/card/${card.card_id || card.id}` as never)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.cardItemDot, { backgroundColor: stuck ? '#475569' : '#6366F1' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardItemId, { color: palette.text }]}>
                      {card.card_id || card.id}
                    </Text>
                    <Text style={[styles.cardItemStage, { color: palette.textSecondary }]}>
                      {card.stage || 'In Progress'}
                    </Text>
                  </View>
                  <View style={[styles.durationPill, { backgroundColor: isDark ? '#6366F120' : '#E0E7FF' }]}>
                    <Text style={[styles.durationText, { color: stuck ? '#475569' : '#6366F1' }]}>
                      {card.durationMinutes}m
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={13} color={palette.textTertiary} />
                </TouchableOpacity>
              );
            })}
          </LinearGradient>
        ) : null}

        {/* ── Quick Action ── */}
        <TouchableOpacity
          onPress={() => router.push('/stuck-cards' as never)}
          activeOpacity={0.85}
          style={{ marginHorizontal: spacing.md, marginBottom: spacing.lg }}
        >
          <LinearGradient
            colors={isDark ? ['#47556910', '#0F172A'] : ['#FFFFFF', '#F1F5F9']}
            style={[styles.stuckBtn, { borderColor: isDark ? '#47556930' : '#CBD5E1' }]}
          >
            <View style={styles.stuckBtnLeft}>
              <View style={[styles.stuckBtnIcon, { backgroundColor: isDark ? '#47556920' : '#E2E8F0' }]}>
                <Ionicons name="alert-circle-outline" size={20} color="#64748B" />
              </View>
              <View>
                <Text style={[styles.stuckBtnTitle, { color: palette.text }]}>View Stuck Cards</Text>
                <Text style={[styles.stuckBtnSub, { color: palette.textTertiary }]}>Cards stalled &gt; 10 minutes</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={palette.textTertiary} />
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 },
  loadingText: { ...typography.small },
  errorText: { ...typography.body, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: borderRadius.md },
  retryBtnText: { color: '#fff', fontWeight: '700' },
  content: { paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  machineLabel: { ...typography.tiny, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  headerTitle: { ...typography.h4, fontWeight: '800' },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
  },
  onlineDot: { width: 7, height: 7, borderRadius: 4 },
  onlineText: { ...typography.tiny, fontWeight: '700' },
  heroCard: {
    margin: spacing.md,
    marginTop: spacing.sm,
    borderRadius: borderRadius.xxl,
    borderWidth: 1,
    padding: spacing.md,
    paddingBottom: spacing.lg,
    ...shadows.md,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    marginBottom: spacing.sm,
  },
  heroBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroMetric: { flex: 1, alignItems: 'center' },
  heroMetricLabel: { ...typography.tiny, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  heroMetricValue: { fontSize: 24, fontWeight: '800', marginVertical: 4 },
  heroMetricSub: { fontSize: 9, fontWeight: '600', textTransform: 'uppercase' },
  heroDivider: { width: 1, height: 50, marginHorizontal: 4 },
  sectionLabel: { ...typography.tiny, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  sectionIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  card: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    padding: spacing.md,
    ...shadows.xs,
  },
  cardTitle: { ...typography.bodyBold, fontSize: 16 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  countBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: borderRadius.full },
  countBadgeText: { ...typography.tiny, fontWeight: '800' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginHorizontal: spacing.md, marginBottom: spacing.sm },
  statBox: {
    padding: spacing.md,
    paddingTop: spacing.lg,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    alignItems: 'center',
    gap: 6,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { ...typography.small, fontWeight: '600', textAlign: 'center', letterSpacing: 0.2, marginTop: 2 },
  statSub: { fontSize: 9, textAlign: 'center', marginTop: 1 },
  sensorsRow: { flexDirection: 'row', gap: 8, marginHorizontal: spacing.md, marginBottom: spacing.sm },
  sensorBox: {
    flex: 1,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sensorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  sensorHeaderLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  sensorBody: { paddingVertical: 12, paddingHorizontal: 10, alignItems: 'center', gap: 1 },
  sensorCountValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  sensorCountLabel: { fontSize: 9, fontWeight: '600', letterSpacing: 0.2 },
  sensorFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderTopWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  sensorPillDot: { width: 5, height: 5, borderRadius: 3 },
  sensorFooterText: { fontSize: 9, fontWeight: '600', letterSpacing: 0.2 },
  cardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  cardItemDot: { width: 10, height: 10, borderRadius: 5 },
  cardItemId: { ...typography.small, fontWeight: '700', fontSize: 15 },
  cardItemStage: { ...typography.tiny, marginTop: 2 },
  durationPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.full },
  durationText: { ...typography.tiny, fontWeight: '700' },
  stuckBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
  },
  stuckBtnLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stuckBtnIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stuckBtnTitle: { ...typography.bodyBold, fontSize: 16 },
  stuckBtnSub: { ...typography.tiny, marginTop: 1 },
});
