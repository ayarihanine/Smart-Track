import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, Dimensions, Modal, Switch, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/design';
import { getAnalytics } from '@/lib/api';
import { AnalyticsData } from '@/types';
import { StageDurationHeatmap } from '@/components/StageDurationHeatmap';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/components/ThemeProvider';
import { useSettingsStore } from '@/store/settingsStore';
import { DashboardWidget } from '@/components/DashboardWidget';

const { width } = Dimensions.get('window');

function MetricCard({
  label, value, sub, icon, color, bg,
}: {
  label: string; value: string | number; sub?: string;
  icon: string; color: string; bg: string;
}) {
  const { palette } = useTheme();
  return (
    <View style={[styles.metricCard, { backgroundColor: bg }]}>
      <View style={[styles.metricIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      <Text style={[styles.metricValue, { color: palette.text }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: palette.textSecondary }]}>{label}</Text>
      {sub && <Text style={[styles.metricSub, { color: palette.textTertiary }]}>{sub}</Text>}
    </View>
  );
}

function ProgressBar({ percent, color }: { percent: number; color: string }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.min(percent, 100)}%`, backgroundColor: color }]} />
    </View>
  );
}

function StageBreakdownRow({
  stage, count, percent, color,
}: {
  stage: string; count: number; percent: number; color: string;
}) {
  const { palette } = useTheme();
  return (
    <View style={styles.stageRow}>
      <View style={[styles.stageDot, { backgroundColor: color }]} />
      <Text style={[styles.stageName, { color: palette.text }]}>{stage}</Text>
      <View style={styles.stageBarWrap}>
        <ProgressBar percent={percent} color={color} />
      </View>
      <Text style={[styles.stageCount, { color: palette.text }]}>{count}</Text>
      <Text style={[styles.stagePct, { color: palette.textTertiary }]}>{percent}%</Text>
    </View>
  );
}

function CompletionGauge({ rate, target }: { rate: number; target: number }) {
  const { t } = useTranslation();
  const isGood = rate >= target;
  const color = isGood ? '#10B981' : rate >= 60 ? '#F59E0B' : '#EF4444';

  return (
    <View style={styles.gaugeContainer}>
      <View style={[styles.gaugeBg, { borderColor: color + '30' }]}>
        <View style={styles.gaugeCenter}>
          <Text style={[styles.gaugeValue, { color }]}>{rate}%</Text>
          <Text style={styles.gaugeLabel}>{t('completionRate')}</Text>
        </View>
      </View>
      <View style={styles.gaugeTarget}>
        <Ionicons name={isGood ? 'checkmark-circle' : 'alert-circle'} size={16} color={color} />
        <Text style={[styles.gaugeTargetText, { color }]}>
          {isGood ? t('onTarget') : `${t('target')}: ${target}%`}
        </Text>
      </View>
    </View>
  );
}

export default function AnalyticsScreen() {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const { dashboardWidgets, setSettings } = useSettingsStore();

  const [period, setPeriod] = useState<'today' | 'this_week' | 'all_time'>('this_week');
  const [isManageModalVisible, setManageModalVisible] = useState(false);

  const PERIODS = [
    { key: 'today', label: t('today') },
    { key: 'this_week', label: t('thisWeek') },
    { key: 'all_time', label: t('allTime') },
  ] as const;

  const { data: analytics, isLoading, refetch } = useQuery<AnalyticsData>({
    queryKey: ['analytics', period],
    queryFn: () => getAnalytics(period),
  });

  const a = analytics;

  const toggleWidget = (id: string) => {
    const newWidgets = dashboardWidgets.map(w => w.id === id ? { ...w, visible: !w.visible } : w);
    setSettings({ dashboardWidgets: newWidgets });
  };

  const isVisible = (id: string) => dashboardWidgets.find(w => w.id === id)?.visible ?? true;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.backgroundSecondary }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: palette.background, borderBottomColor: palette.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: palette.text }]}>{t('analytics')}</Text>
          <Text style={[styles.headerSub, { color: palette.textSecondary }]}>{t('factoryPerformance')}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.refreshBtn, { backgroundColor: palette.primary + '15' }]}
            onPress={() => setManageModalVisible(true)}
          >
            <Ionicons name="options-outline" size={20} color={palette.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.refreshBtn, { backgroundColor: '#10B98115' }]}
            onPress={() => router.push('/export')}
          >
            <Ionicons name="share-outline" size={20} color="#10B981" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.refreshBtn, { backgroundColor: palette.backgroundSecondary }]} onPress={() => refetch()}>
            <Ionicons name="refresh" size={20} color={palette.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Period Selector */}
      <View style={[styles.periodRow, { backgroundColor: palette.background, borderBottomColor: palette.border }]}>
        {PERIODS.map(p => (
          <TouchableOpacity
            key={p.key}
            style={[styles.periodBtn, { backgroundColor: palette.backgroundSecondary }, period === p.key && { backgroundColor: palette.primary }]}
            onPress={() => setPeriod(p.key as any)}
          >
            <Text style={[styles.periodText, { color: palette.textSecondary }, period === p.key && styles.periodTextActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={palette.primary} />}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Metrics Grid */}
        {isVisible('metrics') && (
          <View style={styles.metricsGrid}>
            <MetricCard
              label={t('totalCards')}
              value={a?.totalCards ?? '--'}
              icon="layers"
              color={palette.primary}
              bg={palette.primary + '10'}
            />
            <MetricCard
              label={t('completed')}
              value={a?.completed ?? '--'}
              sub={(t('of') || 'of').replace('X', (a?.totalCards ?? 0).toString())}
              icon="checkmark-circle"
              color="#10B981"
              bg="#F0FDF4"
            />
            <MetricCard
              label={t('inProgress')}
              value={a?.inProgress ?? '--'}
              icon="settings"
              color="#F59E0B"
              bg="#FFFBEB"
            />
            <MetricCard
              label={t('activeNow')}
              value={a?.activeNow ?? '--'}
              icon="pulse"
              color="#8B5CF6"
              bg="#F5F3FF"
            />
          </View>
        )}

        {/* Completion Rate Widget */}
        <DashboardWidget 
            id="completion" 
            title={t('completionRate')} 
            visible={isVisible('completion')}
            onHide={() => toggleWidget('completion')}
        >
          <View style={styles.completionCard}>
            <CompletionGauge rate={a?.completionRate ?? 0} target={a?.targetRate ?? 85} />
            <View style={styles.completionStats}>
              <View style={styles.completionStat}>
                <Text style={[styles.completionStatVal, { color: palette.text }]}>{a?.completionRate ?? 0}%</Text>
                <Text style={[styles.completionStatLabel, { color: palette.textSecondary }]}>{t('actual')}</Text>
              </View>
              <View style={[styles.completionDivider, { backgroundColor: palette.border }]} />
              <View style={styles.completionStat}>
                <Text style={[styles.completionStatVal, { color: palette.text }]}>{a?.targetRate ?? 85}%</Text>
                <Text style={[styles.completionStatLabel, { color: palette.textSecondary }]}>{t('target')}</Text>
              </View>
              <View style={[styles.completionDivider, { backgroundColor: palette.border }]} />
              <View style={styles.completionStat}>
                <Text style={[
                  styles.completionStatVal,
                  { color: (a?.weeklyGrowth ?? 0) >= 0 ? '#10B981' : '#EF4444' },
                ]}>
                  {(a?.weeklyGrowth ?? 0) >= 0 ? '+' : ''}{a?.weeklyGrowth ?? 0}%
                </Text>
                <Text style={[styles.completionStatLabel, { color: palette.textSecondary }]}>{t('growth')}</Text>
              </View>
            </View>
          </View>
        </DashboardWidget>

        {/* Stage Breakdown Widget */}
        <DashboardWidget 
            id="breakdown" 
            title={t('stageBreakdown')} 
            visible={isVisible('breakdown')}
            onHide={() => toggleWidget('breakdown')}
        >
          <View style={styles.breakdownCard}>
            {(a?.stageBreakdown ?? []).map((item) => (
              <StageBreakdownRow
                key={item.stage}
                stage={item.stage}
                count={item.count}
                percent={item.percent}
                color={item.color}
              />
            ))}
            {!a?.stageBreakdown?.length && (
              <View style={styles.emptyState}>
                <Ionicons name="bar-chart-outline" size={36} color={palette.border} />
                <Text style={[styles.emptyText, { color: palette.textSecondary }]}>{t('noStageData')}</Text>
              </View>
            )}
          </View>
        </DashboardWidget>

        {/* Heatmap Widget */}
        <DashboardWidget 
            id="heatmap" 
            title={t('stageDurationHeatmap')} 
            visible={isVisible('heatmap')}
            onHide={() => toggleWidget('heatmap')}
        >
          <StageDurationHeatmap />
        </DashboardWidget>

        {/* Cycle Time Widget */}
        {a?.avgCycleTime !== undefined && (
          <DashboardWidget 
            id="cycle" 
            title={t('cycleTime')} 
            visible={isVisible('cycle')}
            onHide={() => toggleWidget('cycle')}
          >
            <View style={styles.cycleCard}>
              <View style={styles.cycleLeft}>
                <Ionicons name="timer-outline" size={32} color={palette.primary} />
                <View>
                  <Text style={[styles.cycleValue, { color: palette.text }]}>{a.avgCycleTime} {t('min')}</Text>
                  <Text style={[styles.cycleLabel, { color: palette.textSecondary }]}>{t('avgCycleTime')}</Text>
                </View>
              </View>
              <View style={[styles.cycleBadge, { backgroundColor: palette.primary + '15' }]}>
                <Text style={[styles.cycleBadgeText, { color: palette.primary }]}>{t('perCard')}</Text>
              </View>
            </View>
          </DashboardWidget>
        )}

        {/* AI Insight Widget */}
        {a?.insight && (
          <DashboardWidget 
            id="insight" 
            title={t('predictiveInsight')} 
            visible={isVisible('insight')}
            onHide={() => toggleWidget('insight')}
          >
            <View style={styles.insightCard}>
              <View style={styles.insightHeader}>
                <View style={styles.insightIconWrap}>
                  <Ionicons name="bulb" size={20} color="#F59E0B" />
                </View>
                <Text style={styles.insightTitle}>{t('aiAnalysis' as any)}</Text>
                <View style={styles.aiBadge}>
                  <Text style={styles.aiBadgeText}>{t('live' as any)}</Text>
                </View>
              </View>
              <Text style={styles.insightText}>{a.insight}</Text>
              <View style={styles.insightFooter}>
                <Ionicons name="time-outline" size={14} color="#64748B" />
                <Text style={styles.insightFooterText}>{t('since')} {a.sinceDate}</Text>
              </View>
            </View>
          </DashboardWidget>
        )}

        {/* Manage Widgets Modal */}
        <Modal visible={isManageModalVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: palette.background }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: palette.text }]}>{t('manageWidgets') || 'Manage Layout'}</Text>
                <TouchableOpacity onPress={() => setManageModalVisible(false)}>
                  <Ionicons name="close" size={24} color={palette.text} />
                </TouchableOpacity>
              </View>
              
              <ScrollView>
                {dashboardWidgets.map(widget => (
                  <View key={widget.id} style={[styles.manageRow, { borderBottomColor: palette.border }]}>
                    <Text style={[styles.manageLabel, { color: palette.text }]}>{t(widget.id as any) || widget.id.toUpperCase()}</Text>
                    <Switch
                      value={widget.visible}
                      onValueChange={() => toggleWidget(widget.id)}
                      trackColor={{ false: palette.border, true: palette.primary }}
                    />
                  </View>
                ))}
              </ScrollView>
              
              <TouchableOpacity
                style={[styles.doneBtn, { backgroundColor: palette.primary }]}
                onPress={() => setManageModalVisible(false)}
              >
                <Text style={styles.doneBtnText}>{t('save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Bottom padding */}
        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  headerTitle: { ...typography.h3 },
  headerSub: { ...typography.tiny, fontWeight: '600' },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  refreshBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  periodRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  periodBtn: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  periodText: { ...typography.caption, fontWeight: '600' },
  periodTextActive: { color: colors.white },
  scrollContent: { paddingBottom: spacing.xl },
  metricsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: spacing.lg, paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  metricCard: {
    width: (width - spacing.lg * 2 - spacing.sm) / 2,
    borderRadius: borderRadius.lg, padding: spacing.md,
    gap: spacing.xs, ...shadows.xs,
  },
  metricIcon: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  metricValue: { ...typography.h2 },
  metricLabel: { ...typography.caption },
  metricSub: { ...typography.small },
  completionCard: { alignItems: 'center', gap: spacing.lg },
  gaugeContainer: { alignItems: 'center', gap: spacing.sm },
  gaugeBg: {
    width: 120, height: 120, borderRadius: 60,
    borderWidth: 8, alignItems: 'center', justifyContent: 'center',
  },
  gaugeCenter: { alignItems: 'center' },
  gaugeValue: { ...typography.h2 },
  gaugeLabel: { ...typography.small, color: colors.textSecondary },
  gaugeTarget: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  gaugeTargetText: { ...typography.caption, fontWeight: '600' },
  completionStats: {
    flexDirection: 'row', gap: spacing.lg, alignItems: 'center',
  },
  completionStat: { alignItems: 'center', gap: 2 },
  completionStatVal: { ...typography.h3 },
  completionStatLabel: { ...typography.small },
  completionDivider: { width: 1, height: 32 },
  breakdownCard: { gap: spacing.md },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stageDot: { width: 10, height: 10, borderRadius: 5 },
  stageName: { ...typography.caption, fontWeight: '600', width: 64 },
  stageBarWrap: { flex: 1 },
  progressTrack: {
    height: 8, backgroundColor: '#00000010',
    borderRadius: borderRadius.full, overflow: 'hidden',
  },
  progressFill: { height: 8, borderRadius: borderRadius.full },
  stageCount: { ...typography.caption, fontWeight: '600', minWidth: 20, textAlign: 'right' },
  stagePct: { ...typography.small, minWidth: 32, textAlign: 'right' },
  cycleCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  cycleLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cycleValue: { ...typography.h3 },
  cycleLabel: { ...typography.small },
  cycleBadge: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm, paddingVertical: 4,
  },
  cycleBadgeText: { ...typography.small, fontWeight: '700' },
  insightCard: {
    backgroundColor: '#1E293B', borderRadius: borderRadius.xl,
    padding: spacing.md, gap: spacing.md,
  },
  insightHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  insightIconWrap: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F59E0B20', alignItems: 'center', justifyContent: 'center',
  },
  insightTitle: { ...typography.bodyBold, color: colors.white, flex: 1 },
  aiBadge: {
    backgroundColor: '#10B981', borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm, paddingVertical: 2,
  },
  aiBadgeText: { ...typography.tiny, color: colors.white, fontWeight: '700' },
  insightText: { ...typography.body, color: '#CBD5E1', lineHeight: 22 },
  insightFooter: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  insightFooterText: { ...typography.small, color: '#64748B' },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  emptyText: { ...typography.body },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: { ...typography.h2, fontWeight: '800' },
  manageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  manageLabel: { ...typography.bodyBold },
  doneBtn: {
    marginTop: spacing.xl,
    height: 56,
    borderRadius: borderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.md,
  },
  doneBtnText: { ...typography.bodyBold, color: colors.white },
});
