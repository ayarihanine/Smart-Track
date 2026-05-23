import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { spacing, typography, borderRadius, shadows } from '@/constants/design';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/components/ThemeProvider';
import { fetchAlerts, markAlertRead } from '@/lib/api';
import { getSupabaseClient } from '@/lib/supabase';
import { Alert as DbAlert } from '@/types';

const SEVERITY_STYLE = {
  low: { bg: '#DBEAFE', border: '#BFDBFE', icon: 'information-circle', color: '#2563EB' },
  medium: { bg: '#FFFBEB', border: '#FDE68A', icon: 'warning', color: '#D97706' },
  high: { bg: '#FEF2F2', border: '#FECACA', icon: 'alert-circle', color: '#DC2626' },
};

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const { palette, isDark } = useTheme();
  const [alerts, setAlerts] = useState<DbAlert[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const active = alerts;
  const unreadCount = alerts.filter(alert => !alert.is_read).length;

  const loadAlerts = useCallback(async () => {
    const rows = await fetchAlerts();
    setAlerts(rows as DbAlert[]);
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const channel = supabase
      .channel('notifications_alerts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alerts' },
        (payload) => setAlerts(current => [payload.new as DbAlert, ...current])
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleDismiss = async (id: string) => {
    await markAlertRead(id);
    setAlerts(current => current.map(alert => (
      alert.id === id ? { ...alert, is_read: true } : alert
    )));
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAlerts();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.backgroundSecondary }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: palette.background, borderBottomColor: palette.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={palette.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: palette.text }]}>{t('notifications') || 'Notifications'}</Text>
          {unreadCount > 0 ? <Text style={[styles.headerSub, { color: palette.textSecondary }]}>{unreadCount} unread</Text> : null}
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />}
      >
        {active.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconContainer, { backgroundColor: palette.backgroundTertiary }]}>
              <Ionicons name="notifications-off-outline" size={48} color={palette.textTertiary} />
            </View>
            <Text style={[styles.emptyTitle, { color: palette.text }]}>No alerts</Text>
            <Text style={[styles.emptySubtitle, { color: palette.textSecondary }]}>
              No alert notifications have been recorded yet.
            </Text>
          </View>
        ) : (
          active.map((alert) => {
            const s = SEVERITY_STYLE[alert.severity] || SEVERITY_STYLE.low;
            const itemBg = isDark ? '#1f2937' : s.bg;
            
            return (
              <Animated.View 
                key={alert.id}
                style={[
                  styles.notificationCard, 
                  { 
                    backgroundColor: itemBg, 
                    borderColor: isDark ? 'transparent' : s.border,
                    borderLeftColor: s.color,
                    borderLeftWidth: 4,
                    opacity: alert.is_read ? 0.72 : 1,
                  }
                ]}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.iconBox, { backgroundColor: s.color + '20' }]}>
                    <Ionicons name={s.icon as any} size={20} color={s.color} />
                  </View>
                  <View style={styles.cardInfo}>
                    <View style={styles.cardTitleRow}>
                      {!alert.is_read ? <View style={[styles.unreadDot, { backgroundColor: s.color }]} /> : null}
                      <Text style={[styles.cardType, { color: s.color }]}>
                        {alert.title}
                      </Text>
                    </View>
                    <Text style={[styles.cardTime, { color: palette.textTertiary }]}>
                      {new Date(alert.created_at).toLocaleString()}
                    </Text>
                  </View>
                  {!alert.is_read ? (
                    <TouchableOpacity onPress={() => handleDismiss(alert.id)} style={styles.closeBtn}>
                      <Ionicons name="checkmark" size={18} color={isDark ? palette.textSecondary : s.color} />
                    </TouchableOpacity>
                  ) : null}
                </View>
                
                {alert.message ? (
                  <Text style={[styles.cardMsg, { color: isDark ? palette.text : s.color }]}>
                    {alert.message}
                  </Text>
                ) : null}
              </Animated.View>
            );
          })
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
  headerCenter: { alignItems: 'center' },
  headerTitle: { ...typography.bodyBold, fontSize: 18 },
  headerSub: { ...typography.tiny, marginTop: 2 },
  headerSpacer: { width: 32 },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, gap: spacing.md },
  notificationCard: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    ...shadows.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  iconBox: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  cardInfo: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  cardType: { ...typography.tiny, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', flex: 1 },
  cardTime: { ...typography.tiny, marginTop: 1 },
  closeBtn: { padding: 4 },
  cardMsg: { ...typography.body, fontWeight: '500', lineHeight: 20 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 100 },
  emptyIconContainer: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  emptyTitle: { ...typography.h3, marginBottom: spacing.xs },
  emptySubtitle: { ...typography.body, textAlign: 'center', paddingHorizontal: spacing.xl },
});
