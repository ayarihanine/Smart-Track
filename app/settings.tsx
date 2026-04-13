import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Switch, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, spacing, typography, borderRadius, shadows, ACCENT_COLORS } from '@/constants/design';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/components/ThemeProvider';
import { useSettingsStore } from '@/store/settingsStore';
import { useAuthStore } from '@/store/authStore';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { palette, theme, setTheme } = useTheme();
  const { user } = useAuthStore();

  const setSettings = useSettingsStore(state => state.setSettings);
  const setStuckCardThreshold = useSettingsStore(state => state.setStuckCardThreshold);
  const notificationsEnabled = useSettingsStore(state => state.notificationsEnabled);
  const themeValue = useSettingsStore(state => state.theme);
  const vibrationEnabled = useSettingsStore(state => state.vibrationEnabled);
  const offlineModeEnabled = useSettingsStore(state => state.offlineModeEnabled);
  const stuckCardThresholdHours = useSettingsStore(state => state.stuckCardThresholdHours);

  const toggleSwitch = async (key: string, value: boolean) => {
    if (typeof setSettings === 'function') {
      try {
        await setSettings({ [key]: value });
      } catch (err) {
        console.error(`Failed to update ${key}:`, err);
      }
    }
  };


  const handleThemeChange = async (val: 'light' | 'dark' | 'auto') => {
    if (typeof setSettings === 'function') {
      await setSettings({ theme: val });
    }
  };

  const handleThresholdChange = (delta: number) => {
    const newVal = Math.max(1, Math.min(48, stuckCardThresholdHours + delta));
    if (typeof setStuckCardThreshold === 'function') {
      setStuckCardThreshold(newVal);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.backgroundSecondary }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: palette.background, borderBottomColor: palette.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={palette.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: palette.text }]}>{t('preferences') || 'Settings'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Appearance Group */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: palette.textTertiary }]}>{t('appearance') || 'APPEARANCE'}</Text>
          <View style={[styles.group, { backgroundColor: palette.background, borderColor: palette.border }]}>
            <View style={styles.settingItem}>
              <View style={[styles.iconBox, { backgroundColor: palette.primary + '15' }]}>
                <Ionicons name="color-palette-outline" size={20} color={palette.primary} />
              </View>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, { color: palette.text }]}>{t('theme') || 'Theme'}</Text>
                <Text style={[styles.settingSub, { color: palette.textTertiary }]}>
                  {themeValue === 'auto' ? 'System' : themeValue === 'dark' ? 'Dark' : 'Light'}
                </Text>
              </View>
              <View style={styles.themeOptions}>
                {['light', 'dark', 'auto'].map((tOption) => (
                  <TouchableOpacity
                    key={tOption}
                    onPress={() => handleThemeChange(tOption as any)}
                    style={[
                      styles.themeBtn,
                      { 
                        borderColor: themeValue === tOption ? palette.primary : palette.border,
                        backgroundColor: themeValue === tOption ? palette.primary + '15' : 'transparent'
                      }
                    ]}
                  >
                    <Ionicons
                      name={tOption === 'auto' ? 'contrast-outline' : tOption === 'dark' ? 'moon-outline' : 'sunny-outline'}
                      size={16}
                      color={themeValue === tOption ? palette.primary : palette.textSecondary}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Features Group */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: palette.textTertiary }]}>{t('features') || 'SYSTEM FEATURES'}</Text>
          <View style={[styles.group, { backgroundColor: palette.background, borderColor: palette.border }]}>
            <View style={styles.settingItem}>
              <View style={[styles.iconBox, { backgroundColor: colors.success + '15' }]}>
                <Ionicons name="notifications-outline" size={20} color={colors.success} />
              </View>
              <Text style={[styles.settingLabel, { color: palette.text, flex: 1 }]}>{t('notifications') || 'Push Notifications'}</Text>
              <Switch
                value={notificationsEnabled}
                onValueChange={(v) => toggleSwitch('notificationsEnabled', v)}
                trackColor={{ false: palette.border, true: colors.success }}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: palette.border }]} />

            <View style={styles.settingItem}>
              <View style={[styles.iconBox, { backgroundColor: colors.warning + '15' }]}>
                <Ionicons name="pulse-outline" size={20} color={colors.warning} />
              </View>
              <Text style={[styles.settingLabel, { color: palette.text, flex: 1 }]}>{t('vibrationEnabled') || 'Haptic Feedback'}</Text>
              <Switch
                value={vibrationEnabled}
                onValueChange={(v) => toggleSwitch('vibrationEnabled', v)}
                trackColor={{ false: palette.border, true: colors.warning }}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: palette.border }]} />

            <View style={styles.settingItem}>
              <View style={[styles.iconBox, { backgroundColor: palette.primary + '15' }]}>
                <Ionicons name="cloud-offline-outline" size={20} color={palette.primary} />
              </View>
              <Text style={[styles.settingLabel, { color: palette.text, flex: 1 }]}>{t('offlineModeEnabled') || 'Offline Queueing'}</Text>
              <Switch
                value={offlineModeEnabled}
                onValueChange={(v) => toggleSwitch('offlineModeEnabled', v)}
                trackColor={{ false: palette.border, true: palette.primary }}
              />
            </View>
          </View>
        </View>

        {/* Supervision Group */}
        {(user?.role === 'supervisor' || user?.role === 'admin') && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: palette.textTertiary }]}>{t('supervision') || 'SUPERVISION'}</Text>
            <View style={[styles.group, { backgroundColor: palette.background, borderColor: palette.border }]}>
              <View style={styles.settingItem}>
                <View style={[styles.iconBox, { backgroundColor: colors.error + '15' }]}>
                  <Ionicons name="alert-circle-outline" size={20} color={colors.error} />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingLabel, { color: palette.text }]}>{t('stuckThreshold') || 'Stuck Card Threshold'}</Text>
                  <Text style={[styles.settingSub, { color: palette.textTertiary }]}>{t('thresholdHoursDesc') || 'Hours before card is flagged'}</Text>
                </View>
                <View style={[styles.counterRow, { backgroundColor: palette.backgroundSecondary }]}>
                  <TouchableOpacity style={[styles.counterBtn, { backgroundColor: palette.background }]} onPress={() => handleThresholdChange(-1)}>
                    <Ionicons name="remove" size={18} color={palette.text} />
                  </TouchableOpacity>
                  <Text style={[styles.counterText, { color: palette.text }]}>{stuckCardThresholdHours}h</Text>
                  <TouchableOpacity style={[styles.counterBtn, { backgroundColor: palette.background }]} onPress={() => handleThresholdChange(1)}>
                    <Ionicons name="add" size={18} color={palette.text} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
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
  scrollContent: { padding: spacing.md },
  section: { marginBottom: spacing.lg },
  sectionTitle: { ...typography.tiny, fontWeight: '800', marginBottom: spacing.sm, letterSpacing: 1, paddingLeft: 8 },
  group: { borderRadius: borderRadius.xl, borderWidth: 1, overflow: 'hidden', ...shadows.sm },
  settingItem: { flexDirection: 'row', alignItems: 'center', padding: spacing.md },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  settingInfo: { flex: 1 },
  settingLabel: { ...typography.bodyBold, fontSize: 15 },
  settingSub: { ...typography.tiny, marginTop: 2 },
  divider: { height: 1, marginHorizontal: spacing.md },
  themeOptions: { flexDirection: 'row', gap: 6 },
  themeBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  langOptions: { flexDirection: 'row', gap: 4 },
  langBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  langText: { ...typography.tiny, fontWeight: '700' },
  accentOptions: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm },
  accentBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  accentBtnActive: { borderWidth: 2, borderColor: '#FFFFFF', ...shadows.sm },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F8FAFC', borderRadius: 10, padding: 4 },
  counterBtn: { width: 32, height: 32, backgroundColor: '#FFFFFF', borderRadius: 8, alignItems: 'center', justifyContent: 'center', ...shadows.xs },
  counterText: { ...typography.bodyBold, minWidth: 24, textAlign: 'center' },
});
