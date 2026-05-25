import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useStuckCards } from '@/hooks/useStuckCards';
import { getSupabaseClient } from '@/lib/supabase';

export default function StuckCardsScreen() {
  const { stuckCards, loading, refetch } = useStuckCards(30);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleResolve = (cardId: string) => {
    Alert.alert('Resolve Stuck Card', `Mark ${cardId} as manually resolved?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Resolve',
        style: 'destructive',
        onPress: async () => {
          const supabase = getSupabaseClient();
          if (!supabase) return;

          try {
            const { error } = await supabase
              .from('electronic_cards')
              .update({
                status: 'on_hold',
                current_machine_status: 'completed',
                updated_at: new Date().toISOString(),
              })
              .eq('card_id', cardId);

            if (error) throw error;
            Alert.alert('Resolved', `${cardId} marked as resolved`);
            refetch();
          } catch {
            Alert.alert('Error', 'Failed to update card status');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Stuck Cards</Text>
          <Text style={styles.subtitle}>Cards stuck &gt; 30 minutes</Text>
        </View>
      </View>

      {loading && stuckCards.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color="#3b82f6" />
          <Text style={styles.loadingText}>Loading stuck cards...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.container}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
          }
        >
          {stuckCards.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>✓</Text>
              <Text style={styles.emptyText}>Production Flowing Smoothly</Text>
              <Text style={styles.emptySubtext}>No cards are currently stuck in any stage</Text>
            </View>
          ) : (
            <>
              <View style={styles.alertBanner}>
                <Text style={styles.alertText}>
                  {stuckCards.length} card(s) require attention
                </Text>
              </View>

              {stuckCards.map((card) => (
                <View
                  key={card.id}
                  style={[
                    styles.card,
                    { borderColor: card.severity === 'critical' ? '#ef4444' : '#f59e0b' },
                  ]}
                >
                  <View style={styles.cardHeader}>
                    <View>
                      <Text style={styles.cardId}>{card.card_id}</Text>
                      <Text style={styles.cardStage}>{card.stage}</Text>
                    </View>
                    <View
                      style={[
                        styles.badge,
                        { backgroundColor: card.severity === 'critical' ? '#fee2e2' : '#fef3c7' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          { color: card.severity === 'critical' ? '#dc2626' : '#d97706' },
                        ]}
                      >
                        {card.minutesAtStage}m
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardInfo}>
                    <Text style={styles.infoText}>
                      Entered: {new Date(card.enteredAt).toLocaleTimeString('fr-FR')}
                    </Text>
                    {card.severity === 'critical' && (
                      <Text style={styles.criticalText}>Critical: Over 1 hour</Text>
                    )}
                  </View>

                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => handleResolve(card.card_id)}
                    >
                      <Text style={styles.actionBtnText}>Resolve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionBtnSecondary]}
                      onPress={() => router.push(`/card/${card.card_id}` as never)}
                    >
                      <Text style={[styles.actionBtnText, styles.actionBtnSecondaryText]}>Details</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f9fa' },
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: '#6b7280' },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 2 },
  emptyState: { padding: 40, alignItems: 'center', marginTop: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12, color: '#22c55e' },
  emptyText: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  emptySubtext: { color: '#6b7280', textAlign: 'center' },
  alertBanner: { backgroundColor: '#fef2f2', padding: 12, margin: 16, borderRadius: 8 },
  alertText: { color: '#dc2626', fontWeight: '600', textAlign: 'center' },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardId: { fontSize: 16, fontWeight: '700' },
  cardStage: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontWeight: '700', fontSize: 12 },
  cardInfo: { marginBottom: 12 },
  infoText: { fontSize: 13, color: '#374151', marginBottom: 4 },
  criticalText: { color: '#dc2626', fontSize: 12, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1,
    backgroundColor: '#3b82f6',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  actionBtnSecondary: { backgroundColor: '#f3f4f6' },
  actionBtnSecondaryText: { color: '#374151' },
});
