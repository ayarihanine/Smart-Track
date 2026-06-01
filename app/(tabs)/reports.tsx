import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useTheme } from '@/components/ThemeProvider';
import { getDailyReports } from '@/lib/api';
import { borderRadius, shadows, spacing, typography } from '@/constants/design';
import { DailyReport } from '@/types';
import { useFocusEffect, router } from 'expo-router';
import { useTranslation } from '@/hooks/useTranslation';

export default function ReportsScreen() {
  const { t } = useTranslation();
  const { palette, isDark } = useTheme();
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState<Set<string>>(new Set());

  const fetchReports = useCallback(async () => {
    try {
      const data = await getDailyReports();
      setReports(data);
    } catch (err) {
      console.error('fetch reports error', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchReports();
    }, [fetchReports])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchReports();
  }, [fetchReports]);

  const formatDate = (iso: string) => {
    const d = new Date(iso + 'T00:00:00');
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const handleDownload = async (report: DailyReport) => {
    if (!report.file_url) {
      Alert.alert('Error', 'No file URL available for this report.');
      return;
    }

    setDownloading(report.id);
    try {
      const ext = report.file_url.split('.').pop() || 'csv';
      const filename = `report_${report.report_date}.${ext}`;
      const dest = FileSystem.documentDirectory + filename;

      const result = await FileSystem.downloadAsync(report.file_url, dest);

      setDownloaded((prev) => new Set(prev).add(report.id));
      Alert.alert('Downloaded', `Report saved as ${filename}`, [
        { text: 'Open', onPress: async () => {
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(result.uri);
          }
        }},
        { text: 'OK' },
      ]);
    } catch (err) {
      console.error('download error', err);
      Alert.alert('Download Failed', 'Could not download the report. Check your connection and try again.');
    } finally {
      setDownloading(null);
    }
  };

  const handleShare = async (report: DailyReport) => {
    if (!report.file_url) return;
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(report.file_url);
      }
    } catch (err) {
      console.error('share error', err);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={24} color={palette.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: palette.text }]}>
              {t('reports')}
            </Text>
            <Text style={[styles.headerSub, { color: palette.textTertiary }]}>
              {t('dailyReportDesc')}
            </Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={palette.primary} />
        </View>
      ) : reports.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="document-text-outline" size={48} color={palette.textTertiary} />
          <Text style={[styles.emptyTitle, { color: palette.textSecondary }]}>
            {t('noReportsFound')}
          </Text>
          <Text style={[styles.emptySub, { color: palette.textTertiary }]}>
            {t('reportNotFound')}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />
          }
        >
          {reports.map((report) => {
            const isDownloaded = downloaded.has(report.id);
            const isDownloadingNow = downloading === report.id;

            return (
              <LinearGradient
                key={report.id}
                colors={isDark ? ['#1E293B', '#0F172A'] : ['#FFFFFF', '#F8FAFC']}
                style={[styles.reportCard, { borderColor: palette.border }]}
              >
                {/* Header row: date + download indicator */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardDateBlock}>
                    <Ionicons name="calendar-outline" size={14} color={palette.textTertiary} />
                    <Text style={[styles.cardDate, { color: palette.text }]}>
                      {formatDate(report.report_date)}
                    </Text>
                  </View>
                  <View style={styles.cardActions}>
                    {isDownloaded ? (
                      <Ionicons name="checkmark-circle" size={18} color="#0D9488" />
                    ) : null}
                    <TouchableOpacity
                      onPress={() => handleShare(report)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="share-outline" size={18} color={palette.textTertiary} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Download button */}
                <TouchableOpacity
                  style={[styles.downloadBtn, { backgroundColor: isDark ? '#6366F110' : '#EEF2FF', borderColor: isDark ? '#6366F130' : '#C7D2FE' }]}
                  onPress={() => handleDownload(report)}
                  disabled={isDownloadingNow}
                  accessibilityLabel={`Download report for ${formatDate(report.report_date)}`}
                >
                  {isDownloadingNow ? (
                    <ActivityIndicator size="small" color="#6366F1" />
                  ) : (
                    <>
                      <Ionicons
                        name={isDownloaded ? 'download-outline' : 'cloud-download-outline'}
                        size={16}
                        color="#6366F1"
                      />
                      <Text style={styles.downloadBtnText}>
                        {isDownloaded ? 'Download Again' : 'Download CSV'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </LinearGradient>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  headerTitle: { ...typography.h3, fontWeight: '800' },
  headerSub: { ...typography.small, marginTop: 2 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: { ...typography.h4, textAlign: 'center' },
  emptySub: { ...typography.small, textAlign: 'center', maxWidth: 260 },
  list: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  reportCard: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    padding: spacing.md,
    ...shadows.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cardDateBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardDate: { ...typography.bodyBold, fontSize: 15 },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  downloadBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6366F1',
  },
});
