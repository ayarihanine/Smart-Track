import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Modal, Pressable, Alert, Animated, RefreshControl, ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useRouter } from 'expo-router';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/design';
import { getCards, deleteCard } from '@/lib/api';
import { ElectronicCard, FilterOptions } from '@/types';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/components/ThemeProvider';
import { getSupabaseClient } from '@/lib/supabase';

function CardRow({
  card,
  onPress,
  onDelete,
  palette,
  t,
  formatDate,
  formatTime,
}: {
  card: ElectronicCard;
  onPress: () => void;
  onDelete: () => void;
  palette: any;
  t: any;
  formatDate: (d: string) => string;
  formatTime: (d: string) => string;
}) {
  const { isDark } = useTheme();
  const isCompleted = card.status === 'completed';
  const statusLabel = isCompleted ? t('completed' as any) : t('inProgress' as any);
  const statusColor = isCompleted ? '#10B981' : palette.primary;
  const machineUnknown = !card.currentMachine || card.currentMachine === 'Unknown';
  const enteredAt = card.stageEnteredAt || card.updatedAt;

  return (
    <Animated.View style={styles.cardRowWrapper}>
      <TouchableOpacity
        style={[styles.cardItem, { backgroundColor: palette.background, borderColor: palette.border }]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={isDark ? ['#1e293b', '#0f172a'] : ['#FFFFFF', '#F9FAFB']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.cardItemInner}>
          <View style={[styles.cardIconBox, { backgroundColor: statusColor + '12' }]}>
            <Ionicons
              name={isCompleted ? 'shield-checkmark' : 'hardware-chip-outline'}
              size={20}
              color={statusColor}
            />
          </View>

          <View style={styles.cardMainInfo}>
            <View style={styles.cardIdRow}>
              <Text style={[styles.cardIdText, { color: palette.text }]} numberOfLines={1}>
                {card.cardId}
              </Text>
              <View style={[styles.stageBadge, { backgroundColor: statusColor + '12', borderColor: statusColor + '30' }]}>
                <Text style={[styles.stageBadgeText, { color: statusColor }]} numberOfLines={1}>
                  {statusLabel}
                </Text>
              </View>
            </View>
            <Text style={[styles.cardTimeText, { color: palette.textSecondary }]}>
              {machineUnknown
                ? 'Machine not assigned'
                : card.currentMachine}
            </Text>
            <Text style={[styles.cardTimeText, { color: palette.textTertiary }]}>
              {formatDate(enteredAt)} · {formatTime(enteredAt)}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.trashBtn}
            onPress={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            activeOpacity={0.6}
          >
            <View style={[styles.trashIconBox, { backgroundColor: isDark ? '#450a0a' : '#FEF2F2' }]}>
              <Ionicons name="trash-outline" size={18} color="#EF4444" />
            </View>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function HistoryScreen() {
  const { t, language } = useTranslation();
  const { palette, isDark } = useTheme();
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    sortBy: 'recent',
  });
  const [tempFilters, setTempFilters] = useState<FilterOptions>(filters);

  type StatusFilter = 'all' | 'in_progress' | 'completed';
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [tempStatusFilter, setTempStatusFilter] = useState<StatusFilter>('all');

  const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All cards' },
    { value: 'in_progress', label: t('inProgress' as any) },
    { value: 'completed', label: t('completed' as any) },
  ];

  const SORT_OPTIONS = [
    { value: 'recent', label: 'Newest first' },
    { value: 'oldest', label: 'Oldest first' },
  ];

  const [cards, setCards] = useState<ElectronicCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);

  const fetchCards = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setIsLoading(true);
    } else {
      setIsRefetching(true);
    }
    try {
      const queryFilters: FilterOptions = {
        ...filters,
        status: statusFilter === 'all' ? undefined : statusFilter,
      };
      const data = await getCards(queryFilters);
      setCards(data || []);
    } catch (error) {
      console.error('fetchCards failed:', error);
    } finally {
      setIsLoading(false);
      setIsRefetching(false);
    }
  }, [filters, statusFilter]);

  useEffect(() => {
    fetchCards(true);
  }, [fetchCards]);

  useFocusEffect(
    useCallback(() => {
      fetchCards(false);
    }, [fetchCards])
  );

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const channel = supabase
      .channel('history-cards-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'electronic_cards' },
        () => {
          fetchCards(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCards]);

  const completedCount = cards.filter(c => c.status === 'completed').length;
  const inProgressCount = cards.filter(c => c.status === 'in_progress').length;

  function openFilter() {
    setTempFilters(filters);
    setTempStatusFilter(statusFilter);
    setShowFilter(true);
  }

  function applyFilters() {
    setFilters(tempFilters);
    setStatusFilter(tempStatusFilter);
    setShowFilter(false);
  }

  function resetFilters() {
    setTempFilters({ sortBy: 'recent' });
    setTempStatusFilter('all');
  }

  function formatDate(d: string) {
    const date = new Date(d);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return t('today' as any);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return t('yesterday' as any);

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

  async function handleDelete(cardId: string) {
    Alert.alert(
      t('deleteCard' as any) || 'Delete Card',
      t('deleteCardConfirm' as any) || 'Are you sure you want to delete this card?',
      [
        { text: t('cancel' as any), style: 'cancel' },
        { 
          text: t('delete' as any), 
          style: 'destructive',
          onPress: async () => {
            const success = await deleteCard(cardId);
            if (success) {
              fetchCards(false);
            } else {
              Alert.alert(t('error' as any), t('deleteFailed' as any));
            }
          }
        }
      ]
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.backgroundSecondary }]} edges={['top']}>
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
          <Text style={[styles.headerTitle, { color: palette.text }]}>{t('recentCards' as any)}</Text>
          <Text style={[styles.headerSubtitle, { color: palette.textTertiary }]}>{cards.length} {t('totalUnits' as any) || 'units tracked'}</Text>
        </View>
        <TouchableOpacity 
          style={[styles.refreshBtn, { backgroundColor: palette.primary + '10' }]} 
          onPress={() => fetchCards(false)} 
          disabled={isRefetching}
        >
          <Ionicons 
            name={isRefetching ? "sync" : "refresh"} 
            size={20} 
            color={palette.primary} 
            style={isRefetching ? { transform: [{ rotate: '45deg' }] } : null}
          />
        </TouchableOpacity>
      </View>

      {/* Stats Summary Card */}
      <View style={styles.statsContainer}>
        <LinearGradient
          colors={isDark ? ['#1e293b', '#0f172a'] : ['#FFFFFF', '#F8FAFC']}
          style={[styles.statsBar, { borderColor: palette.border }]}
        >
          <View style={styles.stat}>
            <View style={[styles.statIcon, { backgroundColor: '#D1FAE5' }]}>
              <Ionicons name="checkmark-circle" size={22} color="#10B981" />
            </View>
            <View>
              <Text style={[styles.statValue, { color: palette.text }]}>{completedCount}</Text>
              <Text style={[styles.statLabel, { color: palette.textSecondary }]}>{t('completed' as any)}</Text>
            </View>
          </View>
          <View style={[styles.statDivider, { backgroundColor: palette.border }]} />
          <View style={styles.stat}>
            <View style={[styles.statIcon, { backgroundColor: palette.primary + '18' }]}>
              <Ionicons name="time" size={22} color={palette.primary} />
            </View>
            <View>
              <Text style={[styles.statValue, { color: palette.text }]}>{inProgressCount}</Text>
              <Text style={[styles.statLabel, { color: palette.textSecondary }]}>{t('inProgress' as any)}</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Filter Row */}
      <View style={styles.filterContainer}>
        <TouchableOpacity 
          style={[styles.filterBtn, { backgroundColor: palette.background, borderColor: palette.border }]} 
          onPress={openFilter} 
          activeOpacity={0.8}
        >
          <View style={styles.filterBtnLeft}>
            <Ionicons name="options-outline" size={18} color={palette.primary} />
            <Text style={[styles.filterBtnText, { color: palette.text }]}>
              {statusFilter !== 'all' ? STATUS_OPTIONS.find((s) => s.value === statusFilter)?.label : (t('filterSort' as any) || 'Filter & Sort')}
            </Text>
          </View>
          {statusFilter !== 'all' && (
            <View style={[styles.filterBadge, { backgroundColor: palette.primary }]}>
              <Text style={styles.filterBadgeText}>1</Text>
            </View>
          )}
          <Ionicons name="chevron-down" size={16} color={palette.textTertiary} />
        </TouchableOpacity>
      </View>

      {/* List */}
      {isLoading ? (
        <View style={styles.initialLoadingWrap}>
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      ) : (
      <FlatList
        data={cards}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <CardRow 
            card={item} 
            onPress={() => router.push(`/card/${item.cardId}`)} 
            onDelete={() => handleDelete(item.id)}
            palette={palette}
            t={t}
            formatDate={formatDate}
            formatTime={formatTime}
          />
        )}
        refreshControl={
          <RefreshControl 
            refreshing={isRefetching} 
            onRefresh={() => fetchCards(false)} 
            tintColor={palette.primary}
            colors={[palette.primary]}
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyIconContainer, { backgroundColor: palette.background }]}>
               <Ionicons name="layers-outline" size={48} color={palette.border} />
            </View>
            <Text style={[styles.emptyText, { color: palette.textSecondary }]}>{t('noCardsFound' as any)}</Text>
            <Text style={[styles.emptySubtext, { color: palette.textTertiary }]}>{t('scanToSeeHere' as any)}</Text>
            <TouchableOpacity 
              style={[styles.emptyAction, { backgroundColor: palette.primary }]}
              onPress={() => router.push('/(tabs)/scan')}
            >
              <Text style={styles.emptyActionText}>{t('startScanning' as any) || 'Start Scanning'}</Text>
            </TouchableOpacity>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
      )}

      {/* Filter Modal */}
      <Modal visible={showFilter} animationType="slide" transparent>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowFilter(false)}>
          <Pressable style={[styles.modalSheet, { backgroundColor: palette.backgroundSecondary }]} onPress={e => e.stopPropagation()}>
            <View style={[styles.modalHandle, { backgroundColor: palette.border }]} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: palette.text }]}>{t('historyFilterSort' as any)}</Text>
                <Text style={[styles.modalSubtitle, { color: palette.textSecondary }]}>{t('customizeView' as any) || 'Customize your scan history view'}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowFilter(false)}>
                <View style={[styles.closeBtn, { backgroundColor: palette.background, borderColor: palette.border }]}>
                  <Ionicons name="close" size={20} color={palette.text} />
                </View>
              </TouchableOpacity>
            </View>

            <Text style={[styles.filterSectionTitle, { color: palette.text }]}>Status</Text>
            <View style={styles.stageRow}>
              {STATUS_OPTIONS.map((s) => {
                const active = tempStatusFilter === s.value;
                return (
                  <TouchableOpacity
                    key={s.value}
                    style={[styles.stagePillFilter, {
                      backgroundColor: active ? palette.primary : palette.background,
                      borderColor: active ? palette.primary : palette.border,
                      borderWidth: 1,
                    }]}
                    onPress={() => setTempStatusFilter(s.value)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.stagePillFilterText, { color: active ? colors.white : palette.textSecondary }]}>
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.filterSectionTitle, { color: palette.text }]}>{t('sortBy' as any)}</Text>
            <View style={[styles.sortList, { backgroundColor: palette.background, borderColor: palette.border, borderWidth: 1 }]}>
              {SORT_OPTIONS.map((opt, idx) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.sortOption, idx < SORT_OPTIONS.length - 1 && [styles.sortOptionBorder, { borderBottomColor: palette.border }]]}
                  onPress={() => setTempFilters(prev => ({ ...prev, sortBy: opt.value as any }))}
                  activeOpacity={0.7}
                >
                  <View style={[styles.radio, { borderColor: palette.border }, tempFilters.sortBy === opt.value && [styles.radioActive, { borderColor: palette.primary }]]}>
                    {tempFilters.sortBy === opt.value && <View style={[styles.radioInner, { backgroundColor: palette.primary }]} />}
                  </View>
                  <Text style={[styles.sortOptionText, { color: palette.text }]}>{opt.label}</Text>
                  {tempFilters.sortBy === opt.value && (
                    <Ionicons name="checkmark" size={18} color={palette.primary} style={{ marginLeft: 'auto' }} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.resetBtn, { backgroundColor: palette.background, borderColor: palette.border, borderWidth: 1 }]} onPress={resetFilters} activeOpacity={0.8}>
                <Text style={[styles.resetBtnText, { color: palette.textSecondary }]}>{t('reset' as any)}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.applyBtn, { backgroundColor: palette.primary }]} onPress={applyFilters} activeOpacity={0.8}>
                <Text style={styles.applyBtnText}>{t('applyFilters' as any)}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { ...typography.h3, fontSize: 22 },
  headerSubtitle: { ...typography.tiny, marginTop: 2, fontWeight: '600' },
  refreshBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  statsContainer: { paddingHorizontal: spacing.lg, marginTop: spacing.md },
  statsBar: {
    flexDirection: 'row', borderRadius: borderRadius.xl,
    paddingVertical: spacing.md, paddingHorizontal: spacing.md,
    borderWidth: 1, ...shadows.sm,
  },
  stat: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingLeft: spacing.xs },
  statIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statValue: { ...typography.bodyBold, fontSize: 18 },
  statLabel: { ...typography.tiny, fontWeight: '700', textTransform: 'uppercase', fontSize: 9 },
  statDivider: { width: 1, height: '70%', alignSelf: 'center', marginHorizontal: spacing.sm },
  filterContainer: { paddingHorizontal: spacing.lg, marginVertical: spacing.md },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg, borderWidth: 1, ...shadows.xs,
  },
  filterBtnLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  filterBtnText: { ...typography.smallBold },
  filterBadge: {
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    marginHorizontal: spacing.xs,
  },
  filterBadgeText: { ...typography.tiny, color: colors.white, fontWeight: '800' },
  initialLoadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
  separator: { height: spacing.xs },
  cardRowWrapper: { marginBottom: spacing.xs },
  cardItem: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    minHeight: 88,
    ...shadows.sm,
  },
  cardItemInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  cardIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardMainInfo: {
    flex: 1,
    gap: 4,
  },
  cardIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: 2,
  },
  cardIdText: {
    ...typography.bodyBold,
    fontSize: 17,
    flex: 1,
  },
  stageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    maxWidth: 120,
  },
  stageBadgeText: {
    ...typography.tiny,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  cardTimeText: {
    ...typography.small,
    fontWeight: '600',
  },
  trashBtn: {
    paddingLeft: spacing.sm,
  },
  trashIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { alignItems: 'center', paddingVertical: spacing.xxxl, gap: spacing.md },
  emptyIconContainer: { 
    width: 80, height: 80, borderRadius: 40, 
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  emptyText: { ...typography.bodyBold, fontSize: 18 },
  emptySubtext: { ...typography.body, textAlign: 'center', opacity: 0.7, paddingHorizontal: spacing.xl },
  emptyAction: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.md,
  },
  emptyActionText: { ...typography.bodyBold, color: colors.white },
  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32, padding: spacing.xl, paddingBottom: spacing.xxxl,
    ...shadows.lg,
  },
  modalHandle: {
    width: 40, height: 4, 
    borderRadius: 2, alignSelf: 'center', marginBottom: spacing.lg,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xl },
  modalTitle: { ...typography.h3 },
  modalSubtitle: { ...typography.small, marginTop: 4 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  filterSectionTitle: { ...typography.captionBold, marginBottom: spacing.md, marginTop: spacing.lg, textTransform: 'uppercase', letterSpacing: 1 },
  stageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  stagePillFilter: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: borderRadius.lg,
  },
  stagePillFilterText: { ...typography.smallBold },
  sortList: { borderRadius: borderRadius.xl, marginBottom: spacing.xl, overflow: 'hidden' },
  sortOption: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  sortOptionBorder: { borderBottomWidth: 1 },
  sortOptionText: { ...typography.body, flex: 1 },
  radio: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: {},
  radioInner: { width: 12, height: 12, borderRadius: 6 },
  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  resetBtn: {
    flex: 1, height: 56, borderRadius: borderRadius.xl, alignItems: 'center',
    justifyContent: 'center',
  },
  resetBtnText: { ...typography.bodyBold },
  applyBtn: {
    flex: 2, height: 56, borderRadius: borderRadius.xl, alignItems: 'center',
    justifyContent: 'center', ...shadows.md,
  },
  applyBtnText: { ...typography.bodyBold, color: colors.white },
});
