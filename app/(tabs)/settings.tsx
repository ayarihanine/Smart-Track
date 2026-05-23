import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { borderRadius, shadows, spacing, typography } from '@/constants/design';
import { useTheme } from '@/components/ThemeProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { getSupabaseClient } from '@/lib/supabase';
import { getConfiguration, updateConfiguration } from '@/lib/api';

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
  const { palette, setTheme } = useTheme();
  const settings = useSettingsStore();

  const role = user?.role || 'operator';
  const roleStyle = ROLE_STYLES[role];
  const roleLabel =
    role === 'admin' ? t('roleAdmin') : role === 'supervisor' ? t('roleSupervisor') : t('roleOperator');

  const updateSetting = async (key: 'notificationsEnabled' | 'vibrationEnabled' | 'offlineModeEnabled', value: boolean) => {
    try {
      await settings.setSettings({ [key]: value });
    } catch (err) {
      console.error(`Failed to update ${key}:`, err);
      Alert.alert(t('error'), 'Failed to update setting');
    }
  };

  const handleThresholdChange = async (delta: number) => {
    const nextValue = Math.max(36, Math.min(240, settings.stuckCardThresholdHours + delta));
    await settings.setStuckCardThreshold(nextValue);
  };

  // Active Batch Local State
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [activeBatchNumber, setActiveBatchNumber] = useState<string | null>(null);
  const [activeCardRef, setActiveCardRef] = useState<string | null>(null);
  const [activeTargetQty, setActiveTargetQty] = useState<number | null>(null);

  // New Batch Input State
  const [cardReference, setCardReference] = useState('');
  const [targetQuantity, setTargetQuantity] = useState('');
  const [startingBatch, setStartingBatch] = useState(false);

  // Configuration Input State
  const [gpio1, setGpio1] = useState('');
  const [gpio2, setGpio2] = useState('');
  const [gpio3, setGpio3] = useState('');
  const [serialPort, setSerialPort] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActiveBatchAndConfig();
  }, []);

  const loadActiveBatchAndConfig = async () => {
    try {
      setLoading(true);
      // Load active batch from AsyncStorage
      const storedBatchId = await AsyncStorage.getItem('current_batch_id');
      const storedBatchNum = await AsyncStorage.getItem('current_batch_number');
      const storedCardRef = await AsyncStorage.getItem('current_batch_card_reference');
      const storedTargetQty = await AsyncStorage.getItem('current_batch_target_quantity');

      if (storedBatchId) {
        setActiveBatchId(storedBatchId);
        setActiveBatchNumber(storedBatchNum);
        setActiveCardRef(storedCardRef);
        setActiveTargetQty(storedTargetQty ? parseInt(storedTargetQty, 10) : null);
      } else {
        // If not in storage, check database just in case
        const supabase = getSupabaseClient();
        if (supabase) {
          const { data, error } = await supabase
            .from('production_batches')
            .select('*')
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!error && data) {
            await AsyncStorage.setItem('current_batch_id', data.id);
            await AsyncStorage.setItem('current_batch_number', data.batch_number);
            await AsyncStorage.setItem('current_batch_card_reference', data.card_reference || '');
            await AsyncStorage.setItem('current_batch_target_quantity', String(data.target_quantity || 0));

            setActiveBatchId(data.id);
            setActiveBatchNumber(data.batch_number);
            setActiveCardRef(data.card_reference);
            setActiveTargetQty(data.target_quantity);
          }
        }
      }

      // Load configuration
      const config = await getConfiguration();
      if (config) {
        setGpio1(String(config.gpio_capteur1 || ''));
        setGpio2(String(config.gpio_capteur2 || ''));
        setGpio3(String(config.gpio_capteur3 || ''));
        setSerialPort(config.serial_port || '');
      }
    } catch (err) {
      console.error('Error loading config/batch:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartProduction = async () => {
    const trimmedCardReference = cardReference.trim();
    const qty = Number(targetQuantity);
    if (!trimmedCardReference) {
      Alert.alert(t('error'), 'Please enter or scan a Card Reference');
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      Alert.alert(t('error'), 'Number of cards must be greater than 0');
      return;
    }

    try {
      setStartingBatch(true);
      const supabase = getSupabaseClient();
      if (!supabase) {
        Alert.alert(t('error'), 'Supabase connection is not available');
        return;
      }

      const batchNum = 'B-' + new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);

      const { data, error } = await supabase
        .from('production_batches')
        .insert({
          batch_number: batchNum,
          card_reference: trimmedCardReference,
          target_quantity: qty,
          status: 'active',
          start_time: new Date().toISOString(),
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        // Set in AsyncStorage
        await AsyncStorage.setItem('current_batch_id', data.id);
        await AsyncStorage.setItem('current_batch_number', data.batch_number);
        await AsyncStorage.setItem('current_batch_card_reference', data.card_reference || '');
        await AsyncStorage.setItem('current_batch_target_quantity', String(data.target_quantity || 0));

        // Set in State
        setActiveBatchId(data.id);
        setActiveBatchNumber(data.batch_number);
        setActiveCardRef(data.card_reference);
        setActiveTargetQty(data.target_quantity);

        // Reset Inputs
        setCardReference('');
        setTargetQuantity('');

        Alert.alert(t('success'), `Production started for batch ${data.batch_number}`);
      }
    } catch (err: any) {
      console.error('Error starting batch:', err);
      Alert.alert(t('error'), err.message || 'Failed to start production batch');
    } finally {
      setStartingBatch(false);
    }
  };

  const handleStopProduction = async () => {
    if (!activeBatchId) return;

    Alert.alert(
      'Stop Production',
      'Are you sure you want to stop the active production batch?',
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: 'Stop Batch',
          style: 'destructive',
          onPress: async () => {
            try {
              const supabase = getSupabaseClient();
              if (supabase) {
                await supabase
                  .from('production_batches')
                  .update({
                    status: 'completed',
                    end_time: new Date().toISOString()
                  })
                  .eq('id', activeBatchId);
              }

              // Clear local cache
              await AsyncStorage.removeItem('current_batch_id');
              await AsyncStorage.removeItem('current_batch_number');
              await AsyncStorage.removeItem('current_batch_card_reference');
              await AsyncStorage.removeItem('current_batch_target_quantity');

              setActiveBatchId(null);
              setActiveBatchNumber(null);
              setActiveCardRef(null);
              setActiveTargetQty(null);

              Alert.alert(t('success'), 'Production batch stopped successfully');
            } catch (err: any) {
              console.error('Error stopping batch:', err);
              Alert.alert(t('error'), 'Failed to stop production batch');
            }
          }
        }
      ]
    );
  };

  const handleSaveConfiguration = async () => {
    const g1 = parseInt(gpio1, 10);
    const g2 = parseInt(gpio2, 10);
    const g3 = parseInt(gpio3, 10);

    if (isNaN(g1) || isNaN(g2) || isNaN(g3)) {
      Alert.alert(t('error'), 'GPIO Pins must be numeric values');
      return;
    }

    try {
      setSavingConfig(true);
      const updated = await updateConfiguration({
        gpio_capteur1: g1,
        gpio_capteur2: g2,
        gpio_capteur3: g3,
        serial_port: serialPort,
      } as any);

      if (updated) {
        Alert.alert(t('success'), 'Hardware Configuration Saved');
      } else {
        Alert.alert(t('error'), 'Failed to save configuration');
      }
    } catch (err: any) {
      console.error('Error saving config:', err);
      Alert.alert(t('error'), err.message || 'Failed to save configuration');
    } finally {
      setSavingConfig(false);
    }
  };

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

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: palette.backgroundSecondary }]} edges={['top']}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.backgroundSecondary }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Profile Card */}
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
          <SectionTitle title="App Preferences" palette={palette} />
          <View style={[styles.card, { backgroundColor: palette.background, borderColor: palette.border }]}> 
            <View style={styles.inlineSettingRow}>
              <Text style={[styles.inlineSettingLabel, { color: palette.text }]}>Theme</Text>
              <View style={styles.themeControls}>
                {(['light', 'dark', 'auto'] as const).map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    onPress={() => setTheme(mode)}
                    style={[
                      styles.themeChip,
                      {
                        borderColor: settings.theme === mode ? palette.primary : palette.border,
                        backgroundColor: settings.theme === mode ? palette.primary + '14' : palette.backgroundSecondary,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: settings.theme === mode ? palette.primary : palette.textSecondary,
                        fontSize: 12,
                        fontWeight: '700',
                        textTransform: 'capitalize',
                      }}
                    >
                      {mode}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: palette.border }]} />

            <View style={styles.inlineSettingRow}>
              <Text style={[styles.inlineSettingLabel, { color: palette.text }]}>Notifications</Text>
              <Switch
                value={settings.notificationsEnabled}
                onValueChange={(value) => updateSetting('notificationsEnabled', value)}
                trackColor={{ false: palette.border, true: '#10B981' }}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: palette.border }]} />

            <View style={styles.inlineSettingRow}>
              <Text style={[styles.inlineSettingLabel, { color: palette.text }]}>Haptic Feedback</Text>
              <Switch
                value={settings.vibrationEnabled}
                onValueChange={(value) => updateSetting('vibrationEnabled', value)}
                trackColor={{ false: palette.border, true: '#F59E0B' }}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: palette.border }]} />

            <View style={styles.inlineSettingRow}>
              <Text style={[styles.inlineSettingLabel, { color: palette.text }]}>Offline Queueing</Text>
              <Switch
                value={settings.offlineModeEnabled}
                onValueChange={(value) => updateSetting('offlineModeEnabled', value)}
                trackColor={{ false: palette.border, true: palette.primary }}
              />
            </View>

            {(role === 'supervisor' || role === 'admin') && (
              <>
                <View style={[styles.divider, { backgroundColor: palette.border }]} />
                <View style={styles.inlineSettingRow}>
                  <Text style={[styles.inlineSettingLabel, { color: palette.text }]}>Stuck card threshold</Text>
                  <View style={[styles.counterRow, { backgroundColor: palette.backgroundSecondary }]}> 
                    <TouchableOpacity style={[styles.counterBtn, { backgroundColor: palette.background }]} onPress={() => handleThresholdChange(-1)}>
                      <Ionicons name="remove" size={16} color={palette.text} />
                    </TouchableOpacity>
                    <Text style={[styles.counterText, { color: palette.text }]}>{settings.stuckCardThresholdHours}h</Text>
                    <TouchableOpacity style={[styles.counterBtn, { backgroundColor: palette.background }]} onPress={() => handleThresholdChange(1)}>
                      <Ionicons name="add" size={16} color={palette.text} />
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        {/* 1. Production Batch Controller Section */}
        <View style={styles.section}>
          <SectionTitle title="Production Batch Control" palette={palette} />
          
          {activeBatchId ? (
            <View style={[styles.card, { backgroundColor: palette.background, borderColor: palette.border }]}>
              <View style={styles.activeBatchHeader}>
                <View style={styles.pulsingDotWrapper}>
                  <View style={[styles.pulsingDot, { backgroundColor: '#10B981' }]} />
                  <Text style={[styles.activeBatchTitle, { color: palette.text }]}>Batch Active</Text>
                </View>
                <Text style={[styles.batchNumText, { color: palette.primary }]}>{activeBatchNumber}</Text>
              </View>

              <View style={[styles.divider, { backgroundColor: palette.border }]} />

              <View style={styles.batchDetailRow}>
                <Text style={[styles.batchDetailLabel, { color: palette.textSecondary }]}>Card Reference:</Text>
                <Text style={[styles.batchDetailValue, { color: palette.text }]}>{activeCardRef}</Text>
              </View>

              <View style={styles.batchDetailRow}>
                <Text style={[styles.batchDetailLabel, { color: palette.textSecondary }]}>Target Quantity:</Text>
                <Text style={[styles.batchDetailValue, { color: palette.text }]}>{activeTargetQty} cards</Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleStopProduction}
                style={[styles.dangerButton, { marginTop: spacing.md }]}
              >
                <Ionicons name="stop" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.buttonText}>Stop Production</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.card, { backgroundColor: palette.background, borderColor: palette.border }]}>
              <Text style={[styles.cardTitle, { color: palette.text, marginBottom: spacing.md }]}>Start New Batch</Text>
              
              <View style={styles.fieldWrap}>
                <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>Card Reference</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    value={cardReference}
                    onChangeText={setCardReference}
                    placeholder="Enter Card Reference"
                    placeholderTextColor={palette.textTertiary}
                    style={[styles.input, { backgroundColor: palette.backgroundSecondary, borderColor: palette.border, color: palette.text, flex: 1 }]}
                  />
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setCardReference('REF-' + Math.floor(100000 + Math.random() * 900000))}
                    style={[styles.scanIconBtn, { backgroundColor: palette.primary }]}
                  >
                    <Ionicons name="qr-code-outline" size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.fieldWrap}>
                <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>Number of Cards</Text>
                <TextInput
                  value={targetQuantity}
                  onChangeText={setTargetQuantity}
                  placeholder="e.g. 50"
                  placeholderTextColor={palette.textTertiary}
                  keyboardType="number-pad"
                  style={[styles.input, { backgroundColor: palette.backgroundSecondary, borderColor: palette.border, color: palette.text }]}
                />
              </View>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleStartProduction}
                disabled={startingBatch}
                style={[styles.primaryButton, { backgroundColor: palette.primary, opacity: startingBatch ? 0.8 : 1, marginTop: spacing.sm }]}
              >
                {startingBatch ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="play" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.buttonText}>Start Production</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 2. Hardware Configuration Section (GPIO & Serial Port) */}
        <View style={styles.section}>
          <SectionTitle title="Hardware Configuration" palette={palette} />
          
          <View style={[styles.card, { backgroundColor: palette.background, borderColor: palette.border }]}>
            <Text style={[styles.cardTitle, { color: palette.text, marginBottom: spacing.md }]}>Sensor GPIO Mapping & Port</Text>

            <View style={styles.gpioContainer}>
              <View style={[styles.fieldWrap, { flex: 1 }]}>
                <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>GPIO 1</Text>
                <TextInput
                  value={gpio1}
                  onChangeText={setGpio1}
                  placeholder="GPIO 1"
                  placeholderTextColor={palette.textTertiary}
                  keyboardType="number-pad"
                  style={[styles.input, { backgroundColor: palette.backgroundSecondary, borderColor: palette.border, color: palette.text }]}
                />
              </View>
              <View style={[styles.fieldWrap, { flex: 1 }]}>
                <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>GPIO 2</Text>
                <TextInput
                  value={gpio2}
                  onChangeText={setGpio2}
                  placeholder="GPIO 2"
                  placeholderTextColor={palette.textTertiary}
                  keyboardType="number-pad"
                  style={[styles.input, { backgroundColor: palette.backgroundSecondary, borderColor: palette.border, color: palette.text }]}
                />
              </View>
              <View style={[styles.fieldWrap, { flex: 1 }]}>
                <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>GPIO 3</Text>
                <TextInput
                  value={gpio3}
                  onChangeText={setGpio3}
                  placeholder="GPIO 3"
                  placeholderTextColor={palette.textTertiary}
                  keyboardType="number-pad"
                  style={[styles.input, { backgroundColor: palette.backgroundSecondary, borderColor: palette.border, color: palette.text }]}
                />
              </View>
            </View>

            <View style={styles.fieldWrap}>
              <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>Serial Port</Text>
              <TextInput
                value={serialPort}
                onChangeText={setSerialPort}
                placeholder="/dev/ttyUSB0 or COM3"
                placeholderTextColor={palette.textTertiary}
                style={[styles.input, { backgroundColor: palette.backgroundSecondary, borderColor: palette.border, color: palette.text }]}
              />
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleSaveConfiguration}
              disabled={savingConfig}
              style={[styles.secondaryButton, { borderColor: palette.primary, marginTop: spacing.sm }]}
            >
              {savingConfig ? (
                <ActivityIndicator color={palette.primary} />
              ) : (
                <>
                  <Ionicons name="save-outline" size={18} color={palette.primary} style={{ marginRight: 6 }} />
                  <Text style={[styles.secondaryButtonText, { color: palette.primary }]}>Save Configuration</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Existing Navigation Links */}
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
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  inlineSettingRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  inlineSettingLabel: {
    ...typography.bodyBold,
    fontSize: 14,
    flex: 1,
  },
  themeControls: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  themeChip: {
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
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
  card: {
    borderWidth: 1,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  cardTitle: {
    ...typography.bodyBold,
    fontSize: 16,
  },
  fieldWrap: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    ...typography.captionBold,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    ...typography.body,
  },
  scanIconBtn: {
    width: 50,
    height: 50,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.xs,
  },
  primaryButton: {
    height: 50,
    borderRadius: borderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  secondaryButton: {
    height: 50,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    ...typography.bodyBold,
  },
  dangerButton: {
    height: 50,
    borderRadius: borderRadius.lg,
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  buttonText: {
    ...typography.bodyBold,
    color: '#FFFFFF',
  },
  activeBatchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
  },
  pulsingDotWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  activeBatchTitle: {
    ...typography.bodyBold,
    fontSize: 15,
  },
  batchNumText: {
    ...typography.bodyBold,
    fontSize: 14,
  },
  divider: {
    height: 1,
    marginBottom: spacing.md,
  },
  batchDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  batchDetailLabel: {
    ...typography.body,
  },
  batchDetailValue: {
    ...typography.bodyBold,
  },
  gpioContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: borderRadius.md,
    padding: 4,
  },
  counterBtn: {
    width: 30,
    height: 30,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.xs,
  },
  counterText: {
    ...typography.bodyBold,
    minWidth: 32,
    textAlign: 'center',
  },
});
