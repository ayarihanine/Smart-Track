import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  RefreshControl, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/design';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/components/ThemeProvider';
import { getCards, alertTestingTeam } from '@/lib/api';
import { useSettingsStore } from '@/store/settingsStore';
import { ElectronicCard } from '@/types';

export default function StuckCardsScreen() {
  const { t } = useTranslation();
  const { palette, isDark } = useTheme();
  const stuckThreshold = useSettingsStore(s => s.stuckCardThresholdHours);
  const [alertingId, setAlertingId] = useState<string | null>(null);

  const { data: cards, isLoading, refetch } = useQuery({
    queryKey: ['cards', 'stuck'],
    queryFn: () => getCards(),
  });

  const thresholdMs = Math.max(0.1, stuckThreshold) * 60 * 60 * 1000;
  const stuckCards = (cards || []).filter(c => 
    c.status !== 'completed' && (Date.now() - new Date(c.updatedAt).getTime()) > thresholdMs
  ).sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());

  const handleAlertTesting = async (card: ElectronicCard) => {
    setAlertingId(card.cardId);
    const ok = await alertTestingTeam(card.cardId, card.currentStage);
    setAlertingId(null);
    if (ok) {
      Alert.alert(t('success'), t('alertSent'));
    } else {
      Alert.alert(t('error'), "Failed to send alert.");
    }
  };

  const getStuckDuration = (updatedAt: string) => {
    const diff = Date.now() - new Date(updatedAt).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    return t('stuckDuration').replace('{{hours}}', hours.toString());
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.backgroundSecondary }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: palette.background, borderBottomColor: palette.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={palette.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: palette.text }]}>{t('stuckCardsTitle')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        style={styles.scroll} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
      >
        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : stuckCards.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconContainer, { backgroundColor: palette.backgroundTertiary }]}>
              <Ionicons name="checkmark-circle-outline" size={64} color={colors.success} />
            </View>
            <Text style={[styles.emptyTitle, { color: palette.text }]}>All Clear!</Text>
            <Text style={[styles.emptySubtitle, { color: palette.textSecondary }]}>
              No cards are currently stuck beyond the {stuckThreshold}h threshold.
            </Text>
          </View>
        ) : (
          stuckCards.map((card, index) => (
            <Animated.View 
              key={card.id} 
              entering={FadeInDown.delay(index * 100)}
              style={[styles.card, { backgroundColor: palette.background, borderColor: palette.border }]}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.cardIdBadge, { backgroundColor: colors.primary + '15' }]}>
                  <Text style={[styles.cardIdText, { color: colors.primary }]}>{card.cardId}</Text>
                </View>
                <View style={[styles.stuckBadge, { backgroundColor: colors.error + '15' }]}>
                  <Ionicons name="alert-circle" size={14} color={colors.error} />
                  <Text style={[styles.stuckBadgeText, { color: colors.error }]}>
                    {getStuckDuration(card.updatedAt)}
                  </Text>
                </View>
              </View>

              <Text style={[styles.productName, { color: palette.text }]}>{card.productName || t('unknownProduct')}</Text>
              
              <View style={styles.infoRow}>
                <Ionicons name="git-network-outline" size={16} color={palette.textSecondary} />
                <Text style={[styles.infoText, { color: palette.textSecondary }]}>
                  {t('currentStage')}: <Text style={{ color: palette.text, fontWeight: '600' }}>{card.currentStage}</Text>
                </Text>
              </View>

              <View style={[styles.reasonBox, { backgroundColor: palette.backgroundSecondary, borderColor: palette.border }]}>
                <View style={styles.reasonHeader}>
                  <Ionicons name="help-circle-outline" size={16} color={colors.warning} />
                  <Text style={[styles.reasonTitle, { color: colors.warning }]}>{t('stuckReason')}</Text>
                </View>
                <Text style={[styles.reasonText, { color: palette.text }]}>
                  {card.qualityIssues || card.missingItems || t('noReasonReported')}
                </Text>
              </View>

              <TouchableOpacity 
                style={[styles.alertBtn, { backgroundColor: colors.primary }]}
                onPress={() => handleAlertTesting(card)}
                disabled={alertingId === card.cardId}
              >
                {alertingId === card.cardId ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <>
                    <Ionicons name="megaphone-outline" size={18} color={colors.white} />
                    <Text style={styles.alertBtnText}>{t('alertTestingTeam')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  headerTitle: { ...typography.h4, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xl },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 400 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', minHeight: 400, padding: spacing.xl },
  emptyIconContainer: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  emptyTitle: { ...typography.h3, marginBottom: spacing.sm },
  emptySubtitle: { ...typography.body, textAlign: 'center', opacity: 0.7 },
  card: {
    borderRadius: borderRadius.xl, padding: spacing.lg, marginBottom: spacing.md,
    borderWidth: 1, ...shadows.sm,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  cardIdBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.md },
  cardIdText: { ...typography.smallBold },
  stuckBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.md },
  stuckBadgeText: { ...typography.tiny, fontWeight: '700' },
  productName: { ...typography.h4, marginBottom: spacing.sm },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md },
  infoText: { ...typography.caption },
  reasonBox: { padding: spacing.md, borderRadius: borderRadius.lg, borderWidth: 1, marginBottom: spacing.lg },
  reasonHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  reasonTitle: { ...typography.tiny, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  reasonText: { ...typography.caption, lineHeight: 20 },
  alertBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 12, borderRadius: borderRadius.lg,
    ...shadows.md,
  },
  alertBtnText: { ...typography.bodyBold, color: colors.white },
});
