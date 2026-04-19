import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  RefreshControl, Animated, Image, Modal,
} from 'react-native';
import AnimatedReanimated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  FadeInDown,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/design';
import { useAuthStore } from '@/store/authStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/components/ThemeProvider';
import { getCards, getAnalytics } from '@/lib/api';
import { getSupabaseClient } from '@/lib/supabase';
import { ElectronicCard, UserRole } from '@/types';
import { SearchModal } from '@/components/SearchModal';
import { useAlertsStore } from '@/store/alertsStore';
import { useSettingsStore } from '@/store/settingsStore';

// Using palette-based colors for roles would be tricky since it's static,
// but we'll use semantically close colors from the design system or the palette where possible.
const ROLE_COLORS: Record<UserRole, string> = {
  operator: '#10B981', // Success emerald
  supervisor: '#3B82F6', // Blue
  admin: '#8B5CF6', // Violet
};


function CardListItem({ card, onPress, onMorePress, palette, primaryColor }: { card: ElectronicCard; onPress: () => void; onMorePress?: () => void; palette: any; primaryColor?: string }) {
  const { t } = useTranslation();
  const stageColors: Record<string, string> = {
    'Assembly': palette.primary,
    'Testing': '#F59E0B',
    'Shipping': '#10B981',
    'QC': '#8B5CF6',
    'SMT': '#0891B2',
    'THT': '#059669',
  };

  const stageName = card.currentStage?.split(':')[1]?.trim() || card.currentStage || '';
  const stageColor = Object.entries(stageColors).find(([k]) => stageName.includes(k))?.[1] || '#6B7280';

  const getTimeAgo = (dateStr: string): string => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ago`; // Keep these as they are mostly international or if translated, I don't have day keys yet
    if (hours > 0) return t('hoursAgo').replace('X', hours.toString());
    return t('minsAgo').replace('X', mins.toString());
  };

  return (
    <TouchableOpacity 
      style={[styles.cardItem, { backgroundColor: palette.background, borderColor: palette.border }]} 
      onPress={onPress} 
      activeOpacity={0.7}
    >
      <View style={styles.cardItemLeft}>
        <View style={[styles.stageProgress, { borderColor: palette.border }]}>
          <View style={[styles.stageProgressFill, {
            borderTopColor: stageColor,
            borderRightColor: card.progressPercent > 25 ? stageColor : 'transparent',
            borderBottomColor: card.progressPercent > 50 ? stageColor : 'transparent',
            borderLeftColor: card.progressPercent > 75 ? stageColor : 'transparent',
          }]} />
          <Ionicons name="hardware-chip-outline" size={16} color={stageColor} />
        </View>
        <View style={styles.cardItemInfo}>
          <View style={styles.cardItemHeader}>
            <Text style={[styles.cardItemId, { color: palette.text }]}>{card.cardId}</Text>
            <View style={[styles.statusBadge, { backgroundColor: stageColor + '15', borderColor: stageColor + '30' }]}>
              <Text style={[styles.statusBadgeText, { color: stageColor }]}>{stageName}</Text>
            </View>
          </View>
          <Text style={[styles.cardItemMeta, { color: palette.textTertiary }]}>
            <Ionicons name="location-outline" size={12} color={palette.textTertiary} /> {card.currentLocation} · {getTimeAgo(card.updatedAt)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={palette.textDisabled} />
      </View>
    </TouchableOpacity>
  );
}

function AnimatedIcon({ children, index }: { children: React.ReactNode, index: number }) {
  const float = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    float.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000 + index * 200 }),
        withTiming(0, { duration: 2000 + index * 200 })
      ),
      -1,
      true
    );
  }, [float, index]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: float.value * -4 },
      { scale: scale.value },
      { rotate: `${float.value * (index % 2 === 0 ? 2 : -2)}deg` }
    ],
  }));

  return (
    <AnimatedReanimated.View
      style={animatedStyle}
    >
      {children}
    </AnimatedReanimated.View>
  );
}

export default function HomeScreen() {
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const { palette, isDark } = useTheme();
  const scrollY = useRef(new Animated.Value(0)).current;
  const [searchOpen, setSearchOpen] = useState(false);
  const [isMainMenuVisible, setMainMenuVisible] = useState(false);
  const { alerts, checkStuckCards } = useAlertsStore();
  const unreadAlertsCount = alerts.filter(a => !a.dismissed).length;
  const stuckThreshold = useSettingsStore(s => s.stuckCardThresholdHours);

  const { data: cards, isLoading: cardsLoading, refetch } = useQuery({
    queryKey: ['cards'],
    queryFn: () => getCards(),
  });

  useQuery({
    queryKey: ['analytics', 'today'],
    queryFn: () => getAnalytics('today'),
  });

  // Realtime Subscription
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'electronic_cards',
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const completedCount = cards?.filter(c => c.status === 'completed').length || 0;
  const inProgressCount = cards?.filter(c => c.status === 'in_progress').length || 0;
  const totalCount = cards?.length || 0;
  const roleColor = ROLE_COLORS[user?.role || 'operator'];

  // Check for stuck cards whenever cards data changes
  useEffect(() => {
    if (cards && cards.length > 0) {
      checkStuckCards(
        cards.map(c => ({
          cardId: c.cardId,
          updatedAt: c.updatedAt,
          status: c.status,
          currentStage: c.currentStage,
          currentLocation: c.currentLocation
        })),
        stuckThreshold
      );
    }
  }, [cards, stuckThreshold, checkStuckCards]);

  const thresholdMs = Math.max(0.1, stuckThreshold) * 60 * 60 * 1000;
  const delayedCards = (cards || []).filter(c =>
    c.status !== 'completed' && (Date.now() - new Date(c.updatedAt).getTime()) > thresholdMs
  ).sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());

  const headerOpacity = scrollY.interpolate({ inputRange: [0, 60], outputRange: [1, 0.95], extrapolate: 'clamp' });

  const getGreetingText = () => {
    const h = new Date().getHours();
    if (h < 12) return t('morning');
    if (h < 17) return t('afternoon');
    return t('evening');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.backgroundSecondary }]} edges={['top']}>
      <Animated.ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={cardsLoading} onRefresh={refetch} tintColor={palette.primary} />}
      >
        {/* Header */}
        <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
          <LinearGradient
            colors={isDark ? ['#1E293B', '#0F172A'] : ['#FFFFFF', '#F8FAFC']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.headerLeft}>
            <TouchableOpacity style={styles.menuBtn} onPress={() => setMainMenuVisible(true)}>
              <Ionicons name="menu" size={24} color={palette.text} />
            </TouchableOpacity>
            <View>
              <Text style={[styles.userName, { color: palette.text }]}>CardTrack</Text>
              <Text style={[styles.greeting, { color: palette.textSecondary }]}>{getGreetingText()}, {user?.displayName}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.searchBtn} onPress={() => setSearchOpen(true)}>
              <Ionicons name="search" size={22} color={palette.text} />
            </TouchableOpacity>

            {/* Notification Bell with Badge */}
            <TouchableOpacity style={styles.searchBtn} onPress={() => router.push('/notifications')}>
              <View>
                <Ionicons name="notifications-outline" size={24} color={palette.text} />
                {unreadAlertsCount > 0 && (
                  <View style={styles.bellBadge}>
                    <Text style={styles.bellBadgeText}>{unreadAlertsCount}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
            <View style={[styles.roleBadge, { backgroundColor: roleColor + '20' }]}>
              <Text style={[styles.roleText, { color: roleColor }]}>{user?.role?.toUpperCase()}</Text>
            </View>
            <TouchableOpacity style={styles.avatarBtn} onPress={() => router.push('/(tabs)/profile')}>
              <View style={[styles.avatar, { backgroundColor: roleColor, overflow: 'hidden' }]}>
                {user?.avatarUrl ? (
                  <Image source={{ uri: user.avatarUrl }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarText}>
                    {user?.displayName?.[0]?.toUpperCase() || 'U'}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          </View>
        </Animated.View>



        {/* Stats Row */}
        <AnimatedReanimated.View
          entering={FadeInDown.duration(800).delay(200)}
          style={styles.statsRow}
        >
          <View style={[styles.statCard, { backgroundColor: palette.background, borderColor: palette.border, borderWidth: 1 }]}>
            <View style={[styles.statIcon, { backgroundColor: isDark ? '#1e3a8a' : '#EFF6FF' }]}>
              <Ionicons name="apps" size={24} color={palette.primary} />
            </View>
            <View style={styles.statInfo}>
              <Text style={[styles.statValue, { color: palette.text }]}>{totalCount}</Text>
              <Text style={[styles.statLabel, { color: palette.textSecondary }]}>{t('total')}</Text>
            </View>
          </View>
          <View style={[styles.statCard, { backgroundColor: palette.background, borderColor: palette.border, borderWidth: 1 }]}>
            <View style={[styles.statIcon, { backgroundColor: isDark ? '#312e81' : '#EEF2FF' }]}>
              <Ionicons name="sync" size={24} color="#8B5CF6" />
            </View>
            <View style={styles.statInfo}>
              <Text style={[styles.statValue, { color: palette.text }]}>{inProgressCount}</Text>
              <Text style={[styles.statLabel, { color: palette.textSecondary }]}>{t('inProgress')}</Text>
            </View>
          </View>
          <View style={[styles.statCard, { backgroundColor: palette.background, borderColor: palette.border, borderWidth: 1 }]}>
            <View style={[styles.statIcon, { backgroundColor: isDark ? '#064e3b' : '#F0FDF4' }]}>
              <Ionicons name="checkmark-circle" size={24} color="#10B981" />
            </View>
            <View style={styles.statInfo}>
              <Text style={[styles.statValue, { color: palette.text }]}>{completedCount}</Text>
              <Text style={[styles.statLabel, { color: palette.textSecondary }]}>{t('completed')}</Text>
            </View>
          </View>
        </AnimatedReanimated.View>

        {/* Quick Actions */}
        <AnimatedReanimated.View
          entering={FadeInDown.duration(800).delay(400)}
          style={styles.section}
        >
          <Text style={[styles.sectionTitle, { color: palette.text }]}>{t('quickActions')}</Text>
          <View style={[styles.actionsRow, { backgroundColor: palette.background }]}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/production-map')} activeOpacity={0.8}>
              <AnimatedIcon index={0}>
                <LinearGradient
                  colors={isDark ? ['#1e40af', '#1e3a8a'] : ['#DBEAFE', '#BFDBFE']}
                  style={styles.actionIcon}
                >
                  <Ionicons name="map" size={24} color="#2563EB" />
                </LinearGradient>
              </AnimatedIcon>
              <Text style={[styles.actionLabel, { color: palette.textSecondary }]} numberOfLines={2} adjustsFontSizeToFit>{t('productionMap')}</Text>
            </TouchableOpacity>

            {(user?.role === 'supervisor' || user?.role === 'admin') && (
              <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/activity-feed' as any)} activeOpacity={0.8}>
                <AnimatedIcon index={1}>
                  <LinearGradient
                    colors={isDark ? ['#059669', '#065f46'] : ['#D1FAE5', '#A7F3D0']}
                    style={styles.actionIcon}
                  >
                    <Ionicons name="list" size={24} color="#10B981" />
                  </LinearGradient>
                </AnimatedIcon>
                <Text style={[styles.actionLabel, { color: palette.textSecondary }]} numberOfLines={2} adjustsFontSizeToFit>{t('activity')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </AnimatedReanimated.View>

        {/* System Status Banner */}
        <TouchableOpacity
          style={[styles.statusBanner, { backgroundColor: isDark ? '#064e3b' : '#F0FDF4', borderColor: isDark ? '#065f46' : '#D1FAE5' }]}
          onPress={() => router.push('/system-status')}
          activeOpacity={0.8}
        >
          <View style={styles.statusDot} />
          <View style={styles.statusBannerText}>
            <Text style={[styles.statusBannerTitle, { color: palette.text }]}>{t('operationalBanner')}</Text>
            <Text style={[styles.statusBannerSub, { color: palette.textSecondary }]}>{t('operationalSub')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
        </TouchableOpacity>

        {/* Recent Cards */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>{t('recentCards')}</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/history')}>
              <Text style={[styles.sectionAction, { color: palette.primary }]}>{t('viewAll')}</Text>
            </TouchableOpacity>
          </View>
          {cards?.slice(0, 5).map(card => (
            <CardListItem
              key={card.id}
              card={card}
              onPress={() => router.push(`/card/${card.cardId}`)}
              palette={palette}
              primaryColor={palette.primary}
            />
          ))}
          {!cards?.length && !cardsLoading && (
            <View style={styles.empty}>
              <Ionicons name="layers-outline" size={48} color={palette.border} />
              <Text style={[styles.emptyText, { color: palette.textSecondary }]}>{t('noCardsYet')}</Text>
              <Text style={[styles.emptySubtext, { color: palette.textTertiary }]}>{t('scanToStart')}</Text>
            </View>
          )}
        </View>

        {/* Delayed Cards */}
        {delayedCards.length > 0 && (
          <View style={[styles.section, { marginBottom: spacing.xl }]}>
            <View style={styles.sectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="warning" size={20} color="#EF4444" />
                <Text style={[styles.sectionTitle, { color: palette.text }]}>{t('actionRequired')}</Text>
              </View>
            </View>
            <Text style={[styles.sectionSubtitle, { color: palette.textSecondary, marginBottom: spacing.md }]}>
              {t('stuckFor')} {stuckThreshold}h
            </Text>
            {delayedCards.map(card => {
              const hoursStuck = Math.floor((Date.now() - new Date(card.updatedAt).getTime()) / (1000 * 60 * 60));
              return (
                <View key={card.id} style={{ position: 'relative' }}>
                  <CardListItem
                    card={card}
                    onPress={() => router.push(`/card/${card.cardId}`)}
                    palette={palette}
                  />
                  <View style={[styles.stuckBadge, { backgroundColor: '#FEE2E2', borderColor: '#EF4444' }]}>
                    <Text style={[styles.stuckBadgeText, { color: '#DC2626' }]}>{t('stuckBadge')} {hoursStuck}h</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </Animated.ScrollView>
      <SearchModal visible={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Main Dashboard Menu Bottom Sheet */}
      <Modal visible={isMainMenuVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMainMenuVisible(false)}
        >
          <TouchableOpacity style={[styles.bottomSheet, { backgroundColor: palette.background }]} activeOpacity={1}>
            <View style={styles.sheetHeader}>
              <View style={[styles.sheetHandle, { backgroundColor: palette.border }]} />
              <Text style={[styles.sheetTitle, { color: palette.text }]}>{t('mainMenu') || 'Main Menu'}</Text>
              <Text style={[styles.sheetSubtitle, { color: palette.textSecondary }]}>
                {user?.displayName} · {user?.role?.toUpperCase()}
              </Text>
            </View>

            <View style={styles.sheetContent}>
              {/* NEW FEATURES */}


              {user?.role === 'admin' && (
                <TouchableOpacity
                  style={[styles.sheetActionBtn, { borderBottomColor: palette.border }]}
                  onPress={() => {
                    setMainMenuVisible(false);
                    router.push('/system-status' as any);
                  }}
                >
                  <View style={[styles.sheetActionIcon, { backgroundColor: '#FEE2E2' }]}>
                    <Ionicons name="build" size={20} color="#DC2626" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sheetActionText, { color: palette.text }]}>{t('maintenanceCenter') || 'Maintenance Center'}</Text>
                    <Text style={[styles.sheetActionSub, { color: palette.textTertiary }]}>{t('maintenanceCenterDesc') || 'Hardware health & diagnostics'}</Text>
                  </View>
                  <View style={styles.newBadge}><Text style={styles.newBadgeText}>NEW</Text></View>
                </TouchableOpacity>
              )}



              <TouchableOpacity
                style={[styles.sheetActionBtn, { borderBottomColor: palette.border }]}
                onPress={() => {
                  setMainMenuVisible(false);
                  router.push('/smart-optimization' as any);
                }}
              >
                <View style={[styles.sheetActionIcon, { backgroundColor: '#F5F3FF' }]}>
                  <Ionicons name="sparkles" size={20} color="#8B5CF6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sheetActionText, { color: palette.text }]}>{t('smartOptimization') || 'Smart Optimization'}</Text>
                  <Text style={[styles.sheetActionSub, { color: palette.textTertiary }]}>{t('smartOptimizationDesc') || 'AI production insights'}</Text>
                </View>
                <View style={styles.newBadge}><Text style={styles.newBadgeText}>NEW</Text></View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sheetActionBtn, { borderBottomColor: palette.border }]}
                onPress={() => {
                  setMainMenuVisible(false);
                  router.push('/production-map' as any);
                }}
              >
                <View style={[styles.sheetActionIcon, { backgroundColor: '#F0FDF4' }]}>
                  <Ionicons name="map" size={20} color="#10B981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sheetActionText, { color: palette.text }]}>{t('productionMap') || 'Production Map'}</Text>
                  <Text style={[styles.sheetActionSub, { color: palette.textTertiary }]}>{t('productionMapDesc') || 'Real-time floor visualization'}</Text>
                </View>
                <View style={styles.newBadge}><Text style={styles.newBadgeText}>NEW</Text></View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sheetActionBtn, { borderBottomColor: palette.border }]}
                onPress={() => {
                  setMainMenuVisible(false);
                  router.push('/issues' as any);
                }}
              >
                <View style={[styles.sheetActionIcon, { backgroundColor: '#F0F9FF' }]}>
                  <Ionicons name="chatbubbles" size={20} color="#0EA5E9" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sheetActionText, { color: palette.text }]}>{t('issuesAndTasks') || 'Issues & Tasks'}</Text>
                  <Text style={[styles.sheetActionSub, { color: palette.textTertiary }]}>{t('collaborationSubtitle') || 'Team collaboration hub'}</Text>
                </View>
                <View style={styles.newBadge}><Text style={styles.newBadgeText}>NEW</Text></View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sheetActionBtn, { borderBottomColor: palette.border }]}
                onPress={() => {
                  setMainMenuVisible(false);
                  router.push('/(tabs)/history');
                }}
              >
                <View style={[styles.sheetActionIcon, { backgroundColor: '#FEE2E2' }]}>
                  <Ionicons name="time" size={20} color="#DC2626" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sheetActionText, { color: palette.text }]}>{t('history') || 'Scan History'}</Text>
                  <Text style={[styles.sheetActionSub, { color: palette.textTertiary }]}>{t('historyDesc') || 'Review past card scans'}</Text>
                </View>
              </TouchableOpacity>

              {/* STANDARD TOOLS */}
              {(user?.role === 'supervisor' || user?.role === 'admin') && (
                <TouchableOpacity
                  style={[styles.sheetActionBtn, { borderBottomColor: palette.border }]}
                  onPress={() => {
                    setMainMenuVisible(false);
                    router.push('/export');
                  }}
                >
                  <View style={[styles.sheetActionIcon, { backgroundColor: '#D1FAE5' }]}>
                    <Ionicons name="download" size={20} color="#10B981" />
                  </View>
                  <Text style={[styles.sheetActionText, { color: palette.text }]}>{t('exportCenter') || 'Export Center'}</Text>
                  <Ionicons name="chevron-forward" size={18} color={palette.textTertiary} style={{ marginLeft: 'auto' }} />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.sheetActionBtn, { borderBottomWidth: 0 }]}
                onPress={() => {
                  setMainMenuVisible(false);
                  router.push('/settings');
                }}
              >
                <View style={[styles.sheetActionIcon, { backgroundColor: '#F3F4F6' }]}>
                  <Ionicons name="settings" size={20} color="#4B5563" />
                </View>
                <Text style={[styles.sheetActionText, { color: palette.text }]}>{t('preferences')}</Text>
                <Ionicons name="chevron-forward" size={18} color={palette.textTertiary} style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 0,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  searchBtn: { padding: 6 },
  menuBtn: { padding: 4 },
  greeting: { ...typography.small },
  userName: { ...typography.bodyBold },
  roleBadge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.full },
  roleText: { ...typography.tiny, fontWeight: '700' },
  avatarBtn: {},
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { ...typography.captionBold, color: colors.white },
  avatarImg: { width: '100%', height: '100%' },
  statsRow: {
    flexDirection: 'row', gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  statCard: {
    flex: 1, padding: spacing.sm, borderRadius: borderRadius.xl,
    flexDirection: 'column', alignItems: 'center', gap: 6,
    ...shadows.xs,
  },
  statIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statInfo: { alignItems: 'center' },
  statValue: { ...typography.bodyBold, fontSize: 16, textAlign: 'center' },
  statLabel: { ...typography.tiny, fontWeight: '700', textTransform: 'uppercase', textAlign: 'center', fontSize: 9 },
  section: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sectionTitle: { ...typography.h4 },
  sectionAction: { ...typography.caption },
  actionsRow: {
    flexDirection: 'row', gap: spacing.sm,
    borderRadius: borderRadius.xl,
    padding: spacing.md, ...shadows.sm,
  },
  actionBtn: { flex: 1, alignItems: 'center', gap: spacing.xs },
  actionIcon: {
    width: 52, height: 52, borderRadius: borderRadius.xl,
    alignItems: 'center', justifyContent: 'center',
    ...shadows.sm,
  },
  cardItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  statusBadgeText: { ...typography.tiny, fontWeight: '700' },
  actionLabel: { ...typography.small, fontWeight: '600', textAlign: 'center', width: '100%' },
  sectionSubtitle: { ...typography.small },
  bellBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: colors.error, minWidth: 16, height: 16,
    borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
  },
  bellBadgeText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  stuckBadge: {
    position: 'absolute', top: -6, right: -6,
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: borderRadius.full, borderWidth: 1,
  },
  stuckBadgeText: { ...typography.tiny, fontWeight: 'bold' },
  statusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginHorizontal: spacing.lg, marginTop: spacing.md,
    borderRadius: borderRadius.lg,
    padding: spacing.md, borderWidth: 1,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#10B981' },
  statusBannerText: { flex: 1 },
  statusBannerTitle: { ...typography.captionBold },
  statusBannerSub: { ...typography.small },
  cardMoreBtn: { padding: 4, marginLeft: spacing.sm },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 40,
  },
  sheetHeader: {
    alignItems: 'center', paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, marginBottom: spacing.md },
  sheetTitle: { ...typography.bodyBold, fontSize: 18 },
  sheetSubtitle: { ...typography.small, marginTop: 2 },
  sheetContent: { paddingHorizontal: spacing.lg },
  sheetActionBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.md, borderBottomWidth: 1,
  },
  sheetActionIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.md,
  },
  sheetActionText: { ...typography.body, fontWeight: '600' },
  cardItem: {
    borderRadius: borderRadius.lg,
    padding: spacing.md, marginBottom: spacing.sm, ...shadows.xs,
    borderWidth: 1,
  },
  cardItemLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stageProgress: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 3, alignItems: 'center', justifyContent: 'center',
  },
  stageProgressFill: {
    position: 'absolute', width: 44, height: 44,
    borderRadius: 22, borderWidth: 3, borderColor: 'transparent',
  },
  cardItemInfo: { flex: 1 },
  cardItemId: { ...typography.bodyBold },
  cardItemStage: { ...typography.caption, marginTop: 2 },
  cardItemMeta: { ...typography.small, marginTop: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.full },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { ...typography.small, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  emptyText: { ...typography.body },
  emptySubtext: { ...typography.small },
  sheetActionSub: { ...typography.tiny, marginTop: 2 },
  newBadge: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
    alignSelf: 'center',
  },
  newBadgeText: {
    ...typography.tiny,
    fontWeight: '700',
    fontSize: 9,
  },
});
