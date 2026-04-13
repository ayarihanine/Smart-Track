import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/design';
import { getSupabaseClient } from '@/lib/supabase';
import { useTranslation } from '@/hooks/useTranslation';
import { router } from 'expo-router';

export default function AlertsScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: alerts, isLoading, isRefetching } = useQuery({
    queryKey: ['anomalies'],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      if (!supabase) return [];

      const { data, error } = await supabase
        .from('scan_events')
        .select(`
          *,
          card:card_id(card_id, product_id, current_machine)
        `)
        .in('event_type', ['blocking_anomaly', 'quality_alert'])
        .order('timestamp', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    }
  });

  const onRefresh = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['anomalies'] });
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('alertDashboard' as any) || 'n8n Alert Dashboard'}</Text>
        <Text style={styles.subtitle}>
          {t('activeAnomalies' as any) || 'Real-time production anomalies & blocking states'}
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} />
          }
        >
          {alerts?.map((alert: any) => {
            const isBlocking = alert.event_type === 'blocking_anomaly';
            const cardId = alert.card?.card_id || 'Unknown';
            
            return (
              <TouchableOpacity 
                key={alert.id} 
                style={[styles.alertCard, isBlocking && styles.blockingCard]}
                onPress={() => router.push(`/card/${cardId}`)}
              >
                <View style={styles.alertHeader}>
                  <View style={[styles.typeBadge, { backgroundColor: isBlocking ? '#FEF2F2' : '#FFFBEB' }]}>
                    <Ionicons 
                      name={isBlocking ? 'flash' : 'alert-circle'} 
                      size={14} 
                      color={isBlocking ? '#EF4444' : '#F59E0B'} 
                    />
                    <Text style={[styles.typeText, { color: isBlocking ? '#991B1B' : '#92400E' }]}>
                      {isBlocking ? 'BLOCKING' : 'QUALITY ALERT'}
                    </Text>
                  </View>
                  <Text style={styles.timestamp}>
                    {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>

                <View style={styles.alertBody}>
                  <Text style={styles.cardId}>Card: <Text style={styles.cardIdValue}>{cardId}</Text></Text>
                  <Text style={styles.machine}>{alert.location || alert.stage_name || 'Station Unknown'}</Text>
                  <Text style={styles.description}>{alert.notes || 'No description provided.'}</Text>
                </View>

                <View style={styles.alertFooter}>
                  <TouchableOpacity style={styles.actionBtn}>
                    <Text style={styles.actionBtnText}>{t('investigate' as any) || 'Investigate'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, styles.dismissBtn]}>
                    <Text style={[styles.actionBtnText, styles.dismissBtnText]}>{t('dismiss' as any) || 'Dismiss'}</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}

          {!alerts?.length && (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIcon}>
                <Ionicons name="shield-checkmark" size={48} color={colors.border} />
              </View>
              <Text style={styles.emptyTitle}>{t('noAnomalies' as any) || 'System Stable'}</Text>
              <Text style={styles.emptySub}>
                {t('allOperationsNormal' as any) || 'No blocking anomalies or quality alerts detected.'}
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    ...typography.h2,
    color: colors.text,
  },
  subtitle: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 2,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  alertCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  blockingCard: {
    borderLeftColor: '#EF4444',
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  typeText: {
    ...typography.tiny,
    fontWeight: '800',
  },
  timestamp: {
    ...typography.tiny,
    color: colors.textTertiary,
  },
  alertBody: {
    gap: 4,
  },
  cardId: {
    ...typography.small,
    color: colors.textSecondary,
  },
  cardIdValue: {
    ...typography.smallBold,
    color: colors.text,
  },
  machine: {
    ...typography.bodyBold,
    color: colors.text,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    backgroundColor: colors.backgroundSecondary,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginTop: 4,
  },
  alertFooter: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionBtn: {
    flex: 1,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary + '10',
  },
  actionBtnText: {
    ...typography.smallBold,
    color: colors.primary,
  },
  dismissBtn: {
    backgroundColor: 'transparent',
  },
  dismissBtnText: {
    color: colors.textTertiary,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: spacing.sm,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.xs,
  },
  emptyTitle: {
    ...typography.h4,
    color: colors.textSecondary,
  },
  emptySub: {
    ...typography.body,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
});
