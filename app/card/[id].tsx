import React, { useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/design';
import { getCard, updateCardQuality, reassignCard, getScanEvents } from '@/lib/api';
import { ElectronicCard, ScanEvent } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/components/ThemeProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { LoadingPlanView } from '@/components/LoadingPlanView';
import { GuidedOperatorMode } from '@/components/GuidedOperatorMode';

const STAGE_TYPE_COLORS: Record<string, string> = {
  Assembly: '#2563EB',
  Testing: '#F59E0B',
  Shipping: '#10B981',
  QC: '#8B5CF6',
  SMT: '#0891B2',
  THT: '#059669',
  Packaging: '#D97706',
};


export default function CardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { palette } = useTheme();
  const { t } = useTranslation();
  const user = useAuthStore(s => s.user);
  const isSupervisor = (user as any)?.user_metadata?.role === 'supervisor' || (user as any)?.user_metadata?.role === 'admin';

  const MACHINES = [
    'SMT',
    'THT',
    'AOI',
    'Testing',
    'Packaging',
  ];

  // Quality state
  const [isEditingQuality, setIsEditingQuality] = React.useState(false);
  const [qualityIssues, setQualityIssues] = React.useState('');
  const [missingItems, setMissingItems] = React.useState('');

  // Reassignment state
  const [isReassigning, setIsReassigning] = React.useState(false);
  const [selectedStage, setSelectedStage] = React.useState('');
  const [newLocation, setNewLocation] = React.useState('');
  const [reassignNote, setReassignNote] = React.useState('');
  const [isGuidedMode, setIsGuidedMode] = React.useState(false);

  const { data: scanEvents, isLoading: scansLoading } = useQuery<ScanEvent[]>({
    queryKey: ['scan_events', id],
    queryFn: () => getScanEvents(id),
    enabled: !!id,
  });

  const { data: card, isLoading } = useQuery<ElectronicCard | null>({
    queryKey: ['card', id],
    queryFn: () => getCard(id),
    enabled: !!id,
  });

  // Actionable Insight: If at current stage > 2x average (mock avg 120 mins)
  const isDelayed = useMemo(() => {
    if (!card || !card.updatedAt || card.status === 'completed') return false;
    const timeAtStage = (Date.now() - new Date(card.updatedAt).getTime()) / 60000;
    return timeAtStage > 240; // 4 hours threshold for insight
  }, [card]);

  // Initialize state when card loads
  React.useEffect(() => {
    if (card) {
      setQualityIssues(card.qualityIssues || '');
      setMissingItems(card.missingItems || '');
    }
  }, [card]);

  const updateQualityMutation = useMutation({
    mutationFn: async () => {
      // @ts-ignore
      return updateCardQuality(card.cardId, qualityIssues, missingItems);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['card', id] });
      setIsEditingQuality(false);
    }
  });

  const reassignMutation = useMutation({
    mutationFn: async () => {
      if (!card || !selectedStage) throw new Error('Missing fields');
      return reassignCard(card.cardId, selectedStage, newLocation || card.currentMachine || '', reassignNote);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['card', id] });
      setIsReassigning(false);
      setReassignNote('');
    },
  });

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: palette.backgroundSecondary }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!card) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: palette.backgroundSecondary }]}>
        <Ionicons name="alert-circle-outline" size={48} color={palette.border} />
        <Text style={[styles.notFoundText, { color: palette.textSecondary }]}>{t('cardNotFound')}</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>{t('goBack')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const progress = card.progressPercent || 0;
  const isCompleted = card.status === 'completed';

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Actionable Insight Banner */}
        {isDelayed && (
          <View style={styles.insightBanner}>
            <View style={styles.insightIconCircle}>
              <Ionicons name="bulb" size={20} color="#F59E0B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.insightTitle}>{t('actionRequired')}</Text>
              <Text style={styles.insightBody}>
                {t('delayedInsight') || 'This card has been at the current stage for longer than usual. Consider investigating for bottlenecks.'}
              </Text>
            </View>
          </View>
        )}

        {/* Card Overview */}
        <View style={styles.overviewCard}>
          <View style={styles.overviewHeader}>
            <View style={styles.cardIdWrap}>
              <Ionicons name="card" size={20} color={colors.white} />
              <Text style={styles.cardIdText}>{card.cardId}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: isCompleted ? '#10B981' : '#2563EB' }]}>
              <Text style={styles.statusBadgeText}>
                {isCompleted ? t('completed') : t('inProgress')}
              </Text>
            </View>
          </View>

          {card.productId && (
            <Text style={styles.productName}>{t('product' as any) || 'Product'}: {card.productId}</Text>
          )}

          {/* Progress */}
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>{t('overallProgress')}</Text>
              <Text style={styles.progressPct}>{progress}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressSub}>
              {t('componentsInserted' as any) || 'Components Inserted:'} {(card.componentInsertions?.reduce((a,c)=>a+c.insertedQuantity,0) || 0)} / {(card.loadingPlan?.reduce((a,p)=>a+p.requiredQuantity,0) || 0)}
            </Text>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Ionicons name="settings-outline" size={16} color="rgba(255,255,255,0.7)" />
              <Text style={styles.statText}>{card.currentMachine || t('unknown')}</Text>
            </View>
            <View style={styles.stat}>
              <Ionicons name="timer-outline" size={16} color="rgba(255,255,255,0.7)" />
              <Text style={styles.statText}>{card.totalTimeMinutes || 0} {t('min')}</Text>
            </View>
            <View style={styles.stat}>
              <Ionicons name="scan-outline" size={16} color="rgba(255,255,255,0.7)" />
              <Text style={styles.statText}>{card.scanPoints} {t('scans')}</Text>
            </View>
          </View>
        </View>

        {/* Production History (Scan Events) */}
        <View style={styles.timelineSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('productionHistory') || 'Production History'}</Text>
            <View style={styles.historyBadge}>
              <Text style={styles.historyBadgeText}>{scanEvents?.length || 0} {t('events') || 'events'}</Text>
            </View>
          </View>
          
          {(scanEvents || []).map((event, i) => (
            <View key={event.id} style={styles.historyRow}>
              <View style={styles.historyLeft}>
                <View style={[styles.historyDot, { backgroundColor: i === 0 ? colors.primary : colors.border }]} />
                {i < (scanEvents?.length || 0) - 1 && <View style={styles.historyLine} />}
              </View>
              <View style={styles.historyCard}>
                <View style={styles.historyHeader}>
                  <Text style={styles.historyStage}>{event.stage}</Text>
                  <Text style={styles.historyTime}>
                    {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <Text style={styles.historyLocation}>{event.location} · {event.scannedBy}</Text>
                {event.notes && <Text style={styles.historyNotes}>"{event.notes}"</Text>}
              </View>
            </View>
          ))}

          {!scanEvents?.length && !scansLoading && (
            <View style={styles.emptyTimeline}>
              <Ionicons name="time-outline" size={40} color={colors.border} />
              <Text style={styles.emptyText}>{t('noHistoryFound') || 'No historical scan data found'}</Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity 
            style={[styles.guideToggle, isGuidedMode && styles.guideToggleActive]}
            onPress={() => setIsGuidedMode(!isGuidedMode)}
          >
            <Ionicons name={isGuidedMode ? 'close-circle' : 'navigate'} size={20} color={isGuidedMode ? colors.white : colors.primary} />
            <Text style={[styles.guideToggleText, isGuidedMode && { color: colors.white }]}>
              {isGuidedMode ? t('exitGuide' as any) || 'Exit Guide' : t('operatorGuide' as any) || 'Operator Guide'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Dynamic Guided Mode OR Loading Plan View */}
        <View style={styles.contentSection}>
          {isGuidedMode ? (
            <GuidedOperatorMode 
              loadingPlan={card.loadingPlan || []} 
              insertions={card.componentInsertions || []}
              onScanPress={() => {
                // Trigger scanner logic
                console.log('Open Scanner');
              }}
            />
          ) : (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t('loadingPlan' as any) || 'Loading Plan'}</Text>
                <View style={styles.historyBadge}>
                   <Text style={styles.historyBadgeText}>
                     {(card.loadingPlan?.length || 0)} {t('items' as any) || 'items'}
                   </Text>
                </View>
              </View>
              <LoadingPlanView 
                loadingPlan={card.loadingPlan || []} 
                insertions={card.componentInsertions || []} 
              />
            </>
          )}
        </View>

        {/* Quality Tracking Section */}
        <View style={styles.qualitySection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('qualityAndIssues')}</Text>
            {!isEditingQuality ? (
              <TouchableOpacity onPress={() => setIsEditingQuality(true)}>
                <Text style={styles.editLink}>{t('edit')}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => updateQualityMutation.mutate()}
                disabled={updateQualityMutation.isPending}
              >
                <Text style={styles.saveLink}>
                  {updateQualityMutation.isPending ? t('saving') : t('save')}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.qualityCard}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('qualityIssues')}</Text>
              {isEditingQuality ? (
                <View style={styles.textAreaContainer}>
                  <TextInput
                    style={styles.textArea}
                    multiline
                    numberOfLines={3}
                    placeholder={t('qualityDefectsPlaceholder')}
                    value={qualityIssues}
                    onChangeText={setQualityIssues}
                    textAlignVertical="top"
                  />
                </View>
              ) : (
                <Text style={card?.qualityIssues ? styles.valueText : styles.emptyText}>
                  {card?.qualityIssues || t('noQualityReported')}
                </Text>
              )}
            </View>

            <View style={[styles.inputGroup, { marginTop: spacing.md }]}>
              <Text style={styles.inputLabel}>{t('missingItems')}</Text>
              {isEditingQuality ? (
                <View style={styles.textAreaContainer}>
                  <TextInput
                    style={styles.textArea}
                    multiline
                    numberOfLines={3}
                    placeholder={t('missingComponentsPlaceholder')}
                    value={missingItems}
                    onChangeText={setMissingItems}
                    textAlignVertical="top"
                  />
                </View>
              ) : (
                <Text style={card?.missingItems ? styles.valueText : styles.emptyText}>
                  {card?.missingItems || t('noMissingItems')}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Supervisor Reassignment Panel */}
        {isSupervisor && (
          <View style={[styles.qualitySection, { marginTop: spacing.lg }]}>
            <View style={styles.sectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="swap-horizontal" size={16} color="#8B5CF6" />
                <Text style={[styles.sectionTitle, { color: palette.text, marginBottom: 0 }]}>{t('reassignStage')}</Text>
              </View>
              <TouchableOpacity onPress={() => {
                setIsReassigning(!isReassigning);
                setSelectedStage(card.currentMachine || MACHINES[0]);
                setNewLocation('');
              }}>
                <Text style={[styles.editLink, { color: '#8B5CF6' }]}>
                  {isReassigning ? t('cancel') : t('change')}
                </Text>
              </TouchableOpacity>
            </View>

            {!isReassigning ? (
              <View style={[styles.qualityCard, { backgroundColor: palette.background, borderColor: palette.border }]}>
                <Text style={[styles.inputLabel, { color: palette.textSecondary }]}>{t('currentMachine' as any) || 'Current Machine'}</Text>
                <Text style={[styles.valueText, { color: palette.text }]}>{card.currentMachine || 'None'}</Text>
                <Text style={[styles.inputLabel, { color: palette.textSecondary, marginTop: spacing.sm }]}>{t('currentMachineStatus' as any) || 'Machine Status'}</Text>
                <Text style={[styles.valueText, { color: palette.text }]}>{card.currentMachineStatus || 'Unknown'}</Text>
              </View>
            ) : (
              <View style={[styles.qualityCard, { backgroundColor: palette.background, borderColor: palette.border }]}>
                <Text style={[styles.inputLabel, { color: palette.textSecondary }]}>{t('selectNewMachine' as any) || 'Select New Machine'}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 6 }}>
                  {MACHINES.map(m => (
                    <TouchableOpacity
                      key={m}
                      onPress={() => setSelectedStage(m)}
                      style={[
                        styles.stageChip,
                        selectedStage === m && styles.stageChipActive,
                        { borderColor: selectedStage === m ? '#8B5CF6' : palette.border }
                      ]}
                    >
                      <Text style={[
                        styles.stageChipText,
                        { color: selectedStage === m ? '#8B5CF6' : palette.textSecondary }
                      ]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.inputLabel, { color: palette.textSecondary, marginTop: spacing.md }]}>{t('newLocation')}</Text>
                <View style={[styles.textAreaContainer, { borderColor: palette.border, backgroundColor: palette.backgroundSecondary }]}>
                  <TextInput
                    style={[styles.textArea, { color: palette.text }]}
                    placeholder="e.g. Station 3 - SMT"
                    placeholderTextColor={palette.textTertiary}
                    value={newLocation}
                    onChangeText={setNewLocation}
                    numberOfLines={1}
                    textAlignVertical="center"
                  />
                </View>

                <Text style={[styles.inputLabel, { color: palette.textSecondary, marginTop: spacing.md }]}>{t('notesReason')}</Text>
                <View style={[styles.textAreaContainer, { borderColor: palette.border, backgroundColor: palette.backgroundSecondary }]}>
                  <TextInput
                    style={[styles.textArea, { color: palette.text }]}
                    multiline
                    numberOfLines={2}
                    placeholder={t('reassignReasonPlaceholder')}
                    placeholderTextColor={palette.textTertiary}
                    value={reassignNote}
                    onChangeText={setReassignNote}
                    textAlignVertical="top"
                  />
                </View>

                <TouchableOpacity
                  style={[styles.saveBtn, { opacity: reassignMutation.isPending ? 0.6 : 1 }]}
                  onPress={() => reassignMutation.mutate()}
                  disabled={!selectedStage || reassignMutation.isPending}
                >
                  {reassignMutation.isPending ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Text style={styles.saveBtnText}>{t('confirmReassignment')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSecondary },
  loadingContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.backgroundSecondary, gap: spacing.md,
  },
  notFoundText: { ...typography.body, color: colors.textSecondary },
  backLink: { ...typography.body, color: colors.primary },
  stageChip: {
    paddingHorizontal: spacing.sm, paddingVertical: 6,
    borderRadius: borderRadius.full, borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  stageChipActive: { backgroundColor: '#F5F3FF' },
  stageChipText: { ...typography.tiny, fontWeight: '700' },
  saveBtn: {
    backgroundColor: '#8B5CF6', height: 44, borderRadius: borderRadius.md,
    alignItems: 'center', justifyContent: 'center', marginTop: spacing.md,
  },
  saveBtnText: { ...typography.bodyBold, color: colors.white },
  overviewCard: {
    backgroundColor: '#1E3A8A', margin: spacing.lg,
    borderRadius: borderRadius.xl, padding: spacing.lg,
    ...shadows.lg, gap: spacing.md,
  },
  overviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardIdWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardIdText: { ...typography.h3, color: colors.white },
  statusBadge: {
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  statusBadgeText: { ...typography.small, color: colors.white, fontWeight: '700' },
  productName: { ...typography.body, color: 'rgba(255,255,255,0.8)' },
  progressSection: { gap: spacing.xs },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { ...typography.caption, color: 'rgba(255,255,255,0.7)' },
  progressPct: { ...typography.captionBold, color: colors.white },
  progressTrack: {
    height: 8, backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: borderRadius.full, overflow: 'hidden',
  },
  progressFill: {
    height: 8, backgroundColor: '#60A5FA',
    borderRadius: borderRadius.full,
  },
  progressSub: { ...typography.small, color: 'rgba(255,255,255,0.6)' },
  statsRow: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xs },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { ...typography.small, color: 'rgba(255,255,255,0.8)' },
  timelineSection: { paddingHorizontal: spacing.lg },
  sectionTitle: { ...typography.h4, color: colors.text, marginBottom: spacing.lg },
  timelineRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm },
  timelineLeft: { alignItems: 'center', width: 24 },
  timelineLine: { width: 2, flex: 1, marginTop: 4, minHeight: 24 },
  timelineCard: {
    flex: 1, backgroundColor: colors.white,
    borderRadius: borderRadius.lg, padding: spacing.md,
    ...shadows.xs, gap: 6, marginBottom: spacing.xs,
    borderWidth: 1, borderColor: colors.border,
  },
  timelineCardActive: {
    borderColor: '#2563EB', borderWidth: 1.5,
    backgroundColor: '#EFF6FF',
  },
  timelineCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stageTypeBadge: {
    paddingHorizontal: spacing.sm, paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  stageTypeText: { ...typography.tiny, fontWeight: '700' },
  stageOrder: { ...typography.small, color: colors.textTertiary },
  stageName: { ...typography.bodyBold, color: colors.text },
  stageMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stageMetaText: { ...typography.small, color: colors.textSecondary },
  inProgressBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#DBEAFE', paddingHorizontal: spacing.sm,
    paddingVertical: 3, borderRadius: borderRadius.full, marginTop: 4,
  },
  inProgressDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: '#2563EB',
  },
  inProgressText: { ...typography.tiny, color: '#2563EB', fontWeight: '700' },
  pendingText: { ...typography.small, color: colors.textTertiary, fontStyle: 'italic' },
  emptyTimeline: {
    alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm,
  },
  emptyText: { ...typography.body, color: colors.textSecondary },
  qualitySection: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  editLink: { ...typography.bodyBold, color: colors.primary },
  saveLink: { ...typography.bodyBold, color: '#10B981' },
  qualityCard: {
    backgroundColor: colors.white, borderRadius: borderRadius.lg,
    padding: spacing.md, ...shadows.sm, borderWidth: 1, borderColor: colors.border
  },
  inputGroup: { gap: 4 },
  inputLabel: { ...typography.smallBold, color: colors.textSecondary },
  valueText: { ...typography.body, color: colors.text },
  textAreaContainer: {
    borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md,
    padding: spacing.sm, backgroundColor: colors.backgroundSecondary,
  },
  textArea: { ...typography.body, color: colors.text, minHeight: 60 },
  insightBanner: {
    margin: spacing.lg,
    padding: spacing.md,
    backgroundColor: '#FFFBEB',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#FEF3C7',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    ...shadows.sm,
  },
  insightIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightTitle: {
    ...typography.bodyBold,
    color: '#92400E',
  },
  insightBody: {
    ...typography.small,
    color: '#B45309',
    marginTop: 2,
  },
  historyBadge: {
    backgroundColor: colors.backgroundTertiary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  historyBadgeText: {
    ...typography.tiny,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  historyRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  historyLeft: {
    alignItems: 'center',
    width: 12,
  },
  historyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
    zIndex: 1,
  },
  historyLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.border,
    marginVertical: -2,
  },
  historyCard: {
    flex: 1,
    paddingBottom: spacing.lg,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyStage: {
    ...typography.bodyBold,
    color: colors.text,
  },
  historyTime: {
    ...typography.tiny,
    color: colors.textTertiary,
  },
  historyLocation: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 2,
  },
  historyNotes: {
    ...typography.small,
    color: colors.textTertiary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  compactStage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  compactStageName: {
    ...typography.tiny,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  guideToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    ...shadows.sm,
  },
  guideToggleActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  guideToggleText: {
    ...typography.smallBold,
    color: colors.primary,
  },
  contentSection: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
});
