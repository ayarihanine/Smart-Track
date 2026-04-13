import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAlertsStore } from '@/store/alertsStore';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/design';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/components/ThemeProvider';

const SEVERITY_STYLE = {
  warning: { bg: '#FFFBEB', border: '#FDE68A', icon: 'warning', color: '#D97706', lightBg: '#FFFBEB' },
  error: { bg: '#FEF2F2', border: '#FECACA', icon: 'alert-circle', color: '#DC2626', lightBg: '#FEF2F2' },
};

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const { palette, isDark } = useTheme();
  const { alerts, dismissAlert, clearAll } = useAlertsStore();
  const active = alerts.filter(a => !a.dismissed);

  const handleDismiss = (id: string) => {
    dismissAlert(id);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.backgroundSecondary }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: palette.background, borderBottomColor: palette.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={palette.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: palette.text }]}>{t('notifications') || 'Notifications'}</Text>
        <TouchableOpacity style={styles.clearBtn} onPress={clearAll}>
          <Text style={styles.clearBtnText}>{t('clearAll') || 'Clear All'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {active.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconContainer, { backgroundColor: palette.backgroundTertiary }]}>
              <Ionicons name="notifications-off-outline" size={48} color={palette.textTertiary} />
            </View>
            <Text style={[styles.emptyTitle, { color: palette.text }]}>{t('noNotifications') || 'No notifications yet'}</Text>
            <Text style={[styles.emptySubtitle, { color: palette.textSecondary }]}>
              {t('notificationsClear') || 'You\'re all caught up! No active alerts at this time.'}
            </Text>
          </View>
        ) : (
          active.map((alert, index) => {
            const s = (SEVERITY_STYLE as any)[alert.severity] || SEVERITY_STYLE.warning;
            const itemBg = isDark ? (alert.severity === 'error' ? '#450a0a' : '#451a03') : s.bg;
            
            return (
              <Animated.View 
                key={alert.id}
                style={[
                  styles.notificationCard, 
                  { 
                    backgroundColor: itemBg, 
                    borderColor: isDark ? 'transparent' : s.border,
                    borderLeftColor: s.color,
                    borderLeftWidth: 4 
                  }
                ]}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.iconBox, { backgroundColor: s.color + '20' }]}>
                    <Ionicons name={s.icon as any} size={20} color={s.color} />
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={[styles.cardType, { color: s.color }]}>
                      {alert.type === 'stuck_card' ? t('stuckCard') : alert.type.replace('_', ' ').toUpperCase()}
                    </Text>
                    <Text style={[styles.cardTime, { color: palette.textTertiary }]}>
                      {new Date(alert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDismiss(alert.id)} style={styles.closeBtn}>
                    <Ionicons name="close" size={18} color={isDark ? palette.textSecondary : s.color} />
                  </TouchableOpacity>
                </View>
                
                <Text style={[styles.cardMsg, { color: isDark ? '#fecaca' : s.color }]}>
                  {alert.message}
                </Text>
                
                {alert.cardId && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: s.color }]}
                    onPress={() => router.push(`/card/${alert.cardId}`)}
                  >
                    <Text style={styles.actionBtnText}>{t('viewCard')} →</Text>
                  </TouchableOpacity>
                )}
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
  headerTitle: { ...typography.bodyBold, fontSize: 18 },
  clearBtn: { paddingHorizontal: 4 },
  clearBtnText: { ...typography.small, color: colors.primary, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, gap: spacing.md },
  notificationCard: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    ...shadows.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  iconBox: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm,
  },
  cardInfo: { flex: 1 },
  cardType: { ...typography.tiny, fontWeight: '800', letterSpacing: 0.5 },
  cardTime: { ...typography.tiny, marginTop: 1 },
  closeBtn: { padding: 4 },
  cardMsg: { ...typography.body, fontWeight: '500', lineHeight: 20, marginBottom: spacing.md },
  actionBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
    ...shadows.xs,
  },
  actionBtnText: { ...typography.small, color: colors.white, fontWeight: '700' },
  emptyContainer: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 100,
  },
  emptyIconContainer: {
    width: 100, height: 100, borderRadius: 50,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: { ...typography.h3, marginBottom: spacing.xs },
  emptySubtitle: { ...typography.body, textAlign: 'center', paddingHorizontal: spacing.xl },
});
