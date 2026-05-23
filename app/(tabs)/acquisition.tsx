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

import { borderRadius, shadows, spacing, typography } from '@/constants/design';
import { useTheme } from '@/components/ThemeProvider';
import { fetchConfiguration, fetchLatestSensorStates } from '@/lib/api';
import { getSupabaseClient } from '@/lib/supabase';
import { Configuration, SensorState } from '@/types';

const SUCCESS_COLOR = '#10B981';
const WARNING_COLOR = '#F59E0B';
const ERROR_COLOR = '#EF4444';
const INFO_COLOR = '#0EA5E9';
const MIDDLE_COLOR = '#8B5CF6';
const MUTED_COLOR = '#64748B';

type SensorId = 'capteur1' | 'capteur2' | 'capteur3';
type SubscriptionStatus = 'connecting' | 'live' | 'error';

const SENSOR_META: {
  id: SensorId;
  title: string;
  stage: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}[] = [
  { id: 'capteur1', title: 'Sensor 1', stage: 'Entry', icon: 'enter-outline', color: INFO_COLOR },
  { id: 'capteur2', title: 'Sensor 2', stage: 'Middle', icon: 'git-commit-outline', color: MIDDLE_COLOR },
  { id: 'capteur3', title: 'Sensor 3', stage: 'Exit', icon: 'exit-outline', color: SUCCESS_COLOR },
];

function formatTime(value?: string | null) {
  if (!value) return '--:--:--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--:--:--';
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function getLatestTimestamp(states: SensorState[]) {
  return states
    .map((state) => state.recorded_at)
    .filter(Boolean)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
}

function getLossSummary(c1: number, c2: number, c3: number) {
  const zone1 = Math.max(0, c1 - c2);
  const zone2 = Math.max(0, c2 - c3);
  return { zone1, zone2, total: zone1 + zone2 };
}

function getStateColor(state?: SensorState['state']) {
  if (state === 'HIGH') return SUCCESS_COLOR;
  if (state === 'LOW') return MUTED_COLOR;
  return ERROR_COLOR;
}

function getConnectionLabel(status: SubscriptionStatus, hasRecentData: boolean) {
  if (status === 'error') return 'Realtime error';
  if (status === 'connecting') return 'Connecting';
  return hasRecentData ? 'Live' : 'Connected';
}

function HeaderPanel({
  configuration,
  status,
  hasRecentData,
  lastUpdate,
  palette,
}: {
  configuration: Configuration | null;
  status: SubscriptionStatus;
  hasRecentData: boolean;
  lastUpdate: string | null;
  palette: any;
}) {
  const statusColor = status === 'error' ? ERROR_COLOR : status === 'connecting' ? WARNING_COLOR : SUCCESS_COLOR;

  return (
    <View style={[styles.headerPanel, { backgroundColor: palette.background, borderColor: palette.border }]}>
      <View style={styles.headerTopRow}>
        <View style={styles.headerTitleWrap}>
          <Text style={[styles.kicker, { color: palette.textSecondary }]}>Acquisition</Text>
          <Text style={[styles.headerTitle, { color: palette.text }]} numberOfLines={1} adjustsFontSizeToFit>
            {configuration?.machine_name || 'Pi5 Interface'}
          </Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: statusColor + '16' }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusPillText, { color: statusColor }]}>
            {getConnectionLabel(status, hasRecentData)}
          </Text>
        </View>
      </View>

      <View style={styles.headerMetaRow}>
        <View style={styles.headerMetaItem}>
          <Text style={[styles.metaLabel, { color: palette.textTertiary }]}>Last event</Text>
          <Text style={[styles.metaValue, { color: palette.text }]}>{formatTime(lastUpdate)}</Text>
        </View>
        <View style={styles.headerMetaItem}>
          <Text style={[styles.metaLabel, { color: palette.textTertiary }]}>Cycle</Text>
          <Text style={[styles.metaValue, { color: palette.text }]}>
            {configuration?.cycle_time_seconds ?? '--'}s
          </Text>
        </View>
        <View style={styles.headerMetaItem}>
          <Text style={[styles.metaLabel, { color: palette.textTertiary }]}>Threshold</Text>
          <Text style={[styles.metaValue, { color: palette.text }]}>
            {configuration?.loss_threshold ?? '--'}
          </Text>
        </View>
      </View>
    </View>
  );
}

function SummaryTile({
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
    <View style={[styles.summaryTile, { backgroundColor: palette.background, borderColor: palette.border }]}>
      <View style={[styles.summaryIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[styles.summaryLabel, { color: palette.textSecondary }]} numberOfLines={1}>{label}</Text>
      <Text style={[styles.summaryValue, { color: palette.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

function SensorCard({
  meta,
  sensor,
  palette,
}: {
  meta: (typeof SENSOR_META)[number];
  sensor?: SensorState;
  palette: any;
}) {
  const stateColor = getStateColor(sensor?.state);
  const isHigh = sensor?.state === 'HIGH';

  return (
    <View style={[styles.sensorCard, { backgroundColor: palette.background, borderColor: isHigh ? stateColor : palette.border }]}>
      <View style={styles.sensorHeader}>
        <View style={[styles.sensorIcon, { backgroundColor: meta.color + '16' }]}>
          <Ionicons name={meta.icon} size={20} color={meta.color} />
        </View>
        <View style={styles.sensorTitleWrap}>
          <Text style={[styles.sensorTitle, { color: palette.text }]}>{meta.title}</Text>
          <Text style={[styles.sensorStage, { color: palette.textSecondary }]}>{meta.stage}</Text>
        </View>
        <View style={[styles.sensorStatePill, { backgroundColor: stateColor + '16' }]}>
          <View style={[styles.stateDot, { backgroundColor: stateColor }]} />
          <Text style={[styles.sensorStateText, { color: stateColor }]}>
            {sensor?.state ?? '---'}
          </Text>
        </View>
      </View>

      <View style={styles.sensorBody}>
        <View>
          <Text style={[styles.sensorMetricLabel, { color: palette.textTertiary }]}>Counter</Text>
          <Text style={[styles.sensorCounter, { color: palette.text }]}>{sensor?.counter ?? 0}</Text>
        </View>
        <View style={styles.sensorTimeWrap}>
          <Text style={[styles.sensorMetricLabel, { color: palette.textTertiary }]}>Last</Text>
          <Text style={[styles.sensorTime, { color: palette.text }]}>{formatTime(sensor?.recorded_at)}</Text>
        </View>
      </View>
    </View>
  );
}

function FlowPanel({
  counters,
  losses,
  palette,
}: {
  counters: { c1: number; c2: number; c3: number };
  losses: { zone1: number; zone2: number; total: number };
  palette: any;
}) {
  const hasLoss = losses.total > 0;

  return (
    <View style={[styles.panel, { backgroundColor: palette.background, borderColor: hasLoss ? WARNING_COLOR + '80' : palette.border }]}> 
      <View style={styles.panelHeader}>
        <Text style={[styles.panelTitle, { color: palette.text }]}>Line Flow</Text>
        <View style={[styles.lossPill, { backgroundColor: hasLoss ? WARNING_COLOR + '16' : SUCCESS_COLOR + '16' }]}> 
          <Ionicons
            name={hasLoss ? 'alert-circle-outline' : 'shield-checkmark-outline'}
            size={14}
            color={hasLoss ? WARNING_COLOR : SUCCESS_COLOR}
          />
          <Text style={[styles.lossPillText, { color: hasLoss ? WARNING_COLOR : SUCCESS_COLOR }]}> 
            {hasLoss ? `${losses.total} lost` : 'Clear'}
          </Text>
        </View>
      </View>

      <View style={styles.flowRow}>
        <FlowNode label="Entry" value={counters.c1} color={INFO_COLOR} palette={palette} />
        <View style={[styles.flowConnector, { backgroundColor: palette.border }]} />
        <FlowNode label="Middle" value={counters.c2} color={MIDDLE_COLOR} palette={palette} />
        <View style={[styles.flowConnector, { backgroundColor: palette.border }]} />
        <FlowNode label="Exit" value={counters.c3} color={SUCCESS_COLOR} palette={palette} />
      </View>

      <View style={styles.zoneGrid}>
        <ZoneCard label="Zone 1" value={losses.zone1} palette={palette} />
        <ZoneCard label="Zone 2" value={losses.zone2} palette={palette} />
      </View>
    </View>
  );
}

function FlowNode({
  label,
  value,
  color,
  palette,
}: {
  label: string;
  value: number;
  color: string;
  palette: any;
}) {
  return (
    <View style={styles.flowNode}>
      <View style={[styles.flowCircle, { borderColor: color, backgroundColor: color + '12' }]}> 
        <Text style={[styles.flowValue, { color }]}>{value}</Text>
      </View>
      <Text style={[styles.flowLabel, { color: palette.textSecondary }]}>{label}</Text>
    </View>
  );
}

function ZoneCard({ label, value, palette }: { label: string; value: number; palette: any }) {
  const color = value > 0 ? WARNING_COLOR : palette.text;
  return (
    <View style={[styles.zoneCard, { backgroundColor: palette.backgroundSecondary, borderColor: value > 0 ? WARNING_COLOR : palette.border }]}> 
      <Text style={[styles.zoneLabel, { color: palette.textSecondary }]}>{label}</Text>
      <Text style={[styles.zoneValue, { color }]}>{value}</Text>
    </View>
  );
}


export default function AcquisitionScreen() {
  const { palette } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>('connecting');
  const [sensorStates, setSensorStates] = useState<SensorState[]>([]);
  const [configuration, setConfiguration] = useState<Configuration | null>(null);

  const loadData = async () => {
    const [states, config] = await Promise.all([
      fetchLatestSensorStates(),
      fetchConfiguration(),
    ]);
    setSensorStates(states as SensorState[]);
    setConfiguration(config as Configuration | null);
  };

  useEffect(() => {
    let mounted = true;

    loadData()
      .catch((error) => console.error('Failed to load acquisition data:', error))
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setSubscriptionStatus('error');
      return;
    }

    const channel = supabase
      .channel('sensor_acquisition')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sensor_events',
          filter: 'sensor_id=neq.SYSTEM',
        },
        (payload) => {
          const row = payload.new as Partial<SensorState>;
          if (!['capteur1', 'capteur2', 'capteur3'].includes(String(row.sensor_id))) return;

          setSensorStates((current) => {
            const nextRow: SensorState = {
              sensor_id: row.sensor_id as SensorId,
              gpio_pin: row.gpio_pin,
              state: row.state as 'HIGH' | 'LOW',
              counter: Number(row.counter ?? 0),
              recorded_at: String(row.recorded_at ?? new Date().toISOString()),
            };
            const index = current.findIndex((item) => item.sensor_id === nextRow.sensor_id);
            if (index < 0) return [...current, nextRow];

            const next = [...current];
            next[index] = nextRow;
            return next;
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setSubscriptionStatus('live');
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setSubscriptionStatus('error');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData().catch((error) => console.error('Failed to refresh acquisition data:', error));
    setRefreshing(false);
  };

  const orderedSensors = useMemo(
    () => SENSOR_META.map((meta) => ({
      meta,
      sensor: sensorStates.find((state) => state.sensor_id === meta.id),
    })),
    [sensorStates]
  );

  const c1 = orderedSensors.find((item) => item.meta.id === 'capteur1')?.sensor?.counter ?? 0;
  const c2 = orderedSensors.find((item) => item.meta.id === 'capteur2')?.sensor?.counter ?? 0;
  const c3 = orderedSensors.find((item) => item.meta.id === 'capteur3')?.sensor?.counter ?? 0;
  const losses = getLossSummary(c1, c2, c3);
  const latestTimestamp = getLatestTimestamp(sensorStates);
  const hasRecentData = latestTimestamp ? Date.now() - new Date(latestTimestamp).getTime() < 2 * 60 * 1000 : false;
  const activeSensors = orderedSensors.filter((item) => item.sensor).length;
  const highSensors = orderedSensors.filter((item) => item.sensor?.state === 'HIGH').length;

  if (loading) {
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
        <View style={[styles.pageHeader, { backgroundColor: palette.background, borderColor: palette.border }]}> 
          <TouchableOpacity style={styles.pageHeaderBackBtn} onPress={() => router.push('/(tabs)')}>
            <Ionicons name="chevron-back" size={20} color={palette.text} />
          </TouchableOpacity>
          <Text style={[styles.pageHeaderTitle, { color: palette.text }]}>Acquisition Interface</Text>
          <View style={styles.pageHeaderBackBtn} />
        </View>

        <HeaderPanel
          configuration={configuration}
          status={subscriptionStatus}
          hasRecentData={hasRecentData}
          lastUpdate={latestTimestamp}
          palette={palette}
        />

        <View style={styles.summaryGrid}>
          <SummaryTile label="Sensors" value={`${activeSensors}/3`} icon="hardware-chip-outline" color={palette.primary} palette={palette} />
          <SummaryTile label="Detecting" value={highSensors} icon="scan-outline" color={SUCCESS_COLOR} palette={palette} />
          <SummaryTile label="Produced" value={c3} icon="checkmark-done-outline" color={INFO_COLOR} palette={palette} />
          <SummaryTile label="Losses" value={losses.total} icon="warning-outline" color={losses.total > 0 ? WARNING_COLOR : SUCCESS_COLOR} palette={palette} />
        </View>

        <View style={styles.sensorGrid}>
          {orderedSensors.map(({ meta, sensor }) => (
            <SensorCard key={meta.id} meta={meta} sensor={sensor} palette={palette} />
          ))}
        </View>

        <FlowPanel counters={{ c1, c2, c3 }} losses={losses} palette={palette} />

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
  pageHeader: {
    borderWidth: 1,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadows.xs,
  },
  pageHeaderBackBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageHeaderTitle: {
    ...typography.bodyBold,
    fontSize: 16,
  },
  headerPanel: {
    borderWidth: 1,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  headerTitleWrap: {
    flex: 1,
  },
  kicker: {
    ...typography.tiny,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  headerTitle: {
    ...typography.h3,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    borderRadius: borderRadius.full,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusPillText: {
    ...typography.smallBold,
  },
  headerMetaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  headerMetaItem: {
    flex: 1,
  },
  metaLabel: {
    ...typography.tiny,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  metaValue: {
    ...typography.bodyBold,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  summaryTile: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 104,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    justifyContent: 'space-between',
    ...shadows.xs,
  },
  summaryIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryLabel: {
    ...typography.tiny,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  summaryValue: {
    ...typography.h3,
    fontWeight: '900',
  },
  sensorGrid: {
    gap: spacing.md,
  },
  sensorCard: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.xs,
  },
  sensorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  sensorIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sensorTitleWrap: {
    flex: 1,
  },
  sensorTitle: {
    ...typography.bodyBold,
    fontSize: 16,
  },
  sensorStage: {
    ...typography.small,
    marginTop: 2,
  },
  sensorStatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  stateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sensorStateText: {
    ...typography.smallBold,
  },
  sensorBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  sensorMetricLabel: {
    ...typography.tiny,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  sensorCounter: {
    ...typography.h2,
    fontWeight: '900',
  },
  sensorTimeWrap: {
    alignItems: 'flex-end',
  },
  sensorTime: {
    ...typography.bodyBold,
  },
  panel: {
    borderWidth: 1,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  panelTitle: {
    ...typography.h4,
  },
  lossPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  lossPillText: {
    ...typography.smallBold,
  },
  flowRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flowNode: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  flowCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flowValue: {
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
  zoneGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  zoneCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  zoneLabel: {
    ...typography.tiny,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  zoneValue: {
    ...typography.h3,
    fontWeight: '900',
  },
});
