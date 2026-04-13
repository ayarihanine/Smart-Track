import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Modal, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/design';
import { getCards } from '@/lib/api';
import { ElectronicCard, FilterOptions, StageType } from '@/types';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/components/ThemeProvider';


export default function HistoryScreen() {
  const { t, language } = useTranslation();
  const { palette } = useTheme();
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    stages: [],
    sortBy: 'recent',
  });
  const [tempFilters, setTempFilters] = useState<FilterOptions>(filters);

  const STAGES: { value: StageType; label: string; color: string }[] = [
    { value: 'Assembly', label: t('assembly'), color: palette.primary },
    { value: 'Testing', label: t('testing'), color: '#D97706' },
    { value: 'Packaging', label: t('packaging'), color: '#EA580C' },
    { value: 'Shipping', label: t('shipping'), color: '#10B981' },
  ];

  const SORT_OPTIONS = [
    { value: 'recent', label: t('recentScans') },
    { value: 'stage_order', label: t('stageOrder') },
    { value: 'id_asc', label: t('idAsc') },
  ];

  const { data: cards = [], refetch } = useQuery({
    queryKey: ['cards', filters],
    queryFn: () => getCards(filters),
  });

  const completedCount = cards.filter(c => c.status === 'completed').length;
  const inProgressCount = cards.filter(c => c.status === 'in_progress').length;

  function openFilter() {
    setTempFilters(filters);
    setShowFilter(true);
  }

  function applyFilters() {
    setFilters(tempFilters);
    setShowFilter(false);
  }

  function resetFilters() {
    setTempFilters({ stages: [], sortBy: 'recent' });
  }

  function toggleStage(stage: StageType) {
    setTempFilters(prev => ({
      ...prev,
      stages: prev.stages.includes(stage)
        ? prev.stages.filter(s => s !== stage)
        : [...prev.stages, stage],
    }));
  }

  function formatDate(d: string) {
    const date = new Date(d);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return t('today');
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return t('yesterday');

    // Fallback to localized weekday or simple date
    const options: Intl.DateTimeFormatOptions = { weekday: 'long' };
    try {
      return new Intl.DateTimeFormat(language === 'ar' ? 'ar-SA' : language === 'fr' ? 'fr-FR' : 'en-US', options).format(date);
    } catch {
      return date.toLocaleDateString();
    }
  }

  function formatTime(d: string) {
    return new Date(d).toLocaleTimeString(language === 'ar' ? 'ar-SA' : language === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  }

  function CardRow({ card, onPress }: { card: ElectronicCard; onPress: () => void }) {
    const stageName = card.currentStage?.split(':')[1]?.trim() || card.currentStage || 'Unknown';
    const stageColor = STAGES.find(s => stageName.includes(s.value))?.color || '#6B7280';

    return (
      <TouchableOpacity style={styles.cardRow} onPress={onPress} activeOpacity={0.7}>
        <View style={styles.cardRowLeft}>
          <Text style={styles.cardRowId}>{card.cardId}</Text>
          <Text style={styles.cardRowTime}>
            {formatDate(card.updatedAt)} {t('at')} {formatTime(card.updatedAt)}
          </Text>
        </View>
        <View style={[styles.stagePill, { backgroundColor: stageColor }]}>
          {card.status === 'completed' && (
            <Ionicons name="checkmark" size={12} color={colors.white} style={{ marginRight: 2 }} />
          )}
          <Text style={styles.stagePillText}>{stageName}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('recentCards')}</Text>
        <TouchableOpacity onPress={() => refetch()}>
          <Text style={[styles.clearBtn, { color: palette.primary }]}>{t('refresh')}</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsBar}>
        <View style={styles.stat}>
          <View style={[styles.statIcon, { backgroundColor: '#D1FAE5' }]}>
            <Ionicons name="checkmark-circle" size={24} color="#10B981" />
          </View>
          <Text style={styles.statValue}>{completedCount}</Text>
          <Text style={styles.statLabel}>{t('completed')}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <View style={[styles.statIcon, { backgroundColor: palette.primary + '18' }]}>
            <Ionicons name="settings" size={24} color={palette.primary} />
          </View>
          <Text style={[styles.statValue, { color: palette.text }]}>{inProgressCount}</Text>
          <Text style={[styles.statLabel, { color: palette.textSecondary }]}>{t('inProgress')}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <View style={[styles.statIcon, { backgroundColor: colors.backgroundTertiary }]}>
            <Ionicons name="layers" size={24} color={colors.textSecondary} />
          </View>
          <Text style={styles.statValue}>{cards.length}</Text>
          <Text style={styles.statLabel}>{t('total')}</Text>
        </View>
      </View>

      {/* Filter button */}
      <TouchableOpacity style={styles.filterRow} onPress={openFilter} activeOpacity={0.8}>
        <Ionicons name="options" size={20} color={palette.primary} />
        <Text style={[styles.filterText, { color: palette.primary }]}>{t('filterSort')}</Text>
        {filters.stages.length > 0 && (
          <View style={[styles.filterBadge, { backgroundColor: palette.primary }]}>
            <Text style={styles.filterBadgeText}>{filters.stages.length}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* List */}
      <FlatList
        data={cards}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <CardRow card={item} onPress={() => router.push(`/card/${item.cardId}`)} />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="time-outline" size={64} color={colors.border} />
            <Text style={styles.emptyText}>{t('noCardsFound')}</Text>
            <Text style={styles.emptySubtext}>{t('scanToSeeHere')}</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />

      {/* Filter Modal */}
      <Modal visible={showFilter} animationType="slide" transparent>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowFilter(false)}>
          <Pressable style={styles.modalSheet} onPress={e => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('historyFilterSort')}</Text>
              <TouchableOpacity onPress={() => setShowFilter(false)}>
                <View style={styles.closeBtn}>
                  <Ionicons name="close" size={20} color={colors.text} />
                </View>
              </TouchableOpacity>
            </View>

            <Text style={styles.filterSectionTitle}>{t('filterByStage')}</Text>
            <View style={styles.stageRow}>
              {STAGES.map(s => {
                const active = tempFilters.stages.includes(s.value);
                return (
                  <TouchableOpacity
                    key={s.value}
                    style={[styles.stagePillFilter, { backgroundColor: active ? s.color : colors.backgroundTertiary }]}
                    onPress={() => toggleStage(s.value)}
                    activeOpacity={0.8}
                  >
                    {active && <Ionicons name="checkmark" size={14} color={colors.white} />}
                    <Text style={[styles.stagePillFilterText, { color: active ? colors.white : colors.textSecondary }]}>
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.filterSectionTitle}>{t('sortBy')}</Text>
            <View style={styles.sortList}>
              {SORT_OPTIONS.map((opt, idx) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.sortOption, idx < SORT_OPTIONS.length - 1 && styles.sortOptionBorder]}
                  onPress={() => setTempFilters(prev => ({ ...prev, sortBy: opt.value as any }))}
                  activeOpacity={0.7}
                >
                  <View style={[styles.radio, tempFilters.sortBy === opt.value && styles.radioActive]}>
                    {tempFilters.sortBy === opt.value && <View style={styles.radioInner} />}
                  </View>
                  <Text style={styles.sortOptionText}>{opt.label}</Text>
                  {tempFilters.sortBy === opt.value && (
                    <Ionicons name="checkmark" size={18} color={palette.primary} style={{ marginLeft: 'auto' }} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.resetBtn} onPress={resetFilters} activeOpacity={0.8}>
                <Text style={styles.resetBtnText}>{t('reset')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.applyBtn, { backgroundColor: palette.primary }]} onPress={applyFilters} activeOpacity={0.8}>
                <Text style={styles.applyBtnText}>{t('applyFilters')}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSecondary },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { ...typography.h2 },
  clearBtn: { ...typography.captionBold },
  statsBar: {
    flexDirection: 'row', backgroundColor: colors.white,
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  stat: { flex: 1, alignItems: 'center', gap: spacing.xs },
  statIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  statValue: { ...typography.h3, color: colors.text },
  statLabel: { ...typography.small, color: colors.textSecondary },
  statDivider: { width: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  filterRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    backgroundColor: colors.white, marginBottom: 2,
  },
  filterText: { ...typography.captionBold, color: colors.primary, flex: 1 },
  filterBadge: {
    backgroundColor: colors.primary, width: 20, height: 20,
    borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  filterBadgeText: { ...typography.tiny, color: colors.white, fontWeight: '700' },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  separator: { height: 1, backgroundColor: colors.border },
  cardRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.md, backgroundColor: colors.white,
  },
  cardRowLeft: { gap: 4 },
  cardRowId: { ...typography.bodyBold, color: colors.text },
  cardRowTime: { ...typography.small, color: colors.textSecondary },
  stagePill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: borderRadius.full,
  },
  stagePillText: { ...typography.small, color: colors.white, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: spacing.xxxl, gap: spacing.sm },
  emptyText: { ...typography.body, color: colors.textSecondary },
  emptySubtext: { ...typography.small, color: colors.textTertiary },
  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.backgroundSecondary, borderTopLeftRadius: 24,
    borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: spacing.xxxl,
  },
  modalHandle: {
    width: 40, height: 4, backgroundColor: colors.border,
    borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { ...typography.h4, color: colors.text },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.backgroundTertiary, alignItems: 'center', justifyContent: 'center',
  },
  filterSectionTitle: { ...typography.captionBold, color: colors.text, marginBottom: spacing.sm, marginTop: spacing.md },
  stageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  stagePillFilter: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full,
  },
  stagePillFilterText: { ...typography.captionBold },
  sortList: { backgroundColor: colors.white, borderRadius: borderRadius.lg, marginBottom: spacing.lg },
  sortOption: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  sortOptionBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  sortOptionText: { ...typography.body, color: colors.text, flex: 1 },
  radio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
    borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: colors.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  modalActions: { flexDirection: 'row', gap: spacing.md },
  resetBtn: {
    flex: 1, height: 52, borderRadius: borderRadius.md, alignItems: 'center',
    justifyContent: 'center', backgroundColor: '#9E9E9E',
  },
  resetBtnText: { ...typography.bodyBold, color: colors.white },
  applyBtn: {
    flex: 2, height: 52, borderRadius: borderRadius.md, alignItems: 'center',
    justifyContent: 'center', backgroundColor: colors.primary, ...shadows.md,
  },
  applyBtnText: { ...typography.bodyBold, color: colors.white },
});
