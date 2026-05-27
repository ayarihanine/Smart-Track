import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';

import { borderRadius, spacing, typography } from '@/constants/design';
import { useTheme } from '@/components/ThemeProvider';
import { fetchConfiguration } from '@/lib/api';
import { useSensorCounters } from '@/hooks/useSensorCounters';

const DEFAULT_CONFIG = {
  machine_name: 'NPM-DX-1',
  shift_start: '08:00:00',
  shift_end: '16:00:00',
};

function gaugeColor(percent: number): string {
  if (percent >= 80) return '#10B981';
  if (percent >= 50) return '#F59E0B';
  return '#EF4444';
}

function formatShiftTime(value: string): string {
  if (!value) return '—';
  return value.slice(0, 5);
}

function SensorCard({
  label,
  slot,
  counter,
  palette,
}: {
  label: string;
  slot: { state: string; lastSeen: string };
  counter: number;
  palette: any;
}) {
  const state = slot.state === 'HIGH' ? 'HIGH' : slot.state === 'LOW' ? 'LOW' : 'UNKNOWN';
  const stateColor =
    state === 'HIGH' ? '#10B981' : state === 'LOW' ? '#EF4444' : '#9CA3AF';
  const stateLabel = state === 'UNKNOWN' ? '---' : state;

  return (
    <View style={[styles.sensorCard, { backgroundColor: palette.background, borderColor: palette.border }]}>
      <Text style={[styles.sensorLabel, { color: palette.textSecondary }]}>{label}</Text>
      <View style={styles.stateRow}>
        <View style={[styles.stateDot, { backgroundColor: stateColor }]} />
        <Text style={[styles.stateText, { color: palette.text }]}>{stateLabel}</Text>
      </View>
      <Text style={[styles.counterText, { color: palette.text }]}>Count: {counter}</Text>
      <Text style={[styles.updatedText, { color: palette.textTertiary }]}>
        {slot.lastSeen}
      </Text>
    </View>
  );
}

function KpiTile({
  label,
  value,
  palette,
  valueColor,
}: {
  label: string;
  value: string | number;
  palette: any;
  valueColor?: string;
}) {
  return (
    <View style={[styles.kpiTile, { backgroundColor: palette.background, borderColor: palette.border }]}>
      <Text style={[styles.kpiLabel, { color: palette.textSecondary }]}>{label}</Text>
      <Text style={[styles.kpiValue, { color: valueColor ?? palette.text }]}>{value}</Text>
    </View>
  );
}

function GaugeRing({
  label,
  percent,
  showDash,
  palette,
}: {
  label: string;
  percent: number;
  showDash: boolean;
  palette: any;
}) {
  const size = 88;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const rounded = Math.min(100, Math.round(percent));
  const color = showDash ? palette.textTertiary : gaugeColor(rounded);
  const offset = circumference * (1 - rounded / 100);

  return (
    <View style={[styles.gaugeCard, { backgroundColor: palette.background, borderColor: palette.border }]}>
      <Text style={[styles.gaugeLabel, { color: palette.textSecondary }]}>{label}</Text>
      <View style={styles.gaugeSvgWrap}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={palette.border}
            strokeWidth={stroke}
            fill="none"
          />
          {!showDash && (
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={color}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={offset}
              strokeLinecap="round"
              rotation="-90"
              origin={`${size / 2}, ${size / 2}`}
            />
          )}
        </Svg>
        <Text style={[styles.gaugeValue, { color: showDash ? palette.textTertiary : color }]}>
          {showDash ? '—' : `${rounded}%`}
        </Text>
      </View>
    </View>
  );
}

export default function ProductionDashboard() {
  const { palette } = useTheme();
  const {
    sensors,
    logical,
    produced,
    expected,
    goodCards,
    totalLosses,
    zone1Loss,
    zone2Loss,
    trg,
    trs,
  } = useSensorCounters();

  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [configLoading, setConfigLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      const row = await fetchConfiguration();
      if (row) {
        setConfig({
          machine_name: String(row.machine_name ?? DEFAULT_CONFIG.machine_name),
          shift_start: String(row.shift_start ?? DEFAULT_CONFIG.shift_start),
          shift_end: String(row.shift_end ?? DEFAULT_CONFIG.shift_end),
        });
      }
    } finally {
      setConfigLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const lossColor = useMemo(
    () => (totalLosses > 0 ? '#F59E0B' : '#10B981'),
    [totalLosses]
  );

  const showTrDash = produced === 0;
  const trgPercent = Math.min(100, trg);
  const trsPercent = Math.min(100, trs);

  const sensorSlots = [
    { label: 'Capteur 1', slot: sensors.sensor1, counter: logical.entry },
    { label: 'Capteur 2', slot: sensors.sensor2, counter: logical.middle },
    { label: 'Capteur 3', slot: sensors.sensor3, counter: logical.exit },
  ] as const;

  if (configLoading) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: palette.backgroundSecondary }]}>
        <ActivityIndicator size="large" color={palette.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.backgroundSecondary }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadConfig();
            }}
            tintColor={palette.primary}
          />
        }
      >
        <View style={[styles.headerCard, { backgroundColor: palette.background, borderColor: palette.border }]}>
          <View style={styles.headerRow}>
            <Ionicons name="construct-outline" size={22} color={palette.primary} />
            <Text style={[styles.machineName, { color: palette.text }]}>{config.machine_name}</Text>
          </View>
          <Text style={[styles.shiftText, { color: palette.textSecondary }]}>
            Shift: {formatShiftTime(config.shift_start)} → {formatShiftTime(config.shift_end)}
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: palette.text }]}>Live sensors</Text>
        <View style={styles.sensorRow}>
          {sensorSlots.map((item) => (
            <SensorCard
              key={item.label}
              label={item.label}
              slot={item.slot}
              counter={item.counter}
              palette={palette}
            />
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: palette.text }]}>Production KPIs</Text>
        <View style={styles.kpiGrid}>
          <KpiTile label="Cards Produced" value={produced} palette={palette} />
          <KpiTile label="Cards Expected" value={expected} palette={palette} />
          <KpiTile label="Cards Good" value={goodCards} palette={palette} />
          <KpiTile label="Total Losses" value={totalLosses} palette={palette} valueColor={lossColor} />
        </View>

        <View style={styles.gaugeRow}>
          <GaugeRing label="TRG" percent={trgPercent} showDash={showTrDash} palette={palette} />
          <GaugeRing label="TRS" percent={trsPercent} showDash={showTrDash} palette={palette} />
        </View>

        <View style={[styles.lossCard, { backgroundColor: palette.background, borderColor: palette.border }]}>
          <Text style={[styles.sectionTitle, { color: palette.text, marginBottom: spacing.sm }]}>
            Loss breakdown
          </Text>
          {zone1Loss === 0 && zone2Loss === 0 ? (
            <Text style={[styles.noLossText, { color: '#10B981' }]}>No losses detected</Text>
          ) : (
            <>
              {zone1Loss > 0 && (
                <Text style={[styles.lossLine, { color: '#F59E0B' }]}>
                  Zone 1→2 losses: {zone1Loss} cards
                </Text>
              )}
              {zone2Loss > 0 && (
                <Text style={[styles.lossLine, { color: '#F59E0B' }]}>
                  Zone 2→3 losses: {zone2Loss} cards
                </Text>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  headerCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  machineName: { ...typography.h3, fontWeight: '700' },
  shiftText: { ...typography.small, marginTop: spacing.xs },
  sectionTitle: { ...typography.bodyBold, marginBottom: spacing.sm, marginTop: spacing.sm },
  sensorRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  sensorCard: {
    flex: 1,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.sm,
    gap: 4,
  },
  sensorLabel: { ...typography.tiny, fontWeight: '600' },
  stateRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stateDot: { width: 8, height: 8, borderRadius: 4 },
  stateText: { ...typography.smallBold },
  counterText: { ...typography.smallBold, marginTop: 4 },
  updatedText: { ...typography.tiny },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiTile: {
    width: '48%',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  kpiLabel: { ...typography.tiny },
  kpiValue: { ...typography.h3, fontWeight: '700', marginTop: 4 },
  gaugeRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  gaugeCard: {
    flex: 1,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
    alignItems: 'center',
  },
  gaugeLabel: { ...typography.smallBold, marginBottom: spacing.sm },
  gaugeSvgWrap: { alignItems: 'center', justifyContent: 'center' },
  gaugeValue: {
    position: 'absolute',
    ...typography.bodyBold,
    fontSize: 16,
  },
  lossCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  lossLine: { ...typography.body, marginTop: spacing.xs },
  noLossText: { ...typography.bodyBold },
});
