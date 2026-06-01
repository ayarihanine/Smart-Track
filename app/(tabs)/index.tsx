import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  RefreshControl, Animated, Image, Modal, Alert,
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
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/design';
import { useAuthStore } from '@/store/authStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/components/ThemeProvider';
import { fetchAlerts, fetchPendingInspectionsCount, getCards, fetchTodayProductionStats, TodayProductionStats } from '@/lib/api';
import { getSupabaseClient, uploadFileToStorage } from '@/lib/supabase';
import { verifyStorageSetup } from '@/lib/storageDebug';
import { getTodayBounds } from '@/lib/dates';
import { ElectronicCard, UserRole } from '@/types';
import { SearchModal } from '@/components/SearchModal';
import { useAlertsStore } from '@/store/alertsStore';
import { useSettingsStore } from '@/store/settingsStore';
import * as ImagePicker from 'expo-image-picker';

// Using palette-based colors for roles would be tricky since it's static,
// but we'll use semantically close colors from the design system or the palette where possible.
const ROLE_COLORS: Record<UserRole, string> = {
  operator: '#10B981', // Success emerald
  supervisor: '#3B82F6', // Blue
  admin: '#8B5CF6', // Violet
};


function CardListItem({ card, onPress, palette }: { card: ElectronicCard; onPress: () => void; palette: any }) {
  const { t } = useTranslation();
  const { isDark } = useTheme();
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
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return t('hoursAgo').replace('X', hours.toString());
    return t('minsAgo').replace('X', mins.toString());
  };

  return (
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
        <View style={[styles.cardIconBox, { backgroundColor: stageColor + '12' }]}>
          <Ionicons name={card.status === 'completed' ? "shield-checkmark" : "hardware-chip-outline"} size={20} color={stageColor} />
        </View>

        <View style={styles.cardMainInfo}>
          <View style={styles.cardIdRow}>
            <Text style={[styles.cardIdText, { color: palette.text }]} numberOfLines={1}>{card.cardId}</Text>
            {stageName ? (
              <View style={[styles.stageBadge, { backgroundColor: stageColor + '12', borderColor: stageColor + '30' }]}>
                <Text style={[styles.stageBadgeText, { color: stageColor }]} numberOfLines={1}>{stageName}</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.cardTimeText, { color: palette.textTertiary }]}>
            <Ionicons name="location-outline" size={12} color={palette.textTertiary} /> {card.currentLocation ? `${card.currentLocation} · ` : ''}{getTimeAgo(card.updatedAt)}
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
  const { checkStuckCards } = useAlertsStore();
  const [unreadAlertsCount, setUnreadAlertsCount] = useState(0);
  const [uploading, setUploading] = useState(false);
  const stuckThreshold = useSettingsStore(s => s.stuckCardThresholdHours);

  const [cards, setCards] = useState<ElectronicCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [productionStats, setProductionStats] = useState<TodayProductionStats | null>(null);
  const [pendingInspectionsCount, setPendingInspectionsCount] = useState(0);
  // BUG 4 FIX: Track ALL statuses so total === sum of all buckets (no silent drops)
  const [todayStats, setTodayStats] = useState({
    total: 0,
    inProgress: 0,
    completed: 0,
    blocked: 0,    // on_hold + cancelled + removed
    pending: 0,
  });

  const fetchTodayStats = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    try {
      const { start, end } = getTodayBounds();
      const { data, error } = await supabase
        .from('electronic_cards')
        .select('status')
        .gte('created_at', start.toISOString())
        .lt('created_at', end.toISOString());

      if (!error && data) {
        let inProgress = 0;
        let completed = 0;
        let blocked = 0;
        let pending = 0;

        // BUG 4 FIX: Count ALL statuses including 'removed' so total reconciles.
        // blocked bucket = cancelled + removed (non-active, non-complete, non-pending)
        // on_hold counts as in_progress (temporarily paused, not lost)
        data.forEach((c: any) => {
          if (c.status === 'in_progress' || c.status === 'on_hold') inProgress++;
          else if (c.status === 'completed') completed++;
          else if (c.status === 'cancelled' || c.status === 'removed') blocked++;
          else if (c.status === 'pending') pending++;
          // Any other status is already counted in data.length (total)
        });

        // Validate: total must equal sum of all buckets
        const accountedFor = inProgress + completed + blocked + pending;
        if (accountedFor !== data.length) {
          console.warn(
            `[HomeScreen] Stats mismatch: total=${data.length} but buckets sum=${accountedFor}. ` +
            'Unknown statuses present — they are still counted in Total.'
          );
        }

        setTodayStats({
          total: data.length,   // always the raw count — never derived from buckets
          inProgress,
          completed,
          blocked,
          pending,
        });
      }
    } catch (err) {
      console.error('fetchTodayStats failed:', err);
    }
  };

  const fetchCards = async () => {
    try {
      const data = await getCards({ sortBy: 'recent' });
      setCards(data || []);
    } catch (error) {
      console.error('fetchCards failed:', error);
    } finally {
      setCardsLoading(false);
    }
  };

  const fetchProductionStats = async () => {
    try {
      const stats = await fetchTodayProductionStats();
      setProductionStats(stats);
    } catch (error) {
      console.error('fetchProductionStats failed:', error);
    }
  };

  useEffect(() => {
    fetchCards();
    fetchProductionStats();
    fetchTodayStats();
  }, []);

  useEffect(() => {
    let mounted = true;
    const { start, end } = getTodayBounds();
    fetchAlerts(true).then(rows => {
      const todayAlerts = rows.filter((r: any) => {
        const t = new Date(r.created_at).getTime();
        return t >= start.getTime() && t < end.getTime();
      });
      if (mounted) setUnreadAlertsCount(todayAlerts.length);
    });
    fetchPendingInspectionsCount(start.toISOString(), end.toISOString()).then(count => {
      if (mounted) setPendingInspectionsCount(count);
    });
    return () => { mounted = false; };
  }, []);

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
          fetchCards();
          fetchTodayStats();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sensor_data',
          filter: 'node_id=eq.PI5-NODE-01',
        },
        () => {
          fetchProductionStats();
          fetchTodayStats();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'alerts',
        },
        () => {
          setUnreadAlertsCount(count => count + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const completedCount = cards?.filter(c => c.status === 'completed').length || 0;
  const inProgressCount = cards?.filter(c => c.status === 'in_progress').length || 0;
  const totalCount = cards?.length ?? 0;
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
          currentLocation: c.currentLocation,
          stageEnteredAt: c.stageEnteredAt
        })),
        stuckThreshold
      );
    }
  }, [cards, stuckThreshold, checkStuckCards]);

  const headerOpacity = scrollY.interpolate({ inputRange: [0, 60], outputRange: [1, 0.95], extrapolate: 'clamp' });

  const getGreetingText = () => {
    const h = new Date().getHours();
    if (h < 12) return t('morning');
    if (h < 17) return t('afternoon');
    return t('evening');
  };

  const handleReportIssue = async () => {
    setMainMenuVisible(false);
    const choice = await new Promise<string | null>((resolve) => {
      Alert.alert('Report Issue', 'Attach a photo of the problem', [
        { text: 'Take Photo', onPress: () => resolve('camera') },
        { text: 'Choose from Gallery', onPress: () => resolve('gallery') },
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
      ]);
    });
    if (!choice) return;

    try {
      let uri: string | undefined;
      if (choice === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission Required', 'Camera access is needed to take photos.');
          return;
        }
        const result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true });
        if (!result.canceled && result.assets?.[0]) uri = result.assets[0].uri;
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission Required', 'Gallery access is needed to select photos.');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true });
        if (!result.canceled && result.assets?.[0]) uri = result.assets[0].uri;
      }
      if (!uri) return;

      setUploading(true);
      const supabase = getSupabaseClient();
      if (!supabase) { Alert.alert('Error', 'Database not configured'); return; }

      // Check authentication status and warn if not logged in
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        console.warn('User not authenticated - photo upload will use anon role');
      }

      const ext = uri.split('.').pop() || 'jpg';
      const fileName = `operator_${user?.displayName?.replace(/\s+/g, '_')}_${Date.now()}.${ext}`;
      
      try {
        console.log('[Photo Upload] Starting upload process for:', fileName);
        console.log('[Photo Upload] URI:', uri);
        
        // Fetch the image as a blob
        console.log('[Photo Upload] Fetching image from local URI...');
        const response = await fetch(uri, { timeout: 10000 });
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        
        const blob = await response.blob();
        console.log('[Photo Upload] Image fetched successfully');
        console.log('[Photo Upload] Blob details:', { size: blob.size, type: blob.type });

        // Use retry-enabled upload function
        console.log('[Photo Upload] Starting upload to inspection_photos bucket...');
        const { error: uploadError, data } = await uploadFileToStorage(
          'inspection_photos',
          fileName,
          blob,
          { 
            contentType: `image/${ext}`,
            maxRetries: 3
          }
        );

        if (uploadError) {
          console.error('[Photo Upload] Upload failed:', {
            message: uploadError.message,
            statusCode: (uploadError as any).statusCode || (uploadError as any).status,
            error: uploadError
          });
          
          // Provide specific error messages based on error type
          let errorMessage = 'Failed to upload photo.';
          const statusCode = (uploadError as any).statusCode || (uploadError as any).status;
          
          if (statusCode === 403 || uploadError.message?.includes('Permission denied')) {
            errorMessage = 'Permission denied. Make sure you are logged in and the "inspection_photos" bucket has proper access policies.';
          } else if (statusCode === 404 || uploadError.message?.includes('not found')) {
            errorMessage = 'The "inspection_photos" bucket does not exist in Supabase Storage. Please contact your administrator.';
          } else if (statusCode === 401 || uploadError.message?.includes('Unauthorized')) {
            errorMessage = 'Authentication failed. Please log in and try again.';
          } else if (uploadError.message?.includes('network') || uploadError.message?.includes('Network')) {
            errorMessage = 'Network error. Please check your internet connection and try again.';
          } else if (uploadError.message?.includes('timeout')) {
            errorMessage = 'Upload timed out. Please check your internet connection and try again.';
          } else {
            errorMessage = uploadError.message || errorMessage;
          }
          
          throw new Error(errorMessage);
        }
        
        console.log('[Photo Upload] Upload successful:', fileName);
      } catch (err: any) {
        console.error('[Photo Upload] Process failed:', err);
        Alert.alert(
          'Upload Failed', 
          err?.message || 'Could not upload photo. Please check your internet connection and try again.'
        );
        setUploading(false);
        return;
      }

      // Get the public URL for the uploaded photo
      const { data: urlData } = supabase.storage
        .from('inspection_photos')
        .getPublicUrl(fileName);

      if (!urlData?.publicUrl) {
        throw new Error('Failed to generate public URL for uploaded photo');
      }

      // Navigate to issues screen with photo URL as param
      router.push({
        pathname: '/issues',
        params: { photoUrl: urlData.publicUrl, photoPath: fileName },
      });
      Alert.alert('Photo Ready', 'Now add details to create the issue report.');
    } catch (err: any) {
      console.error('Report issue error:', err);
      Alert.alert('Error', err?.message || 'Could not process your photo. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.backgroundSecondary }]} edges={['top']}>
      <Animated.ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={cardsLoading} onRefresh={() => { fetchCards(); fetchProductionStats(); fetchTodayStats(); }} tintColor={palette.primary} />}
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
            <View style={{ marginLeft: 4 }}>
              <Text style={[styles.userName, { color: palette.text }]}>CardTrack</Text>
              <Text style={[styles.greeting, { color: palette.textSecondary }]}>{getGreetingText()}, {user?.displayName || 'User'}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.searchBtn} onPress={() => setSearchOpen(true)}>
              <Ionicons name="search" size={22} color={palette.text} />
            </TouchableOpacity>

            {/* Notification Bell with Badge */}
            <TouchableOpacity style={styles.notifBtn} onPress={() => router.push('/notifications')}>
              <View>
                <Ionicons name="notifications-outline" size={24} color={palette.text} />
                {unreadAlertsCount > 0 && (
                  <View style={styles.bellBadge}>
                    <Text style={styles.bellBadgeText}>{unreadAlertsCount}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
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



        {/* Today's Stats Banner */}
        <AnimatedReanimated.View
          entering={FadeInDown.duration(800).delay(200)}
          style={styles.statsBannerWrap}
        >
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push('/(tabs)/dashboard' as never)}
          >
            <LinearGradient
              colors={isDark ? ['#6366F120', '#0F172A'] : ['#EEF2FF', '#E0E7FF']}
              style={[styles.statCardFull, { borderColor: isDark ? '#6366F140' : '#A5B4FC', borderWidth: 1 }]}
            >
              <View style={[styles.statIconFull, { backgroundColor: isDark ? '#6366F130' : '#C7D2FE' }]}>
                <Ionicons name="layers" size={26} color="#6366F1" />
              </View>
              <View style={styles.statInfoFull}>
                <Text style={[styles.statValueLarge, { color: '#6366F1' }]}>{todayStats.total}</Text>
                <Text style={[styles.statLabelLarge, { color: '#6366F1' }]}>Cards Started Today</Text>
              </View>
              <View style={[styles.bannerArrow, { backgroundColor: isDark ? '#6366F130' : '#C7D2FE' }]}>
                <Ionicons name="chevron-forward" size={18} color="#6366F1" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </AnimatedReanimated.View>

        {/* 3-column Stats Row */}
        <AnimatedReanimated.View
          entering={FadeInDown.duration(800).delay(300)}
          style={styles.statsGridWrap}
        >
          <LinearGradient
            colors={isDark ? ['#6366F120', '#0F172A'] : ['#EEF2FF', '#E0E7FF']}
            style={[styles.statCardGrid, { borderColor: isDark ? '#6366F140' : '#A5B4FC', borderWidth: 1 }]}
          >
            <View style={[styles.statIcon, { backgroundColor: isDark ? '#6366F130' : '#C7D2FE' }]}>
              <Ionicons name="sync" size={20} color="#6366F1" />
            </View>
            <View style={styles.statInfo}>
              <Text style={[styles.statValue, { color: '#6366F1' }]}>{todayStats.inProgress}</Text>
              <Text style={[styles.statLabel, { color: '#6366F1' }]}>{t('inProgress')}</Text>
            </View>
          </LinearGradient>
          
          <LinearGradient
            colors={isDark ? ['#0D948820', '#0F172A'] : ['#F0FDFA', '#CCFBF1']}
            style={[styles.statCardGrid, { borderColor: isDark ? '#0D948840' : '#5EEAD4', borderWidth: 1 }]}
          >
            <View style={[styles.statIcon, { backgroundColor: isDark ? '#0D948830' : '#99F6E4' }]}>
              <Ionicons name="checkmark-circle" size={20} color="#0D9488" />
            </View>
            <View style={styles.statInfo}>
              <Text style={[styles.statValue, { color: '#0D9488' }]}>{todayStats.completed}</Text>
              <Text style={[styles.statLabel, { color: '#0D9488' }]}>Completed</Text>
            </View>
          </LinearGradient>

          <LinearGradient
            colors={isDark ? ['#47556920', '#0F172A'] : ['#F1F5F9', '#E2E8F0']}
            style={[styles.statCardGrid, { borderColor: isDark ? '#47556940' : '#94A3B8', borderWidth: 1 }]}
          >
            <View style={[styles.statIcon, { backgroundColor: isDark ? '#47556930' : '#CBD5E1' }]}>
              <Ionicons name="ban-outline" size={20} color="#475569" />
            </View>
            <View style={styles.statInfo}>
              <Text style={[styles.statValue, { color: '#475569' }]}>{todayStats.blocked}</Text>
              <Text style={[styles.statLabel, { color: '#475569' }]}>Cards Lost</Text>
            </View>
          </LinearGradient>
        </AnimatedReanimated.View>



        {/* Inspection Priority Banner */}
        {pendingInspectionsCount > 0 ? (
          <AnimatedReanimated.View
            entering={FadeInDown.duration(800).delay(400)}
            style={styles.statsBannerWrap}
          >
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push('/(tabs)/losses')}
            >
              <LinearGradient
                colors={isDark ? ['#F59E0B15', '#0F172A'] : ['#FFFBEB', '#FEF3C7']}
                style={[styles.statCardFull, { borderColor: isDark ? '#F59E0B30' : '#FDE68A', borderWidth: 1 }]}
              >
                <View style={[styles.statIconFull, { backgroundColor: isDark ? '#F59E0B20' : '#FDE68A' }]}>
                  <Ionicons name="search-outline" size={26} color="#D97706" />
                </View>
                <View style={styles.statInfoFull}>
                  <Text style={[styles.statValueLarge, { color: '#D97706' }]}>{pendingInspectionsCount}</Text>
                  <Text style={[styles.statLabelLarge, { color: '#D97706' }]}>
                    {pendingInspectionsCount === 1 ? 'Loss Pending Inspection' : 'Losses Pending Inspection'}
                  </Text>
                </View>
                <View style={[styles.bannerArrow, { backgroundColor: isDark ? '#F59E0B20' : '#FDE68A' }]}>
                  <Ionicons name="chevron-forward" size={18} color="#D97706" />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </AnimatedReanimated.View>
        ) : null}

        {/* Recent Cards */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[styles.sectionIcon, { backgroundColor: palette.primary + '20' }]}>
                <Ionicons name="documents-outline" size={16} color={palette.primary} />
              </View>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>{t('recentCards')}</Text>
            </View>
            <TouchableOpacity
              style={[styles.viewAllBtn, { backgroundColor: palette.primary + '12' }]}
              onPress={() => router.push('/(tabs)/history')}
            >
              <Text style={[styles.viewAllText, { color: palette.primary }]}>{t('viewAll')}</Text>
              <Ionicons name="arrow-forward" size={14} color={palette.primary} />
            </TouchableOpacity>
          </View>
          {cards?.slice(0, 5).map(card => (
            <CardListItem
              key={card.id}
              card={card}
              onPress={() => router.push(`/card/${card.cardId}`)}
              palette={palette}
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
              {/* MAIN MENU */}
              <TouchableOpacity
                style={[styles.sheetActionBtn, { borderBottomColor: palette.border }]}
                onPress={() => {
                  setMainMenuVisible(false);
                  router.push('/configuration');
                }}
              >
                <View style={[styles.sheetActionIcon, { backgroundColor: '#E0F2FE' }]}>
                  <Ionicons name="construct" size={20} color="#0284C7" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sheetActionText, { color: palette.text }]}>{t('Configuration') || 'Configuration'}</Text>
                  <Text style={[styles.sheetActionSub, { color: palette.textTertiary }]}>Manage expected cards, machines & GPIOs</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sheetActionBtn, { borderBottomColor: palette.border }]}
                onPress={() => {
                  setMainMenuVisible(false);
                  router.push('/(tabs)/sensors');
                }}
              >
                <View style={[styles.sheetActionIcon, { backgroundColor: '#D1FAE5' }]}>
                  <Ionicons name="pulse" size={20} color="#10B981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sheetActionText, { color: palette.text }]}>{t('Sensor Status') || 'Sensor Status'}</Text>
                  <Text style={[styles.sheetActionSub, { color: palette.textTertiary }]}>Real-time sensor telemetry & GPIO pins</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sheetActionBtn, { borderBottomColor: palette.border, opacity: uploading ? 0.5 : 1 }]}
                onPress={handleReportIssue}
                disabled={uploading}
              >
                <View style={[styles.sheetActionIcon, { backgroundColor: '#FCE7F3' }]}>
                  <Ionicons name={uploading ? "hourglass" : "camera"} size={20} color="#DB2777" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sheetActionText, { color: palette.text }]}>Report Issue</Text>
                  <Text style={[styles.sheetActionSub, { color: palette.textTertiary }]}>
                    {uploading ? 'Uploading...' : 'Take a photo of a problem & upload'}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sheetActionBtn, { borderBottomColor: palette.border }]}
                onPress={() => {
                  setMainMenuVisible(false);
                  router.push('/(tabs)/statistics');
                }}
              >
                <View style={[styles.sheetActionIcon, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="bar-chart" size={20} color="#D97706" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sheetActionText, { color: palette.text }]}>{t('Statistics') || 'Statistics'}</Text>
                  <Text style={[styles.sheetActionSub, { color: palette.textTertiary }]}>OOE & OEE — daily performance & losses</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sheetActionBtn, { borderBottomColor: palette.border }]}
                onPress={() => {
                  setMainMenuVisible(false);
                  router.push('/(tabs)/history');
                }}
              >
                <View style={[styles.sheetActionIcon, { backgroundColor: '#F3E8FF' }]}>
                  <Ionicons name="file-tray-full" size={20} color="#7C3AED" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sheetActionText, { color: palette.text }]}>{t('Data') || 'Data'}</Text>
                  <Text style={[styles.sheetActionSub, { color: palette.textTertiary }]}>Browse scan logs & history records</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sheetActionBtn, { borderBottomColor: palette.border }]}
                onPress={() => {
                  setMainMenuVisible(false);
                  router.push('/(tabs)/reports');
                }}
              >
                <View style={[styles.sheetActionIcon, { backgroundColor: '#DBEAFE' }]}>
                  <Ionicons name="document-text" size={20} color="#2563EB" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sheetActionText, { color: palette.text }]}>{t('reports') || 'Reports'}</Text>
                  <Text style={[styles.sheetActionSub, { color: palette.textTertiary }]}>Daily reports with OEE & losses</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sheetActionBtn, { borderBottomColor: palette.border }]}
                onPress={() => {
                  setMainMenuVisible(false);
                  router.push('/(tabs)/settings');
                }}
              >
                <View style={[styles.sheetActionIcon, { backgroundColor: '#F3F4F6' }]}>
                  <Ionicons name="options" size={20} color="#4B5563" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sheetActionText, { color: palette.text }]}>{t('settings') || 'Settings'}</Text>
                  <Text style={[styles.sheetActionSub, { color: palette.textTertiary }]}>Adjust threshold values & language settings</Text>
                </View>
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
  scrollContent: { paddingBottom: spacing.xxxl },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 0,
    ...shadows.sm,
    zIndex: 10,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  searchBtn: { padding: 6 },
  notifBtn: { padding: 6, position: 'relative' },
  menuBtn: { padding: 4 },
  greeting: { ...typography.small },
  userName: { ...typography.bodyBold },
  avatarBtn: {},
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)',
  },
  avatarText: { ...typography.captionBold, color: colors.white },
  avatarImg: { width: '100%', height: '100%', borderRadius: 18 },
  statIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statInfo: { alignItems: 'center', gap: 2 },
  statValue: { ...typography.bodyBold, fontSize: 20, textAlign: 'center' },
  statLabel: { ...typography.tiny, fontWeight: '800', textTransform: 'uppercase', textAlign: 'center', fontSize: 9, letterSpacing: 0.8 },
  bannerArrow: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  section: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sectionTitle: { ...typography.h4, fontSize: 18 },
  sectionIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  viewAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  viewAllText: { ...typography.small, fontWeight: '600' },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    justifyContent: 'space-between',
  },
  menuItemBtn: {
    width: '48%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    ...shadows.sm,
  },
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
  badgeText: { ...typography.small, fontWeight: '600' },
  cardItem: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    minHeight: 84,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  cardItemInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  cardIconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
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
    fontSize: 18,
    flex: 1,
  },
  stageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    maxWidth: 130,
  },
  stageBadgeText: {
    ...typography.tiny,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  cardTimeText: {
    ...typography.small,
    fontWeight: '600',
  },
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
  statsBannerWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  statCardFull: {
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    ...shadows.xs,
  },
  statIconFull: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statInfoFull: {
    flex: 1,
  },
  statValueLarge: {
    ...typography.h2,
    fontWeight: '800',
  },
  statLabelLarge: {
    ...typography.captionBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statsGridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  statCardGrid: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: borderRadius.xl,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    ...shadows.xs,
  },
});
