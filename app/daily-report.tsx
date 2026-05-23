import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { fetchN8nReportData } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/components/ThemeProvider';
import { colors, spacing, typography, borderRadius } from '@/constants/design';

function flattenRows(rows: any[]) {
  return rows.map((row) => {
    if (row && typeof row === 'object' && !Array.isArray(row)) {
      const out: Record<string, any> = {};
      Object.entries(row).forEach(([key, value]) => {
        if (value && typeof value === 'object') {
          out[key] = JSON.stringify(value);
        } else {
          out[key] = value;
        }
      });
      return out;
    }
    return { value: row };
  });
}

export default function DailyReportScreen() {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const [isDownloading, setIsDownloading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleDownload = async () => {
    setIsDownloading(true);
    setErrorMsg(null);

    try {
      const rows = await fetchN8nReportData('all');
      const exportRows = flattenRows(rows);
      
      const date = new Date();
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const dateString = `${yyyy}-${mm}-${dd}`;

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'N8N_Daily_Report');
      
      const wbout = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
      const fileUri = `${FileSystem.cacheDirectory}CardTrack_Daily_Report_${dateString}.xlsx`;

      await FileSystem.writeAsStringAsync(fileUri, wbout, { encoding: FileSystem.EncodingType.Base64 });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: t('downloadTodayReport') || "Today's Report",
          UTI: 'com.microsoft.excel.xlsx'
        });
      } else {
        Alert.alert(t('error') || 'Error', t('sharingNotAvailable') || 'Sharing is not available on this device');
      }
    } catch (error: any) {
      console.error('Download error:', error);
      setErrorMsg(error.message || t('error') || 'An error occurred');
      Alert.alert(t('error') || 'Error', error.message || t('error') || 'An error occurred');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.backgroundSecondary }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: palette.background, borderBottomColor: palette.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: palette.text }]}>{t('dailyReport') || 'Daily Report'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <View style={[styles.card, { backgroundColor: palette.background, borderColor: palette.border }]}>
          <View style={[styles.iconContainer, { backgroundColor: palette.primary + '15' }]}>
            <Ionicons name="document-text" size={40} color={palette.primary} />
          </View>
          
          <Text style={[styles.title, { color: palette.text }]}>{t('todayReportTitle') || "Today's Production Report"}</Text>
          <Text style={[styles.description, { color: palette.textSecondary }]}> 
            {t('todayReportDesc') || 'Download the Excel report generated from the n8n workflow data source.'}
          </Text>

          <View style={[styles.sourceBadge, { backgroundColor: palette.primary + '12', borderColor: palette.primary + '35' }]}>
            <Ionicons name="git-network-outline" size={14} color={palette.primary} />
            <Text style={[styles.sourceBadgeText, { color: palette.primary }]}>Source: n8n workflow</Text>
          </View>

          {errorMsg && (
            <View style={[styles.errorBox, { backgroundColor: colors.error + '15', borderColor: colors.error + '30' }]}>
              <Ionicons name="alert-circle" size={20} color={colors.error} />
              <Text style={[styles.errorText, { color: colors.error }]}>{errorMsg}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.downloadBtn, { backgroundColor: palette.primary }, isDownloading && { opacity: 0.7 }]}
            onPress={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Ionicons name="download-outline" size={20} color={colors.white} />
                <Text style={styles.downloadBtnText}>{t('downloadTodayReport') || "Download Today's Report"}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  backBtn: { padding: spacing.xs },
  headerTitle: { ...typography.h4 },
  content: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  card: {
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h3,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  description: {
    ...typography.body,
    textAlign: 'center',
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.sm,
  },
  sourceBadge: {
    width: '100%',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  sourceBadgeText: {
    ...typography.smallBold,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    width: '100%',
    gap: spacing.sm,
  },
  downloadBtnText: {
    ...typography.bodyBold,
    color: colors.white,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.lg,
    width: '100%',
    gap: spacing.sm,
  },
  errorText: {
    ...typography.small,
    flex: 1,
  },
});
