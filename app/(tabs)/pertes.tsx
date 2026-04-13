import React, { useMemo, useState } from 'react';
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
import { useQuery } from '@tanstack/react-query';

import { borderRadius, shadows, spacing, typography } from '@/constants/design';
import { useTheme } from '@/components/ThemeProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { getLosses } from '@/lib/api';
import { PertesTable } from '@/types/production';

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
        {
          backgroundColor: active ? palette.primary : palette.background,
          borderColor: active ? palette.primary : palette.border,
        },
      ]}
    >
      <Text style={[styles.filterChipText, { color: active ? '#FFFFFF' : palette.textSecondary }]}>{label}</Text>
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
    <View style={[styles.lossCard, { backgroundColor: palette.background, borderColor: palette.border }]}>
      <View style={styles.lossAccent} />

      <View style={styles.lossBody}>
        <View style={styles.lossHeader}>
          <View style={styles.lossHeaderLeft}>
            <View style={[styles.lossIconWrap, { backgroundColor: ERROR_COLOR + '12' }]}>
              <Ionicons name="warning" size={18} color={ERROR_COLOR} />
            </View>
            <View>
              <Text style={[styles.lossDate, { color: palette.text }]}>{formatted.date}</Text>
              <Text style={[styles.lossTime, { color: palette.textTertiary }]}>{formatted.time}</Text>
            </View>
          </View>

          <Text style={[styles.lossCost, { color: ERROR_COLOR }]}>{item.pertes_totale.toFixed(3)} TND</Text>
        </View>

        <Text style={[styles.lossMachine, { color: palette.text }]}>{item.machine}</Text>
        <Text style={[styles.lossLocation, { color: palette.textSecondary }]}>{location}</Text>
        <Text style={[styles.lossCount, { color: palette.text }]}>{`${item.nb_cartes_perdues} ${t('lostCardsLabel')}`}</Text>
      </View>
    </View>
  );
}

export default function LossesScreen() {
  const { t, language } = useTranslation();
  const { palette } = useTheme();
  const [filter, setFilter] = useState<LossesFilter>('today');

  const lossesQuery = useQuery({
    queryKey: ['production', 'losses'],
    queryFn: () => getLosses(),
  });

  const filteredLosses = useMemo(() => {
    const start = getFilterStart(filter);
    return (lossesQuery.data || []).filter((item) => new Date(item.date_temps) >= start);
  }, [filter, lossesQuery.data]);

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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.backgroundSecondary }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: palette.background, borderBottomColor: palette.border }]}>
        <Text style={[styles.headerTitle, { color: palette.text }]}>{t('lossesHistory')}</Text>

        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: palette.backgroundSecondary }]}>
            <Text style={[styles.summaryLabel, { color: palette.textSecondary }]}>{t('totalLostCards')}</Text>
            <Text style={[styles.summaryValue, { color: ERROR_COLOR }]}>{totals.cards}</Text>
          </View>

          <View style={[styles.summaryCard, { backgroundColor: palette.backgroundSecondary }]}>
            <Text style={[styles.summaryLabel, { color: palette.textSecondary }]}>{t('totalFinancialCost')}</Text>
            <Text style={[styles.summaryValue, { color: ERROR_COLOR }]}>{totals.cost.toFixed(3)} TND</Text>
          </View>
        </View>

        <View style={styles.filtersRow}>
          <FilterChip active={filter === 'today'} label={t('filterToday')} onPress={() => setFilter('today')} palette={palette} />
          <FilterChip active={filter === 'week'} label={t('filterThisWeek')} onPress={() => setFilter('week')} palette={palette} />
          <FilterChip active={filter === 'month'} label={t('filterThisMonth')} onPress={() => setFilter('month')} palette={palette} />
        </View>
      </View>

      <FlatList
        data={filteredLosses}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <LossCard item={item} language={language} palette={palette} t={t} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={lossesQuery.isFetching} onRefresh={lossesQuery.refetch} tintColor={palette.primary} />
        }
        ListEmptyComponent={
          lossesQuery.isLoading ? null : (
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
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    ...shadows.sm,
  },
  headerTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  summaryCard: {
    flex: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  summaryLabel: {
    ...typography.tiny,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  summaryValue: {
    ...typography.h3,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  filterChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
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
    flexDirection: 'row',
    ...shadows.xs,
  },
  lossAccent: {
    width: 5,
    backgroundColor: ERROR_COLOR,
  },
  lossBody: {
    flex: 1,
    padding: spacing.md,
  },
  lossHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  lossHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    marginRight: spacing.md,
  },
  lossIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lossDate: {
    ...typography.bodyBold,
  },
  lossTime: {
    ...typography.caption,
  },
  lossCost: {
    ...typography.captionBold,
  },
  lossMachine: {
    ...typography.bodyBold,
    marginBottom: 4,
  },
  lossLocation: {
    ...typography.small,
    marginBottom: 6,
  },
  lossCount: {
    ...typography.smallBold,
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
});
