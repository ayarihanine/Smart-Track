import React, { useCallback, useState } from 'react';
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

import { useSensorCounters } from '@/hooks/useSensorCounters';
import { useActiveCards } from '@/hooks/useActiveCards';
import { useTodaysLosses } from '@/hooks/useTodaysLosses';
import { useMachineConfig } from '@/hooks/useMachineConfig';

export default function DashboardScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const { expected, cycleTime } = useMachineConfig();

  const {
    sensors,
    logical,
    produced,
    goodCards,
    totalLosses,
    zone1Loss,
    zone2Loss,
    activeCount,
  } = useSensorCounters();

  const trg = expected > 0 ? (Math.max(0, produced - totalLosses) / expected) * 100 : 0
  const trs = trg * 0.85

  const { cards: activeCards, loading: cardsLoading, refetch: refetchCards } = useActiveCards();
  const { totalCost, totalCards, loading: lossesLoading, refetch: refetchLosses } = useTodaysLosses('today');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchCards(), refetchLosses()]);
    setRefreshing(false);
  }, [refetchCards, refetchLosses]);

  const piOnline = activeCount > 0;

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
            <Text style={styles.headerLabel}>FACTORY PERFORMANCE</Text>
            <Text style={styles.headerTitle}>Card Track</Text>
          </View>
          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, { backgroundColor: piOnline ? '#22c55e' : '#9ca3af' }]} />
            <Text style={[styles.statusText, { color: piOnline ? '#22c55e' : '#9ca3af' }]}>
              {piOnline ? 'Pi Online' : 'Pi Offline'}
            </Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Live Sensors</Text>
          <View style={styles.sensorsGrid}>
            {(['sensor1', 'sensor2', 'sensor3'] as const).map((id, idx) => {
              const s = sensors[id];
              const names = ['Capteur 1', 'Capteur 2', 'Capteur 3'];
              const locations = ['Entry', 'Middle', 'Exit'];
              const logicalCount =
                idx === 0 ? logical.entry : idx === 1 ? logical.middle : logical.exit;

              return (
                <View key={id} style={styles.sensorBox}>
                  <Text style={styles.sensorName}>{names[idx]}</Text>
                  <Text style={styles.sensorLocation}>{locations[idx]}</Text>
                  <View
                    style={[
                      styles.stateIndicator,
                      { backgroundColor: s.state === 'HIGH' ? '#dcfce7' : '#f3f4f6' },
                    ]}
                  >
                    <View
                      style={[
                        styles.stateDot,
                        { backgroundColor: s.state === 'HIGH' ? '#22c55e' : '#9ca3af' },
                      ]}
                    />
                    <Text style={styles.stateText}>{s.state}</Text>
                  </View>
                  <Text style={styles.sensorCount}>Count: {logicalCount}</Text>
                  <Text style={styles.sensorTime}>{s.lastSeen}</Text>
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
              <Text style={styles.kpiValue}>{produced}</Text>
            </View>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>Cards Expected</Text>
              <Text style={styles.kpiValue}>{expected}</Text>
            </View>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>Cards Good</Text>
              <Text style={styles.kpiValue}>{goodCards}</Text>
            </View>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>Total Losses</Text>
              <Text style={[styles.kpiValue, { color: totalLosses > 0 ? '#f59e0b' : '#22c55e' }]}>
                {totalLosses}
              </Text>
            </View>
          </View>

          <View style={styles.trgTrsRow}>
            <View style={styles.trgTrsCard}>
              <Text style={styles.trgTrsLabel}>TRG</Text>
              <View style={styles.circle}>
                <Text style={[styles.circleValue, { color: trg < 50 ? '#ef4444' : '#22c55e' }]}>
                  {produced === 0 ? '—' : `${trg.toFixed(0)}%`}
                </Text>
              </View>
            </View>
            <View style={styles.trgTrsCard}>
              <Text style={styles.trgTrsLabel}>TRS</Text>
              <View style={styles.circle}>
                <Text style={[styles.circleValue, { color: trs < 50 ? '#ef4444' : '#22c55e' }]}>
                  {produced === 0 ? '—' : `${trs.toFixed(0)}%`}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.lossBreakdown}>
            <Text style={styles.lossBreakdownTitle}>Loss breakdown</Text>
            {zone1Loss === 0 && zone2Loss === 0 ? (
              <Text style={[styles.lossZone, { color: '#16a34a' }]}>No losses detected</Text>
            ) : (
              <>
                {zone1Loss > 0 && (
                  <Text style={styles.lossZone}>Zone 1 → 2 losses: {zone1Loss} cards</Text>
                )}
                {zone2Loss > 0 && (
                  <Text style={styles.lossZone}>Zone 2 → 3 losses: {zone2Loss} cards</Text>
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
              <Text style={[styles.statBoxValue, { color: '#3b82f6' }]}>{produced}</Text>
              <Text style={styles.statBoxLabel}>In Progress</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statBoxValue, { color: '#22c55e' }]}>{totalLosses}</Text>
              <Text style={styles.statBoxLabel}>Completed</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statBoxValue, { color: '#ef4444' }]}>0</Text>
              <Text style={styles.statBoxLabel}>Blocked</Text>
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
                      onPress={() => router.push(`/card/${card.card_id}` as never)}
                    >
                      <View style={styles.cardItemLeft}>
                        <Text style={styles.cardId}>{card.card_id}</Text>
                        <Text style={styles.cardStage}>{card.stage}</Text>
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
  header: {
    backgroundColor: '#fff',
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerLabel: { fontSize: 11, color: '#6b7280', marginBottom: 2 },
  headerTitle: { fontSize: 22, fontWeight: '700' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
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
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
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
  sensorName: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
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
  stateText: { fontSize: 10, fontWeight: '600' },
  sensorCount: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
  sensorTime: { fontSize: 9, color: '#6b7280' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  kpiBox: { width: '50%', padding: 12, backgroundColor: '#f9fafb', borderRadius: 10, marginBottom: 8 },
  kpiLabel: { fontSize: 11, color: '#6b7280', marginBottom: 4 },
  kpiValue: { fontSize: 20, fontWeight: '700' },
  trgTrsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  trgTrsCard: { flex: 1, alignItems: 'center', padding: 12, backgroundColor: '#f9fafb', borderRadius: 10 },
  trgTrsLabel: { fontSize: 12, fontWeight: '600', marginBottom: 8, color: '#6b7280' },
  circle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 4,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleValue: { fontSize: 16, fontWeight: '700' },
  lossBreakdown: {
    backgroundColor: '#fff7ed',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fdba74',
  },
  lossBreakdownTitle: { fontSize: 13, fontWeight: '600', marginBottom: 4, color: '#ea580c' },
  lossZone: { fontSize: 12, color: '#c2410c', marginTop: 2 },
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
  cardId: { fontSize: 12, fontWeight: '600' },
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
  lossTitle: { fontSize: 15, fontWeight: '600', marginBottom: 12 },
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
  lossCost: { fontSize: 13, color: '#f97316', marginTop: 2 },
  quickActions: { marginHorizontal: 16, marginTop: 16, gap: 12 },
  actionButton: { backgroundColor: '#3b82f6', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  actionButtonSecondary: { backgroundColor: '#f3f4f6' },
  actionButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  actionButtonSecondaryText: { color: '#374151' },
});
