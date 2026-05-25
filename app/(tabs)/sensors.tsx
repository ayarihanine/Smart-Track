import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { borderRadius, shadows, spacing, typography } from '@/constants/design';
import { useTheme } from '@/components/ThemeProvider';
import { getSupabaseClient } from '@/lib/supabase';
import { fetchLatestSensorStates, SensorReading, sensorIdToPosition } from '@/lib/api';

// Helper — call this for each sensor card
function getSensorDisplay(state: 'HIGH' | 'LOW' | 'UNKNOWN') {
  switch (state) {
    case 'HIGH':
      // HIGH = card IS in front of sensor (NPN pulled pin LOW)
      return {
        label: 'HIGH',
        description: 'Card detected',
        color: '#22c55e',   // green
        dotColor: '#16a34a',
      };
    case 'LOW':
      return {
        label: 'LOW',
        description: 'No card',
        color: '#ef4444',   // red
        dotColor: '#dc2626',
      };
    case 'UNKNOWN':
    default:
      return {
        label: '---',
        description: 'Waiting for data',
        color: '#9ca3af',   // gray
        dotColor: '#6b7280',
      };
  }
}

function formatTime(timestampString: string | null): string {
  if (!timestampString) return '--:--:--';
  try {
    const date = new Date(timestampString);
    if (isNaN(date.getTime())) return '--:--:--';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  } catch {
    return '--:--:--';
  }
}

export default function SensorsTabScreen() {
  const { palette } = useTheme();
  
  // STEP 3A: State initialization
  const [sensorStates, setSensorStates] = useState<SensorReading[]>([
    { position: 1, sensorId: 'capteur1', state: 'UNKNOWN', counter: 0, recordedAt: null, gpioPin: 17 },
    { position: 2, sensorId: 'capteur2', state: 'UNKNOWN', counter: 0, recordedAt: null, gpioPin: 26 },
    { position: 3, sensorId: 'capteur3', state: 'UNKNOWN', counter: 0, recordedAt: null, gpioPin: 16 },
  ]);
  const [loading, setLoading] = useState(true);

  // STEP 3B: Initial data load
  useEffect(() => {
    let mounted = true;

    async function loadInitialStates() {
      try {
        const states = await fetchLatestSensorStates();
        if (mounted && states.length > 0) {
          setSensorStates(states);
        }
      } catch (e) {
        console.error('Failed to load sensor states:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadInitialStates();
    return () => { mounted = false; };
  }, []);

  // STEP 3C: Real-time subscription
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const channel = supabase
      .channel('sensor_events_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sensor_events',
          filter: 'sensor_id=neq.SYSTEM',
        },
        (payload) => {
          const row = payload.new as {
            sensor_id: string;
            state: string;
            counter: number;
            recorded_at: string;
          };
          const position = sensorIdToPosition(row.sensor_id);
          if (!position) return;

          setSensorStates((prev) => {
            const updated = [...prev];
            const idx = updated.findIndex((s) => s.position === position);
            const reading: SensorReading = {
              position,
              sensorId: row.sensor_id,
              state: row.state as 'HIGH' | 'LOW',
              counter: row.counter,
              recordedAt: row.recorded_at,
              gpioPin: 0,
            };
            if (idx >= 0) updated[idx] = reading;
            else updated.push(reading);
            return updated.sort((a, b) => a.position - b.position);
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Acquisition] Realtime subscription active');
        }
        if (status === 'CHANNEL_ERROR') {
          console.error('[Acquisition] Realtime subscription failed');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // STEP 3E: Counter-based loss indicator
  const c1 = sensorStates.find((s) => s.position === 1)?.counter ?? 0;
  const c2 = sensorStates.find((s) => s.position === 2)?.counter ?? 0;
  const c3 = sensorStates.find((s) => s.position === 3)?.counter ?? 0;

  const lossZone1 = Math.max(0, c1 - c2);  // cards lost between sensor 1 and 2
  const lossZone2 = Math.max(0, c2 - c3);  // cards lost between sensor 2 and 3
  const totalLoss = lossZone1 + lossZone2;

  const hasHighLoss = lossZone1 > 1 || lossZone2 > 1;

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: palette.backgroundSecondary }]} edges={['top']}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={palette.primary} />
          <Text style={[styles.loadingText, { color: palette.textSecondary }]}>Connecting to Pi5 interface...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.backgroundSecondary }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: palette.border, backgroundColor: palette.background }]}>
        <View>
          <Text style={[styles.headerTitle, { color: palette.text }]}>Pi5 Acquisition Interface</Text>
          <Text style={[styles.headerSubtitle, { color: palette.textSecondary }]}>Real-time Sensor Monitoring</Text>
        </View>
        <View style={[styles.livePulse, { backgroundColor: '#10B9811A' }]}>
          <View style={[styles.pulseDot, { backgroundColor: '#10B981' }]} />
          <Text style={[styles.pulseText, { color: '#10B981' }]}>LIVE</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Sensor Display Cards (CHANGE 3D) */}
        <View style={styles.sensorGrid}>
          {sensorStates.map((sensor) => {
            const display = getSensorDisplay(sensor.state || 'UNKNOWN');
            const iconName = sensor.position === 1
              ? 'enter-outline'
              : sensor.position === 2
                ? 'git-commit-outline'
                : 'exit-outline';

            return (
              <View
                key={`sensor-${sensor.position}`}
                style={[
                  styles.sensorCard, 
                  { 
                    backgroundColor: palette.background, 
                    borderColor: sensor.state === 'HIGH' ? '#22c55e' : palette.border 
                  }
                ]}
              >
                <View style={styles.sensorCardHeader}>
                  <View style={[styles.iconContainer, { backgroundColor: display.color + '20' }]}>
                    <Ionicons name={iconName} size={20} color={display.color} />
                  </View>
                  <View style={styles.sensorIdentity}>
                    <Text style={[styles.sensorLabelText, { color: palette.text }]}>
                      {sensor.position === 1
                        ? 'Sensor 1 (Entry)'
                        : sensor.position === 2
                          ? 'Sensor 2 (Middle)'
                          : 'Sensor 3 (Exit)'}
                    </Text>
                    <Text style={[styles.sensorIdSub, { color: palette.textTertiary }]}>
                      {sensor.sensorId}
                    </Text>
                  </View>
                  <View style={[styles.stateIndicatorBadge, { backgroundColor: display.color + '15' }]}>
                    <View style={[styles.indicatorDot, { backgroundColor: display.dotColor }]} />
                    <Text style={[styles.stateLabelText, { color: display.dotColor }]}>
                      {display.label}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardDivider} />

                <View style={styles.cardInfoRow}>
                  <View style={styles.infoCol}>
                    <Text style={[styles.infoLabel, { color: palette.textTertiary }]}>COUNTER</Text>
                    <Text style={[styles.infoValue, { color: palette.text }]}>{sensor.counter}</Text>
                  </View>
                  <View style={styles.infoCol}>
                    <Text style={[styles.infoLabel, { color: palette.textTertiary }]}>LAST DETECTED</Text>
                    <Text style={[styles.infoValue, { color: palette.text }]}>
                      {formatTime(sensor.recordedAt)}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {/* Counter-based Loss Indicator Section (CHANGE 3E) */}
        <View 
          style={[
            styles.lossCard, 
            { 
              backgroundColor: palette.background, 
              borderColor: hasHighLoss ? '#f97316' : palette.border 
            }
          ]}
        >
          <View style={styles.lossHeader}>
            <View style={[styles.lossIconContainer, { backgroundColor: hasHighLoss ? '#f973161A' : '#10B9811A' }]}>
              <Ionicons 
                name={hasHighLoss ? 'warning' : 'shield-checkmark'} 
                size={22} 
                color={hasHighLoss ? '#f97316' : '#10B981'} 
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.lossTitle, { color: palette.text }]}>CMS Production Loss Analysis</Text>
              <Text style={[styles.lossSubtitle, { color: palette.textSecondary }]}>
                Real-time tracking of discrepancies between stages
              </Text>
            </View>
          </View>

          <View style={styles.lossGrid}>
            <View style={[styles.lossBox, { backgroundColor: palette.backgroundSecondary }]}>
              <Text style={[styles.lossBoxLabel, { color: palette.textSecondary }]}>Zone 1 Loss (S1 → S2)</Text>
              <Text 
                style={[
                  styles.lossBoxValue, 
                  { color: lossZone1 > 1 ? '#f97316' : palette.text }
                ]}
              >
                {lossZone1}
              </Text>
            </View>

            <View style={[styles.lossBox, { backgroundColor: palette.backgroundSecondary }]}>
              <Text style={[styles.lossBoxLabel, { color: palette.textSecondary }]}>Zone 2 Loss (S2 → S3)</Text>
              <Text 
                style={[
                  styles.lossBoxValue, 
                  { color: lossZone2 > 1 ? '#f97316' : palette.text }
                ]}
              >
                {lossZone2}
              </Text>
            </View>
          </View>

          <View style={styles.cardDivider} />

          <View style={styles.lossTotalRow}>
            <Text style={[styles.lossTotalLabel, { color: palette.text }]}>Total Line Loss</Text>
            <View style={[styles.lossTotalBadge, { backgroundColor: hasHighLoss ? '#ef444415' : '#10B98115' }]}>
              <Text style={[styles.lossTotalValue, { color: hasHighLoss ? '#ef4444' : '#10B981' }]}>
                {totalLoss} cards
              </Text>
            </View>
          </View>
        </View>
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
    gap: spacing.md,
  },
  loadingText: {
    ...typography.small,
  },
  header: {
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    ...shadows.xs,
  },
  headerTitle: {
    ...typography.h4,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    ...typography.tiny,
    marginTop: 2,
  },
  livePulse: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pulseText: {
    ...typography.tiny,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sensorGrid: {
    gap: spacing.md,
  },
  sensorCard: {
    borderWidth: 1,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.xs,
  },
  sensorCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sensorIdentity: {
    flex: 1,
  },
  sensorLabelText: {
    ...typography.bodyBold,
    fontSize: 15,
  },
  sensorIdSub: {
    ...typography.tiny,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  stateIndicatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  indicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stateLabelText: {
    ...typography.smallBold,
    letterSpacing: 0.5,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    opacity: 0.5,
    marginVertical: spacing.md,
  },
  cardInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoCol: {
    flex: 1,
  },
  infoLabel: {
    ...typography.tiny,
    fontWeight: '700',
    marginBottom: 4,
  },
  infoValue: {
    ...typography.bodyBold,
    fontSize: 16,
  },
  lossCard: {
    borderWidth: 1,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  lossHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  lossIconContainer: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lossTitle: {
    ...typography.bodyBold,
    fontSize: 16,
  },
  lossSubtitle: {
    ...typography.tiny,
    marginTop: 2,
  },
  lossGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  lossBox: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  lossBoxLabel: {
    ...typography.tiny,
    fontWeight: '600',
    textAlign: 'center',
  },
  lossBoxValue: {
    ...typography.h3,
    fontWeight: '800',
  },
  lossTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  lossTotalLabel: {
    ...typography.bodyBold,
  },
  lossTotalBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  lossTotalValue: {
    ...typography.smallBold,
  },
});
