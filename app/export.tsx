import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/design';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCards } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import { useRoleGuard } from '@/hooks/useRoleGuard';

type ExportFormat = 'json' | 'csv' | 'xlsx';
type ExportScope = 'all' | 'in_progress' | 'completed';

interface GeneratedReport {
  id: string;
  name: string;
  date: string;
  type: 'pdf' | 'excel' | 'json' | 'csv';
  count: number;
}

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
  const { t, language } = useTranslation();
  const [format, setFormat] = useState<ExportFormat>('json');
  const [scope, setScope] = useState<ExportScope>('all');
  const [exporting, setExporting] = useState(false);
  const [recentReports, setRecentReports] = useState<GeneratedReport[]>([]);

  React.useEffect(() => {
    loadReports();
  }, []);

  async function loadReports() {
    try {
      const saved = await AsyncStorage.getItem('generated_reports');
      if (saved) setRecentReports(JSON.parse(saved));
    } catch (e) {
      console.error('Failed to load reports', e);
    }
  }

  async function saveReport(type: GeneratedReport['type'], count: number) {
    try {
      const dayName = new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'long' }).format(new Date());
      const newReport: GeneratedReport = {
        id: Date.now().toString(),
        name: `${dayName} Report`,
        date: new Date().toISOString(),
        type,
        count
      };
      const updated = [newReport, ...recentReports].slice(0, 10);
      setRecentReports(updated);
      await AsyncStorage.setItem('generated_reports', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save report', e);
    }
  }

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    try {
      const cards = await getCards();
      const filtered = scope === 'all' ? cards
        : cards.filter(c => c.status === scope);

      if (format === 'xlsx') {
        const worksheet = XLSX.utils.json_to_sheet(filtered);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "ProductionData");
        
        const wbout = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
        const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date());
        const fileName = `${dayName}_Report_${Date.now()}.xlsx`;
        const fileUri = FileSystem.cacheDirectory + fileName;
        
        await FileSystem.writeAsStringAsync(fileUri, wbout, { encoding: FileSystem.EncodingType.Base64 });
        await Sharing.shareAsync(fileUri, { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', UTI: 'com.microsoft.excel.xlsx' });
        saveReport('excel', filtered.length);
      } else {
        let content = '';
        if (format === 'json') {
          content = JSON.stringify(filtered, null, 2);
          saveReport('json', filtered.length);
        } else {
          const headers = ['cardId', 'productName', 'status', 'currentStage', 'currentLocation', 'progressPercent', 'totalTimeMinutes', 'createdAt'];
          const rows = filtered.map(c =>
            headers.map(h => (c as any)[h] ?? '').join(',')
          );
          content = [headers.join(','), ...rows].join('\n');
          saveReport('csv', filtered.length);
        }

        // On native, sharing strings is tricky, better save to file first if large
        const fileName = `export_${Date.now()}.${format}`;
        const fileUri = FileSystem.cacheDirectory + fileName;
        await FileSystem.writeAsStringAsync(fileUri, content);
        await Sharing.shareAsync(fileUri);
      }
    } catch (e) {
      console.error(e);
      Alert.alert(t('exportFailed'), t('exportFailedMessage'));
    } finally {
      setExporting(false);
    }
  }

  async function handleGeneratePdf() {
    setExporting(true);
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
      saveReport('pdf', cards.length);
      
    } catch (error) {
      console.error('PDF Generation Error:', error);
      Alert.alert(t('error'), 'Could not generate or share PDF report');
    } finally {
      setExporting(false);
    }
  }

  function getReportIcon(type: GeneratedReport['type']) {
    switch (type) {
      case 'pdf': return 'document-text';
      case 'excel': return 'stats-chart';
      case 'json': return 'code-slash';
      default: return 'grid';
    }
  }

  function getReportColor(type: GeneratedReport['type']) {
    switch (type) {
      case 'pdf': return '#EF4444';
      case 'excel': return '#10B981';
      case 'json': return '#F59E0B';
      default: return '#3B82F6';
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
            <FormatBtn
              label="Excel"
              icon="stats-chart"
              active={format === 'xlsx'}
              onPress={() => setFormat('xlsx')}
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

        {/* Export Action */}
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
                <Text style={styles.exportBtnText}>
                  {t('exportAction').replace('X', format.toUpperCase())}
                </Text>
              </>
            )}
          </TouchableOpacity>
          
          <View style={{ height: spacing.md }} />
          
          <TouchableOpacity
            style={[styles.pdfBtn, exporting && styles.exportBtnDisabled]}
            onPress={handleGeneratePdf}
            disabled={exporting}
            activeOpacity={0.8}
          >
            {exporting ? (
              <ActivityIndicator color="#8B5CF6" />
            ) : (
              <>
                <Ionicons name="document-text" size={20} color="#8B5CF6" />
                <Text style={styles.pdfBtnText}>{t('generateReport')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Recent Reports History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Reports History</Text>
          <View style={styles.historyCard}>
            {recentReports.length === 0 ? (
              <View style={styles.emptyHistory}>
                <Ionicons name="archive-outline" size={32} color={colors.textTertiary} />
                <Text style={styles.emptyHistoryText}>No reports generated yet</Text>
              </View>
            ) : (
              recentReports.map((report, idx) => (
                <View key={report.id}>
                  {idx > 0 && <View style={styles.divider} />}
                  <View style={styles.reportItem}>
                    <View style={[styles.reportIcon, { backgroundColor: getReportColor(report.type) + '15' }]}>
                      <Ionicons name={getReportIcon(report.type)} size={20} color={getReportColor(report.type)} />
                    </View>
                    <View style={styles.reportInfo}>
                      <Text style={[styles.reportName, { color: colors.text }]}>{report.name}</Text>
                      <Text style={styles.reportMeta}>
                        {new Date(report.date).toLocaleDateString()} · {report.count} cards
                      </Text>
                    </View>
                    <View style={[styles.typeBadge, { backgroundColor: getReportColor(report.type) + '15' }]}>
                      <Text style={[styles.typeBadgeText, { color: getReportColor(report.type) }]}>
                        {report.type.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
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
  pdfBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, backgroundColor: '#F3E8FF',
    borderRadius: borderRadius.xl, height: 56,
    borderWidth: 1.5, borderColor: '#C084FC',
  },
  pdfBtnText: { ...typography.bodyBold, color: '#7E22CE' },
  historyCard: {
    backgroundColor: colors.white, borderRadius: borderRadius.xl,
    ...shadows.sm, overflow: 'hidden', paddingVertical: spacing.xs,
  },
  reportItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md,
  },
  reportIcon: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  reportInfo: { flex: 1, gap: 2 },
  reportName: { ...typography.bodyBold },
  reportMeta: { ...typography.tiny, color: colors.textTertiary },
  typeBadge: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6,
  },
  typeBadgeText: { fontSize: 10, fontWeight: '700' },
  emptyHistory: {
    padding: spacing.xl, alignItems: 'center', gap: spacing.sm,
  },
  emptyHistoryText: { ...typography.caption, color: colors.textTertiary },
});
