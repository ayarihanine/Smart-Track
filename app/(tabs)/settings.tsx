import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { borderRadius, shadows, spacing, typography } from '@/constants/design';
import { useTheme } from '@/components/ThemeProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuthStore } from '@/store/authStore';

const ROLE_STYLES = {
  admin: { color: '#8B5CF6', icon: 'shield-checkmark' },
  supervisor: { color: '#2563EB', icon: 'eye' },
  operator: { color: '#10B981', icon: 'construct' },
} as const;

function SectionTitle({ title, palette }: { title: string; palette: any }) {
  return <Text style={[styles.sectionTitle, { color: palette.textSecondary }]}>{title}</Text>;
}

function SettingsLink({
  icon,
  label,
  onPress,
  palette,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  palette: any;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[styles.linkRow, { backgroundColor: palette.background, borderColor: palette.border }]}
    >
      <View style={[styles.linkIconWrap, { backgroundColor: palette.primary + '12' }]}>
        <Ionicons name={icon} size={18} color={palette.primary} />
      </View>
      <Text style={[styles.linkLabel, { color: palette.text }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={palette.textTertiary} />
    </TouchableOpacity>
  );
}

export default function SettingsTabScreen() {
  const { user, signOut } = useAuthStore();
  const { t } = useTranslation();
  const { palette } = useTheme();

  const role = user?.role || 'operator';
  const roleStyle = ROLE_STYLES[role];
  const roleLabel =
    role === 'admin' ? t('roleAdmin') : role === 'supervisor' ? t('roleSupervisor') : t('roleOperator');

  const confirmSignOut = () => {
    Alert.alert(t('signOut'), t('confirmSignOut'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('signOut'),
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/auth');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.backgroundSecondary }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.profileCard, { backgroundColor: palette.background, borderColor: palette.border }]}>
          <View style={[styles.avatar, { backgroundColor: roleStyle.color }]}>
            <Text style={styles.avatarText}>{user?.displayName?.[0]?.toUpperCase() || 'U'}</Text>
          </View>

          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: palette.text }]}>{user?.displayName || t('unknownUser')}</Text>
            <Text style={[styles.profileEmail, { color: palette.textSecondary }]}>{user?.email || t('unavailable')}</Text>
            <View style={[styles.roleBadge, { backgroundColor: roleStyle.color + '12', borderColor: roleStyle.color + '28' }]}>
              <Ionicons name={roleStyle.icon} size={13} color={roleStyle.color} />
              <Text style={[styles.roleBadgeText, { color: roleStyle.color }]}>{roleLabel}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <SectionTitle title={t('productionSection')} palette={palette} />
          <SettingsLink icon="stats-chart" label={t('statisticsTab')} onPress={() => router.push('/(tabs)/statistiques')} palette={palette} />
          <SettingsLink icon="warning" label={t('lossesTab')} onPress={() => router.push('/(tabs)/pertes')} palette={palette} />
          <SettingsLink icon="hardware-chip" label={t('systemStatusTitle')} onPress={() => router.push('/system-status')} palette={palette} />
        </View>

        {role !== 'operator' ? (
          <View style={styles.section}>
            <SectionTitle title={t('administrationSection')} palette={palette} />
            <SettingsLink icon="options" label={t('configurationTitle')} onPress={() => router.push('/configuration')} palette={palette} />
            <SettingsLink icon="layers" label={t('articlesTitle')} onPress={() => router.push('/articles')} palette={palette} />
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionTitle title={t('accountSection')} palette={palette} />
          <SettingsLink icon="log-out-outline" label={t('signOut')} onPress={confirmSignOut} palette={palette} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  profileCard: {
    borderWidth: 1,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.sm,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    ...typography.h4,
    color: '#FFFFFF',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    ...typography.h4,
    marginBottom: 2,
  },
  profileEmail: {
    ...typography.small,
    marginBottom: spacing.sm,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: borderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  roleBadgeText: {
    ...typography.tiny,
    fontWeight: '700',
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.tiny,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  linkRow: {
    borderWidth: 1,
    borderRadius: borderRadius.xl,
    minHeight: 58,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.xs,
  },
  linkIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  linkLabel: {
    ...typography.bodyBold,
    flex: 1,
  },
});
