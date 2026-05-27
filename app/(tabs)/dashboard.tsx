import React, { useCallback, useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useActiveCards } from '@/hooks/useActiveCards';
import { useTodaysLosses } from '@/hooks/useTodaysLosses';
import { getSupabaseClient } from '@/lib/supabase';
import {
  fetchConfiguration,
  fetchLatestSensorStates,
  computeKPIs,
  SensorReading,
  ProductionKPIs,
} from '@/lib/api';

function getSensorPosition(sensorId: string): 1 | 2 | 3 | null {
  if (sensorId === 'capteur1' || sensorId === 'sensor1') return 1;
  if (sensorId === 'capteur2' || sensorId === 'sensor2') return 2;
  if (sensorId === 'capteur3' || sensorId === 'sensor3') return 3;
  return null;
}

export default function DashboardScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [config, setConfig] = useState<{
    nb_cartes_attendues: number;
    machine_name: string;
    shift_start: string;
    shift_end: string;
  } | null>(null);

  const [sensors, setSensors] = useState<SensorReading[]>([]);

  const { cards: activeCards, loading: cardsLoading, refetch: refetchCards } = useActiveCards();
  const { totalCost, totalCards, loading: lossesLoading, refetch: refetchLosses } = useTodaysLosses('today');

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [conf, sens] = await Promise.all([
        fetchConfiguration(),
        fetchLatestSensorStates(),
      ]);

      if (conf) {
        setConfig({
          nb_cartes_attendues: Number(conf.nb_cartes_attendues || 10),
          machine_name: conf.machine_name || 'NPM-DX-1',
          shift_start: conf.shift_start?.toString().slice(0, 5) || '08:00',
          shift_end: conf.shift_end?.toString().slice(0, 5) || '16:00',
        });
      } else {
        setConfig({
          nb_cartes_attendues: 10,
          machine_name: 'NPM-DX-1',
          shift_start: '08:00',
          shift_end: '16:00',
        });
      }

      setSensors(sens);
    } catch (err) {
      console.error('loadData failed:', err);
      setError('Failed to fetch data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadData();

    const supabase = getSupabaseClient();
    if (!supabase) return;

    const channel = supabase
      .channel('dashboard_sensor_updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sensor_events' },
        (payload: any) => {
          if (!payload.new) return;
          const sensorId = payload.new.sensor_id;
          const pos = getSensorPosition(sensorId);
          if (pos) {
            setSensors((prev) => {
              const next = prev.map((s) =>
                s.position === pos
                  ? {
                      position: pos,
                      sensorId: sensorId,
                      state: payload.new.state as 'HIGH' | 'LOW',
                      counter: payload.new.counter ?? 0,
                      recordedAt: payload.new.recorded_at || payload.new.created_at || null,
                      gpioPin: payload.new.gpio_pin ?? s.gpioPin,
                    }
                  : s
              );
              return next;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadData(), refetchCards(), refetchLosses()]);
    setRefreshing(false);
  }, [loadData, refetchCards, refetchLosses]);

  const kpis = useMemo(() => {
    if (!config) return null;
    return computeKPIs(sensors, config);
  }, [sensors, config]);

  const getKpiColor = (percent: number) => {
    if (percent >= 80) return '#22c55e'; // green
    if (percent >= 50) return '#f97316'; // orange
    return '#ef4444'; // red
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading Dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !config || !kpis) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error || 'Error loading dashboard.'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => { setLoading(true); loadData(); }}>
            <Text style={styles.retryButtonText}>Tap to retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const piOnline = sensors.some(s => s.state !== 'UNKNOWN');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.headerLabel}>MACHINE: {config.machine_name}</Text>
            <Text style={styles.headerTitle}>Shift: {config.shift_start} - {config.shift_end}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: piOnline ? '#ecfdf5' : '#f3f4f6' }]}>
            <View style={[styles.statusDot, { backgroundColor: piOnline ? '#22c55e' : '#9ca3af' }]} />
            <Text style={[styles.statusText, { color: piOnline ? '#15803d' : '#4b5563' }]}>
              {piOnline ? 'Pi Online' : 'Pi Offline'}
            </Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Live Sensors</Text>
          <View style={styles.sensorsGrid}>
            {sensors.map((s, idx) => {
              const names = ['Capteur 1', 'Capteur 2', 'Capteur 3'];
              const locations = ['Entry', 'Middle', 'Exit'];
              
              const stateBg = s.state === 'HIGH' ? '#dcfce7' : s.state === 'LOW' ? '#fee2e2' : '#f3f4f6';
              const stateDotColor = s.state === 'HIGH' ? '#22c55e' : s.state === 'LOW' ? '#ef4444' : '#9ca3af';

              return (
                <View key={s.position} style={styles.sensorBox}>
                  <Text style={styles.sensorName}>{names[idx]}</Text>
                  <Text style={styles.sensorLocation}>{locations[idx]}</Text>
                  <View style={[styles.stateIndicator, { backgroundColor: stateBg }]}>
                    <View style={[styles.stateDot, { backgroundColor: stateDotColor }]} />
                    <Text style={[styles.stateText, { color: s.state === 'HIGH' ? '#15803d' : s.state === 'LOW' ? '#b91c1c' : '#4b5563' }]}>
                      {s.state}
                    </Text>
                  </View>
                  <Text style={styles.sensorCount}>Count: {s.counter}</Text>
                  <Text style={styles.sensorTime}>
                    {s.recordedAt ? new Date(s.recordedAt).toLocaleTimeString('fr-FR') : '-'}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Production KPIs</Text>
          <View style={styles.kpiGrid}>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>Cards Produced</Text>
              <Text style={styles.kpiValue}>{kpis.cardsProduced}</Text>
            </View>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>Cards Expected</Text>
              <Text style={styles.kpiValue}>{kpis.cardsExpected}</Text>
            </View>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>Cards Good</Text>
              <Text style={styles.kpiValue}>{kpis.cardsGood}</Text>
            </View>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>Total Losses</Text>
              <Text style={[styles.kpiValue, { color: kpis.totalLosses > 0 ? '#ef4444' : '#22c55e' }]}>
                {kpis.totalLosses}
              </Text>
            </View>
          </View>

          <View style={styles.trgTrsRow}>
            <View style={styles.trgTrsCard}>
              <Text style={styles.trgTrsLabel}>TRG</Text>
              <View style={[styles.circle, { borderColor: kpis.cardsProduced === 0 ? '#e5e7eb' : getKpiColor(kpis.trgPercent) }]}>
                <Text style={[styles.circleValue, { color: kpis.cardsProduced === 0 ? '#6b7280' : getKpiColor(kpis.trgPercent) }]}>
                  {kpis.cardsProduced === 0 ? '—' : `${kpis.trgPercent}%`}
                </Text>
              </View>
            </View>
            <View style={styles.trgTrsCard}>
              <Text style={styles.trgTrsLabel}>TRS</Text>
              <View style={[styles.circle, { borderColor: kpis.cardsProduced === 0 ? '#e5e7eb' : getKpiColor(kpis.trsPercent) }]}>
                <Text style={[styles.circleValue, { color: kpis.cardsProduced === 0 ? '#6b7280' : getKpiColor(kpis.trsPercent) }]}>
                  {kpis.cardsProduced === 0 ? '—' : `${kpis.trsPercent}%`}
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.lossBreakdown, { backgroundColor: kpis.totalLosses > 0 ? '#fff5f5' : '#f0fdf4', borderColor: kpis.totalLosses > 0 ? '#fee2e2' : '#bbf7d0' }]}>
            <Text style={[styles.lossBreakdownTitle, { color: kpis.totalLosses > 0 ? '#dc2626' : '#15803d' }]}>
              Loss breakdown
            </Text>
            {kpis.totalLosses === 0 ? (
              <Text style={[styles.lossZone, { color: '#16a34a' }]}>No losses detected</Text>
            ) : (
              <>
                {kpis.lossZone1to2 > 0 && (
                  <Text style={styles.lossZone}>Zone 1 → 2 losses: {kpis.lossZone1to2} cards</Text>
                )}
                {kpis.lossZone2to3 > 0 && (
                  <Text style={styles.lossZone}>Zone 2 → 3 losses: {kpis.lossZone2to3} cards</Text>
                )}
              </>
            )}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Live Production</Text>
            <Text style={styles.sectionSub}>Today&apos;s Activity</Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={[styles.statBoxValue, { color: '#3b82f6' }]}>{kpis.cardsProduced}</Text>
              <Text style={styles.statBoxLabel}>Produced</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statBoxValue, { color: '#22c55e' }]}>{kpis.cardsGood}</Text>
              <Text style={styles.statBoxLabel}>Good</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statBoxValue, { color: '#ef4444' }]}>{kpis.totalLosses}</Text>
              <Text style={styles.statBoxLabel}>Lost</Text>
            </View>
          </View>

          {cardsLoading ? (
            <ActivityIndicator color="#3b82f6" style={{ marginVertical: 16 }} />
          ) : (
            <>
              {activeCards.length > 0 && (
                <View style={styles.cardsList}>
                  <Text style={styles.cardsListTitle}>Active Cards ({activeCards.length})</Text>
                  {activeCards.slice(0, 5).map((card) => (
                    <TouchableOpacity
                      key={card.id}
                      style={styles.cardItem}
                      onPress={() => router.push(`/card/${card.card_id || card.id}` as never)}
                    >
                      <View style={styles.cardItemLeft}>
                        <Text style={styles.cardId}>{card.card_id || card.id}</Text>
                        <Text style={styles.cardStage}>{card.stage || 'In Progress'}</Text>
                      </View>
                      <View
                        style={[
                          styles.durationBadge,
                          { backgroundColor: card.durationMinutes > 30 ? '#fee2e2' : '#fef3c7' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.durationText,
                            { color: card.durationMinutes > 30 ? '#dc2626' : '#d97706' },
                          ]}
                        >
                          {card.durationMinutes}m
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}
        </View>

        <View style={styles.lossCard}>
          <Text style={styles.lossTitle}>Today&apos;s Losses</Text>
          <View style={styles.lossContent}>
            <View style={styles.lossIconBox}>
              <Text style={styles.lossIconText}>!</Text>
            </View>
            <View>
              {lossesLoading ? (
                <ActivityIndicator color="#ef4444" />
              ) : (
                <>
                  <Text style={styles.lossCount}>{totalCards} lost cards</Text>
                  <Text style={styles.lossCost}>{totalCost.toFixed(3)} TND</Text>
                </>
              )}
            </View>
          </View>
        </View>

        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/(tabs)/scan' as never)}
          >
            <Text style={styles.actionButtonText}>Scan Card (Zebra)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonSecondary]}
            onPress={() => router.push('/stuck-cards' as never)}
          >
            <Text style={[styles.actionButtonText, styles.actionButtonSecondaryText]}>
              View Stuck Cards
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f9fa' },
  container: { flex: 1 },
  content: { paddingBottom: 32 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 12, fontSize: 15, color: '#6b7280' },
  errorText: { fontSize: 16, color: '#ef4444', textAlign: 'center', marginBottom: 16 },
  retryButton: { backgroundColor: '#3b82f6', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryButtonText: { color: '#fff', fontWeight: '600' },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerLabel: { fontSize: 11, color: '#6b7280', marginBottom: 2, fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1f2937' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  statusText: { fontWeight: '600', fontSize: 11 },
  sectionCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12, color: '#111827' },
  sectionSub: { fontSize: 12, color: '#6b7280' },
  sensorsGrid: { flexDirection: 'row', gap: 8 },
  sensorBox: {
    flex: 1,
    backgroundColor: '#f9fafb',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sensorName: { fontSize: 12, fontWeight: '600', marginBottom: 2, color: '#374151' },
  sensorLocation: { fontSize: 10, color: '#9ca3af', marginBottom: 6 },
  stateIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 6,
    alignSelf: 'flex-start',
  },
  stateDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  stateText: { fontSize: 10, fontWeight: '700' },
  sensorCount: { fontSize: 11, fontWeight: '600', marginBottom: 2, color: '#1f2937' },
  sensorTime: { fontSize: 9, color: '#6b7280' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  kpiBox: { width: '48%', marginRight: '2%', padding: 12, backgroundColor: '#f9fafb', borderRadius: 10, marginBottom: 8 },
  kpiLabel: { fontSize: 11, color: '#6b7280', marginBottom: 4, fontWeight: '500' },
  kpiValue: { fontSize: 20, fontWeight: '700', color: '#111827' },
  trgTrsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  trgTrsCard: { flex: 1, alignItems: 'center', padding: 12, backgroundColor: '#f9fafb', borderRadius: 10 },
  trgTrsLabel: { fontSize: 12, fontWeight: '600', marginBottom: 8, color: '#6b7280' },
  circle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleValue: { fontSize: 16, fontWeight: '700' },
  lossBreakdown: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  lossBreakdownTitle: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  lossZone: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12 },
  statBox: { alignItems: 'center' },
  statBoxValue: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
  statBoxLabel: { fontSize: 11, color: '#6b7280' },
  cardsList: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 12 },
  cardsListTitle: { fontSize: 13, fontWeight: '600', marginBottom: 8, color: '#374151' },
  cardItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
  },
  cardItemLeft: { flex: 1 },
  cardId: { fontSize: 12, fontWeight: '600', color: '#1f2937' },
  cardStage: { fontSize: 10, color: '#6b7280', marginTop: 2 },
  durationBadge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  durationText: { fontSize: 10, fontWeight: '600' },
  lossCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  lossTitle: { fontSize: 15, fontWeight: '600', marginBottom: 12, color: '#111827' },
  lossContent: { flexDirection: 'row', alignItems: 'center' },
  lossIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  lossIconText: { fontSize: 20, fontWeight: '700', color: '#ef4444' },
  lossCount: { fontSize: 14, fontWeight: '600', color: '#ef4444' },
  lossCost: { fontSize: 13, color: '#f97316', marginTop: 2, fontWeight: '600' },
  quickActions: { marginHorizontal: 16, marginTop: 16, gap: 12 },
  actionButton: { backgroundColor: '#3b82f6', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  actionButtonSecondary: { backgroundColor: '#f3f4f6' },
  actionButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  actionButtonSecondaryText: { color: '#374151' },
});
