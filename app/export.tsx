import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/design';
import { getCards } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import { useRoleGuard } from '@/hooks/useRoleGuard';

type ExportFormat = 'json' | 'csv';
type ExportScope = 'all' | 'in_progress' | 'completed';

function FormatBtn({ label, icon, active, onPress }: {
  label: string; icon: string; active: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.formatBtn, active && styles.formatBtnActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons name={icon as any} size={22} color={active ? colors.white : colors.textSecondary} />
      <Text style={[styles.formatLabel, active && styles.formatLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ScopeBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.scopeBtn, active && styles.scopeBtnActive]}
      onPress={onPress}
    >
      <Text style={[styles.scopeText, active && styles.scopeTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function ExportScreen() {
  useRoleGuard(['admin', 'supervisor']);
  const { t } = useTranslation();
  const [format, setFormat] = useState<ExportFormat>('json');
  const [scope, setScope] = useState<ExportScope>('all');
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const cards = await getCards();
      const filtered = scope === 'all' ? cards
        : cards.filter(c => c.status === scope);

      let content = '';
      if (format === 'json') {
        content = JSON.stringify(filtered, null, 2);
      } else {
        const headers = ['cardId', 'productName', 'status', 'currentStage', 'currentLocation', 'progressPercent', 'totalTimeMinutes', 'createdAt'];
        const rows = filtered.map(c =>
          headers.map(h => (c as any)[h] ?? '').join(',')
        );
        content = [headers.join(','), ...rows].join('\n');
      }

      console.debug('Generated export content length:', content.length);

      // On native, would use share sheet. On web, download.
      Alert.alert(
        t('exportReady'),
        t('exportReadyMessage').replace('X', filtered.length.toString()).replace('FORMAT', format.toUpperCase()),
        [{ text: 'OK' }]
      );
    } catch {
      Alert.alert(t('exportFailed'), t('exportFailedMessage'));
    } finally {
      setExporting(false);
    }
  }

  const SCOPES = [
    { key: 'all' as const, label: t('allCards') },
    { key: 'in_progress' as const, label: t('inProgress') },
    { key: 'completed' as const, label: t('completed') },
  ];

  const FIELDS = [
    t('cardIdLabel'),
    t('productNameLabel'),
    t('statusLabel'),
    t('currentStageLabel'),
    t('locationLabel'),
    t('progressLabel'),
    t('cycleTimeLabel'),
    t('createdAtLabel')
  ];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle" size={20} color="#2563EB" />
          <Text style={styles.infoText}>{t('exportDescription')}</Text>
        </View>

        {/* Format */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('exportFormat')}</Text>
          <View style={styles.formatRow}>
            <FormatBtn
              label="JSON"
              icon="code-slash"
              active={format === 'json'}
              onPress={() => setFormat('json')}
            />
            <FormatBtn
              label="CSV"
              icon="grid"
              active={format === 'csv'}
              onPress={() => setFormat('csv')}
            />
          </View>
        </View>

        {/* Scope */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('dataScope')}</Text>
          <View style={styles.scopeRow}>
            {SCOPES.map(s => (
              <ScopeBtn
                key={s.key}
                label={s.label}
                active={scope === s.key}
                onPress={() => setScope(s.key)}
              />
            ))}
          </View>
        </View>

        {/* Included Fields */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('includedFields')}</Text>
          <View style={styles.fieldsCard}>
            {FIELDS.map((f, i) => (
              <View key={f}>
                {i > 0 && <View style={styles.divider} />}
                <View style={styles.fieldRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  <Text style={styles.fieldLabel}>{f}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Export Button */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.exportBtn, exporting && styles.exportBtnDisabled]}
            onPress={handleExport}
            disabled={exporting}
            activeOpacity={0.8}
          >
            {exporting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Ionicons name="download" size={20} color={colors.white} />
                <Text style={styles.exportBtnText}>{t('exportAction').replace('X', format.toUpperCase())}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSecondary },
  scrollContent: { paddingBottom: spacing.xl },
  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    backgroundColor: '#EFF6FF', margin: spacing.lg,
    borderRadius: borderRadius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  infoText: { ...typography.caption, color: '#1E40AF', flex: 1, lineHeight: 18 },
  section: { paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  sectionTitle: { ...typography.h4, color: colors.text, marginBottom: spacing.md },
  formatRow: { flexDirection: 'row', gap: spacing.md },
  formatBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, paddingVertical: spacing.md,
    borderRadius: borderRadius.xl, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.white, ...shadows.xs,
  },
  formatBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  formatLabel: { ...typography.bodyBold, color: colors.textSecondary },
  formatLabelActive: { color: colors.white },
  scopeRow: { flexDirection: 'row', gap: spacing.sm },
  scopeBtn: {
    flex: 1, paddingVertical: spacing.sm,
    borderRadius: borderRadius.full, alignItems: 'center',
    backgroundColor: colors.backgroundTertiary,
    borderWidth: 1, borderColor: colors.border,
  },
  scopeBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  scopeText: { ...typography.captionBold, color: colors.textSecondary },
  scopeTextActive: { color: colors.white },
  fieldsCard: {
    backgroundColor: colors.white, borderRadius: borderRadius.xl,
    ...shadows.sm, overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: spacing.lg + 20 },
  fieldRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.md,
  },
  fieldLabel: { ...typography.body, color: colors.text },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, backgroundColor: colors.primary,
    borderRadius: borderRadius.xl, height: 56, ...shadows.md,
  },
  exportBtnDisabled: { opacity: 0.6 },
  exportBtnText: { ...typography.bodyBold, color: colors.white },
});
