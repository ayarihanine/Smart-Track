import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { borderRadius, shadows, spacing, typography } from '@/constants/design';
import { useTheme } from '@/components/ThemeProvider';
import { useTranslation } from '@/hooks/useTranslation';
import {
  getLatestEtatCapteur,
  getLatestTRG,
  getLatestTRS,
  getPiStatus,
  getTodayLossesSummary,
} from '@/lib/api';
import { getSupabaseClient } from '@/lib/supabase';
import { EtatCapteur, SystemNode, TodayLossSummary } from '@/types/production';

const SUCCESS_COLOR = '#10B981';
const WARNING_COLOR = '#F59E0B';
const ERROR_COLOR = '#EF4444';

function isToday(value?: string | null) {
  if (!value) return false;
  const date = new Date(value);
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

function isPiOnline(node: SystemNode | null | undefined) {
  if (!node?.last_seen) return false;
  return node.status === 'online' && Date.now() - new Date(node.last_seen).getTime() <= 2 * 60 * 1000;
}

function mapRealtimeSensorRow(row: any): EtatCapteur {
  const timestamp = row?.timestamp || row?.date_temps || new Date().toISOString();
  return {
    id: row?.id ?? timestamp,
    timestamp,
    date_temps: row?.date_temps ?? null,
    capteur1: Number(row?.capteur1 ?? 0),
    capteur2: Number(row?.capteur2 ?? 0),
    capteur3: Number(row?.capteur3 ?? 0),
  };
}

function getPerformanceColor(value: number) {
  if (value >= 85) return SUCCESS_COLOR;
  if (value >= 65) return WARNING_COLOR;
  return ERROR_COLOR;
}

function formatTrend(delta: number) {
  if (delta === 0) {
    return { color: '#94A3B8', icon: 'remove', text: '=' };
  }

  if (delta > 0) {
    return { color: SUCCESS_COLOR, icon: 'arrow-up', text: `+${delta}` };
  }

  return { color: ERROR_COLOR, icon: 'arrow-down', text: `${delta}` };
}

function PerformanceCard({
  title,
  value,
  subtitle,
  palette,
}: {
  title: string;
  value: number;
  subtitle: string;
  palette: any;
}) {
  const valueColor = getPerformanceColor(value);

  return (
    <View style={[styles.performanceCard, { backgroundColor: palette.background, borderColor: palette.border }]}>
      <Text style={[styles.performanceLabel, { color: palette.textSecondary }]}>{title}</Text>
      <Text style={[styles.performanceValue, { color: valueColor }]}>{value.toFixed(1)}%</Text>
      <Text style={[styles.performanceSubtitle, { color: palette.textTertiary }]} numberOfLines={2}>
        {subtitle}
      </Text>
    </View>
  );
}

function SensorRow({
  label,
  count,
  previousCount,
  palette,
}: {
  label: string;
  count: number;
  previousCount?: number;
  palette: any;
}) {
  const trend = formatTrend(count - (previousCount ?? count));

  return (
    <View style={[styles.sensorRow, { borderBottomColor: palette.border }]}>
      <View style={styles.sensorLeft}>
        <View style={[styles.sensorDot, { backgroundColor: palette.primary }]} />
        <Text style={[styles.sensorLabel, { color: palette.text }]}>{label}</Text>
      </View>
      <View style={styles.sensorRight}>
        <Text style={[styles.sensorCount, { color: palette.text }]}>{count}</Text>
        <View style={[styles.sensorTrend, { backgroundColor: trend.color + '12' }]}>
          <Ionicons name={trend.icon as any} size={12} color={trend.color} />
          <Text style={[styles.sensorTrendText, { color: trend.color }]}>{trend.text}</Text>
        </View>
      </View>
    </View>
  );
}

export default function DashboardScreen() {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [sensorRows, setSensorRows] = useState<EtatCapteur[]>([]);
  const [todayLosses, setTodayLosses] = useState<TodayLossSummary>({ totalCards: 0, totalCost: 0 });

  const sensorsQuery = useQuery({
    queryKey: ['production', 'dashboard', 'sensors'],
    queryFn: () => getLatestEtatCapteur(2),
  });

  const trgQuery = useQuery({
    queryKey: ['production', 'dashboard', 'trg'],
    queryFn: getLatestTRG,
  });

  const trsQuery = useQuery({
    queryKey: ['production', 'dashboard', 'trs'],
    queryFn: getLatestTRS,
  });

  const lossesQuery = useQuery({
    queryKey: ['production', 'dashboard', 'today-losses'],
    queryFn: getTodayLossesSummary,
  });

  const piQuery = useQuery({
    queryKey: ['production', 'dashboard', 'pi'],
    queryFn: getPiStatus,
  });

  useEffect(() => {
    setSensorRows(sensorsQuery.data || []);
  }, [sensorsQuery.data]);

  useEffect(() => {
    setTodayLosses(lossesQuery.data || { totalCards: 0, totalCost: 0 });
  }, [lossesQuery.data]);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const channel = supabase
      .channel('production-dashboard-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'etat_capteur' },
        (payload) => {
          const nextRow = mapRealtimeSensorRow(payload.new);
          setSensorRows((current) => [nextRow, ...current].slice(0, 2));
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pertes_table' },
        (payload) => {
          const row = payload.new as any;
          if (!isToday(row?.date_temps || row?.timestamp)) return;

          setTodayLosses((current) => ({
            totalCards: current.totalCards + Number(row?.nb_cartes_perdues ?? 0),
            totalCost: current.totalCost + Number(row?.pertes_totale ?? 0),
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      sensorsQuery.refetch(),
      trgQuery.refetch(),
      trsQuery.refetch(),
      lossesQuery.refetch(),
      piQuery.refetch(),
    ]);
    setRefreshing(false);
  };

  const latestRow = sensorRows[0];
  const previousRow = sensorRows[1];
  const piOnline = isPiOnline(piQuery.data);

  const sensorItems = useMemo(
    () => [
      {
        key: 'capteur1',
        label: t('sensor1Entry'),
        count: latestRow?.capteur1 ?? 0,
        previousCount: previousRow?.capteur1,
      },
      {
        key: 'capteur2',
        label: t('sensor2Middle'),
        count: latestRow?.capteur2 ?? 0,
        previousCount: previousRow?.capteur2,
      },
      {
        key: 'capteur3',
        label: t('sensor3Exit'),
        count: latestRow?.capteur3 ?? 0,
        previousCount: previousRow?.capteur3,
      },
    ],
    [latestRow, previousRow, t]
  );

  const isInitialLoading =
    sensorsQuery.isLoading &&
    trgQuery.isLoading &&
    trsQuery.isLoading &&
    lossesQuery.isLoading &&
    piQuery.isLoading;

  if (isInitialLoading) {
    return (
      <SafeAreaView style={[styles.loader, { backgroundColor: palette.backgroundSecondary }]} edges={['top']}>
        <ActivityIndicator size="large" color={palette.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.backgroundSecondary }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { backgroundColor: palette.background, borderColor: palette.border }]}>
          <Text style={[styles.headerTitle, { color: palette.text }]}>{t('smartTrackCmsLine')}</Text>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push('/system-status')}
            style={[styles.piBadge, { backgroundColor: (piOnline ? SUCCESS_COLOR : ERROR_COLOR) + '12' }]}
          >
            <View style={[styles.piBadgeDot, { backgroundColor: piOnline ? SUCCESS_COLOR : ERROR_COLOR }]} />
            <Text style={[styles.piBadgeText, { color: piOnline ? SUCCESS_COLOR : ERROR_COLOR }]}>
              {piOnline ? t('piOnline') : t('piOffline')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.performanceGrid}>
          <PerformanceCard
            title={t('trgLabel')}
            value={trgQuery.data?.trg_pourcentage ?? 0}
            subtitle={`${trgQuery.data?.cartes_bonnes ?? 0} / ${trgQuery.data?.cartes_attendues ?? 0}`}
            palette={palette}
          />
          <PerformanceCard
            title={t('trsLabel')}
            value={trsQuery.data?.trs_pourcentage ?? 0}
            subtitle={`${trsQuery.data?.cartes_bonnes ?? 0} / ${trsQuery.data?.cartes_produites ?? 0}`}
            palette={palette}
          />
        </View>

        <View style={[styles.sectionCard, { backgroundColor: palette.background, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>{t('realtimeSensors')}</Text>

          {sensorRows.length === 0 ? (
            <View style={styles.emptyBlock}>
              <Ionicons name="radio-outline" size={28} color={palette.textTertiary} />
              <Text style={[styles.emptyTitle, { color: palette.textSecondary }]}>{t('noRealtimeData')}</Text>
            </View>
          ) : (
            sensorItems.map((item, index) => (
              <View key={item.key}>
                <SensorRow
                  label={item.label}
                  count={item.count}
                  previousCount={item.previousCount}
                  palette={palette}
                />
                {index === sensorItems.length - 1 ? null : <View style={[styles.sensorDivider, { backgroundColor: palette.border }]} />}
              </View>
            ))
          )}
        </View>

        <View style={[styles.sectionCard, { backgroundColor: palette.background, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>{t('todayLosses')}</Text>

          {todayLosses.totalCards === 0 ? (
            <View style={styles.lossesOkState}>
              <Ionicons name="checkmark-circle" size={28} color={SUCCESS_COLOR} />
              <View style={styles.lossesTextWrap}>
                <Text style={[styles.lossesTitle, { color: palette.text }]}>{t('noLossesDetected')}</Text>
                <Text style={[styles.lossesSubtitle, { color: palette.textSecondary }]}>{t('lossesSubtitle')}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.lossesAlertState}>
              <Ionicons name="warning" size={28} color={ERROR_COLOR} />
              <View style={styles.lossesTextWrap}>
                <Text style={[styles.lossesTitle, { color: palette.text }]}>
                  {t('lostCardsValue').replace('{{count}}', String(todayLosses.totalCards))}
                </Text>
                <Text style={[styles.lossesSubtitle, { color: ERROR_COLOR }]}>
                  {t('lossCostValue').replace('{{cost}}', todayLosses.totalCost.toFixed(3))}
                </Text>
              </View>
            </View>
          )}
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push('/(tabs)/statistiques')}
          style={[styles.fullStatsButton, { backgroundColor: palette.primary }]}
        >
          <Text style={styles.fullStatsText}>{t('viewFullStats')}</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  header: {
    borderWidth: 1,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadows.sm,
  },
  headerTitle: {
    ...typography.h3,
    flex: 1,
    marginRight: spacing.md,
  },
  piBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    gap: 6,
  },
  piBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  piBadgeText: {
    ...typography.smallBold,
  },
  performanceGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  performanceCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  performanceLabel: {
    ...typography.captionBold,
    marginBottom: 10,
  },
  performanceValue: {
    ...typography.h1,
    marginBottom: 8,
  },
  performanceSubtitle: {
    ...typography.small,
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  sectionTitle: {
    ...typography.h4,
    marginBottom: spacing.md,
  },
  emptyBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.body,
    textAlign: 'center',
  },
  sensorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  sensorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.md,
  },
  sensorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.sm,
  },
  sensorLabel: {
    ...typography.body,
    flexShrink: 1,
  },
  sensorRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sensorCount: {
    ...typography.bodyBold,
    minWidth: 26,
    textAlign: 'right',
  },
  sensorTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  sensorTrendText: {
    ...typography.tiny,
    fontWeight: '700',
  },
  sensorDivider: {
    height: 1,
  },
  lossesOkState: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lossesAlertState: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lossesTextWrap: {
    marginLeft: spacing.md,
    flex: 1,
  },
  lossesTitle: {
    ...typography.bodyBold,
    marginBottom: 4,
  },
  lossesSubtitle: {
    ...typography.small,
  },
  fullStatsButton: {
    minHeight: 56,
    borderRadius: borderRadius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    ...shadows.md,
  },
  fullStatsText: {
    ...typography.bodyBold,
    color: '#FFFFFF',
  },
});
