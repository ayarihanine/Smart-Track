import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { borderRadius, shadows, spacing, typography } from '@/constants/design';
import { useTheme } from '@/components/ThemeProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { fetchConfiguration, updateConfiguration } from '@/lib/api';
import { useRoleGuard } from '@/hooks/useRoleGuard';

type ConfigurationForm = {
  expected_cards: number;
  machine_name: string;
  cycle_time_seconds: number;
  loss_threshold: number;
  sensor_1_gpio: number;
  sensor_2_gpio: number;
  sensor_3_gpio: number;
};

const defaultForm: ConfigurationForm = {
  expected_cards: 0,
  machine_name: '',
  cycle_time_seconds: 0,
  loss_threshold: 0,
  sensor_1_gpio: 0,
  sensor_2_gpio: 0,
  sensor_3_gpio: 0,
};

function AccessDenied({ t, palette }: { t: (key: any) => string; palette: any }) {
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.backgroundSecondary }]} edges={['top']}>
      <View style={styles.deniedWrap}>
        <Ionicons name="lock-closed" size={64} color="#EF4444" />
        <Text style={[styles.deniedTitle, { color: palette.text }]}>{t('accessDeniedTitle')}</Text>
        <Text style={[styles.deniedMessage, { color: palette.textSecondary }]}>{t('productionAccessDeniedMessage')}</Text>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.back()}
          style={[styles.primaryButton, { backgroundColor: palette.primary }]}
        >
          <Text style={styles.primaryButtonText}>{t('goBack')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function ConfigInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  palette,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'number-pad';
  palette: any;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.textTertiary}
        keyboardType={keyboardType}
        style={[styles.input, { backgroundColor: palette.backgroundSecondary, borderColor: palette.border, color: palette.text }]}
      />
    </View>
  );
}

export default function ConfigurationScreen() {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const { isAuthorized } = useRoleGuard(['admin', 'supervisor']);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ConfigurationForm>(defaultForm);

  useEffect(() => {
    let mounted = true;

    const loadConfiguration = async () => {
      setLoading(true);
      const configuration = await fetchConfiguration();

      if (mounted && configuration) {
        setForm({
          expected_cards: configuration.expected_cards,
          machine_name: configuration.machine_name,
          cycle_time_seconds: configuration.cycle_time_seconds,
          loss_threshold: configuration.loss_threshold,
          sensor_1_gpio: configuration.sensor_1_gpio || 0,
          sensor_2_gpio: configuration.sensor_2_gpio || 0,
          sensor_3_gpio: configuration.sensor_3_gpio || 0,
        });
      }

      if (mounted) {
        setLoading(false);
      }
    };

    loadConfiguration();

    return () => {
      mounted = false;
    };
  }, []);

  if (!isAuthorized) {
    return <AccessDenied t={t} palette={palette} />;
  }

  const saveConfiguration = async () => {
    setSaving(true);
    try {
      const updated = await updateConfiguration(form);
      if (updated) {
        Alert.alert(t('success') || 'Success', t('configurationSaved') || 'Configuration saved successfully!');
      } else {
        Alert.alert(t('error') || 'Error', t('configurationSaveError') || 'Failed to save configuration.');
      }
    } catch (e: any) {
      Alert.alert(t('error') || 'Error', e.message || 'An error occurred.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.loader, { backgroundColor: palette.backgroundSecondary }]} edges={['top']}>
        <ActivityIndicator size="large" color={palette.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.backgroundSecondary }]} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { backgroundColor: palette.background, borderBottomColor: palette.border }]}>
          <TouchableOpacity activeOpacity={0.8} onPress={() => router.back()} style={styles.headerBack}>
            <Ionicons name="arrow-back" size={22} color={palette.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: palette.text }]}>{t('configurationTitle') || 'Configuration'}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={[styles.sectionCard, { backgroundColor: palette.background, borderColor: palette.border }]}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>{t('productionSettingsSection') || 'Production settings'}</Text>

            <ConfigInput
              label="Machine Name"
              value={form.machine_name}
              onChangeText={(value) => setForm((current) => ({ ...current, machine_name: value }))}
              placeholder="e.g. NPM-DX-1"
              palette={palette}
            />

            <ConfigInput
              label="Cards Expected Per Batch"
              value={String(form.expected_cards || '')}
              onChangeText={(value) => setForm((current) => ({ ...current, expected_cards: Number(value.replace(/[^0-9]/g, '')) || 0 }))}
              placeholder="e.g. 1000"
              keyboardType="number-pad"
              palette={palette}
            />

            <ConfigInput
              label="Cycle Time (seconds)"
              value={String(form.cycle_time_seconds || '')}
              onChangeText={(value) => setForm((current) => ({ ...current, cycle_time_seconds: Number(value.replace(/[^0-9]/g, '')) || 0 }))}
              placeholder="e.g. 45"
              keyboardType="number-pad"
              palette={palette}
            />

            <ConfigInput
              label="Loss Alert Threshold"
              value={String(form.loss_threshold || '')}
              onChangeText={(value) => setForm((current) => ({ ...current, loss_threshold: Number(value.replace(/[^0-9]/g, '')) || 0 }))}
              placeholder="1"
              keyboardType="number-pad"
              palette={palette}
            />
          </View>

          <View style={[styles.sectionCard, { backgroundColor: palette.background, borderColor: palette.border, marginTop: spacing.md }]}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>GPIO Sensor Configurations</Text>

            <ConfigInput
              label="Sensor 1 GPIO Pin (Entry)"
              value={String(form.sensor_1_gpio || '')}
              onChangeText={(value) => setForm((current) => ({ ...current, sensor_1_gpio: Number(value.replace(/[^0-9]/g, '')) || 0 }))}
              placeholder="e.g. 17"
              keyboardType="number-pad"
              palette={palette}
            />

            <ConfigInput
              label="Sensor 2 GPIO Pin (Middle)"
              value={String(form.sensor_2_gpio || '')}
              onChangeText={(value) => setForm((current) => ({ ...current, sensor_2_gpio: Number(value.replace(/[^0-9]/g, '')) || 0 }))}
              placeholder="e.g. 26"
              keyboardType="number-pad"
              palette={palette}
            />

            <ConfigInput
              label="Sensor 3 GPIO Pin (Exit)"
              value={String(form.sensor_3_gpio || '')}
              onChangeText={(value) => setForm((current) => ({ ...current, sensor_3_gpio: Number(value.replace(/[^0-9]/g, '')) || 0 }))}
              placeholder="e.g. 16"
              keyboardType="number-pad"
              palette={palette}
            />
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={saveConfiguration}
            disabled={saving}
            style={[styles.primaryButton, { backgroundColor: palette.primary, opacity: saving ? 0.8 : 1, marginTop: spacing.md }]}
          >
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>{t('saveConfiguration') || 'Save Configuration'}</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
  sectionCard: {
    borderWidth: 1,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  sectionTitle: {
    ...typography.h4,
    marginBottom: spacing.md,
  },
  fieldWrap: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    ...typography.captionBold,
    marginBottom: 8,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    ...typography.body,
  },
  warningBox: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  warningText: {
    ...typography.small,
    flex: 1,
    fontWeight: '600',
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  primaryButtonText: {
    ...typography.bodyBold,
    color: '#FFFFFF',
  },
  deniedWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  deniedTitle: {
    ...typography.h2,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  deniedMessage: {
    ...typography.body,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
});
