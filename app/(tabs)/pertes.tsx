import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';

import { borderRadius, shadows, spacing, typography } from '@/constants/design';
import { useTheme } from '@/components/ThemeProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { getLosses } from '@/lib/api';
import { PertesTable } from '@/types/production';
import { getSupabaseClient } from '@/lib/supabase';
import { useAlertsStore } from '@/store/alertsStore';

type LossesFilter = 'today' | 'week' | 'month';

const SUCCESS_COLOR = '#10B981';
const ERROR_COLOR = '#EF4444';

function getFilterStart(filter: LossesFilter) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  if (filter === 'week') {
    const day = start.getDay();
    const diff = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - diff);
  }

  if (filter === 'month') {
    start.setDate(1);
  }

  return start;
}

function FilterChip({
  active,
  label,
  onPress,
  palette,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  palette: any;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[
        styles.filterChip,
        active && styles.filterChipActive,
      ]}
    >
      {active && (
        <Animated.View style={StyleSheet.absoluteFill} entering={FadeInDown.duration(200)}>
          <LinearGradient
            colors={['#EF4444', '#B91C1C']}
            style={[StyleSheet.absoluteFill, { borderRadius: 8 }]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          />
        </Animated.View>
      )}
      <Text style={[styles.filterChipText, { color: active ? '#FFFFFF' : palette.textSecondary, zIndex: 1 }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function formatLossDate(value: string, language: string) {
  const locale = language === 'ar' ? 'ar-SA' : language === 'fr' ? 'fr-FR' : 'en-US';
  const date = new Date(value);

  return {
    date: new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date),
    time: new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(date),
  };
}

function LossCard({
  item,
  language,
  palette,
  t,
}: {
  item: PertesTable;
  language: string;
  palette: any;
  t: (key: any) => string;
}) {
  const formatted = formatLossDate(item.date_temps, language);
  const location = t('lossBetweenSensors')
    .replace('{{from}}', item.capteur_from || '1')
    .replace('{{to}}', item.capteur_to || '2');

  return (
    <Animated.View 
      entering={FadeInDown.delay(100).springify().damping(14)}
      style={[styles.lossCard, { backgroundColor: palette.background, borderColor: palette.border }]}
    >
      <View style={styles.lossCardInner}>
        {/* Left Column: Date Badge */}
        <View style={styles.lossLeftCol}>
          <View style={[styles.dateBox, { backgroundColor: palette.backgroundSecondary, borderColor: palette.border }]}>
            <Text style={[styles.dateDay, { color: palette.text }]}>{formatted.date.split('/')[0]}</Text>
            <Text style={[styles.dateMonth, { color: palette.textTertiary }]}>{formatted.date.split('/')[1]}</Text>
          </View>
        </View>
        
        {/* Main Content */}
        <View style={styles.lossMainCol}>
          <View style={styles.lossMachineRow}>
            <Text style={[styles.lossMachine, { color: palette.text }]}>{item.machine}</Text>
            <View style={[styles.timeBadge, { backgroundColor: palette.backgroundSecondary }]}>
              <Ionicons name="time-outline" size={12} color={palette.textSecondary} style={{ marginRight: 4 }}/>
              <Text style={[styles.timeText, { color: palette.textSecondary }]}>{formatted.time}</Text>
            </View>
          </View>
          
          <View style={styles.locationRow}>
            <View style={[styles.dot, { backgroundColor: palette.textTertiary }]} />
            <Text style={[styles.lossLocation, { color: palette.textSecondary }]}>{location}</Text>
          </View>
          
          <View style={[styles.lossFooter, { borderTopColor: palette.border }]}>
            <View style={[styles.countBadge, { backgroundColor: ERROR_COLOR + '10' }]}>
              <Ionicons name="layers-outline" size={14} color={ERROR_COLOR} style={{ marginRight: 6 }}/>
              <Text style={[styles.lossCount, { color: ERROR_COLOR }]}>{item.nb_cartes_perdues} {t('lostCardsLabel')}</Text>
            </View>
            <View style={styles.costContainer}>
              <Text style={[styles.lossCost, { color: ERROR_COLOR }]}>-{item.pertes_totale.toFixed(3)}</Text>
              <Text style={[styles.lossCurrency, { color: ERROR_COLOR }]}>TND</Text>
            </View>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

export default function LossesScreen() {
  const { t, language } = useTranslation();
  const { palette, isDark } = useTheme();
  const { addAlert } = useAlertsStore();

  const [filter, setFilter] = useState<LossesFilter>('today');
  const [losses, setLosses] = useState<PertesTable[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Active batch and quality threshold state
  const [activeBatch, setActiveBatch] = useState<any>(null);
  const [lossThreshold, setLossThreshold] = useState<number>(0.05); // default 5%

  const fetchLosses = async () => {
    try {
      const data = await getLosses();
      setLosses(data || []);
    } catch (error) {
      console.error('fetchLosses failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadBatchAndConfig = async () => {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) return;

      // 1. Fetch active batch
      const { data: activeBatchData } = await supabase
        .from('production_batches')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setActiveBatch(activeBatchData);

      // 2. Fetch loss_threshold from configuration
      const { data: config } = await supabase
        .from('configuration')
        .select('loss_threshold')
        .limit(1)
        .maybeSingle();

      if (config) {
        setLossThreshold(Number(config.loss_threshold || 0.05));
      }
    } catch (err) {
      console.error('loadBatchAndConfig failed:', err);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadBatchAndConfig();
      fetchLosses();
    }, [])
  );

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const channel = supabase
      .channel('pertes-screen-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pertes_table' },
        () => {
          fetchLosses();
          loadBatchAndConfig();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredLosses = useMemo(() => {
    if (activeBatch) {
      const start = new Date(activeBatch.start_time).getTime();
      const end = activeBatch.end_time ? new Date(activeBatch.end_time).getTime() : Date.now();

      return losses.filter((item) => {
        const tVal = new Date(item.date_temps).getTime();
        return tVal >= start && tVal <= end;
      });
    }

    const start = getFilterStart(filter);
    return losses.filter((item) => new Date(item.date_temps) >= start);
  }, [activeBatch, filter, losses]);

  const totals = useMemo(
    () =>
      filteredLosses.reduce(
        (result, item) => ({
          cards: result.cards + item.nb_cartes_perdues,
          cost: result.cost + item.pertes_totale,
        }),
        { cards: 0, cost: 0 }
      ),
    [filteredLosses]
  );

  const normalizedLossThreshold = useMemo(
    () => (lossThreshold > 1 ? lossThreshold / 100 : lossThreshold),
    [lossThreshold]
  );

  const producedQuantity = useMemo(() => {
    if (!activeBatch) return 0;

    const produced = Number(activeBatch.produced_quantity || 0);
    if (produced > 0) return produced;

    const goodQty = Number(activeBatch.good_quantity || 0);
    return goodQty + totals.cards;
  }, [activeBatch, totals.cards]);

  const wastePercentage = useMemo(() => {
    const wasteQty = totals.cards;
    if (producedQuantity <= 0) return 0;
    return wasteQty / producedQuantity;
  }, [producedQuantity, totals.cards]);

  // Critical Safeguard Alert triggers
  useEffect(() => {
    if (activeBatch && normalizedLossThreshold > 0 && wastePercentage > normalizedLossThreshold) {
      const alertId = `loss-threshold-exceeded-${activeBatch.id}`;
      addAlert({
        id: alertId,
        type: 'quality_alert',
        severity: 'critical',
        message: `Quality Alert: Waste rate (${(wastePercentage * 100).toFixed(1)}%) in batch ${activeBatch.batch_number} exceeds threshold limit of ${(normalizedLossThreshold * 100).toFixed(1)}%!`,
      });
    }
  }, [activeBatch, normalizedLossThreshold, wastePercentage, addAlert]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.backgroundSecondary }]} edges={['top']}>
      {/* Theme Adaptive Hero Header */}
      <Animated.View entering={FadeInUp.duration(600).springify()} style={[styles.heroBanner, { backgroundColor: palette.background, shadowColor: isDark ? '#EF4444' : palette.border, borderBottomColor: palette.border, borderBottomWidth: 1 }]}>
        <SafeAreaView edges={['top']} style={styles.heroSafeArea}>
          <View style={styles.heroContent}>
            <View style={styles.heroTitleRow}>
              <View>
                <Text style={[styles.heroTitle, { color: palette.text }]}>
                  {activeBatch ? 'Batch scrap rate' : t('lossesHistory')}
                </Text>
                {activeBatch && (
                  <Text style={[styles.activeBatchBadgeText, { color: palette.textSecondary }]}>
                    Batch: {activeBatch.batch_number} ({activeBatch.card_reference})
                  </Text>
                )}
              </View>
              <View style={[styles.heroBadge, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)', borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.2)' }]}>
                <Ionicons name="trending-down" size={14} color={ERROR_COLOR} />
                <Text style={[styles.heroBadgeText, { color: ERROR_COLOR }]}>{totals.cards} lost</Text>
              </View>
            </View>
            
            <View style={styles.heroStatsRow}>
              <View style={styles.heroStatItem}>
                <Text style={[styles.heroStatLabel, { color: palette.textSecondary }]}>
                  {activeBatch ? 'Waste quantity' : t('totalFinancialCost')}
                </Text>
                <View style={styles.heroStatValueRow}>
                  <Text style={[styles.heroStatValue, { color: palette.text }]}>
                    {activeBatch ? totals.cards : totals.cost.toFixed(3)}
                  </Text>
                  <Text style={[styles.heroStatCurrency, { color: ERROR_COLOR }]}>
                    {activeBatch ? 'cards' : 'TND'}
                  </Text>
                </View>
              </View>

              {activeBatch && (
                <View style={[styles.heroStatItem, { alignItems: 'flex-end' }]}>
                  <Text style={[styles.heroStatLabel, { color: palette.textSecondary }]}>Scrap rate</Text>
                  <View style={styles.heroStatValueRow}>
                    <Text style={[
                      styles.heroStatValue, 
                      { color: wastePercentage > normalizedLossThreshold ? ERROR_COLOR : SUCCESS_COLOR }
                    ]}>
                      {(wastePercentage * 100).toFixed(1)}%
                    </Text>
                  </View>
                  <Text style={[styles.thresholdLabel, { color: palette.textTertiary }]}>
                    Produced: {producedQuantity} | Limit: {(normalizedLossThreshold * 100).toFixed(0)}%
                  </Text>
                </View>
              )}
            </View>
          </View>
          
          {!activeBatch && (
            <View style={styles.segmentedControlWrap}>
              <View style={[styles.segmentedControl, { backgroundColor: isDark ? '#334155' : palette.background, borderColor: palette.border, borderWidth: 1 }]}>
                <FilterChip active={filter === 'today'} label={t('filterToday')} onPress={() => setFilter('today')} palette={palette} />
                <FilterChip active={filter === 'week'} label={t('filterThisWeek')} onPress={() => setFilter('week')} palette={palette} />
                <FilterChip active={filter === 'month'} label={t('filterThisMonth')} onPress={() => setFilter('month')} palette={palette} />
              </View>
            </View>
          )}
        </SafeAreaView>
      </Animated.View>

      <FlatList
        data={filteredLosses}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <LossCard item={item} language={language} palette={palette} t={t} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={fetchLosses} tintColor={palette.primary} />
        }
        ListEmptyComponent={
          isLoading ? null : (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle" size={56} color={SUCCESS_COLOR} />
              <Text style={[styles.emptyTitle, { color: palette.text }]}>{t('noLossesDetected')}</Text>
              <Text style={[styles.emptySubtitle, { color: palette.textSecondary }]}>{t('lossesEmptySubtitle')}</Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroBanner: {
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
    marginBottom: spacing.md,
  },

  heroSafeArea: {
    // container inside the banner
  },
  heroContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  heroTitle: {
    ...typography.h2,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  heroBadgeText: {
    ...typography.smallBold,
    color: '#EF4444',
    marginLeft: 6,
  },
  heroStatsRow: {
    flexDirection: 'row',
  },
  heroStatItem: {
    flex: 1,
  },
  heroStatLabel: {
    ...typography.smallBold,
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  heroStatValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  heroStatValue: {
    ...typography.h1,
    fontWeight: '900',
    fontSize: 40,
  },
  heroStatCurrency: {
    ...typography.h3,
    fontWeight: '700',
    color: '#EF4444',
    marginLeft: 8,
  },
  segmentedControlWrap: {
    paddingHorizontal: spacing.xl,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
  },
  filterChip: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
  },
  filterChipActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  filterChipText: {
    ...typography.smallBold,
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  lossCard: {
    borderWidth: 1,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 4,
  },
  lossCardInner: {
    flexDirection: 'row',
    padding: spacing.md,
  },
  lossLeftCol: {
    width: 56,
    alignItems: 'center',
    marginRight: spacing.md,
  },
  dateBox: {
    width: 56,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  dateDay: {
    ...typography.h3,
    fontWeight: '800',
    marginBottom: -2,
  },
  dateMonth: {
    ...typography.tiny,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  lossMainCol: {
    flex: 1,
  },
  lossMachineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  lossMachine: {
    ...typography.bodyBold,
    fontSize: 16,
    flex: 1,
    marginRight: spacing.sm,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  timeText: {
    ...typography.tiny,
    fontWeight: '600',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  lossLocation: {
    ...typography.small,
  },
  lossFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    paddingTop: spacing.md,
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  lossCount: {
    ...typography.smallBold,
  },
  costContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  lossCost: {
    ...typography.h3,
    fontWeight: '900',
  },
  lossCurrency: {
    ...typography.smallBold,
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    ...typography.h4,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...typography.body,
    textAlign: 'center',
  },
  activeBatchBadgeText: {
    ...typography.tiny,
    marginTop: 4,
  },
  thresholdLabel: {
    ...typography.tiny,
    fontWeight: '700',
    marginTop: 2,
  },
});
