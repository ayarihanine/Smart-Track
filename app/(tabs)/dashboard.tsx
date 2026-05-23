import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { 
  useAnimatedProps, 
  useSharedValue, 
  withTiming, 
  useAnimatedStyle,
  withSpring,
  withRepeat
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { BlurView } from 'expo-blur';

import { borderRadius, shadows, spacing, typography } from '@/constants/design';
import { useTheme } from '@/components/ThemeProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { fetchConfiguration } from '@/lib/api';
import { getSupabaseClient } from '@/lib/supabase';
import { Configuration } from '@/types/production';
import { useSensorCounters } from '@/hooks/useSensorCounters';
import { usePerformanceMetrics } from '@/hooks/usePerformanceMetrics';
import { useTodaysLosses } from '@/hooks/useTodaysLosses';

const SUCCESS_COLOR = '#10B981';
const WARNING_COLOR = '#F59E0B';
const ERROR_COLOR = '#EF4444';

function getPerformanceColor(value: number) {
  if (value >= 85) return SUCCESS_COLOR;
  if (value >= 65) return WARNING_COLOR;
  return ERROR_COLOR;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function PerformanceCard({
  title,
  value,
  subtitle,
  palette,
}: {
  title: string;
  value: number | null;
  subtitle: string;
  palette: any;
}) {
  const { isDark } = useTheme();
  const progress = useSharedValue(0);
  const numericValue = value ?? 0;
  const valueColor = value === null ? '#94A3B8' : getPerformanceColor(numericValue);
  
  const size = 80;
  const strokeWidth = 8;
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const gradientId = `performance-${title.replace(/[^a-z0-9]/gi, '').toLowerCase()}`;

  useEffect(() => {
    progress.value = withSpring(numericValue / 100, { damping: 15 });
  }, [numericValue, progress]);

  const animatedProps = useAnimatedProps(() => {
    const strokeDashoffset = circumference * (1 - progress.value);
    return {
      strokeDashoffset,
    };
  });

  return (
    <View style={[styles.performanceCard, { backgroundColor: palette.background, borderColor: palette.border }]}>
      <LinearGradient
        colors={isDark ? ['#1e293b', '#0f172a'] : ['#FFFFFF', '#F8FAFC']}
        style={StyleSheet.absoluteFill}
      />
      
      <View style={styles.cardHeaderRow}>
        <View style={[styles.performanceMiniIcon, { backgroundColor: valueColor + '20' }]}>
          <Ionicons name={title.includes('TRG') ? 'rocket' : 'flash'} size={14} color={valueColor} />
        </View>
        <Text style={[styles.performanceLabel, { color: palette.textSecondary }]}>{title}</Text>
      </View>

      <View style={styles.performanceContent}>
        <View style={styles.circularContainer}>
          <Svg width={size} height={size}>
            <Defs>
              <SvgGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor={valueColor} />
                <Stop offset="100%" stopColor={isDark ? valueColor : valueColor + 'CC'} />
              </SvgGradient>
            </Defs>
            {/* Background Circle */}
            <Circle
              cx={center}
              cy={center}
              r={radius}
              stroke={isDark ? '#334155' : '#E2E8F0'}
              strokeWidth={strokeWidth}
              fill="none"
            />
            {/* Progress Circle */}
            <AnimatedCircle
              cx={center}
              cy={center}
              r={radius}
              stroke={`url(#${gradientId})`}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              animatedProps={animatedProps}
              strokeLinecap="round"
              fill="none"
              transform={`rotate(-90 ${center} ${center})`}
            />
          </Svg>
          <View style={styles.percentageContainer}>
            <Text style={[styles.performanceValue, { color: palette.text, fontSize: 18, marginBottom: 0 }]}>
              {value === null ? '—' : Math.round(value)}
              {value === null ? null : <Text style={{ fontSize: 10, color: palette.textSecondary }}>%</Text>}
            </Text>
          </View>
        </View>

        <View style={styles.statsInfoWrap}>
          <Text style={[styles.performanceSubtitle, { color: palette.textTertiary, fontSize: 11 }]}>
            {subtitle}
          </Text>
          <View style={[styles.trendBadge, { backgroundColor: valueColor + '15' }]}>
            <Ionicons 
              name={value === null ? 'remove' : value >= 85 ? 'trending-up' : value >= 65 ? 'remove' : 'trending-down'} 
              size={12} 
              color={valueColor} 
            />
            <Text style={[styles.trendText, { color: valueColor }]}>
              {value === null ? 'No data yet' : value >= 85 ? 'Good' : value >= 65 ? 'Stable' : 'Low'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function MetricTile({
  label,
  value,
  icon,
  color,
  palette,
}: {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  palette: any;
}) {
  return (
    <View style={[styles.metricTile, { backgroundColor: palette.backgroundSecondary, borderColor: palette.border }]}>
      <View style={[styles.metricIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[styles.metricLabel, { color: palette.textSecondary }]} numberOfLines={1}>{label}</Text>
      <Text style={[styles.metricValue, { color: palette.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

function PulsingDot({ color }: { color: string }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    scale.value = withRepeat(withTiming(2, { duration: 2000 }), -1, false);
    opacity.value = withRepeat(withTiming(0, { duration: 2000 }), -1, false);
  }, [opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
    backgroundColor: color,
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
  }));

  return (
    <View style={{ width: 20, height: 20, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
      <Animated.View style={animatedStyle} />
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
    </View>
  );
}

function SensorRow({
  label,
  count,
  palette,
}: {
  label: string;
  count: number;
  palette: any;
}) {
  return (
    <View style={[styles.sensorRow, { borderBottomColor: palette.border }]}>
      <View style={styles.sensorLeft}>
        <PulsingDot color={palette.primary} />
        <Text style={[styles.sensorLabel, { color: palette.text }]}>{label}</Text>
      </View>
      <View style={styles.sensorRight}>
        <Text style={[styles.sensorCount, { color: palette.text }]}>{count}</Text>
      </View>
    </View>
  );
}

export default function DashboardScreen() {
  const { palette, isDark } = useTheme();
  const { t } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);
  const [configuration, setConfiguration] = useState<Configuration | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  const sensors = useSensorCounters();
  const { trg, trs, loading: mLoading } = usePerformanceMetrics();
  const { totalCost, totalCards, loading: lossesLoading } = useTodaysLosses();

  // Active batch info
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [activeBatchNum, setActiveBatchNum] = useState<string | null>(null);
  const [activeCardRef, setActiveCardRef] = useState<string | null>(null);
  const [activeTargetQty, setActiveTargetQty] = useState<number>(0);
  const [batchCards, setBatchCards] = useState<any[]>([]);

  // Function to load active batch and its electronic cards
  const fetchActiveBatchData = async () => {
    try {
      const storedId = await AsyncStorage.getItem('current_batch_id');
      const storedNum = await AsyncStorage.getItem('current_batch_number');
      const storedRef = await AsyncStorage.getItem('current_batch_card_reference');
      const storedQty = await AsyncStorage.getItem('current_batch_target_quantity');

      let batchId = storedId;
      let batchNum = storedNum;
      let cardRef = storedRef;
      let targetQty = storedQty ? parseInt(storedQty, 10) : 0;

      const supabase = getSupabaseClient();
      if (!batchId && supabase) {
        // Fallback: Query DB
        const { data, error } = await supabase
          .from('production_batches')
          .select('*')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          batchId = data.id;
          batchNum = data.batch_number;
          cardRef = data.card_reference;
          targetQty = data.target_quantity;
          
          await AsyncStorage.setItem('current_batch_id', data.id);
          await AsyncStorage.setItem('current_batch_number', data.batch_number);
          await AsyncStorage.setItem('current_batch_card_reference', data.card_reference || '');
          await AsyncStorage.setItem('current_batch_target_quantity', String(data.target_quantity || 0));
        }
      }

      setActiveBatchId(batchId);
      setActiveBatchNum(batchNum);
      setActiveCardRef(cardRef);
      setActiveTargetQty(targetQty);

      if (batchId && supabase) {
        const { data: cards, error } = await supabase
          .from('electronic_cards')
          .select('*')
          .eq('batch_id', batchId);
        
        if (!error && cards) {
          setBatchCards(cards);
        }
      } else {
        setBatchCards([]);
      }
    } catch (err) {
      console.error('Error loading active batch data:', err);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchActiveBatchData();
    }, [])
  );

  const fetchConfigurationData = useCallback(async () => {
    try {
      const configData = await fetchConfiguration();
      setConfiguration(configData as Configuration | null);
    } catch (error) {
      console.error('fetchConfigurationData failed:', error);
    } finally {
      setIsLoadingConfig(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigurationData();
    fetchActiveBatchData();
  }, [fetchConfigurationData]);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const channel = supabase
      .channel('dashboard-cards-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'electronic_cards' },
        (payload) => {
          const eventType = payload.eventType;
          const newRow = payload.new as any;
          const oldRow = payload.old as any;

          if (eventType === 'INSERT') {
            if (activeBatchId && newRow.batch_id === activeBatchId) {
              setBatchCards((curr) => {
                if (curr.some(c => c.id === newRow.id)) return curr;
                return [...curr, newRow];
              });
            }
          } else if (eventType === 'UPDATE') {
            if (activeBatchId && newRow.batch_id === activeBatchId) {
              setBatchCards((curr) =>
                curr.map(c => c.id === newRow.id ? newRow : c)
              );
            } else if (activeBatchId && oldRow?.batch_id === activeBatchId) {
              setBatchCards((curr) => curr.filter(c => c.id !== newRow.id));
            }
          } else if (eventType === 'DELETE') {
            const deletedId = oldRow?.id || payload.old?.id;
            if (deletedId) {
              setBatchCards((curr) => curr.filter(c => c.id !== deletedId));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeBatchId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchConfigurationData(), fetchActiveBatchData()]);
    setRefreshing(false);
  };

  const expectedCards = configuration?.nb_cartes_attendues ?? 10;
  const producedCards = sensors.capteur3.counter;
  const lostCards = Math.max(0, sensors.capteur1.counter - sensors.capteur3.counter);
  const productionProgress = expectedCards > 0 ? Math.min(100, Math.round((producedCards / expectedCards) * 100)) : null;
  const piOnline =
    sensors.capteur1.counter > 0 ||
    sensors.capteur2.counter > 0 ||
    sensors.capteur3.counter > 0 ||
    Boolean(sensors.capteur1.lastSeen || sensors.capteur2.lastSeen || sensors.capteur3.lastSeen);

  const sensorItems = useMemo(
    () => [
      {
        key: 'capteur1',
        label: t('sensor1Entry'),
        count: sensors.capteur1.counter,
        lastSeen: sensors.capteur1.lastSeen,
      },
      {
        key: 'capteur2',
        label: t('sensor2Middle'),
        count: sensors.capteur2.counter,
        lastSeen: sensors.capteur2.lastSeen,
      },
      {
        key: 'capteur3',
        label: t('sensor3Exit'),
        count: sensors.capteur3.counter,
        lastSeen: sensors.capteur3.lastSeen,
      },
    ],
    [sensors, t]
  );

  const groupedCounters = useMemo(() => {
    const counts: Record<string, number> = {};
    batchCards.forEach((card) => {
      const machine = card.current_machine || 'Unknown';
      counts[machine] = (counts[machine] || 0) + 1;
    });
    return counts;
  }, [batchCards]);

  const isInitialLoading = isLoadingConfig || mLoading || lossesLoading;

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
        <View style={[styles.topNavRow, { backgroundColor: palette.background, borderColor: palette.border }]}> 
          <TouchableOpacity style={[styles.topNavBackBtn, { borderColor: palette.border }]} onPress={() => router.push('/(tabs)')}>
            <Ionicons name="arrow-back" size={16} color={palette.text} />
          </TouchableOpacity>
          <Text style={[styles.topNavTitle, { color: palette.text }]}>Dashboard</Text>
          <View style={styles.topNavBackBtn} />
        </View>

        <View style={styles.headerWrap}>
          <BlurView intensity={isDark ? 30 : 60} tint={isDark ? "dark" : "light"} style={styles.headerBlur}>
            <LinearGradient
              colors={isDark ? ['rgba(30,41,59,0.8)', 'rgba(15,23,42,0.9)'] : ['rgba(255,255,255,0.8)', 'rgba(248,250,252,0.9)']}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.headerInner}>
              <View>
                <Text style={[styles.headerSubtitle, { color: palette.textSecondary }]}>{t('factoryPerformance') || 'Factory Overview'}</Text>
                <Text style={[styles.headerTitle, { color: palette.text }]}>{t('smartTrackCmsLine')}</Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => router.push('/system-status')}
                style={[styles.piBadge, { 
                  backgroundColor: (piOnline ? SUCCESS_COLOR : ERROR_COLOR) + '15',
                  borderColor: (piOnline ? SUCCESS_COLOR : ERROR_COLOR) + '40',
                  borderWidth: 1
                }]}
              >
                <PulsingDot color={piOnline ? SUCCESS_COLOR : ERROR_COLOR} />
                <Text style={[styles.piBadgeText, { color: piOnline ? SUCCESS_COLOR : ERROR_COLOR }]}>
                  {piOnline ? t('piOnline') : t('piOffline')}
                </Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>

        <View style={styles.performanceGrid}>
          <PerformanceCard
            title={t('trgLabel')}
            value={mLoading ? null : trg}
            subtitle={mLoading ? '-' : trg !== null ? `${trg.toFixed(1)}%` : 'No data yet'}
            palette={palette}
          />
          <PerformanceCard
            title={t('trsLabel')}
            value={mLoading ? null : trs}
            subtitle={mLoading ? '-' : trs !== null ? `${trs.toFixed(1)}%` : 'No data yet'}
            palette={palette}
          />
        </View>

        <View style={[styles.sectionCard, { backgroundColor: palette.background, borderColor: palette.border }]}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={[styles.sectionTitle, { color: palette.text, marginBottom: 2 }]}>Production Snapshot</Text>
              <Text style={[styles.sectionCaption, { color: palette.textSecondary }]}>
                {configuration?.machine_name || 'Machine not configured'}
              </Text>
            </View>
            <View style={[styles.progressBadge, { backgroundColor: (productionProgress === null ? '#94A3B8' : palette.primary) + '14' }]}>
              <Text style={[styles.progressBadgeText, { color: productionProgress === null ? '#94A3B8' : palette.primary }]}>
                {productionProgress === null ? '—' : `${productionProgress}%`}
              </Text>
            </View>
          </View>
          <View style={styles.metricsGrid}>
            <MetricTile label="Expected" value={expectedCards || '—'} icon="flag-outline" color={palette.primary} palette={palette} />
            <MetricTile label="Produced" value={producedCards} icon="checkmark-done-outline" color={SUCCESS_COLOR} palette={palette} />
            <MetricTile label="Lost" value={lostCards} icon="warning-outline" color={lostCards > 0 ? ERROR_COLOR : SUCCESS_COLOR} palette={palette} />
            <MetricTile label="Cycle" value={`${configuration?.cycle_time_seconds ?? '—'}s`} icon="timer-outline" color={WARNING_COLOR} palette={palette} />
          </View>
          <View style={styles.snapshotProgressWrap}>
            <View style={[styles.snapshotProgressTrack, { backgroundColor: palette.border }]}>
              <View
                style={[
                  styles.snapshotProgressFill,
                  {
                    backgroundColor: productionProgress === null ? '#94A3B8' : palette.primary,
                    width: `${productionProgress ?? 0}%`,
                  },
                ]}
              />
            </View>
          </View>
        </View>

        {/* Real-time active batch tracker counters */}
        {activeBatchId ? (
          <View style={[styles.sectionCard, { backgroundColor: palette.background, borderColor: palette.border }]}>
            <View style={styles.activeBatchHeader}>
              <View style={styles.batchInfoContainer}>
                <View style={styles.activeDotWrapper}>
                  <View style={[styles.activeDot, { backgroundColor: SUCCESS_COLOR }]} />
                  <Text style={[styles.activeBatchTitle, { color: palette.text }]}>Active Batch</Text>
                </View>
                <Text style={[styles.activeBatchRefText, { color: palette.textSecondary }]}>Ref: {activeCardRef}</Text>
              </View>
              <Text style={[styles.activeBatchNum, { color: palette.primary }]}>{activeBatchNum}</Text>
            </View>

            {/* Progress bar */}
            <View style={styles.progressBarWrapper}>
              <View style={styles.progressTextRow}>
                <Text style={[styles.progressText, { color: palette.text }]}>
                  Scanned: {batchCards.length} / {activeTargetQty}
                </Text>
                <Text style={[styles.progressPercentText, { color: palette.primary }]}>
                  {Math.round((batchCards.length / (activeTargetQty || 1)) * 100)}%
                </Text>
              </View>
              <View style={[styles.progressBarBg, { backgroundColor: palette.border }]}>
                <View 
                  style={[
                    styles.progressBarFill, 
                    { 
                      backgroundColor: palette.primary,
                      width: `${Math.min(100, Math.round((batchCards.length / (activeTargetQty || 1)) * 100))}%` 
                    }
                  ]} 
                />
              </View>
            </View>

            <View style={[styles.sensorDivider, { backgroundColor: palette.border, marginVertical: spacing.md }]} />

            <Text style={[styles.cardTitle, { color: palette.text, marginBottom: spacing.sm }]}>Location Counters</Text>

            {Object.keys(groupedCounters).length === 0 ? (
              <Text style={[styles.emptyBatchText, { color: palette.textTertiary }]}>No card scans recorded for this batch yet.</Text>
            ) : (
              <View style={styles.countersGrid}>
                {Object.entries(groupedCounters).map(([machine, count]) => (
                  <View key={machine} style={[styles.counterBox, { backgroundColor: palette.backgroundSecondary, borderColor: palette.border }]}>
                    <Text style={[styles.counterBoxLabel, { color: palette.textSecondary }]} numberOfLines={1}>
                      {machine}
                    </Text>
                    <Text style={[styles.counterBoxCount, { color: palette.primary }]}>
                      {count} / {activeTargetQty}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : null}

        <View style={[styles.sectionCard, { backgroundColor: palette.background, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>{t('realtimeSensors')}</Text>

          {sensorItems.every(item => item.count === 0) ? (
            <View style={styles.emptyBlock}>
              <Ionicons name="radio-outline" size={28} color={palette.textTertiary} />
              <Text style={[styles.emptyTitle, { color: palette.textSecondary }]}>{t('noRealtimeData')}</Text>
            </View>
          ) : (
            sensorItems.map((item, index) => (
              <View key={item.key}>
                <SensorRow
                  label={`${item.label} (${item.lastSeen || '-'})`}
                  count={item.count}
                  palette={palette}
                />
                {index === sensorItems.length - 1 ? null : <View style={[styles.sensorDivider, { backgroundColor: palette.border }]} />}
              </View>
            ))
          )}
        </View>

        <View style={[styles.sectionCard, { backgroundColor: palette.background, borderColor: palette.border, overflow: 'hidden' }]}>
          {totalCards > 0 ? (
             <LinearGradient
               colors={isDark ? ['#450a0a', '#171717'] : ['#fef2f2', '#ffffff']}
               style={StyleSheet.absoluteFill}
             />
          ) : (
             <LinearGradient
               colors={isDark ? ['#022c22', '#171717'] : ['#f0fdf4', '#ffffff']}
               style={StyleSheet.absoluteFill}
             />
          )}
          <Text style={[styles.sectionTitle, { color: palette.text }]}>{t('todayLosses')}</Text>

          {totalCards === 0 ? (
            <View style={styles.lossesOkState}>
              <View style={[styles.lossIconCircle, { backgroundColor: SUCCESS_COLOR + '20' }]}>
                <Ionicons name="shield-checkmark" size={28} color={SUCCESS_COLOR} />
              </View>
              <View style={styles.lossesTextWrap}>
                <Text style={[styles.lossesTitle, { color: palette.text }]}>{t('noLossesDetected')}</Text>
                <Text style={[styles.lossesSubtitle, { color: palette.textSecondary }]}>{t('lossesSubtitle')}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.lossesAlertState}>
              <View style={[styles.lossIconCircle, { backgroundColor: ERROR_COLOR + '20', borderWidth: 1, borderColor: ERROR_COLOR + '40' }]}>
                <Ionicons name="warning" size={28} color={ERROR_COLOR} />
              </View>
              <View style={styles.lossesTextWrap}>
                <Text style={[styles.lossesTitle, { color: palette.text }]}>
                  {t('lostCardsValue').replace('{{count}}', String(totalCards))}
                </Text>
                <Text style={[styles.lossesSubtitle, { color: ERROR_COLOR, fontWeight: '800', fontSize: 16 }]}>
                  {lossesLoading ? '...' : t('lossCostValue').replace('{{cost}}', totalCost.toFixed(3))}
                </Text>
              </View>
            </View>
          )}
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push('/(tabs)/statistiques')}
          style={styles.fullStatsButton}
        >
          <LinearGradient
            colors={[palette.primary, isDark ? '#1E40AF' : '#3B82F6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
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
    paddingBottom: spacing.xxxl,
  },
  topNavRow: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topNavBackBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topNavTitle: {
    ...typography.bodyBold,
    fontSize: 16,
  },
  headerWrap: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    ...shadows.sm,
    borderWidth: 1,
    borderColor: 'rgba(150, 150, 150, 0.2)',
  },
  headerBlur: {
    padding: spacing.lg,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerSubtitle: {
    ...typography.tiny,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  headerTitle: {
    ...typography.h3,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    overflow: 'hidden',
  },
  performanceLabel: {
    ...typography.smallBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  performanceValue: {
    ...typography.h2,
    fontWeight: '800',
    marginBottom: 8,
  },
  performanceSubtitle: {
    ...typography.tiny,
    fontWeight: '600',
  },
  performanceProgressBar: {
    height: 4,
    borderRadius: 2,
    marginVertical: 12,
    overflow: 'hidden',
  },
  performanceProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  performanceIconHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  performanceContent: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  circularContainer: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentageContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsInfoWrap: {
    alignItems: 'center',
    gap: 4,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  trendText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  performanceMiniIcon: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  sectionTitle: {
    ...typography.h4,
    marginBottom: spacing.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  sectionCaption: {
    ...typography.small,
    fontWeight: '600',
  },
  progressBadge: {
    minWidth: 54,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    alignItems: 'center',
  },
  progressBadgeText: {
    ...typography.smallBold,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metricTile: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 104,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  metricIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    ...typography.tiny,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  metricValue: {
    ...typography.h3,
    fontWeight: '900',
  },
  snapshotProgressWrap: {
    marginTop: spacing.md,
  },
  snapshotProgressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  snapshotProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  lossBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  lossBadgeText: {
    ...typography.smallBold,
  },
  flowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  flowStep: {
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  flowNode: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flowCount: {
    ...typography.h3,
    fontWeight: '900',
  },
  flowLabel: {
    ...typography.tiny,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  flowConnector: {
    width: 28,
    height: 2,
    borderRadius: 1,
    marginBottom: 24,
  },
  lossZoneGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  lossZone: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  lossZoneLabel: {
    ...typography.tiny,
    fontWeight: '800',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  lossZoneValue: {
    ...typography.h3,
    fontWeight: '900',
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
  lossIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
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
    overflow: 'hidden',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    marginTop: spacing.sm,
  },
  fullStatsText: {
    ...typography.bodyBold,
    color: '#FFFFFF',
  },
  activeBatchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  batchInfoContainer: {
    gap: 2,
  },
  activeDotWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeBatchTitle: {
    ...typography.bodyBold,
    fontSize: 16,
  },
  activeBatchRefText: {
    ...typography.tiny,
  },
  activeBatchNum: {
    ...typography.bodyBold,
    fontSize: 14,
  },
  progressBarWrapper: {
    gap: 6,
    marginBottom: spacing.xs,
  },
  progressTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressText: {
    ...typography.smallBold,
  },
  progressPercentText: {
    ...typography.smallBold,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  cardTitle: {
    ...typography.bodyBold,
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyBatchText: {
    ...typography.small,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  countersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  counterBox: {
    flex: 1,
    minWidth: '28%',
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  counterBoxCount: {
    ...typography.h3,
    fontWeight: '800',
  },
  counterBoxLabel: {
    ...typography.tiny,
    fontWeight: '700',
    textAlign: 'center',
  },
  noBatchWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  noBatchTitle: {
    ...typography.bodyBold,
    fontSize: 15,
  },
  noBatchText: {
    ...typography.tiny,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  noBatchBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    marginTop: spacing.xs,
    ...shadows.xs,
  },
  noBatchBtnText: {
    ...typography.captionBold,
    color: '#FFFFFF',
  },
});
