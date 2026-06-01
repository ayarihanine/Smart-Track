import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, Image, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/components/ThemeProvider';
import { getSupabaseClient } from '@/lib/supabase';
import { getRangeBounds } from '@/lib/dates';
import { borderRadius, shadows, spacing, typography } from '@/constants/design';
import { useRouter } from 'expo-router';
import { fetchInspectedLosses, submitInspection, getCurrentUserProfile } from '@/lib/api';
import InspectionModal from '@/components/InspectionModal';
import { InspectedLoss, RootCauseCategory, ROOT_CAUSE_LABELS } from '@/types';

type Period = 'today' | 'week' | 'month';

interface LostCard {
  id: string;
  card_id: string;
  status: string;
  current_machine: string | null;
  updated_at: string;
  created_at: string;
}

interface ScrapRecord {
  id: string;
  created_at: string;
  machine_name: string;
  loss_zone: string | null;
  loss_count: number;
  cost_tnd: number;
  reason: string | null;
}

export default function LossesScreen() {
  const router = useRouter();
  const { palette, isDark } = useTheme();
  const [period, setPeriod] = useState<Period>('today');
  const [lostCards, setLostCards] = useState<LostCard[]>([]);
  const [scrapRecords, setScrapRecords] = useState<InspectedLoss[]>([]);
  const [lostCardCost, setLostCardCost] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLoss, setSelectedLoss] = useState<InspectedLoss | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [operatorId, setOperatorId] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');

  useEffect(() => {
    getCurrentUserProfile().then((profile) => {
      if (profile) {
        setOperatorId(profile.id);
        setUserRole(profile.role);
      }
    });
  }, []);

  const fetchLosses = useCallback(async () => {
    setError(null);
    const supabase = getSupabaseClient();
    if (!supabase) { setError('Database not configured'); setLoading(false); return; }

    try {
      const { start, end } = getRangeBounds(period);
      const [lostResult, scrapResult, articlesResult] = await Promise.all([
        supabase
          .from('electronic_cards')
          .select('id, card_id, status, current_machine, product_id, updated_at, created_at')
          .in('status', ['cancelled', 'blocked', 'removed'])
          .gte('created_at', start)
          .lt('created_at', end)
          .order('updated_at', { ascending: false }),
        fetchInspectedLosses(start, end),
        supabase.from('articles').select('id, unit_price, assembly_count'),
      ]);

      if (lostResult.error) throw lostResult.error;

      const lostData = (lostResult.data || []) as any[];
      // Build article cost map for product-specific pricing
      const articles = articlesResult.data || [];
      const articleCostMap = new Map<string, number>();
      for (const a of articles) {
        articleCostMap.set(a.id, Number(a.unit_price || 0) * Number(a.assembly_count || 0));
      }

      // Compute cost per lost card: group by product_id, sum product costs
      let totalCardCost = 0;
      for (const card of lostData) {
        const pid = card.product_id;
        totalCardCost += pid ? (articleCostMap.get(pid) || 0) : 0;
      }

      setLostCardCost(totalCardCost);
      setLostCards(lostData as LostCard[]);
      setScrapRecords(scrapResult);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch loss data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => { setLoading(true); fetchLosses(); }, [fetchLosses]);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const ch = supabase.channel('pertes_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'losses' }, fetchLosses)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'electronic_cards' }, fetchLosses)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchLosses]);

  const totalCost = scrapRecords.reduce((s, r) => s + (Number(r.cost_tnd) || 0), 0) + lostCardCost;
  const pendingInspections = scrapRecords.filter((r) => !r.root_cause).length;
  const canInspect = ['operator', 'supervisor', 'admin'].includes(userRole);

  const PERIODS: { key: Period; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week',  label: 'This Week' },
    { key: 'month', label: 'This Month' },
  ];

  const handleOpenInspect = (loss: InspectedLoss) => {
    setSelectedLoss(loss);
    setModalVisible(true);
  };

  const handleInspectSubmit = async (params: {
    lossId: string;
    category: RootCauseCategory;
    details?: string;
    operatorId: string;
    photoUri?: string;
  }) => {
    const result = await submitInspection(params);
    if (result.success) {
      await fetchLosses();
    }
    return result;
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.backgroundSecondary }]} edges={['top']}>
      {/* Header */}
      <LinearGradient
        colors={isDark ? ['#47556910', '#0F172A'] : ['#FFFFFF', '#F1F5F9']}
        style={[styles.header, { borderBottomColor: isDark ? '#47556930' : '#CBD5E1' }]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: isDark ? '#47556920' : '#E2E8F0' }]}
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={20} color={palette.text} />
          </TouchableOpacity>
          <View>
            <Text style={[styles.headerTitle, { color: palette.text }]}>Loss History</Text>
            <Text style={[styles.headerSub, { color: palette.textSecondary }]}>
              Track production defects &amp; financial impact
            </Text>
          </View>
        </View>
        {lostCards.length > 0 && (
          <View style={[styles.headerBadge, { backgroundColor: isDark ? '#47556920' : '#E2E8F0' }]}>
            <Text style={[styles.headerBadgeText, { color: '#475569' }]}>{lostCards.length} lost</Text>
          </View>
        )}
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchLosses(); }}
            tintColor={palette.textTertiary}
          />
        }
      >
        {/* ── Pending Inspections Banner ── */}
        {scrapRecords.length > 0 && canInspect ? (
          <View
            style={[
              styles.inspectBanner,
              {
                backgroundColor: pendingInspections > 0
                  ? (isDark ? '#F59E0B15' : '#FFFBEB')
                  : (isDark ? '#0D948815' : '#F0FDFA'),
                borderColor: pendingInspections > 0
                  ? (isDark ? '#F59E0B30' : '#FDE68A')
                  : (isDark ? '#0D948830' : '#99F6E4'),
              },
            ]}
          >
            <Ionicons
              name={pendingInspections > 0 ? 'alert-circle' : 'checkmark-circle'}
              size={18}
              color={pendingInspections > 0 ? '#F59E0B' : '#0D9488'}
            />
            <Text
              style={[
                styles.inspectBannerText,
                { color: pendingInspections > 0 ? '#D97706' : '#0D9488' },
              ]}
            >
              {pendingInspections > 0
                ? `${pendingInspections} loss${pendingInspections !== 1 ? 'es' : ''} pending inspection`
                : 'All losses inspected'}
            </Text>
          </View>
        ) : null}

        {/* ── KPI Cards ── */}
        <View style={styles.kpiRow}>
          <LinearGradient
            colors={isDark ? ['#47556910', '#0F172A'] : ['#FFFFFF', '#F1F5F9']}
            style={[styles.kpiCard, { borderColor: isDark ? '#47556930' : '#CBD5E1' }]}
          >
            <View style={[styles.kpiIcon, { backgroundColor: isDark ? '#47556920' : '#E2E8F0' }]}>
              <Ionicons name="close-circle-outline" size={18} color="#475569" />
            </View>
            <Text style={[styles.kpiValue, { color: '#475569' }]}>
              {loading ? '—' : lostCards.length}
            </Text>
            <Text style={[styles.kpiLabel, { color: '#64748B' }]}>Cards Lost</Text>
            <Text style={[styles.kpiSub, { color: '#94A3B8' }]}>cancelled / blocked</Text>
          </LinearGradient>

          <LinearGradient
            colors={isDark ? ['#6366F110', '#0F172A'] : ['#FFFFFF', '#EEF2FF']}
            style={[styles.kpiCard, { borderColor: isDark ? '#6366F130' : '#C7D2FE' }]}
          >
            <View style={[styles.kpiIcon, { backgroundColor: isDark ? '#6366F120' : '#E0E7FF' }]}>
              <Ionicons name="trash-outline" size={18} color="#6366F1" />
            </View>
            <Text style={[styles.kpiValue, { color: '#6366F1' }]}>
              {loading ? '—' : scrapRecords.reduce((s, r) => s + (Number(r.loss_count) || 0), 0)}
            </Text>
            <Text style={[styles.kpiLabel, { color: '#6366F1' }]}>Scrap Qty</Text>
            <Text style={[styles.kpiSub, { color: '#818CF8' }]}>material defects</Text>
          </LinearGradient>

          <LinearGradient
            colors={isDark ? ['#0D948810', '#0F172A'] : ['#FFFFFF', '#F0FDFA']}
            style={[styles.kpiCard, { borderColor: isDark ? '#0D948830' : '#99F6E4' }]}
          >
            <View style={[styles.kpiIcon, { backgroundColor: isDark ? '#0D948820' : '#CCFBF1' }]}>
              <Ionicons name="cash-outline" size={18} color="#0D9488" />
            </View>
            <Text style={[styles.kpiValue, { color: '#0D9488' }]}>
              {loading ? '—' : totalCost.toFixed(3)}
            </Text>
            <Text style={[styles.kpiLabel, { color: '#0D9488' }]}>Cost (TND)</Text>
            <Text style={[styles.kpiSub, { color: '#14B8A6' }]}>financial impact</Text>
          </LinearGradient>
        </View>

        {/* ── Period Tabs ── */}
        <View style={[styles.tabsWrapper, { backgroundColor: palette.background, borderColor: palette.border }]}>
          {PERIODS.map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[styles.tab, period === key && { backgroundColor: isDark ? '#47556920' : '#E2E8F0' }]}
              onPress={() => setPeriod(key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, styles.tabTextBase, period === key && { color: '#475569', fontWeight: '700' }]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Content ── */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={palette.textTertiary} />
            <Text style={[styles.loadingText, { color: palette.textSecondary }]}>Loading losses…</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Ionicons name="alert-circle-outline" size={36} color={palette.textTertiary} />
            <Text style={[styles.errorText, { color: palette.textSecondary }]}>{error}</Text>
            <TouchableOpacity
              style={[styles.retryBtn, { backgroundColor: palette.background, borderColor: palette.border, borderWidth: 1 }]}
              onPress={() => { setLoading(true); fetchLosses(); }}
            >
              <Text style={[styles.retryBtnText, { color: palette.text }]}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : lostCards.length === 0 && scrapRecords.length === 0 ? (
          <View style={styles.emptyState}>
            <LinearGradient
              colors={isDark ? ['#6366F110', '#0F172A'] : ['#FFFFFF', '#EEF2FF']}
              style={[styles.emptyIcon, { borderColor: isDark ? '#6366F130' : '#C7D2FE' }]}
            >
              <Ionicons name="checkmark-circle" size={36} color="#6366F1" />
            </LinearGradient>
            <Text style={[styles.emptyTitle, { color: palette.text }]}>No Losses Detected</Text>
            <Text style={[styles.emptySub, { color: palette.textSecondary }]}>
              No lost cards or defects for this period.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {/* Lost Cards */}
            {lostCards.length > 0 && (
              <View>
                <Text style={[styles.listSectionTitle, { color: '#475569' }]}>Lost Cards</Text>
                {lostCards.map((item) => {
                  const date = new Date(item.updated_at || item.created_at);
                  const statusAccent =
                    item.status === 'cancelled' ? '#475569' :
                    item.status === 'blocked' ? '#0D9488' :
                    item.status === 'removed' ? '#EF4444' : '#64748B';
                  return (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => router.push(`/card/${item.card_id}` as never)}
                      activeOpacity={0.7}
                    >
                      <LinearGradient
                        colors={isDark ? [statusAccent + '10', '#0F172A'] : ['#FFFFFF', statusAccent + '08']}
                        style={[styles.lossCard, { borderColor: isDark ? statusAccent + '30' : statusAccent + '20', borderLeftColor: statusAccent }]}
                      >
                        <View style={styles.lossHeader}>
                          <View style={styles.lossDateBlock}>
                            <Text style={[styles.lossDate, { color: palette.text }]}>{item.card_id}</Text>
                            <Text style={[styles.lossTime, { color: palette.textTertiary }]}>
                              {date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} · {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                          </View>
                          <View style={[styles.costBadge, { backgroundColor: isDark ? statusAccent + '20' : statusAccent + '15' }]}>
                            <Text style={[styles.costText, { color: statusAccent }]}>{item.status}</Text>
                          </View>
                        </View>
                        <View style={[styles.lossMeta, { borderTopColor: isDark ? statusAccent + '20' : statusAccent + '15' }]}>
                          <View style={styles.lossMetaItem}>
                            <Ionicons name="hardware-chip-outline" size={12} color={statusAccent + 'aa'} />
                            <Text style={[styles.lossMetaText, { color: palette.textSecondary }]}>{item.current_machine || '—'}</Text>
                          </View>
                        </View>
                      </LinearGradient>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            {/* Scrap Records */}
            {scrapRecords.length > 0 && (
              <View style={{ marginTop: lostCards.length > 0 ? spacing.md : 0 }}>
                <Text style={[styles.listSectionTitle, { color: '#6366F1' }]}>Material Scrap</Text>
                {scrapRecords.map((item, idx) => {
                  const date = new Date(item.created_at);
                  const cost = Number(item.cost_tnd) || 0;
                  const zone = item.loss_zone || '—';
                  const isHighCost = cost > 30;
                  const accent = isHighCost ? '#475569' : '#6366F1';
                  const hasRootCause = !!item.root_cause;
                  return (
                    <View key={item.id || idx}>
                      <LinearGradient
                        colors={isDark ? [accent + '10', '#0F172A'] : ['#FFFFFF', accent + '08']}
                        style={[styles.lossCard, { borderColor: isDark ? accent + '30' : accent + '20', borderLeftColor: accent }]}
                      >
                        <View style={styles.lossHeader}>
                          <View style={styles.lossDateBlock}>
                            <Text style={[styles.lossDate, { color: palette.text }]}>
                              {date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                            </Text>
                            <Text style={[styles.lossTime, { color: palette.textTertiary }]}>
                              {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            {hasRootCause ? (
                              <View style={[styles.statusBadge, { backgroundColor: isDark ? '#0D948820' : '#D1FAE5' }]}>
                                <Ionicons name="checkmark-circle" size={12} color="#0D9488" />
                                <Text style={[styles.statusBadgeText, { color: '#0D9488' }]}>Inspected</Text>
                              </View>
                            ) : (
                              <View style={[styles.statusBadge, { backgroundColor: isDark ? '#F59E0B20' : '#FEF3C7' }]}>
                                <Ionicons name="alert-circle" size={12} color="#F59E0B" />
                                <Text style={[styles.statusBadgeText, { color: '#D97706' }]}>Pending</Text>
                              </View>
                            )}
                            <View style={[styles.costBadge, { backgroundColor: isDark ? accent + '20' : accent + '15' }]}>
                              <Text style={[styles.costText, { color: accent }]}>
                                {cost.toFixed(3)} TND
                              </Text>
                            </View>
                          </View>
                        </View>
                        <View style={[styles.lossMeta, { borderTopColor: isDark ? accent + '20' : accent + '15' }]}>
                          <View style={styles.lossMetaItem}>
                            <Ionicons name="hardware-chip-outline" size={12} color={accent + 'aa'} />
                            <Text style={[styles.lossMetaText, { color: palette.textSecondary }]}>{item.machine_name || '—'}</Text>
                          </View>
                          <View style={styles.lossMetaItem}>
                            <Ionicons name="location-outline" size={12} color={accent + 'aa'} />
                            <Text style={[styles.lossMetaText, { color: palette.textSecondary }]}>{zone}</Text>
                          </View>
                          <View style={[styles.countPill, { backgroundColor: isDark ? accent + '20' : accent + '15' }]}>
                            <Text style={[styles.countText, { color: accent }]}>
                              {item.loss_count} carte{item.loss_count !== 1 ? 's' : ''}
                            </Text>
                          </View>
                        </View>
                        {/* Inspect / Inspected info */}
                        {hasRootCause ? (
                          <View style={[styles.inspectedInfo, { borderTopColor: palette.border }]}>
                            <Ionicons name="checkmark-done" size={14} color="#0D9488" />
                            <Text style={[styles.inspectedInfoText, { color: palette.textTertiary }]}>
                              {ROOT_CAUSE_LABELS[item.root_cause!.cause_category] || item.root_cause!.cause_category}
                            </Text>
                            {item.root_cause!.cause_details ? (
                              <Text style={[styles.inspectedDetailText, { color: palette.textSecondary }]}>
                                {item.root_cause!.cause_details}
                              </Text>
                            ) : null}
                            {item.root_cause!.photo_url ? (
                              <TouchableOpacity onPress={() => Linking.openURL(item.root_cause!.photo_url!)} activeOpacity={0.8}>
                                <Image
                                  source={{ uri: item.root_cause!.photo_url }}
                                  style={[styles.photoThumb, { borderColor: palette.border }]}
                                  resizeMode="cover"
                                />
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        ) : canInspect ? (
                          <TouchableOpacity
                            style={[styles.inspectBtn, { borderColor: accent }]}
                            onPress={() => handleOpenInspect(item)}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="search-outline" size={14} color={accent} />
                            <Text style={[styles.inspectBtnText, { color: accent }]}>Inspect Issue</Text>
                          </TouchableOpacity>
                        ) : null}
                      </LinearGradient>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <InspectionModal
        visible={modalVisible}
        loss={selectedLoss}
        operatorId={operatorId}
        onClose={() => { setModalVisible(false); setSelectedLoss(null); }}
        onSubmit={handleInspectSubmit}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.h4, fontWeight: '800' },
  headerSub: { ...typography.tiny, marginTop: 2 },
  headerBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: borderRadius.full },
  headerBadgeText: { ...typography.tiny, fontWeight: '700' },
  scrollContent: { padding: spacing.md, gap: spacing.md, paddingBottom: 40 },
  inspectBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: spacing.sm + 2, borderRadius: borderRadius.lg, borderWidth: 1,
  },
  inspectBannerText: { ...typography.small, fontWeight: '700' },
  kpiRow: { flexDirection: 'row', gap: spacing.sm },
  kpiCard: {
    flex: 1, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.xl, borderWidth: 1, alignItems: 'center', gap: 3,
  },
  kpiSub: { fontSize: 8, fontWeight: '500', textAlign: 'center', letterSpacing: 0.2 },
  kpiIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  kpiValue: { fontSize: 20, fontWeight: '800' },
  kpiLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' },
  tabsWrapper: { flexDirection: 'row', borderRadius: borderRadius.lg, borderWidth: 1, padding: 3, gap: 3 },
  tab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: borderRadius.md },
  tabTextBase: { color: '#9CA3AF' },
  tabText: { ...typography.small, fontWeight: '600' },
  center: { paddingVertical: 60, alignItems: 'center', gap: 12 },
  loadingText: { ...typography.small },
  errorText: { ...typography.small, textAlign: 'center', maxWidth: 260 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: borderRadius.md },
  retryBtnText: { fontWeight: '700' },
  emptyState: { paddingVertical: 50, alignItems: 'center', gap: 14 },
  emptyIcon: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { ...typography.h4 },
  emptySub: { ...typography.small, textAlign: 'center', maxWidth: 260 },
  list: { gap: spacing.sm },
  listSectionTitle: { ...typography.captionBold, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm },
  lossCard: { borderRadius: borderRadius.xl, borderWidth: 1, borderLeftWidth: 4, padding: spacing.md, overflow: 'hidden' },
  lossHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  lossDateBlock: {},
  lossDate: { ...typography.bodyBold, fontSize: 14 },
  lossTime: { ...typography.tiny, marginTop: 1 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: borderRadius.full },
  statusBadgeText: { fontSize: 9, fontWeight: '700' },
  costBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: borderRadius.full },
  costText: { ...typography.tiny, fontWeight: '700' },
  lossMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, borderTopWidth: 1, paddingTop: 10 },
  lossMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lossMetaText: { ...typography.tiny },
  countPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: borderRadius.full, marginLeft: 'auto' },
  countText: { ...typography.tiny, fontWeight: '600' },
  inspectedInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, marginTop: 10, paddingTop: 8, flexWrap: 'wrap' },
  inspectedInfoText: { ...typography.tiny, flex: 1 },
  inspectedDetailText: { ...typography.tiny, width: '100%', marginTop: 4 },
  photoThumb: { width: '100%', height: 160, borderRadius: borderRadius.lg, borderWidth: 1, marginTop: 8 },
  inspectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    marginTop: 10, paddingVertical: 8, borderRadius: borderRadius.lg, borderWidth: 1,
  },
  inspectBtnText: { fontSize: 12, fontWeight: '700' },
});
