import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { borderRadius, spacing, typography } from '@/constants/design';
import { useTheme } from '@/components/ThemeProvider';
import { DailyReportSummary, fetchDailyReportSummaries } from '@/lib/api';

const ZERO_NOTE =
  'Note: KPIs will populate once the Pi5 writes to pertes_table and trg/trs tables.';

function statusColor(status: string): string {
  if (status === 'critical') return '#EF4444';
  if (status === 'warning') return '#F59E0B';
  return '#10B981';
}

function formatReportDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function isAllZero(report: DailyReportSummary): boolean {
  return (
    Number(report.total_produced) === 0 &&
    Number(report.total_good) === 0 &&
    Number(report.total_bad) === 0 &&
    Number(report.total_losses) === 0 &&
    Number(report.trg) === 0 &&
    Number(report.trs) === 0
  );
}

export default function QualityReportScreen() {
  const { palette } = useTheme();
  const [reports, setReports] = useState<DailyReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const rows = await fetchDailyReportSummaries(10);
      setReports(rows);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.backgroundSecondary }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: palette.background, borderBottomColor: palette.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={palette.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: palette.text }]}>Quality Report</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={palette.primary} />
          }
        >
          {reports.length === 0 ? (
            <Text style={[styles.emptyText, { color: palette.textSecondary }]}>
              No daily reports yet. Reports are generated automatically each evening.
            </Text>
          ) : (
            reports.map((report) => (
              <View
                key={report.id}
                style={[styles.card, { backgroundColor: palette.background, borderColor: palette.border }]}
              >
                <View style={styles.cardHeader}>
                  <Text style={[styles.dateText, { color: palette.text }]}>
                    {formatReportDate(report.period_start)}
                  </Text>
                  <View style={[styles.statusPill, { borderColor: statusColor(report.status) }]}>
                    <Text style={[styles.statusText, { color: statusColor(report.status) }]}>
                      {report.status || 'normal'}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.metric, { color: palette.textSecondary }]}>
                  Total produced: {report.total_produced}
                </Text>
                <Text style={[styles.metric, { color: palette.textSecondary }]}>
                  Total good: {report.total_good}
                </Text>
                <Text style={[styles.metric, { color: palette.textSecondary }]}>
                  Total bad: {report.total_bad}
                </Text>
                <Text style={[styles.metric, { color: palette.textSecondary }]}>
                  TRG: {report.trg}%
                </Text>
                <Text style={[styles.metric, { color: palette.textSecondary }]}>
                  TRS: {report.trs}%
                </Text>
                <Text style={[styles.metric, { color: palette.textSecondary }]}>
                  Losses: {report.total_losses}
                </Text>
                {isAllZero(report) && (
                  <Text style={[styles.note, { color: palette.textTertiary }]}>{ZERO_NOTE}</Text>
                )}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', ...typography.h4, fontWeight: '700' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.md, gap: spacing.md },
  emptyText: { ...typography.body, textAlign: 'center', marginTop: spacing.xl },
  card: { borderRadius: borderRadius.lg, borderWidth: 1, padding: spacing.md, gap: spacing.xs },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  dateText: { ...typography.bodyBold },
  statusPill: { borderWidth: 1, borderRadius: borderRadius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  statusText: { ...typography.tiny, fontWeight: '700', textTransform: 'capitalize' },
  metric: { ...typography.small },
  note: { ...typography.tiny, marginTop: spacing.sm, fontStyle: 'italic' },
});
