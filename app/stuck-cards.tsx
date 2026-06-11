import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/components/ThemeProvider';
import { useStuckCards } from '@/hooks/useStuckCards';
import { borderRadius, shadows, spacing, typography } from '@/constants/design';

export default function StuckCardsScreen() {
  const { palette, isDark } = useTheme();
  const { stuckCards, loading, refetch } = useStuckCards(10);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
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
          <Ionicons name="time-outline" size={40} color="#EF4444" />
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
                colors={isDark ? ['#ef444412', '#0f172a'] : ['#FEF2F2', '#FFFFFF']}
                style={[styles.summaryBanner, { borderColor: isDark ? '#ef444430' : '#FEE2E2', borderWidth: 1 }]}
              >
                <View style={styles.summaryLeft}>
                  <View style={[styles.summaryIconBox, { backgroundColor: isDark ? '#ef444422' : '#FEE2E2' }]}>
                    <Ionicons name="alert-circle" size={22} color="#EF4444" />
                  </View>
                  <View style={{ marginLeft: 12 }}>
                    <Text style={[styles.summaryTitle, { color: palette.text }]}>
                      {stuckCards.length} Stalled Card{stuckCards.length !== 1 ? 's' : ''}
                    </Text>
                    <Text style={[styles.summarySub, { color: palette.textSecondary }]}>
                      {criticalCount > 0 ? `${criticalCount} critical alert${criticalCount !== 1 ? 's' : ''} • ` : ''}{warningCount} warning{warningCount !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
              </LinearGradient>

              {/* ── Card List ── */}
              {stuckCards.map((card) => {
                const isCritical = card.severity === 'critical';

                return (
                  <View
                    key={card.id}
                    style={[
                      styles.stuckCard,
                      {
                        backgroundColor: palette.background,
                        borderColor: isCritical ? '#EF444430' : '#F59E0B30',
                      },
                      shadows.sm,
                    ]}
                  >
                    {/* Top Section */}
                    <View style={styles.cardHeader}>
                      <View style={[
                        styles.severityIconBox,
                        { backgroundColor: isCritical ? '#EF444412' : '#F59E0B12' }
                      ]}>
                        <Ionicons
                          name={isCritical ? 'alert-circle' : 'warning-outline'}
                          size={22}
                          color={isCritical ? '#EF4444' : '#F59E0B'}
                        />
                      </View>

                      <View style={{ flex: 1, marginLeft: 12, marginRight: 8 }}>
                        <Text style={[styles.cardIdText, { color: palette.text }]} numberOfLines={1} ellipsizeMode="tail">
                          {card.card_id}
                        </Text>
                        {card.stage && card.stage !== 'Unknown' && (
                          <Text style={[styles.stageText, { color: palette.textSecondary }]}>
                            Stage: {card.stage}
                          </Text>
                        )}
                      </View>

                      {isCritical && (
                        <View style={styles.criticalBadge}>
                          <Text style={styles.criticalBadgeText}>CRITICAL</Text>
                        </View>
                      )}
                    </View>

                    {/* Divider Line */}
                    <View style={[styles.divider, { backgroundColor: palette.border }]} />

                    {/* Action Button: Details */}
                    <TouchableOpacity
                      style={[styles.detailsBtn, { backgroundColor: palette.backgroundSecondary, borderColor: palette.border }]}
                      onPress={() => router.push(`/card/${card.card_id}` as never)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="eye-outline" size={16} color={palette.text} style={{ marginRight: 6 }} />
                      <Text style={[styles.detailsBtnText, { color: palette.text }]}>Details</Text>
                    </TouchableOpacity>
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
    borderRadius: borderRadius.xl,
    marginBottom: spacing.sm,
  },
  summaryLeft: { flexDirection: 'row', alignItems: 'center' },
  summaryIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTitle: { ...typography.bodyBold, fontSize: 16 },
  summarySub: { ...typography.tiny, marginTop: 2 },
  stuckCard: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  severityIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIdText: {
    ...typography.bodyBold,
    fontSize: 16,
  },
  stageText: {
    ...typography.tiny,
    marginTop: 2,
  },
  criticalBadge: {
    backgroundColor: '#EF444412',
    borderColor: '#EF444430',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  criticalBadgeText: {
    color: '#EF4444',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    marginVertical: spacing.md,
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  detailsBtnText: {
    ...typography.small,
    fontWeight: '700',
  },
});
