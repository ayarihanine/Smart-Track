import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useTheme } from '@/components/ThemeProvider';
import { getDailyReports, generateCsvStringForDate } from '@/lib/api';
import { borderRadius, shadows, spacing, typography } from '@/constants/design';
import { DailyReport } from '@/types';
import { useFocusEffect, router } from 'expo-router';
import { useTranslation } from '@/hooks/useTranslation';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return {
    day: d.toLocaleDateString('en-GB', { day: '2-digit' }),
    month: d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase(),
    year: String(d.getFullYear()),
    full: d.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }),
  };
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatFileSize(bytes?: number) {
  if (!bytes || bytes === 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ─── Animated Report Card ────────────────────────────────────────────────────
function ReportCard({
  report,
  isDark,
  palette,
  index,
  onDownload,
  isDownloading,
  isDownloaded,
}: {
  report: DailyReport;
  isDark: boolean;
  palette: any;
  index: number;
  onDownload: () => void;
  isDownloading: boolean;
  isDownloaded: boolean;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const hasFile = true;
  const date = formatDate(report.report_date);
  const fileSize = formatFileSize(report.file_size_bytes);
  const rowCount = report.row_count ?? 0;
  const reportName = report.report_name ?? 'n8n Workflow Report';

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 350,
      delay: index * 70,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
      }}
    >
      <View style={[styles.card, { backgroundColor: isDark ? '#1A2744' : '#FFFFFF', borderColor: isDark ? '#2D3F6B' : '#E8EDF8' }]}>
        {/* ── Left date column ── */}
        <LinearGradient
          colors={isDark ? ['#3B4FCC', '#5B6FEE'] : ['#6366F1', '#818CF8']}
          style={styles.dateColumn}
        >
          <Text style={styles.dateDay}>{date.day}</Text>
          <Text style={styles.dateMonth}>{date.month}</Text>
          <Text style={styles.dateYear}>{date.year}</Text>

          {/* n8n icon */}
          <View style={styles.n8nBadge}>
            <Ionicons name="git-network-outline" size={11} color="rgba(255,255,255,0.8)" />
          </View>
        </LinearGradient>

        {/* ── Right content ── */}
        <View style={styles.cardBody}>
          {/* Title row */}
          <View style={styles.cardTitleRow}>
            <Text style={[styles.cardTitle, { color: palette.text }]} numberOfLines={1}>
              {reportName}
            </Text>
            {isDownloaded && (
              <View style={styles.savedPill}>
                <Ionicons name="checkmark-circle" size={11} color="#10B981" />
                <Text style={styles.savedText}>Saved</Text>
              </View>
            )}
          </View>

          {/* Subtitle: generated time */}
          <Text style={[styles.cardSub, { color: palette.textTertiary }]}>
            Generated at {formatTime(report.created_at)}
          </Text>

          {/* Meta chips */}
          <View style={styles.chipRow}>
            {rowCount > 0 && (
              <View style={[styles.chip, { backgroundColor: isDark ? '#2D3F6B' : '#EEF2FF' }]}>
                <Ionicons name="list-outline" size={11} color="#6366F1" />
                <Text style={[styles.chipText, { color: isDark ? '#A5B4FC' : '#4338CA' }]}>
                  {rowCount} rows
                </Text>
              </View>
            )}
            {fileSize && (
              <View style={[styles.chip, { backgroundColor: isDark ? '#1E3A2F' : '#ECFDF5' }]}>
                <Ionicons name="document-outline" size={11} color="#10B981" />
                <Text style={[styles.chipText, { color: isDark ? '#6EE7B7' : '#065F46' }]}>
                  {fileSize}
                </Text>
              </View>
            )}
            {report.scope && report.scope !== 'all' && (
              <View style={[styles.chip, { backgroundColor: isDark ? '#3B2A1A' : '#FFF7ED' }]}>
                <Ionicons name="filter-outline" size={11} color="#F59E0B" />
                <Text style={[styles.chipText, { color: isDark ? '#FCD34D' : '#92400E' }]}>
                  {report.scope === 'completed' ? 'Completed' : 'In Progress'}
                </Text>
              </View>
            )}
          </View>

          {/* Download button */}
          <TouchableOpacity
            style={[
              styles.downloadBtn,
              !hasFile && styles.downloadBtnDisabled,
              isDownloaded && styles.downloadBtnDone,
            ]}
            onPress={onDownload}
            disabled={isDownloading || !hasFile}
            activeOpacity={0.75}
          >
            {isDownloading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons
                  name={isDownloaded ? 'checkmark-circle-outline' : 'cloud-download-outline'}
                  size={16}
                  color="#fff"
                />
                <Text style={styles.downloadBtnText}>
                  {!hasFile
                    ? 'No file'
                    : isDownloaded
                    ? 'Download Again'
                    : 'Download CSV'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function ReportsScreen() {
  const { palette, isDark } = useTheme();
  const { t } = useTranslation();

  const [reports, setReports]     = useState<DailyReport[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloaded, setDownloaded]   = useState<Set<string>>(new Set());

  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: 1,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  // ── Fetch ──
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

  const handleDownload = async (report: DailyReport) => {
    setDownloading(report.id);
    try {
      const fileName = `report_${report.report_date}.csv`;
      const dest = (FileSystem.documentDirectory ?? '') + fileName;

      if (report.file_url) {
        const result = await FileSystem.downloadAsync(report.file_url, dest);
        setDownloaded((prev) => new Set(prev).add(report.id));
        Alert.alert('Downloaded ✓', `Saved as ${fileName}`, [
          {
            text: 'Open',
            onPress: async () => {
              if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(result.uri);
            },
          },
          { text: 'OK' },
        ]);
      } else if (report.csv_content) {
        await FileSystem.writeAsStringAsync(dest, report.csv_content, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        setDownloaded((prev) => new Set(prev).add(report.id));
        Alert.alert('Downloaded ✓', `Saved as ${fileName}`, [
          {
            text: 'Open',
            onPress: async () => {
              if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(dest);
            },
          },
          { text: 'OK' },
        ]);
      } else {
        // Fallback: Generate the CSV on the fly from current database values
        const csvContent = await generateCsvStringForDate(report.report_date);
        await FileSystem.writeAsStringAsync(dest, csvContent, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        setDownloaded((prev) => new Set(prev).add(report.id));
        Alert.alert('Downloaded ✓', `Generated CSV from database values: saved as ${fileName}`, [
          {
            text: 'Open',
            onPress: async () => {
              if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(dest);
            },
          },
          { text: 'OK' },
        ]);
      }
    } catch (err) {
      console.error('download error', err);
      Alert.alert('Download Failed', 'Could not download the report. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  const bg = isDark ? '#0D1B3E' : '#F0F4FF';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['bottom']}>

      {/* ── Gradient Header ── */}
      <LinearGradient
        colors={isDark ? ['#1A2744', '#0D1B3E'] : ['#6366F1', '#4F46E5']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        {/* Decorative circles */}
        <View style={styles.deco1} />
        <View style={styles.deco2} />

        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>

        <Animated.View
          style={[
            styles.headerText,
            {
              opacity: headerAnim,
              transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
            },
          ]}
        >
          <Text style={styles.headerTitle}>Reports</Text>
          <Text style={styles.headerSub}>
            {reports.length > 0
              ? `${reports.length} report${reports.length !== 1 ? 's' : ''} from n8n`
              : 'Workflow-generated CSV files'}
          </Text>
        </Animated.View>

        {/* Count badge */}
        {reports.length > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{reports.length}</Text>
          </View>
        )}
      </LinearGradient>

      {/* ── Body ── */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={[styles.loadingText, { color: palette.textSecondary }]}>
            Loading reports…
          </Text>
        </View>
      ) : reports.length === 0 ? (
        /* ── Empty State ── */
        <View style={styles.center}>
          <LinearGradient
            colors={isDark ? ['#1A2744', '#2D3F6B'] : ['#EEF2FF', '#C7D2FE']}
            style={styles.emptyCircle}
          >
            <Ionicons name="cloud-upload-outline" size={42} color={isDark ? '#818CF8' : '#6366F1'} />
          </LinearGradient>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>No Reports Yet</Text>
          <Text style={[styles.emptySub, { color: palette.textTertiary }]}>
            Reports appear here automatically each time your n8n workflow runs and generates a CSV.
          </Text>
          <TouchableOpacity
            style={styles.reloadBtn}
            onPress={() => { setLoading(true); fetchReports(); }}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={15} color="#fff" />
            <Text style={styles.reloadBtnText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* ── List ── */
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#6366F1"
              colors={['#6366F1']}
            />
          }
        >
          {reports.map((report, i) => (
            <ReportCard
              key={report.id}
              report={report}
              isDark={isDark}
              palette={palette}
              index={i}
              isDownloading={downloading === report.id}
              isDownloaded={downloaded.has(report.id)}
              onDownload={() => handleDownload(report)}
            />
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: 28,
    gap: spacing.sm,
    overflow: 'hidden',
  },
  deco1: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: -60,
    right: -30,
  },
  deco2: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.05)',
    bottom: -40,
    left: 60,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, marginLeft: 4 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  countBadge: {
    minWidth: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  countBadgeText: { fontSize: 15, fontWeight: '800', color: '#fff' },

  // List
  list: { padding: spacing.md, gap: spacing.md },

  // Card
  card: {
    flexDirection: 'row',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    ...shadows.md,
  },
  dateColumn: {
    width: 64,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 2,
  },
  dateDay: {
    fontSize: 26,
    fontWeight: '900',
    color: '#fff',
    lineHeight: 28,
    letterSpacing: -0.5,
  },
  dateMonth: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 1.2,
  },
  dateYear: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '500',
    marginTop: 2,
  },
  n8nBadge: {
    marginTop: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Card body
  cardBody: {
    flex: 1,
    padding: 14,
    gap: 6,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'space-between',
  },
  cardTitle: { fontSize: 14, fontWeight: '700', flex: 1 },
  cardSub: { fontSize: 11, fontWeight: '400' },
  savedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#D1FAE5',
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  savedText: { fontSize: 10, fontWeight: '700', color: '#065F46' },

  // Chips
  chipRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipText: { fontSize: 11, fontWeight: '600' },

  // Download button
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingVertical: 11,
    marginTop: 6,
    ...shadows.sm,
  },
  downloadBtnDisabled: { backgroundColor: '#94A3B8' },
  downloadBtnDone: { backgroundColor: '#10B981' },
  downloadBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // States
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: spacing.xl,
  },
  loadingText: { fontSize: 14, fontWeight: '500' },
  emptyCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 21, fontWeight: '800', letterSpacing: -0.3 },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 270,
    lineHeight: 20,
  },
  reloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#6366F1',
    borderRadius: 30,
    paddingHorizontal: 24,
    paddingVertical: 13,
    marginTop: 4,
    ...shadows.sm,
  },
  reloadBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
