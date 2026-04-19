import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { borderRadius, shadows, spacing, typography } from '@/constants/design';
import { useTheme } from '@/components/ThemeProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { getPiStatus } from '@/lib/api';
import { SystemNode } from '@/types/production';
import { useRoleGuard } from '@/hooks/useRoleGuard';

const SUCCESS_COLOR = '#10B981';
const ERROR_COLOR = '#EF4444';

function isOnline(node: SystemNode | null | undefined) {
  if (!node?.last_seen) return false;
  return node.status === 'online' && Date.now() - new Date(node.last_seen).getTime() <= 2 * 60 * 1000;
}

function formatDateTime(value: string, language: string) {
  const locale = language === 'ar' ? 'ar-SA' : language === 'fr' ? 'fr-FR' : 'en-US';
  const date = new Date(value);
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

function InfoRow({
  label,
  value,
  palette,
}: {
  label: string;
  value: string;
  palette: any;
}) {
  return (
    <View style={[styles.infoRow, { borderBottomColor: palette.border }]}>
      <Text style={[styles.infoLabel, { color: palette.textSecondary }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: palette.text }]}>{value}</Text>
    </View>
  );
}

export default function SystemStatusScreen() {
  useRoleGuard(['admin']);
  const { t, language } = useTranslation();
  const { palette } = useTheme();

  const piQuery = useQuery({
    queryKey: ['production', 'system-status', 'pi'],
    queryFn: getPiStatus,
  });

  const node = piQuery.data;
  const online = isOnline(node);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.backgroundSecondary }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: palette.background, borderBottomColor: palette.border }]}>
        <TouchableOpacity activeOpacity={0.8} onPress={() => router.back()} style={styles.headerBack}>
          <Ionicons name="arrow-back" size={22} color={palette.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: palette.text }]}>{t('systemStatusTitle')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={piQuery.isFetching} onRefresh={piQuery.refetch} tintColor={palette.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.statusCircle,
            {
              backgroundColor: (online ? SUCCESS_COLOR : ERROR_COLOR) + '12',
              borderColor: online ? SUCCESS_COLOR : ERROR_COLOR,
            },
          ]}
        >
          <Text style={[styles.statusCircleText, { color: online ? SUCCESS_COLOR : ERROR_COLOR }]}>
            {online ? t('systemOnline') : t('systemOffline')}
          </Text>
        </View>

        {node ? (
          <View style={[styles.infoCard, { backgroundColor: palette.background, borderColor: palette.border }]}>
            <InfoRow
              label={t('lastConnectionLabel')}
              value={formatDateTime(node.last_seen, language)}
              palette={palette}
            />
            <InfoRow
              label={t('ipAddressLabel')}
              value={node.ip_address || node.ip || t('unavailable')}
              palette={palette}
            />
            <InfoRow label={t('systemTypeLabel')} value={node.type || 'raspberry_pi'} palette={palette} />
            <InfoRow label={t('activeSensorsLabel')} value="3" palette={palette} />
          </View>
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: palette.background, borderColor: palette.border }]}>
            <Ionicons name="information-circle-outline" size={32} color={palette.textTertiary} />
            <Text style={[styles.emptyTitle, { color: palette.text }]}>{t('piScriptNotStartedTitle')}</Text>
            <Text style={[styles.emptyMessage, { color: palette.textSecondary }]}>{t('piScriptNotStartedMessage')}</Text>
          </View>
        )}

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => piQuery.refetch()}
          style={[styles.refreshButton, { backgroundColor: palette.primary }]}
        >
          <Text style={styles.refreshButtonText}>{t('refreshStatus')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  headerBack: {
    width: 40,
  },
  headerTitle: {
    ...typography.h4,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  statusCircle: {
    width: 210,
    height: 210,
    borderRadius: 105,
    borderWidth: 10,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  statusCircleText: {
    ...typography.h2,
    textAlign: 'center',
  },
  infoCard: {
    borderWidth: 1,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    ...shadows.sm,
  },
  infoRow: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  infoLabel: {
    ...typography.captionBold,
    marginBottom: 4,
  },
  infoValue: {
    ...typography.body,
    fontWeight: '600',
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.sm,
  },
  emptyTitle: {
    ...typography.h4,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  emptyMessage: {
    ...typography.body,
    textAlign: 'center',
  },
  refreshButton: {
    minHeight: 56,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  refreshButtonText: {
    ...typography.bodyBold,
    color: '#FFFFFF',
  },
});
