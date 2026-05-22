import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { getConfiguration, getLatestEtatCapteur, getLatestSensorEvents } from '@/lib/api';
import { useAlertsStore } from '@/store/alertsStore';
import { SensorEvent } from '@/types/production';

interface SensorState {
  gpio: number;
  active: boolean;
  lastUpdated: string | null;
  lastDetectedAt?: string | null;
  sensorId?: string;
  stateLabel?: string;
  scenario?: string;
  rawValue?: number;
  source?: 'configuration' | 'etat_capteur' | 'sensor_events';
}

type SensorNumber = 1 | 2 | 3;
type GpioPins = { gpio1: number; gpio2: number; gpio3: number };
type EventLogType = 'info' | 'success' | 'warn';

function formatEventTime(value?: string | null) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toLocaleString();
  return date.toLocaleString();
}

function normalizeSensorTimestamp(value?: string | null) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

function isNewerReading(current: SensorState, nextTimestamp: string) {
  if (!current.lastDetectedAt) return true;
  return new Date(nextTimestamp).getTime() >= new Date(current.lastDetectedAt).getTime();
}

function formatSensorStatus(active: boolean) {
  return active ? 'Active' : 'Low';
}

function getSensorGpio(sensorNum: SensorNumber, pins: GpioPins) {
  if (sensorNum === 1) return pins.gpio1;
  if (sensorNum === 2) return pins.gpio2;
  return pins.gpio3;
}

function getEventActiveState(row: Partial<SensorEvent> | any) {
  const state = String(row.state || '').trim().toLowerCase();
  if (['1', 'active', 'high', 'on', 'true', 'triggered'].includes(state)) return true;
  if (['0', 'inactive', 'low', 'off', 'false', 'idle'].includes(state)) return false;

  const rawValue = Number(row.raw_value ?? row.rawValue);
  return Number.isFinite(rawValue) ? rawValue === 1 : false;
}

function getSensorNumberFromEvent(row: Partial<SensorEvent> | any, pins: GpioPins): SensorNumber | null {
  const sensorId = String(row.sensor_id || '').toLowerCase();
  const directMatch = sensorId.match(/(?:sensor|capteur)[^0-9]*([123])/) || sensorId.match(/^([123])$/);
  if (directMatch?.[1]) return Number(directMatch[1]) as SensorNumber;

  const gpioPin = Number(row.gpio_pin ?? 0);
  if (gpioPin === pins.gpio1) return 1;
  if (gpioPin === pins.gpio2) return 2;
  if (gpioPin === pins.gpio3) return 3;

  return null;
}

function getSensorSetter(
  sensorNum: SensorNumber,
  setters: {
    setSensor1: React.Dispatch<React.SetStateAction<SensorState>>;
    setSensor2: React.Dispatch<React.SetStateAction<SensorState>>;
    setSensor3: React.Dispatch<React.SetStateAction<SensorState>>;
  }
) {
  if (sensorNum === 1) return setters.setSensor1;
  if (sensorNum === 2) return setters.setSensor2;
  return setters.setSensor3;
}

function applySensorReading(
  sensorNum: SensorNumber,
  setters: {
    setSensor1: React.Dispatch<React.SetStateAction<SensorState>>;
    setSensor2: React.Dispatch<React.SetStateAction<SensorState>>;
    setSensor3: React.Dispatch<React.SetStateAction<SensorState>>;
  },
  next: Partial<SensorState> & { lastDetectedAt: string }
) {
  const setter = getSensorSetter(sensorNum, setters);
  setter((prev) => {
    if (!isNewerReading(prev, next.lastDetectedAt)) return prev;
    return {
      ...prev,
      ...next,
      lastUpdated: formatEventTime(next.lastDetectedAt),
    };
  });
}

function SensorMeta({ sensor, palette }: { sensor: SensorState; palette: any }) {
  const details = [
    sensor.sensorId ? `ID ${sensor.sensorId}` : null,
    sensor.stateLabel ? `State ${sensor.stateLabel}` : null,
    sensor.scenario ? `Scenario ${sensor.scenario}` : null,
    sensor.rawValue !== undefined ? `Raw ${sensor.rawValue}` : null,
    sensor.source ? `Source ${sensor.source}` : null,
  ].filter((detail): detail is string => Boolean(detail));

  if (details.length === 0) return null;

  return (
    <View style={styles.sensorMeta}>
      {details.map((detail) => (
        <View key={detail} style={[styles.sensorMetaChip, { backgroundColor: palette.backgroundSecondary }]}>
          <Text style={[styles.sensorMetaText, { color: palette.textSecondary }]}>{detail}</Text>
        </View>
      ))}
    </View>
  );
}

export default function SensorsTabScreen() {
  const { palette } = useTheme();
  const { addAlert } = useAlertsStore();

  const [loading, setLoading] = useState(true);
  const [piOnline, setPiOnline] = useState(false);

  // Configuration GPIO values
  const [gpioPins, setGpioPins] = useState({ gpio1: 0, gpio2: 0, gpio3: 0 });
  const [cycleTime, setCycleTime] = useState(5); // default cycle time in seconds
  const gpioPinsRef = useRef<GpioPins>({ gpio1: 0, gpio2: 0, gpio3: 0 });

  // Real-time sensor states
  const [sensor1, setSensor1] = useState<SensorState>({ gpio: 0, active: false, lastUpdated: null });
  const [sensor2, setSensor2] = useState<SensorState>({ gpio: 0, active: false, lastUpdated: null });
  const [sensor3, setSensor3] = useState<SensorState>({ gpio: 0, active: false, lastUpdated: null });

  // Event stream log
  const [events, setEvents] = useState<{ id: string; msg: string; time: string; type: EventLogType }[]>([]);

  // Timers to detect stuck card signal
  const sensorTimers = useRef<{ [key: number]: any }>({ 1: null, 2: null, 3: null });
  const latestDetectedAt = useRef<Record<SensorNumber, string | null>>({ 1: null, 2: null, 3: null });

  // track Pi heartbeat
  const lastHeartbeatTime = useRef<number>(0);

  const logEvent = useCallback((msg: string, type: EventLogType = 'info') => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setEvents((prev) => [{ id: Math.random().toString(), msg, time, type }, ...prev.slice(0, 19)]);
  }, []);

  const acceptSensorReading = useCallback((sensorNum: SensorNumber, detectedAt: string) => {
    const current = latestDetectedAt.current[sensorNum];
    if (current && new Date(detectedAt).getTime() < new Date(current).getTime()) {
      return false;
    }

    latestDetectedAt.current[sensorNum] = detectedAt;
    return true;
  }, []);

  const handleStuckWatchdog = useCallback((sensorNum: SensorNumber, isActive: boolean, gpioPin: number) => {
    if (!isActive) {
      if (sensorTimers.current[sensorNum]) {
        clearTimeout(sensorTimers.current[sensorNum]!);
        sensorTimers.current[sensorNum] = null;
      }
      return;
    }

    if (sensorTimers.current[sensorNum]) return;

    sensorTimers.current[sensorNum] = setTimeout(() => {
      addAlert({
        id: `stuck-sensor-${sensorNum}`,
        type: 'blocking_anomaly',
        severity: 'critical',
        message: `Stuck Card Alert: Card detected on Sensor ${sensorNum} (GPIO ${gpioPin}) for too long (${cycleTime}s cycle exceeded).`,
      });

      logEvent(`ALERT: Sensor ${sensorNum} stuck for over ${cycleTime} seconds!`, 'warn');
      Alert.alert(
        'Stuck Card Alert',
        `Sensor ${sensorNum} (GPIO ${gpioPin}) has been stuck active for longer than the cycle time of ${cycleTime} seconds!`,
        [{ text: 'Acknowledge' }]
      );
    }, cycleTime * 1000);
  }, [addAlert, cycleTime, logEvent]);

  const updateSensorFromEtat = useCallback((row: any, pins: GpioPins = gpioPinsRef.current) => {
    setPiOnline(true);
    lastHeartbeatTime.current = Date.now();

    const timestampValue = row.date_temps || row.timestamp || row.created_at || new Date().toISOString();
    const detectedAt = normalizeSensorTimestamp(timestampValue);
    const setters = { setSensor1, setSensor2, setSensor3 };

    if (row.capteur1 !== undefined) {
      const active = Number(row.capteur1) === 1;
      if (acceptSensorReading(1, detectedAt)) {
        applySensorReading(1, setters, {
          gpio: pins.gpio1,
          active,
          lastDetectedAt: detectedAt,
          stateLabel: formatSensorStatus(active),
          rawValue: Number(row.capteur1),
          source: 'etat_capteur',
        });
        handleStuckWatchdog(1, active, pins.gpio1);
        if (active) logEvent(`etat_capteur: Sensor 1 (GPIO ${pins.gpio1}) is active`, 'info');
      }
    }

    if (row.capteur2 !== undefined) {
      const active = Number(row.capteur2) === 1;
      if (acceptSensorReading(2, detectedAt)) {
        applySensorReading(2, setters, {
          gpio: pins.gpio2,
          active,
          lastDetectedAt: detectedAt,
          stateLabel: formatSensorStatus(active),
          rawValue: Number(row.capteur2),
          source: 'etat_capteur',
        });
        handleStuckWatchdog(2, active, pins.gpio2);
        if (active) logEvent(`etat_capteur: Sensor 2 (GPIO ${pins.gpio2}) is active`, 'info');
      }
    }

    if (row.capteur3 !== undefined) {
      const active = Number(row.capteur3) === 1;
      if (acceptSensorReading(3, detectedAt)) {
        applySensorReading(3, setters, {
          gpio: pins.gpio3,
          active,
          lastDetectedAt: detectedAt,
          stateLabel: formatSensorStatus(active),
          rawValue: Number(row.capteur3),
          source: 'etat_capteur',
        });
        handleStuckWatchdog(3, active, pins.gpio3);
        if (active) logEvent(`etat_capteur: Sensor 3 (GPIO ${pins.gpio3}) is active`, 'info');
      }
    }
  }, [acceptSensorReading, handleStuckWatchdog, logEvent]);

  const updateSensorFromEvent = useCallback((row: any, pins: GpioPins = gpioPinsRef.current, isHistorical = false) => {
    if (!isHistorical) {
      setPiOnline(true);
      lastHeartbeatTime.current = Date.now();
    }

    const sensorNum = getSensorNumberFromEvent(row, pins);
    if (!sensorNum) {
      logEvent(`sensor_events: Unmapped sensor ${row.sensor_id || 'unknown'} on GPIO ${row.gpio_pin || 'unknown'}`, 'warn');
      return;
    }

    const active = getEventActiveState(row);
    const mappedGpio = sensorNum === 1 ? pins.gpio1 : sensorNum === 2 ? pins.gpio2 : pins.gpio3;
    const gpioPin = Number(row.gpio_pin || mappedGpio);
    const detectedAt = normalizeSensorTimestamp(row.created_at);
    const stateLabel = row.state || formatSensorStatus(active);
    if (!acceptSensorReading(sensorNum, detectedAt)) return;

    applySensorReading(sensorNum, { setSensor1, setSensor2, setSensor3 }, {
      gpio: gpioPin,
      active,
      lastDetectedAt: detectedAt,
      sensorId: row.sensor_id,
      stateLabel,
      scenario: row.scenario,
      rawValue: Number(row.raw_value ?? 0),
      source: 'sensor_events',
    });

    handleStuckWatchdog(sensorNum, active, gpioPin);
    logEvent(
      `sensor_events: ${row.sensor_id || `Sensor ${sensorNum}`} GPIO ${gpioPin} ${stateLabel} (${row.scenario || 'no scenario'})`,
      active ? 'info' : 'success'
    );
  }, [acceptSensorReading, handleStuckWatchdog, logEvent]);

  const loadSensorData = useCallback(async () => {
    try {
      setLoading(true);
      const [config, latestSensorEvents] = await Promise.all([
        getConfiguration(),
        getLatestSensorEvents(100),
      ]);

      const pins = {
        gpio1: Number(config?.gpio_capteur1 ?? 0),
        gpio2: Number(config?.gpio_capteur2 ?? 0),
        gpio3: Number(config?.gpio_capteur3 ?? 0),
      };
      const ct = Number(config?.cycle_time_seconds || 5);

      gpioPinsRef.current = pins;
      setGpioPins(pins);
      setCycleTime(ct);
      setSensor1((prev) => ({ ...prev, gpio: pins.gpio1, source: 'configuration' }));
      setSensor2((prev) => ({ ...prev, gpio: pins.gpio2, source: 'configuration' }));
      setSensor3((prev) => ({ ...prev, gpio: pins.gpio3, source: 'configuration' }));

      // Find the single latest event for each sensor to update them with only their last data
      const latestEventsMap: Record<string, any> = {};
      latestSensorEvents.forEach((event) => {
        const sensorNum = getSensorNumberFromEvent(event, pins);
        if (sensorNum && !latestEventsMap[sensorNum]) {
          latestEventsMap[sensorNum] = event;
        }
      });

      // Process only the latest events (reversing them to process oldest of the three first)
      Object.values(latestEventsMap)
        .reverse()
        .forEach((event) => updateSensorFromEvent(event, pins, true));

      if (latestSensorEvents.length > 0) {
        const newestEvent = latestSensorEvents[0];
        const newestTime = new Date(newestEvent.created_at).getTime();
        const now = Date.now();
        
        // If the Pi sent data within the last 20 seconds, it's online
        if (now - newestTime <= 20000) {
          setPiOnline(true);
          lastHeartbeatTime.current = Date.now(); // Reset window from now
        } else {
          setPiOnline(false);
          lastHeartbeatTime.current = 0; // Force offline immediately
        }
      } else {
        setPiOnline(false);
        lastHeartbeatTime.current = 0;
      }
    } catch (err) {
      console.error('Error loading sensor data:', err);
    } finally {
      setLoading(false);
    }
  }, [updateSensorFromEvent]);

  useEffect(() => {
    loadSensorData();

    const supabase = getSupabaseClient();
    if (!supabase) {
      logEvent('Supabase client not available', 'warn');
      setLoading(false);
      return;
    }

    const timers = sensorTimers.current;
    logEvent('Connecting to Supabase Realtime...', 'info');

    const channel = supabase
      .channel('sensor_updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sensor_events' }, (payload) => {
        updateSensorFromEvent(payload.new);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logEvent('Live Supabase stream connected successfully', 'success');
        } else {
          logEvent(`Stream connection state: ${status}`, 'info');
        }
      });

    const heartbeatCheck = setInterval(() => {
      const elapsed = Date.now() - lastHeartbeatTime.current;
      if (elapsed > 20000) {
        setPiOnline(false);
      }
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(heartbeatCheck);
      if (timers[1]) clearTimeout(timers[1]);
      if (timers[2]) clearTimeout(timers[2]);
      if (timers[3]) clearTimeout(timers[3]);
    };
  }, [loadSensorData, logEvent, updateSensorFromEvent]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: palette.backgroundSecondary }]} edges={['top']}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.backgroundSecondary }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: palette.border, backgroundColor: palette.background }]}>
        <View>
          <Text style={[styles.headerTitle, { color: palette.text }]}>Acquisition Interface</Text>
          <Text style={[styles.headerSubtitle, { color: palette.textSecondary }]}>Real-Time Sensor Monitoring</Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: piOnline ? '#10B9811A' : '#EF44441A', borderColor: piOnline ? '#10B9812E' : '#EF44442E' }]}>
          <View style={[styles.statusDot, { backgroundColor: piOnline ? '#10B981' : '#EF4444' }]} />
          <Text style={[styles.statusText, { color: piOnline ? '#10B981' : '#EF4444' }]}>
            {piOnline ? 'Pi Online' : 'Pi Offline'}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Sensor Grid */}
        <View style={styles.sensorGrid}>
          {/* Sensor 1 Card */}
          <View style={[styles.sensorCard, { backgroundColor: palette.background, borderColor: sensor1.active ? '#10B981' : palette.border }, sensor1.active && styles.activeSensorShadow]}>
            <View style={styles.sensorCardHeader}>
              <View style={[styles.sensorIconWrap, { backgroundColor: sensor1.active ? '#10B9811F' : palette.border }]}>
                <Ionicons name="enter-outline" size={20} color={sensor1.active ? '#10B981' : palette.textSecondary} />
              </View>
              <View style={[styles.gpioBadge, { backgroundColor: palette.backgroundSecondary }]}>
                <Text style={[styles.gpioText, { color: palette.textSecondary }]}>GPIO {sensor1.gpio}</Text>
              </View>
            </View>

            <Text style={[styles.sensorName, { color: palette.text }]}>Sensor 1 (GPIO {sensor1.gpio})</Text>
            <View style={styles.statusRow}>
              <Text style={[styles.sensorStatus, { color: sensor1.active ? '#10B981' : palette.textTertiary }]}>
                {formatSensorStatus(sensor1.active)}
              </Text>
              {sensor1.lastUpdated && (
                <Text style={[styles.lastUpdate, { color: palette.textTertiary }]}>Last Update: {sensor1.lastUpdated}</Text>
              )}
            </View>
            <SensorMeta sensor={sensor1} palette={palette} />
          </View>

          {/* Sensor 2 Card */}
          <View style={[styles.sensorCard, { backgroundColor: palette.background, borderColor: sensor2.active ? '#10B981' : palette.border }, sensor2.active && styles.activeSensorShadow]}>
            <View style={styles.sensorCardHeader}>
              <View style={[styles.sensorIconWrap, { backgroundColor: sensor2.active ? '#10B9811F' : palette.border }]}>
                <Ionicons name="git-commit-outline" size={20} color={sensor2.active ? '#10B981' : palette.textSecondary} />
              </View>
              <View style={[styles.gpioBadge, { backgroundColor: palette.backgroundSecondary }]}>
                <Text style={[styles.gpioText, { color: palette.textSecondary }]}>GPIO {sensor2.gpio}</Text>
              </View>
            </View>

            <Text style={[styles.sensorName, { color: palette.text }]}>Sensor 2 (GPIO {sensor2.gpio})</Text>
            <View style={styles.statusRow}>
              <Text style={[styles.sensorStatus, { color: sensor2.active ? '#10B981' : palette.textTertiary }]}>
                {formatSensorStatus(sensor2.active)}
              </Text>
              {sensor2.lastUpdated && (
                <Text style={[styles.lastUpdate, { color: palette.textTertiary }]}>Last Update: {sensor2.lastUpdated}</Text>
              )}
            </View>
            <SensorMeta sensor={sensor2} palette={palette} />
          </View>

          {/* Sensor 3 Card */}
          <View style={[styles.sensorCard, { backgroundColor: palette.background, borderColor: sensor3.active ? '#10B981' : palette.border }, sensor3.active && styles.activeSensorShadow]}>
            <View style={styles.sensorCardHeader}>
              <View style={[styles.sensorIconWrap, { backgroundColor: sensor3.active ? '#10B9811F' : palette.border }]}>
                <Ionicons name="exit-outline" size={20} color={sensor3.active ? '#10B981' : palette.textSecondary} />
              </View>
              <View style={[styles.gpioBadge, { backgroundColor: palette.backgroundSecondary }]}>
                <Text style={[styles.gpioText, { color: palette.textSecondary }]}>GPIO {sensor3.gpio}</Text>
              </View>
            </View>

            <Text style={[styles.sensorName, { color: palette.text }]}>Sensor 3 (GPIO {sensor3.gpio})</Text>
            <View style={styles.statusRow}>
              <Text style={[styles.sensorStatus, { color: sensor3.active ? '#10B981' : palette.textTertiary }]}>
                {formatSensorStatus(sensor3.active)}
              </Text>
              {sensor3.lastUpdated && (
                <Text style={[styles.lastUpdate, { color: palette.textTertiary }]}>Last Update: {sensor3.lastUpdated}</Text>
              )}
            </View>
            <SensorMeta sensor={sensor3} palette={palette} />
          </View>
        </View>

        {/* Live Event Log */}
        <View style={[styles.card, { backgroundColor: palette.background, borderColor: palette.border }]}>
          <View style={styles.logHeader}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>Live Acquisition Stream</Text>
            <View style={styles.livePulse}>
              <View style={[styles.pulseDot, { backgroundColor: piOnline ? '#10B981' : '#EF4444' }]} />
              <Text style={[styles.pulseText, { color: piOnline ? '#10B981' : '#EF4444' }]}>LIVE</Text>
            </View>
          </View>

          <ScrollView style={styles.logList} nestedScrollEnabled={true}>
            {events.length === 0 ? (
              <Text style={[styles.emptyLogText, { color: palette.textTertiary }]}>Awaiting sensor events...</Text>
            ) : (
              events.map((evt) => (
                <View key={evt.id} style={styles.logItem}>
                  <Text style={[styles.logTime, { color: palette.textSecondary }]}>[{evt.time}]</Text>
                  <Text style={[
                    styles.logMsg, 
                    { color: evt.type === 'success' ? '#10B981' : evt.type === 'warn' ? '#EF4444' : palette.text }
                  ]}>
                    {evt.msg}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>
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
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    ...typography.tiny,
    fontWeight: 'bold',
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
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sensorIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gpioBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  gpioText: {
    ...typography.tiny,
    fontWeight: '700',
  },
  sensorName: {
    ...typography.bodyBold,
    fontSize: 16,
    marginBottom: spacing.xs,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sensorStatus: {
    ...typography.captionBold,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  lastUpdate: {
    ...typography.tiny,
  },
  sensorMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.sm,
  },
  sensorMetaChip: {
    borderRadius: borderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sensorMetaText: {
    ...typography.tiny,
    fontWeight: '700',
  },
  activeSensorShadow: {
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  card: {
    borderWidth: 1,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  cardTitle: {
    ...typography.bodyBold,
    fontSize: 18,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: spacing.sm,
  },
  livePulse: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  logList: {
    maxHeight: 400,
  },
  emptyLogText: {
    ...typography.body,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  logItem: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.sm,
    paddingVertical: 4,
  },
  logTime: {
    fontFamily: 'Courier',
    ...typography.tiny,
    fontWeight: '600',
  },
  logMsg: {
    ...typography.tiny,
    flex: 1,
  },
});
