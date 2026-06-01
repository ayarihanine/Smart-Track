import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/design';
import { getSupabaseClient } from '@/lib/supabase';
import { fetchAlerts, markAlertRead } from '@/lib/api';
import { Alert as DbAlert } from '@/types';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/components/ThemeProvider';

const SEVERITY = {
  low: { color: '#2563EB', bg: '#DBEAFE', icon: 'information-circle' },
  medium: { color: '#EA580C', bg: '#FFEDD5', icon: 'warning' },
  high: { color: '#DC2626', bg: '#FEE2E2', icon: 'alert-circle' },
};

const cleanText = (text: string | null | undefined) => {
  if (!text) return '';
  return text.replace(/\b(tres|trg|trs)\b/gi, (match) => match.toLowerCase() === 'trg' ? 'OOE' : 'OEE');
};

export default function AlertsScreen() {
  const { t } = useTranslation();
  const { palette, isDark } = useTheme();
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
    <SafeAreaView style={[styles.container, { backgroundColor: palette.backgroundSecondary }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: palette.background, borderBottomColor: palette.border }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: isDark ? '#1e293b' : '#F3F4F6' }]}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={20} color={palette.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.title, { color: palette.text }]}>{t('alertDashboard' as any) || 'Alerts'}</Text>
          <Text style={[styles.subtitle, { color: palette.textSecondary }]}>{unreadCount > 0 ? `${unreadCount} unread` : 'No unread alerts'}</Text>
        </View>
        {unreadCount > 0 ? <View style={[styles.badge, { backgroundColor: colors.error }]}><Text style={styles.badgeText}>{unreadCount}</Text></View> : null}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />}
        >
          {alerts.map((alert) => {
            const style = SEVERITY[alert.severity] || SEVERITY.low;
            const cardBg = isDark ? '#1f2937' : style.bg;
            return (
              <TouchableOpacity
                key={alert.id}
                style={[styles.alertCard, { borderLeftColor: style.color, backgroundColor: cardBg, borderColor: isDark ? 'transparent' : style.color + '30' }, !alert.is_read && styles.unreadCard]}
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
                    <Text style={styles.alertTitle}>{cleanText(alert.title)}</Text>
                  </View>
                  {alert.message ? <Text style={styles.description}>{cleanText(alert.message)}</Text> : null}
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
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { ...typography.h4, fontWeight: '800' },
  subtitle: { ...typography.tiny, marginTop: 2 },
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
