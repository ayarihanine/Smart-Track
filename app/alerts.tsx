import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/design';
import { getSupabaseClient } from '@/lib/supabase';
import { fetchAlerts, markAlertRead } from '@/lib/api';
import { Alert as DbAlert } from '@/types';
import { useTranslation } from '@/hooks/useTranslation';

const SEVERITY = {
  low: { color: '#2563EB', bg: '#DBEAFE', icon: 'information-circle' },
  medium: { color: '#EA580C', bg: '#FFEDD5', icon: 'warning' },
  high: { color: '#DC2626', bg: '#FEE2E2', icon: 'alert-circle' },
};

export default function AlertsScreen() {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState<DbAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const unreadCount = alerts.filter(alert => !alert.is_read).length;

  const loadAlerts = useCallback(async () => {
    const rows = await fetchAlerts();
    setAlerts(rows as DbAlert[]);
  }, []);

  useEffect(() => {
    loadAlerts().finally(() => setLoading(false));
  }, [loadAlerts]);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const channel = supabase
      .channel('alerts_screen')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alerts' },
        (payload) => {
          setAlerts(current => [payload.new as DbAlert, ...current]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAlerts();
    setRefreshing(false);
  }, [loadAlerts]);

  const onMarkRead = async (alertId: string) => {
    await markAlertRead(alertId);
    setAlerts(current => current.map(alert => (
      alert.id === alertId ? { ...alert, is_read: true } : alert
    )));
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t('alertDashboard' as any) || 'Alerts'}</Text>
          <Text style={styles.subtitle}>{unreadCount > 0 ? `${unreadCount} unread` : 'No unread alerts'}</Text>
        </View>
        {unreadCount > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount}</Text></View> : null}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {alerts.map((alert) => {
            const style = SEVERITY[alert.severity] || SEVERITY.low;
            return (
              <TouchableOpacity
                key={alert.id}
                style={[styles.alertCard, { borderLeftColor: style.color }, !alert.is_read && styles.unreadCard]}
                onPress={() => onMarkRead(alert.id)}
                activeOpacity={0.85}
              >
                <View style={styles.alertHeader}>
                  <View style={[styles.typeBadge, { backgroundColor: style.bg }]}>
                    <Ionicons name={style.icon as any} size={14} color={style.color} />
                    <Text style={[styles.typeText, { color: style.color }]}>{alert.severity.toUpperCase()}</Text>
                  </View>
                  <Text style={styles.timestamp}>
                    {new Date(alert.created_at).toLocaleString()}
                  </Text>
                </View>

                <View style={styles.alertBody}>
                  <View style={styles.titleRow}>
                    {!alert.is_read ? <View style={styles.unreadDot} /> : null}
                    <Text style={styles.alertTitle}>{alert.title}</Text>
                  </View>
                  {alert.message ? <Text style={styles.description}>{alert.message}</Text> : null}
                </View>

                {!alert.is_read ? (
                  <Text style={[styles.markRead, { color: style.color }]}>Mark read</Text>
                ) : null}
              </TouchableOpacity>
            );
          })}

          {alerts.length === 0 && (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIcon}>
                <Ionicons name="notifications-off-outline" size={48} color={colors.border} />
              </View>
              <Text style={styles.emptyTitle}>No alerts</Text>
              <Text style={styles.emptySub}>No alert notifications have been recorded yet.</Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSecondary },
  header: {
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { ...typography.h2, color: colors.text },
  subtitle: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
  badge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  badgeText: { color: colors.white, fontWeight: '800' },
  scrollContent: { padding: spacing.lg, gap: spacing.md },
  alertCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
    borderLeftWidth: 4,
  },
  unreadCard: { borderWidth: 1, borderColor: colors.primary + '30' },
  alertHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: borderRadius.full },
  typeText: { ...typography.tiny, fontWeight: '800' },
  timestamp: { ...typography.tiny, color: colors.textTertiary },
  alertBody: { gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  alertTitle: { ...typography.bodyBold, color: colors.text, flex: 1 },
  description: { ...typography.body, color: colors.textSecondary, backgroundColor: colors.backgroundSecondary, padding: spacing.sm, borderRadius: borderRadius.md, marginTop: 4 },
  markRead: { ...typography.smallBold, marginTop: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: spacing.sm },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', ...shadows.xs },
  emptyTitle: { ...typography.h4, color: colors.textSecondary },
  emptySub: { ...typography.body, color: colors.textTertiary, textAlign: 'center', paddingHorizontal: spacing.xl },
});
