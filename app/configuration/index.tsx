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
import { useAuthStore } from '@/store/authStore';
import { fetchConfiguration } from '@/lib/api';
import { getSupabaseClient } from '@/lib/supabase';
import { Configuration } from '@/types/production';

type ConfigurationForm = Pick<
  Configuration,
  'nb_cartes_attendues' | 'machine_name' | 'cycle_time_seconds'
> & {
  loss_threshold: number;
};

const defaultForm: ConfigurationForm = {
  nb_cartes_attendues: 0,
  machine_name: '',
  cycle_time_seconds: 0,
  loss_threshold: 0,
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
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const { palette } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ConfigurationForm>(defaultForm);

  const isAuthorized = user?.role === 'admin' || user?.role === 'supervisor';

  useEffect(() => {
    let mounted = true;

    const loadConfiguration = async () => {
      setLoading(true);
      const configuration = await fetchConfiguration();

      if (mounted && configuration) {
        setForm({
          nb_cartes_attendues: configuration.nb_cartes_attendues,
          machine_name: configuration.machine_name,
          cycle_time_seconds: configuration.cycle_time_seconds,
          loss_threshold: configuration.loss_threshold,
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

    const supabase = getSupabaseClient();
    const { error } = supabase
      ? await supabase
          .from('configuration')
          .update({ ...form, updated_at: new Date().toISOString() })
          .eq('id', 1)
      : { error: new Error('Supabase is not configured') };

    setSaving(false);

    if (!error) {
      Alert.alert(t('success'), t('configurationSaved'));
      return;
    }

    Alert.alert(t('error'), t('configurationSaveError'));
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
          <Text style={[styles.headerTitle, { color: palette.text }]}>{t('configurationTitle')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={[styles.sectionCard, { backgroundColor: palette.background, borderColor: palette.border }]}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>{t('productionSettingsSection')}</Text>

            <ConfigInput
              label="Cards expected per batch"
              value={String(form.nb_cartes_attendues || '')}
              onChangeText={(value) => setForm((current) => ({ ...current, nb_cartes_attendues: Number(value.replace(/[^0-9]/g, '')) || 0 }))}
              placeholder={t('expectedCardsPlaceholder')}
              keyboardType="number-pad"
              palette={palette}
            />

            <ConfigInput
              label="Machine name"
              value={form.machine_name}
              onChangeText={(value) => setForm((current) => ({ ...current, machine_name: value }))}
              placeholder={t('machineNamePlaceholder')}
              palette={palette}
            />

            <ConfigInput
              label="Cycle time (seconds)"
              value={String(form.cycle_time_seconds || '')}
              onChangeText={(value) => setForm((current) => ({ ...current, cycle_time_seconds: Number(value.replace(/[^0-9]/g, '')) || 0 }))}
              placeholder={t('cycleTimePlaceholder')}
              keyboardType="number-pad"
              palette={palette}
            />
            <ConfigInput
              label="Loss alert threshold"
              value={String(form.loss_threshold || '')}
              onChangeText={(value) => setForm((current) => ({ ...current, loss_threshold: Number(value.replace(/[^0-9]/g, '')) || 0 }))}
              placeholder="1"
              keyboardType="number-pad"
              palette={palette}
            />
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={saveConfiguration}
            disabled={saving}
            style={[styles.primaryButton, { backgroundColor: palette.primary, opacity: saving ? 0.8 : 1 }]}
          >
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>{t('saveConfiguration')}</Text>}
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
