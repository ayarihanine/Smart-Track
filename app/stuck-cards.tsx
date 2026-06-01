import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/components/ThemeProvider';
import { useStuckCards } from '@/hooks/useStuckCards';
import { getSupabaseClient } from '@/lib/supabase';
import { borderRadius, shadows, spacing, typography } from '@/constants/design';

export default function StuckCardsScreen() {
  const { palette, isDark } = useTheme();
  const { stuckCards, loading, refetch } = useStuckCards(10);
  const [refreshing, setRefreshing] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleResolve = (cardId: string, id: string) => {
    Alert.alert(
      'Resolve Stuck Card',
      `Mark card ${cardId} as manually resolved and move it to "on hold"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Resolve',
          style: 'destructive',
          onPress: async () => {
            setResolvingId(id);
            const supabase = getSupabaseClient();
            if (!supabase) { setResolvingId(null); return; }
            try {
              const { error } = await supabase
                .from('electronic_cards')
                .update({
                  status: 'on_hold',
                  current_machine_status: 'idle',
                  updated_at: new Date().toISOString(),
                })
                .eq('card_id', cardId);
              if (error) throw error;
              await refetch();
              Alert.alert('✅ Resolved', `Card ${cardId} has been marked as resolved.`);
            } catch {
              Alert.alert('Error', 'Failed to update card status. Please try again.');
            } finally {
              setResolvingId(null);
            }
          },
        },
      ]
    );
  };

  const criticalCount = stuckCards.filter(c => c.severity === 'critical').length;
  const warningCount = stuckCards.filter(c => c.severity === 'warning').length;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.backgroundSecondary }]} edges={['top']}>
      {/* Header — single back button, no double routing */}
      <View style={[styles.header, { backgroundColor: palette.background, borderBottomColor: palette.border }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: isDark ? '#1e293b' : '#F3F4F6' }]}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={20} color={palette.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.title, { color: palette.text }]}>Stuck Cards</Text>
          <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
            In-progress cards stalled &gt; 10 min
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.refreshBtn, { borderColor: palette.border }]}
          onPress={onRefresh}
        >
          <Ionicons name="refresh-outline" size={18} color={palette.primary} />
        </TouchableOpacity>
      </View>

      {loading && stuckCards.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#EF4444" />
          <Text style={[styles.loadingText, { color: palette.textSecondary }]}>
            Scanning for stuck cards…
          </Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#EF4444" />
          }
        >
          {stuckCards.length === 0 ? (
            /* ── Empty state ── */
            <View style={styles.emptyState}>
              <LinearGradient colors={['#D1FAE5', '#A7F3D0']} style={styles.emptyIconBox}>
                <Ionicons name="checkmark-circle" size={48} color="#059669" />
              </LinearGradient>
              <Text style={[styles.emptyTitle, { color: palette.text }]}>
                Production Flowing Smoothly
              </Text>
              <Text style={[styles.emptySub, { color: palette.textSecondary }]}>
                No cards have been stalled for more than 10 minutes.
              </Text>
            </View>
          ) : (
            <>
              {/* ── Summary Banner ── */}
              <LinearGradient
                colors={isDark ? ['#450a0a', '#7f1d1d'] : ['#FEF2F2', '#FEE2E2']}
                style={[styles.summaryBanner, { borderColor: isDark ? '#991b1b' : '#FECACA' }]}
              >
                <View style={styles.summaryLeft}>
                  <Ionicons name="warning" size={24} color="#EF4444" />
                  <View style={{ marginLeft: 10 }}>
                    <Text style={[styles.summaryTitle, { color: isDark ? '#fca5a5' : '#DC2626' }]}>
                      {stuckCards.length} card{stuckCards.length !== 1 ? 's' : ''} require attention
                    </Text>
                    <Text style={[styles.summarySub, { color: isDark ? '#fca5a5' : '#EF4444' }]}>
                      {criticalCount > 0 ? `${criticalCount} critical · ` : ''}{warningCount} warning
                    </Text>
                  </View>
                </View>
              </LinearGradient>

              {/* ── Card List ── */}
              {stuckCards.map((card) => {
                const isCritical = card.severity === 'critical';
                const isResolving = resolvingId === card.id;
                const displayMins = Math.min(card.minutesAtStage, 60);
                const hours = Math.floor(displayMins / 60);
                const mins = displayMins % 60;
                const durationLabel = card.minutesAtStage > 60 ? `${hours}h ${mins}m+` : `${hours > 0 ? `${hours}h ` : ''}${mins}m`;

                return (
                  <View
                    key={card.id}
                    style={[
                      styles.card,
                      {
                        backgroundColor: palette.background,
                        borderColor: isCritical ? '#EF4444' : '#F59E0B',
                        borderLeftWidth: 4,
                        borderLeftColor: isCritical ? '#EF4444' : '#F59E0B',
                      },
                      shadows.sm,
                    ]}
                  >
                    {/* Card header row */}
                    <View style={styles.cardHeader}>
                      <View style={styles.cardHeaderLeft}>
                        <View style={[
                          styles.severityIcon,
                          { backgroundColor: isCritical ? '#FEE2E2' : '#FEF3C7' },
                        ]}>
                          <Ionicons
                            name={isCritical ? 'alert-circle' : 'warning'}
                            size={20}
                            color={isCritical ? '#DC2626' : '#D97706'}
                          />
                        </View>
                        <View>
                          <Text style={[styles.cardId, { color: palette.text }]}>{card.card_id}</Text>
                          <Text style={[styles.cardStage, { color: palette.textSecondary }]}>
                            Stage: {card.stage}
                          </Text>
                        </View>
                      </View>
                      <View style={[
                        styles.durationBadge,
                        { backgroundColor: isCritical ? '#FEE2E2' : '#FEF3C7' },
                      ]}>
                        <Ionicons
                          name="time-outline"
                          size={12}
                          color={isCritical ? '#DC2626' : '#D97706'}
                        />
                        <Text style={[
                          styles.durationText,
                          { color: isCritical ? '#DC2626' : '#D97706' },
                        ]}>
                          {durationLabel}
                        </Text>
                      </View>
                    </View>

                    {/* Info row */}
                    <View style={[styles.infoRow, { borderTopColor: palette.border }]}>
                      <Ionicons name="enter-outline" size={13} color={palette.textTertiary} />
                      <Text style={[styles.infoText, { color: palette.textSecondary }]}>
                        Entered stage at {new Date(card.enteredAt).toLocaleTimeString('fr-FR', {
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </Text>
                      {isCritical && (
                        <View style={styles.criticalPill}>
                          <Text style={styles.criticalPillText}>CRITICAL</Text>
                        </View>
                      )}
                    </View>

                    {/* Action buttons */}
                    <View style={styles.actions}>
                      <TouchableOpacity
                        style={[styles.resolveBtn, { opacity: isResolving ? 0.6 : 1 }]}
                        onPress={() => handleResolve(card.card_id, card.id)}
                        disabled={isResolving}
                        activeOpacity={0.8}
                      >
                        {isResolving ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                            <Text style={styles.resolveBtnText}>Resolve</Text>
                          </>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.detailsBtn, { borderColor: palette.border, backgroundColor: palette.backgroundSecondary }]}
                        onPress={() => router.push(`/card/${card.card_id}` as never)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="open-outline" size={16} color={palette.text} />
                        <Text style={[styles.detailsBtnText, { color: palette.text }]}>Details</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...typography.bodyBold, fontSize: 18 },
  subtitle: { ...typography.tiny, marginTop: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { ...typography.small },
  scrollContent: { padding: spacing.md, gap: spacing.md, paddingBottom: 40 },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 16 },
  emptyIconBox: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { ...typography.h4, textAlign: 'center' },
  emptySub: { ...typography.small, textAlign: 'center', maxWidth: 280 },
  summaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: 4,
  },
  summaryLeft: { flexDirection: 'row', alignItems: 'center' },
  summaryTitle: { ...typography.bodyBold, fontSize: 15 },
  summarySub: { ...typography.tiny, marginTop: 2 },
  card: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    padding: spacing.md,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  severityIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardId: { ...typography.bodyBold, fontSize: 15 },
  cardStage: { ...typography.tiny, marginTop: 1 },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
  },
  durationText: { ...typography.tiny, fontWeight: '800' },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: 1,
    paddingTop: 10,
    marginBottom: 12,
  },
  infoText: { ...typography.tiny, flex: 1 },
  criticalPill: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  criticalPillText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  actions: { flexDirection: 'row', gap: 8 },
  resolveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EF4444',
    paddingVertical: 10,
    borderRadius: borderRadius.md,
  },
  resolveBtnText: { ...typography.small, color: '#fff', fontWeight: '700' },
  detailsBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  detailsBtnText: { ...typography.small, fontWeight: '700' },
});
