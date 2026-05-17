import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, TextInput, Switch, Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router } from 'expo-router';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/design';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/components/ThemeProvider';
import { testWebhook, getCards } from '@/lib/api';
import { UserRole } from '@/types';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { getSupabaseClient } from '@/lib/supabase';

const ROLE_COLORS: Record<UserRole, string> = {
  operator: '#10B981',
  supervisor: '#2563EB',
  admin: '#8B5CF6',
};

const ROLE_ICONS: Record<UserRole, string> = {
  operator: 'construct',
  supervisor: 'eye',
  admin: 'shield',
};

function SectionHeader({ title, color }: { title: string; color: string }) {
  return <Text style={[styles.sectionTitle, { color }]}>{title}</Text>;
}

function SettingRow({
  icon, label, value, onPress, rightElement, color, textColor, palette,
}: {
  icon: string; label: string; value?: string;
  onPress?: () => void; rightElement?: React.ReactNode; color?: string; textColor: string; palette: any;
}) {
  return (
    <TouchableOpacity
      style={styles.settingRow}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[styles.settingIcon, { backgroundColor: (color || palette.primary) + '15' }]}>
        <Ionicons name={icon as any} size={20} color={color || palette.primary} />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingLabel, { color: textColor }]}>{label}</Text>
        {value && <Text style={styles.settingValue}>{value}</Text>}
      </View>
      {rightElement || (onPress && (
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      ))}
    </TouchableOpacity>
  );
}

function RoleToolItem({
  icon, color, label, desc, onPress, palette, loading
}: {
  icon: string; color: string; label: string; desc: string;
  onPress: () => void; palette: any; loading?: boolean;
}) {
  return (
    <TouchableOpacity 
      style={[styles.roleToolRow, loading && { opacity: 0.6 }]} 
      onPress={onPress} 
      activeOpacity={0.7}
      disabled={loading}
    >
      <View style={[styles.roleToolIcon, { backgroundColor: color + '18' }]}>
        {loading ? (
          <ActivityIndicator size="small" color={color} />
        ) : (
          <Ionicons name={icon as any} size={22} color={color} />
        )}
      </View>
      <View style={styles.roleToolContent}>
        <Text style={[styles.roleToolLabel, { color: palette.text }]}>{label}</Text>
        <Text style={[styles.roleToolDesc, { color: palette.textSecondary }]} numberOfLines={1}>{desc}</Text>
      </View>
      <View style={[styles.roleToolArrow, { backgroundColor: color + '15' }]}>
        <Ionicons name="chevron-forward" size={16} color={color} />
      </View>
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const { user, signOut } = useAuthStore();
  const settings = useSettingsStore();
  const { t } = useTranslation();
  const { palette, isDark } = useTheme();

  const [editingWebhook, setEditingWebhook] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [tempWebhook, setTempWebhook] = useState(settings.webhookUrl);
  const [tempN8n, setTempN8n] = useState(settings.n8nUrl);

  const roleColor = ROLE_COLORS[user?.role || 'operator'];
  const roleIcon = ROLE_ICONS[user?.role || 'operator'];

  async function handleSaveWebhook() {
    await settings.setSettings({ webhookUrl: tempWebhook, n8nUrl: tempN8n });
    setEditingWebhook(false);
    Alert.alert(t('success'), t('webhookUpdated'));
  }

  async function handleToggle(key: 'notificationsEnabled' | 'vibrationEnabled', val: boolean) {
    await settings.setSettings({ [key]: val });
  }

  async function handleTestWebhook() {
    if (!tempWebhook) {
      Alert.alert(t('error'), t('enterWebhookFirst'));
      return;
    }
    setTestingWebhook(true);
    const ok = await testWebhook(tempWebhook);
    setTestingWebhook(false);
    Alert.alert(ok ? t('success') : t('error'), ok ? t('connectionEstablished') : t('connectionRefused'));
  }

  async function handleImagePick() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled && result.assets[0].uri) {
      const uri = result.assets[0].uri;
      const supabase = getSupabaseClient();
      if (!supabase || !user) return;

      try {
        setTestingWebhook(true);

        const { error } = await supabase.auth.updateUser({
          data: { avatarUrl: uri }
        });

        if (error) throw error;

        await (supabase.from('profiles') as any).update({ avatar_url: uri }).eq('id', user.id);

        Alert.alert(t('success'), "Profile picture updated!");
      } catch (err: any) {
        Alert.alert(t('error'), err.message || "Failed to update profile picture");
      } finally {
        setTestingWebhook(false);
      }
    }
  }
  
  async function handleGenerateReport() {
    if (generatingReport) return;
    setGeneratingReport(true);
    try {
      const cards = await getCards();
      const now = new Date().toLocaleString();
      
      const html = `
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
            <style>
              body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; }
              .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
              .logo { font-size: 24px; font-weight: bold; color: #2563eb; }
              .report-title { font-size: 28px; margin: 0; }
              .meta { font-size: 12px; color: #666; margin-top: 5px; }
              .stats { display: flex; gap: 20px; margin-bottom: 30px; }
              .stat-box { flex: 1; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
              .stat-label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold; }
              .stat-value { font-size: 20px; font-weight: bold; color: #1e293b; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th { text-align: left; background: #f1f5f9; padding: 12px; font-size: 12px; border-bottom: 2px solid #e2e8f0; }
              td { padding: 12px; font-size: 11px; border-bottom: 1px solid #f1f5f9; }
              .status-badge { padding: 2px 8px; border-radius: 10px; font-size: 9px; font-weight: bold; text-transform: uppercase; }
              .completed { background: #dcfce7; color: #166534; }
              .in-progress { background: #dbeafe; color: #1e40af; }
              .footer { margin-top: 50px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 20px; }
            </style>
          </head>
          <body>
            <div class="header">
              <div>
                <h1 class="report-title">Production Report</h1>
                <div class="meta">Generated on ${now}</div>
              </div>
              <div class="logo">CARD-TRACK</div>
            </div>

            <div class="stats">
              <div class="stat-box">
                <div class="stat-label">Total Cards</div>
                <div class="stat-value">${cards.length}</div>
              </div>
              <div class="stat-box">
                <div class="stat-label">Completed</div>
                <div class="stat-value">${cards.filter(c => c.status === 'completed').length}</div>
              </div>
              <div class="stat-box">
                <div class="stat-label">In Progress</div>
                <div class="stat-value">${cards.filter(c => c.status === 'in_progress').length}</div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Card ID</th>
                  <th>Product</th>
                  <th>Stage</th>
                  <th>Status</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                ${cards.map(c => `
                  <tr>
                    <td><strong>${c.cardId}</strong></td>
                    <td>${c.productName || 'N/A'}</td>
                    <td>${c.currentStage || 'Unknown'}</td>
                    <td>
                      <span class="status-badge ${c.status === 'completed' ? 'completed' : 'in-progress'}">
                        ${c.status}
                      </span>
                    </td>
                    <td>${new Date(c.updatedAt).toLocaleDateString()}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="footer">
              &copy; ${new Date().getFullYear()} Card-Track Production Monitoring System. All rights reserved.
            </div>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error) {
      console.error('PDF Error:', error);
      Alert.alert(t('error'), 'Could not generate or share PDF report');
    } finally {
      setGeneratingReport(false);
    }
  }

  function handleSignOut() {
    Alert.alert(
      t('signOut'),
      t('secureSession'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('signOut'), style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/auth');
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.backgroundSecondary }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: palette.background, borderBottomColor: palette.border }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.push('/(tabs)')} style={styles.backBtnHeader}>
            <Ionicons name="arrow-back" size={24} color={palette.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: palette.text }]}>{t('profile')}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerContainer}>
          <View style={[styles.banner, { backgroundColor: roleColor + '30' }]}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: roleColor + '15' }]} />
            <View style={[styles.bannerCircle, styles.bannerCircleLg, { backgroundColor: roleColor + '20', top: -20, right: -20 }]} />
            <View style={[styles.bannerCircle, styles.bannerCircleSm, { backgroundColor: roleColor + '30', bottom: 10, left: 30 }]} />
            <Ionicons name={roleIcon as any} size={80} color={roleColor + '25'} style={styles.bannerIcon} />
          </View>

          <Animated.View
            entering={FadeInDown.duration(600).delay(150)}
            style={styles.profileCenter}
          >
            <TouchableOpacity
              style={[styles.avatarContainer, { backgroundColor: palette.background }]}
              onPress={handleImagePick}
              activeOpacity={0.9}
            >
              <View style={[styles.avatarRing, { borderColor: roleColor }]}>
                <View style={[styles.avatar, { backgroundColor: roleColor, overflow: 'hidden' }]}>
                  {user?.avatarUrl ? (
                    <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarText}>
                      {user?.displayName?.[0]?.toUpperCase() || 'U'}
                    </Text>
                  )}
                </View>
              </View>
              <View style={[styles.addBtn, { backgroundColor: palette.primary, borderColor: palette.background }]}>
                <Ionicons name="camera" size={12} color={colors.white} />
              </View>
            </TouchableOpacity>

            <Text style={[styles.profileName, { color: palette.text }]}>{user?.displayName}</Text>

            <View style={styles.emailRow}>
              <Ionicons name="mail-outline" size={13} color={palette.textSecondary} />
              <Text style={[styles.profileEmail, { color: palette.textSecondary }]}>{user?.email}</Text>
            </View>

            <View style={[styles.roleBadge, { backgroundColor: roleColor + '18', borderColor: roleColor + '50', borderWidth: 1 }]}>
              <Ionicons name={roleIcon as any} size={13} color={roleColor} />
              <Text style={[styles.roleText, { color: roleColor }]}>
                {t(user?.role as any) || user?.role?.toUpperCase()}
              </Text>
            </View>
          </Animated.View>
        </View>

        {/* ── Tools ─────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader title={t('myTools')} color={palette.textSecondary} />
          <View style={[styles.card, { backgroundColor: palette.background }]}>
            {/* All Roles */}
            <RoleToolItem
              icon="layers-outline" color="#3B82F6"
              label={t('cardsTab')} desc={t('historyDesc')}
              onPress={() => router.push('/(tabs)/history')} palette={palette}
            />
            <View style={[styles.divider, { backgroundColor: palette.border }]} />
            <RoleToolItem
              icon="bar-chart-outline" color="#2563EB"
              label={t('statisticsTab')} desc={t('statisticsDesc' as any) || 'Production statistics'}
              onPress={() => router.push('/(tabs)/statistiques')} palette={palette}
            />

            {/* Supervisor+ Tools */}
            {(user?.role === 'supervisor' || user?.role === 'admin') && <>
              <View style={[styles.divider, { backgroundColor: palette.border }]} />
              <RoleToolItem
                icon="warning-outline" color="#EF4444"
                label={t('manageStuckCards')} desc={t('manageStuckCardsDesc')}
                onPress={() => router.push('/stuck-cards' as any)} palette={palette}
              />
            </>}

            {/* Admin Tools */}
            {(user?.role === 'admin') && <>
              <View style={[styles.divider, { backgroundColor: palette.border }]} />
              <RoleToolItem
                icon="people-outline" color="#8B5CF6"
                label={t('adminPanel')} desc={t('adminPanelDesc')}
                onPress={() => router.push('/admin')} palette={palette}
              />
              <View style={[styles.divider, { backgroundColor: palette.border }]} />
              <RoleToolItem
                icon="pulse-outline" color="#EF4444"
                label={t('systemStatus')} desc="Monitor live system health"
                onPress={() => router.push('/system-status')} palette={palette}
              />
            </>}
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title={t('account')} color={palette.textSecondary} />
          <View style={[styles.card, { backgroundColor: palette.background }]}>
            <SettingRow icon="person-outline" label={t('identity')} value={user?.displayName} color="#2563EB" textColor={palette.text} palette={palette} />
            <View style={[styles.divider, { backgroundColor: palette.border }]} />
            <SettingRow icon="mail-outline" label={t('email')} value={user?.email} color="#2563EB" textColor={palette.text} palette={palette} />
            <View style={[styles.divider, { backgroundColor: palette.border }]} />
            <SettingRow
              icon="shield-checkmark-outline"
              label={t('authorization')}
              value={user?.role?.toUpperCase()}
              color={roleColor}
              textColor={palette.text}
              palette={palette}
            />
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title={t('settings')} color={palette.textSecondary} />
          <View style={[styles.card, { backgroundColor: palette.background }]}>
            <View style={styles.settingRow}>
              <View style={[styles.settingIcon, { backgroundColor: palette.primary + '15' }]}>
                <Ionicons name="color-palette-outline" size={20} color={palette.primary} />
              </View>
              <View style={styles.settingContent}>
                <Text style={[styles.settingLabel, { color: palette.text }]}>{t('theme') || 'Theme'}</Text>
                <Text style={[styles.settingValue, { color: palette.textSecondary }]}>
                  {settings.theme === 'auto' ? 'System' : settings.theme === 'dark' ? 'Dark' : 'Light'}
                </Text>
              </View>
              <View style={styles.optionsRow}>
                {['light', 'dark', 'auto'].map((tOption) => (
                  <TouchableOpacity
                    key={tOption}
                    onPress={() => settings.setSettings({ theme: tOption as any })}
                    style={[
                      styles.optionBtn,
                      { borderColor: settings.theme === tOption ? palette.primary : palette.border },
                      settings.theme === tOption && { backgroundColor: palette.primary }
                    ]}
                  >
                    <Text style={[styles.optionText, { color: palette.textSecondary }, settings.theme === tOption && styles.optionTextActive]}>
                      {tOption.charAt(0).toUpperCase() + tOption.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={[styles.divider, { backgroundColor: palette.border }]} />
            
            <View style={styles.settingRow}>
              <View style={[styles.settingIcon, { backgroundColor: colors.success + '15' }]}>
                <Ionicons name="notifications-outline" size={20} color={colors.success} />
              </View>
              <View style={styles.settingContent}>
                <Text style={[styles.settingLabel, { color: palette.text }]}>{t('notifications') || 'Push Notifications'}</Text>
              </View>
              <Switch
                value={settings.notificationsEnabled}
                onValueChange={(v) => handleToggle('notificationsEnabled', v)}
                trackColor={{ false: palette.border, true: colors.success }}
              />
            </View>
            <View style={[styles.divider, { backgroundColor: palette.border }]} />
            
            <View style={styles.settingRow}>
              <View style={[styles.settingIcon, { backgroundColor: colors.warning + '15' }]}>
                <Ionicons name="pulse-outline" size={20} color={colors.warning} />
              </View>
              <View style={styles.settingContent}>
                <Text style={[styles.settingLabel, { color: palette.text }]}>{t('vibrationEnabled') || 'Haptic Feedback'}</Text>
              </View>
              <Switch
                value={settings.vibrationEnabled}
                onValueChange={(v) => handleToggle('vibrationEnabled', v)}
                trackColor={{ false: palette.border, true: colors.warning }}
              />
            </View>
            <View style={[styles.divider, { backgroundColor: palette.border }]} />
            
            <View style={styles.settingRow}>
              <View style={[styles.settingIcon, { backgroundColor: palette.primary + '15' }]}>
                <Ionicons name="cloud-offline-outline" size={20} color={palette.primary} />
              </View>
              <View style={styles.settingContent}>
                <Text style={[styles.settingLabel, { color: palette.text }]}>{t('offlineModeEnabled') || 'Offline Queueing'}</Text>
              </View>
              <Switch
                value={settings.offlineModeEnabled}
                onValueChange={(v) => settings.setSettings({ offlineModeEnabled: v })}
                trackColor={{ false: palette.border, true: palette.primary }}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title={t('integrations')} color={palette.textSecondary} />
          <View style={[styles.card, { backgroundColor: palette.background }]}>
            <View style={styles.webhookHeader}>
              <View style={[styles.settingIcon, { backgroundColor: '#F59E0B15' }]}>
                <Ionicons name="link" size={20} color="#F59E0B" />
              </View>
              <Text style={[styles.webhookTitle, { color: palette.text }]}>{t('dataHook')}</Text>
              <TouchableOpacity onPress={() => setEditingWebhook(!editingWebhook)}>
                <Ionicons name={editingWebhook ? 'close' : 'pencil'} size={18} color={palette.primary} />
              </TouchableOpacity>
            </View>
            {editingWebhook ? (
              <View style={styles.webhookEdit}>
                <TextInput
                  style={[styles.webhookInput, { backgroundColor: palette.backgroundSecondary, color: palette.text, borderColor: palette.border }]}
                  placeholder="Primary Webhook URL"
                  placeholderTextColor={palette.textTertiary}
                  value={tempWebhook}
                   onChangeText={setTempWebhook}
                  autoCapitalize="none"
                />
                <View style={{ height: spacing.sm }} />
                <TextInput
                  style={[styles.webhookInput, { backgroundColor: palette.backgroundSecondary, color: palette.text, borderColor: palette.border }]}
                  placeholder={t('n8nUrlPlaceholder')}
                  placeholderTextColor={palette.textTertiary}
                  value={tempN8n}
                  onChangeText={setTempN8n}
                  autoCapitalize="none"
                />
                <View style={styles.webhookBtns}>
                  <TouchableOpacity
                    style={styles.webhookTestBtn}
                    onPress={handleTestWebhook}
                    disabled={testingWebhook}
                  >
                    <Ionicons name="pulse" size={16} color="#F59E0B" />
                    <Text style={styles.webhookTestText}>{testingWebhook ? t('testing') : t('test')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.webhookSaveBtn, { backgroundColor: palette.primary }]}
                    onPress={handleSaveWebhook}
                  >
                    <Text style={styles.webhookSaveText}>{t('save')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.webhookPreviewContainer}>
                <Text style={[styles.webhookPreview, { color: palette.textSecondary }]}>
                  <Text style={{ fontWeight: '600' }}>Hook: </Text>
                  {settings.webhookUrl || t('disconnected')}
                </Text>
                <Text style={[styles.webhookPreview, { color: palette.textSecondary, marginTop: 4 }]}>
                  <Text style={{ fontWeight: '600' }}>n8n: </Text>
                  {settings.n8nUrl || t('disconnected')}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.signOutBtn, { backgroundColor: isDark ? '#450a0a' : '#FEF2F2', borderColor: isDark ? '#991b1b' : '#FECACA' }]}
            onPress={handleSignOut}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            <Text style={styles.signOutText}>{t('signOut')}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  backBtnHeader: { padding: 4 },
  headerTitle: { ...typography.h3 },
  scrollContent: { paddingBottom: spacing.xl },
  headerContainer: { marginBottom: spacing.md },
  bannerCircle: {
    position: 'absolute',
    borderRadius: 999,
  },
  bannerCircleLg: {
    width: 130,
    height: 130,
  },
  bannerCircleSm: {
    width: 60,
    height: 60,
  },
  banner: {
    height: 140,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  bannerIcon: {
    position: 'absolute',
    right: -10,
    bottom: -10,
  },
  avatarContainer: {
    padding: 4,
    borderRadius: 52,
    ...shadows.md,
  },
  avatarRing: {
    padding: 3,
    borderRadius: 48,
    borderWidth: 2.5,
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  addBtn: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    ...shadows.sm,
  },
  avatarText: { ...typography.h2, color: colors.white },
  profileCenter: {
    alignItems: 'center',
    marginTop: -48,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  profileName: { fontSize: 22, fontWeight: '700', letterSpacing: 0.2 },
  profileEmail: { ...typography.caption },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md, paddingVertical: 5,
    borderRadius: borderRadius.full,
  },
  roleText: { ...typography.small, fontWeight: '700', letterSpacing: 0.5 },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  sectionTitle: { ...typography.caption, fontWeight: '700', marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: {
    borderRadius: borderRadius.xl,
    ...shadows.sm, overflow: 'hidden',
  },
  divider: { height: 1, marginLeft: 56 },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md,
  },
  settingIcon: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  settingContent: { flex: 1 },
  settingLabel: { ...typography.body, fontWeight: '500' },
  settingValue: { ...typography.small, opacity: 0.6, marginTop: 2 },
  roleToolRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md,
  },
  roleToolIcon: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  roleToolContent: { flex: 1, gap: 2 },
  roleToolLabel: { ...typography.body, fontWeight: '600' },
  roleToolDesc: { ...typography.small, opacity: 0.7 },
  roleToolArrow: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  webhookHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  webhookTitle: { ...typography.body, fontWeight: '500', flex: 1 },
  webhookEdit: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  webhookInput: {
    borderWidth: 1,
    borderRadius: borderRadius.md, paddingHorizontal: spacing.md,
    height: 44, ...typography.body,
  },
  webhookBtns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  webhookTestBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.xs, height: 40, borderRadius: borderRadius.md,
    borderWidth: 1.5, borderColor: '#F59E0B',
  },
  webhookTestText: { ...typography.captionBold, color: '#F59E0B' },
  webhookSaveBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    height: 40, borderRadius: borderRadius.md,
  },
  webhookSaveText: { ...typography.captionBold, color: colors.white },
  webhookPreviewContainer: {
    paddingHorizontal: spacing.md, paddingBottom: spacing.md,
  },
  webhookPreview: {
    ...typography.small,
  },
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: borderRadius.xl, padding: spacing.md,
    borderWidth: 1,
  },
  signOutText: { ...typography.bodyBold, color: '#EF4444' },
  optionsRow: { flexDirection: 'row', gap: spacing.xs },
  optionBtn: {
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderRadius: borderRadius.md, borderWidth: 1,
  },
  optionText: { ...typography.small },
  optionTextActive: { color: colors.white, fontWeight: '700' },
  brandingContainer: {
    alignItems: 'center',
    marginTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  logoContainer: {
    width: 80, height: 80, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.sm,
    ...shadows.md,
  },
  logoImage: { width: '100%', height: '100%', borderRadius: 20 },
  appName: { ...typography.h4, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  actionsRow: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.md,
    borderRadius: borderRadius.xl,
    ...shadows.sm,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    ...typography.caption,
    textAlign: 'center',
    fontWeight: '600',
  },
});
