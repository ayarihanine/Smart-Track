import React, { useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, TextInput, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/design';
import { createIssue, getCard, updateCardQuality, reassignCard, getScanEvents } from '@/lib/api';
import { ElectronicCard, ScanEvent } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/components/ThemeProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { getSupabaseClient } from '@/lib/supabase';
import { getActiveElapsedMs } from '@/store/alertsStore';

const STATUS_COLOR: Record<string, string> = {
  completed: '#10B981',
  in_progress: '#2563EB',
  pending: '#F59E0B',
  blocked: '#EF4444',
};

const MACHINES = ['SMT', 'THT', 'AOI', 'Testing', 'Packaging'];

function formatDateTime(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString([], { day: '2-digit', month: 'short' }) +
    ' · ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function CardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { palette } = useTheme();
  const { t } = useTranslation();
  const user = useAuthStore(s => s.user);
  const isSupervisor =
    (user as any)?.user_metadata?.role === 'supervisor' ||
    (user as any)?.user_metadata?.role === 'admin';

  // Quality state
  const [isEditingQuality, setIsEditingQuality] = React.useState(false);
  const [qualityIssues, setQualityIssues] = React.useState('');
  const [missingItems, setMissingItems] = React.useState('');

  // Reassignment state
  const [isReassigning, setIsReassigning] = React.useState(false);
  const [selectedStage, setSelectedStage] = React.useState('');
  const [newLocation, setNewLocation] = React.useState('');
  const [reassignNote, setReassignNote] = React.useState('');

  const [scanEvents, setScanEvents] = React.useState<ScanEvent[]>([]);
  const [card, setCard] = React.useState<ElectronicCard | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const fetchCardDetails = React.useCallback(async () => {
    if (!id) return;
    try {
      const [cardData, scansData] = await Promise.all([
        getCard(id),
        getScanEvents(id),
      ]);
      setCard(cardData || null);
      setScanEvents(scansData || []);
    } catch (error) {
      console.error('fetchCardDetails failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    fetchCardDetails();
  }, [fetchCardDetails]);

  // Realtime subscription — filter on id column (not cardId)
  React.useEffect(() => {
    if (!id) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const ch = supabase
      .channel(`card-detail-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'electronic_cards', filter: `id=eq.${id}` }, fetchCardDetails)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scan_events', filter: `id=eq.${id}` }, fetchCardDetails)
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [id, fetchCardDetails]);

  // Delayed banner: card at current stage > 36 hours of active working time
  const isDelayed = useMemo(() => {
    if (!card || card.status === 'completed') return false;
    const ref = card.stageEnteredAt || card.updatedAt;
    if (!ref) return false;
    const activeMs = getActiveElapsedMs(ref, 8, 17);
    return activeMs / (1000 * 60 * 60) >= 36;
  }, [card]);

  // Sync quality fields when card loads
  React.useEffect(() => {
    if (card) {
      setQualityIssues(card.qualityIssues || '');
      setMissingItems(card.missingItems || '');
    }
  }, [card]);

  const updateQualityMutation = useMutation({
    mutationFn: async () => {
      if (!card) throw new Error('No card');
      return updateCardQuality(card.cardId, qualityIssues, missingItems);
    },
    onSuccess: () => { fetchCardDetails(); setIsEditingQuality(false); },
  });

  const reassignMutation = useMutation({
    mutationFn: async () => {
      if (!card || !selectedStage) throw new Error('Missing fields');
      return reassignCard(card.cardId, selectedStage, newLocation || card.currentMachine || '', reassignNote);
    },
    onSuccess: () => {
      fetchCardDetails();
      setIsReassigning(false);
      setReassignNote('');
      setNewLocation('');
    },
  });

  const createIssueMutation = useMutation({
    mutationFn: async () => {
      if (!card) throw new Error('No card');
      await updateCardQuality(card.cardId, qualityIssues, missingItems);
      const issueText = [qualityIssues.trim(), missingItems.trim()].filter(Boolean).join(' | ');
      return createIssue({
        title: `Quality issue - ${card.cardId}`,
        description: issueText || `Escalated from card ${card.cardId}`,
        priority: 'high',
        cardId: card.cardId,
        reportedBy: user?.id,
        status: 'open',
      } as any);
    },
    onSuccess: () => {
      Alert.alert('Success', 'Issue created from card quality section.');
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.message || 'Failed to create issue.');
    },
  });

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: palette.backgroundSecondary }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!card) {
    return (
      <View style={[styles.centered, { backgroundColor: palette.backgroundSecondary }]}>
        <Ionicons name="alert-circle-outline" size={52} color={palette.border} />
        <Text style={[styles.notFoundText, { color: palette.textSecondary }]}>{t('cardNotFound')}</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>{t('goBack')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const progress = card.progressPercent || 0;
  const isCompleted = card.status === 'completed';
  const statusColor = STATUS_COLOR[card.status] || '#6B7280';
  const totalInserted = card.componentInsertions?.reduce((a, c) => a + (c.insertedQuantity || 0), 0) ?? 0;
  const totalRequired = card.loadingPlan?.reduce((a, p) => a + (p.requiredQuantity || 0), 0) ?? 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.backgroundSecondary }]} edges={['top', 'bottom']}>
      {/* ── Header ── */}
      <View style={[styles.header, { backgroundColor: palette.background, borderBottomColor: palette.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
          <Ionicons name="arrow-back" size={22} color={palette.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: palette.text }]} numberOfLines={1}>
            Card {card.cardId}
          </Text>
          {card.productId ? (
            <Text style={[styles.headerSub, { color: palette.textSecondary }]} numberOfLines={1}>
              Product: {card.productId}
            </Text>
          ) : null}
        </View>
        <View style={[styles.statusPill, { backgroundColor: statusColor + '20', borderColor: statusColor }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusPillText, { color: statusColor }]}>
            {isCompleted ? t('completed') : t('inProgress')}
          </Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* ── Delay Banner ── */}
        {isDelayed && (
          <View style={styles.delayBanner}>
            <Ionicons name="warning-outline" size={20} color="#D97706" />
            <Text style={styles.delayText}>
              This card has exceeded the normal stage duration. Consider investigating for bottlenecks.
            </Text>
          </View>
        )}

        {/* ── Overview Card ── */}
        <LinearGradient
          colors={['#0F766E', '#115E59', '#134E4A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.overviewCard}
        >
          {/* Progress */}
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>{t('overallProgress')}</Text>
              <Text style={styles.progressPct}>{progress}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            {totalRequired > 0 && (
              <Text style={styles.progressSub}>
                {totalInserted} / {totalRequired} components inserted
              </Text>
            )}
          </View>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="settings-outline" size={14} color="rgba(255,255,255,0.6)" />
              <Text style={styles.statLabel}>Machine</Text>
              <Text style={styles.statValue}>{card.currentMachine || '—'}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons name="timer-outline" size={14} color="rgba(255,255,255,0.6)" />
              <Text style={styles.statLabel}>Total Time</Text>
              <Text style={styles.statValue}>{card.totalTimeMinutes ? `${card.totalTimeMinutes} min` : '—'}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons name="scan-outline" size={14} color="rgba(255,255,255,0.6)" />
              <Text style={styles.statLabel}>Scans</Text>
              <Text style={styles.statValue}>{card.scanPoints ?? scanEvents.length}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ── Production History ── */}
        <View style={[styles.section, { backgroundColor: palette.background, borderColor: palette.border }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>{t('productionHistory')}</Text>
            <View style={[styles.badge, { backgroundColor: palette.backgroundSecondary }]}>
              <Text style={[styles.badgeText, { color: palette.textSecondary }]}>
                {scanEvents.length} events
              </Text>
            </View>
          </View>

          {scanEvents.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="time-outline" size={36} color={palette.border} />
              <Text style={[styles.emptyStateText, { color: palette.textTertiary }]}>
                {t('noHistoryFound')}
              </Text>
            </View>
          ) : (
            scanEvents.map((event, i) => (
              <View key={event.id} style={styles.timelineRow}>
                {/* Line + Dot */}
                <View style={styles.timelineLeft}>
                  <View style={[
                    styles.timelineDot,
                    { backgroundColor: i === 0 ? colors.primary : palette.border }
                  ]} />
                  {i < scanEvents.length - 1 && (
                    <View style={[styles.timelineLine, { backgroundColor: palette.border }]} />
                  )}
                </View>
                {/* Content */}
                <View style={[
                  styles.timelineCard,
                  { backgroundColor: palette.backgroundSecondary, borderColor: i === 0 ? colors.primary : palette.border },
                  i === 0 && styles.timelineCardActive,
                ]}>
                  <View style={styles.timelineCardHeader}>
                    <Text style={[styles.timelineStage, { color: palette.text }]}>
                      {event.stage || '—'}
                    </Text>
                    <Text style={[styles.timelineTime, { color: palette.textTertiary }]}>
                      {formatDateTime(event.timestamp)}
                    </Text>
                  </View>
                  {(event.location || event.scannedBy) && (
                    <Text style={[styles.timelineMeta, { color: palette.textSecondary }]}>
                      {[event.location, event.scannedBy].filter(Boolean).join(' · ')}
                    </Text>
                  )}
                  {event.notes ? (
                    <Text style={[styles.timelineNotes, { color: palette.textTertiary }]}> 
                      {`"${event.notes}"`}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </View>

        {/* ── Quality & Issues ── */}
        <View style={[styles.section, { backgroundColor: palette.background, borderColor: palette.border }]}> 
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>{t('qualityAndIssues')}</Text>
            <View style={[styles.livePill, { backgroundColor: palette.backgroundSecondary, borderColor: palette.border }]}> 
              <Text style={[styles.livePillText, { color: palette.textSecondary }]}>Quality Log</Text>
            </View>
          </View>

          {/* Quality Issues */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>{t('qualityIssues')}</Text>
            {isEditingQuality ? (
              <View style={[styles.inputBox, { borderColor: palette.border, backgroundColor: palette.backgroundSecondary }]}>
                <TextInput
                  style={[styles.inputText, { color: palette.text }]}
                  multiline
                  numberOfLines={3}
                  placeholder={t('qualityDefectsPlaceholder')}
                  placeholderTextColor={palette.textTertiary}
                  value={qualityIssues}
                  onChangeText={setQualityIssues}
                  textAlignVertical="top"
                />
              </View>
            ) : (
              <Text style={[styles.fieldValue, { color: card.qualityIssues ? palette.text : palette.textTertiary }]}>
                {card.qualityIssues || t('noQualityReported')}
              </Text>
            )}
          </View>

          {/* Missing Items */}
          <View style={[styles.fieldGroup, { marginTop: spacing.md }]}>
            <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>{t('missingItems')}</Text>
            {isEditingQuality ? (
              <View style={[styles.inputBox, { borderColor: palette.border, backgroundColor: palette.backgroundSecondary }]}>
                <TextInput
                  style={[styles.inputText, { color: palette.text }]}
                  multiline
                  numberOfLines={3}
                  placeholder={t('missingComponentsPlaceholder')}
                  placeholderTextColor={palette.textTertiary}
                  value={missingItems}
                  onChangeText={setMissingItems}
                  textAlignVertical="top"
                />
              </View>
            ) : (
              <Text style={[styles.fieldValue, { color: card.missingItems ? palette.text : palette.textTertiary }]}>
                {card.missingItems || t('noMissingItems')}
              </Text>
            )}
          </View>

          <View style={[styles.qualityActionsRow, { borderTopColor: palette.border }]}> 
            <TouchableOpacity
              style={[styles.qualityActionBtn, { borderColor: palette.border, backgroundColor: palette.backgroundSecondary }]}
              onPress={() => {
                if (isEditingQuality) {
                  updateQualityMutation.mutate();
                } else {
                  setIsEditingQuality(true);
                }
              }}
            >
              <Ionicons name={isEditingQuality ? 'save-outline' : 'create-outline'} size={16} color={palette.textSecondary} />
              <Text style={[styles.qualityActionText, { color: palette.textSecondary }]}>
                {isEditingQuality ? (updateQualityMutation.isPending ? 'Saving...' : 'Save Notes') : 'Edit Notes'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.qualityActionBtnPrimary, { opacity: createIssueMutation.isPending || (!qualityIssues.trim() && !missingItems.trim()) ? 0.7 : 1 }]}
              onPress={() => createIssueMutation.mutate()}
              disabled={createIssueMutation.isPending || (!qualityIssues.trim() && !missingItems.trim())}
            >
              <Ionicons name="alert-circle-outline" size={16} color="#FFFFFF" />
              <Text style={styles.qualityActionPrimaryText}>{createIssueMutation.isPending ? 'Escalating...' : 'Escalate Issue'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Supervisor: Reassign Stage ── */}
        {isSupervisor && (
          <View style={[styles.section, { backgroundColor: palette.background, borderColor: '#8B5CF630' }]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="swap-horizontal" size={16} color="#8B5CF6" />
                <Text style={[styles.sectionTitle, { color: palette.text, marginBottom: 0 }]}>
                  {t('reassignStage')}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setIsReassigning(!isReassigning);
                  setSelectedStage(card.currentMachine || MACHINES[0]);
                  setNewLocation('');
                }}
                style={styles.actionLink}
              >
                <Text style={[styles.actionLinkText, { color: '#8B5CF6' }]}>
                  {isReassigning ? t('cancel') : t('change')}
                </Text>
              </TouchableOpacity>
            </View>

            {!isReassigning ? (
              <View style={styles.infoGrid}>
                <View style={styles.infoCell}>
                  <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>Current Machine</Text>
                  <Text style={[styles.fieldValue, { color: palette.text }]}>{card.currentMachine || '—'}</Text>
                </View>
                <View style={styles.infoCell}>
                  <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>Machine Status</Text>
                  <Text style={[styles.fieldValue, { color: palette.text }]}>{card.currentMachineStatus || '—'}</Text>
                </View>
              </View>
            ) : (
              <View style={{ gap: spacing.md }}>
                {/* Machine chips */}
                <View>
                  <Text style={[styles.fieldLabel, { color: palette.textSecondary, marginBottom: 8 }]}>
                    Select New Machine
                  </Text>
                  <View style={styles.chipRow}>
                    {MACHINES.map(m => (
                      <TouchableOpacity
                        key={m}
                        onPress={() => setSelectedStage(m)}
                        style={[
                          styles.chip,
                          {
                            borderColor: selectedStage === m ? '#8B5CF6' : palette.border,
                            backgroundColor: selectedStage === m ? '#8B5CF615' : 'transparent',
                          }
                        ]}
                      >
                        <Text style={[styles.chipText, { color: selectedStage === m ? '#8B5CF6' : palette.textSecondary }]}>
                          {m}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* New location input */}
                <View>
                  <Text style={[styles.fieldLabel, { color: palette.textSecondary, marginBottom: 4 }]}>
                    {t('newLocation')}
                  </Text>
                  <View style={[styles.inputBox, { borderColor: palette.border, backgroundColor: palette.backgroundSecondary }]}>
                    <TextInput
                      style={[styles.inputText, { color: palette.text }]}
                      placeholder="e.g. Station 3 - SMT"
                      placeholderTextColor={palette.textTertiary}
                      value={newLocation}
                      onChangeText={setNewLocation}
                    />
                  </View>
                </View>

                {/* Reason */}
                <View>
                  <Text style={[styles.fieldLabel, { color: palette.textSecondary, marginBottom: 4 }]}>
                    {t('notesReason')}
                  </Text>
                  <View style={[styles.inputBox, { borderColor: palette.border, backgroundColor: palette.backgroundSecondary }]}>
                    <TextInput
                      style={[styles.inputText, { color: palette.text }]}
                      multiline
                      numberOfLines={2}
                      placeholder={t('reassignReasonPlaceholder')}
                      placeholderTextColor={palette.textTertiary}
                      value={reassignNote}
                      onChangeText={setReassignNote}
                      textAlignVertical="top"
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[
                    styles.confirmBtn,
                    { opacity: !selectedStage || reassignMutation.isPending ? 0.55 : 1 }
                  ]}
                  onPress={() => reassignMutation.mutate()}
                  disabled={!selectedStage || reassignMutation.isPending}
                >
                  {reassignMutation.isPending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.confirmBtnText}>{t('confirmReassignment')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        <View style={{ height: spacing.xl * 2 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md,
  },
  notFoundText: { ...typography.body },
  backBtn: {
    marginTop: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.primary + '15', borderRadius: borderRadius.md,
  },
  backBtnText: { ...typography.bodyBold, color: colors.primary },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm, gap: spacing.sm,
    borderBottomWidth: 1, ...shadows.xs,
  },
  headerBack: {
    width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { ...typography.h4, fontWeight: '700' },
  headerSub: { ...typography.tiny, marginTop: 1 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: borderRadius.full, borderWidth: 1.5,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { ...typography.tiny, fontWeight: '800', letterSpacing: 0.3 },

  scrollContent: { paddingBottom: spacing.xl },

  // Delay banner
  delayBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    margin: spacing.md, padding: spacing.md,
    backgroundColor: '#FFFBEB', borderRadius: borderRadius.lg,
    borderWidth: 1, borderColor: '#FDE68A', ...shadows.xs,
  },
  delayText: { ...typography.small, color: '#92400E', flex: 1 },

  // Overview card
  overviewCard: {
    marginHorizontal: spacing.md, marginTop: spacing.md,
    backgroundColor: '#1E3A8A', borderRadius: borderRadius.xl,
    padding: spacing.lg, gap: spacing.lg, ...shadows.lg,
  },
  progressSection: { gap: 6 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { ...typography.small, color: 'rgba(255,255,255,0.75)' },
  progressPct: { ...typography.smallBold, color: '#fff' },
  progressTrack: {
    height: 7, backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: borderRadius.full, overflow: 'hidden',
  },
  progressFill: { height: 7, backgroundColor: '#60A5FA', borderRadius: borderRadius.full },
  progressSub: { ...typography.tiny, color: 'rgba(255,255,255,0.6)' },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center', gap: 3 },
  statLabel: { ...typography.tiny, color: 'rgba(255,255,255,0.55)' },
  statValue: { ...typography.smallBold, color: '#fff', textAlign: 'center' },
  statDivider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.15)' },

  // Sections
  section: {
    margin: spacing.md, marginTop: 0, borderRadius: borderRadius.xl,
    padding: spacing.lg, borderWidth: 1, ...shadows.xs,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: spacing.md,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { ...typography.bodyBold, fontSize: 16, fontWeight: '700' },
  badge: {
    paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  badgeText: { ...typography.tiny, fontWeight: '700' },
  livePill: {
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  livePillText: { ...typography.tiny, fontWeight: '700', textTransform: 'uppercase' },
  qualityActionsRow: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    paddingTop: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  qualityActionBtn: {
    flex: 1,
    height: 42,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  qualityActionBtnPrimary: {
    flex: 1,
    height: 42,
    borderRadius: borderRadius.lg,
    backgroundColor: '#0F766E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...shadows.xs,
  },
  qualityActionText: { ...typography.smallBold },
  qualityActionPrimaryText: { ...typography.smallBold, color: '#FFFFFF' },

  // Timeline
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  emptyStateText: { ...typography.body },
  timelineRow: { flexDirection: 'row', gap: spacing.md, marginBottom: 4 },
  timelineLeft: { alignItems: 'center', width: 14, paddingTop: 4 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, zIndex: 1 },
  timelineLine: { width: 2, flex: 1, marginTop: 4, minHeight: 20 },
  timelineCard: {
    flex: 1, borderRadius: borderRadius.lg, padding: spacing.md,
    gap: 4, marginBottom: spacing.sm, borderWidth: 1.5,
  },
  timelineCardActive: { borderColor: colors.primary },
  timelineCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timelineStage: { ...typography.bodyBold, fontSize: 14 },
  timelineTime: { ...typography.tiny },
  timelineMeta: { ...typography.small, marginTop: 2 },
  timelineNotes: { ...typography.small, fontStyle: 'italic', marginTop: 4 },

  // Fields
  fieldGroup: { gap: 4 },
  fieldLabel: { ...typography.smallBold },
  fieldValue: { ...typography.body, marginTop: 2 },
  inputBox: { borderWidth: 1, borderRadius: borderRadius.md, padding: spacing.sm, marginTop: 4 },
  inputText: { ...typography.body, minHeight: 40 },

  // Info grid (supervisor view)
  infoGrid: { flexDirection: 'row', gap: spacing.md },
  infoCell: { flex: 1, gap: 4 },

  // Chips
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.sm, paddingVertical: 7,
    borderRadius: borderRadius.full, borderWidth: 1.5,
  },
  chipText: { ...typography.tiny, fontWeight: '700' },

  // Confirm button
  confirmBtn: {
    height: 46, backgroundColor: '#8B5CF6', borderRadius: borderRadius.lg,
    alignItems: 'center', justifyContent: 'center', ...shadows.sm,
  },
  confirmBtnText: { ...typography.bodyBold, color: '#fff', letterSpacing: 0.3 },
});
