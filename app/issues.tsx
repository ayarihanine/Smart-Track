import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Modal, FlatList, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/design';
import { getIssues, createIssue, updateIssue, getTasks, createTask, updateTask, getComments, createComment } from '@/lib/api';
import { Issue, IssuePriority, IssueStatus, Task, Comment } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/components/ThemeProvider';
import { useTranslation } from '@/hooks/useTranslation';

export default function IssuesScreen() {
  const { palette } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState<IssuePriority | 'all'>('all');
  const [isCreateModalVisible, setCreateModalVisible] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);

  // New Issue State
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState<IssuePriority>('medium');
  const [newCardId, setNewCardId] = useState('');

  const { data: issues, isLoading } = useQuery({
    queryKey: ['issues'],
    queryFn: getIssues,
  });

  const createIssueMutation = useMutation({
    mutationFn: createIssue,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      setCreateModalVisible(false);
      resetNewIssueForm();
    },
    onError: (err: any) => Alert.alert(t('error'), err.message),
  });

  const resetNewIssueForm = () => {
    setNewTitle('');
    setNewDesc('');
    setNewPriority('medium');
    setNewCardId('');
  };

  const filteredIssues = useMemo(() => {
    if (!issues) return [];
    return issues.filter(issue => {
      const matchesSearch = (issue.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                           (issue.cardId || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPriority = filterPriority === 'all' || issue.priority === filterPriority;
      return matchesSearch && matchesPriority;
    });
  }, [issues, searchQuery, filterPriority]);

  const getPriorityColor = (p: IssuePriority) => {
    switch (p) {
      case 'critical': return '#EF4444';
      case 'high': return '#F59E0B';
      case 'medium': return '#3B82F6';
      case 'low': return '#10B981';
      default: return colors.textTertiary;
    }
  };

  const handleCreateIssue = () => {
    if (!newTitle.trim()) {
      Alert.alert(t('error'), t('fillFields'));
      return;
    }
    createIssueMutation.mutate({
      title: newTitle,
      description: newDesc,
      priority: newPriority,
      cardId: newCardId,
      reportedBy: user?.id,
      status: 'open',
    });
  };

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: palette.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <View>
          <Text style={[styles.title, { color: palette.text }]}>{t('issuesAndTasks') || 'Issues & Tasks'}</Text>
          <Text style={[styles.subtitle, { color: palette.textSecondary }]}>{t('collaborationSubtitle') || 'Manage floor problems and action items'}</Text>
        </View>
        <TouchableOpacity 
          style={styles.addBtn}
          onPress={() => setCreateModalVisible(true)}
        >
          <Ionicons name="add" size={24} color={colors.white} />
        </TouchableOpacity>
      </View>

      {/* Search & Filters */}
      <View style={styles.filterSection}>
        <View style={[styles.searchBar, { backgroundColor: palette.backgroundSecondary, borderColor: palette.border }]}>
          <Ionicons name="search" size={20} color={palette.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: palette.text }]}
            placeholder={t('searchIssues') || 'Search issues, cards...'}
            placeholderTextColor={palette.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
          {(['all', 'critical', 'high', 'medium', 'low'] as const).map(p => (
            <TouchableOpacity
              key={p}
              style={[
                styles.chip,
                { backgroundColor: filterPriority === p ? colors.primary : palette.backgroundSecondary },
                { borderColor: filterPriority === p ? colors.primary : palette.border }
              ]}
              onPress={() => setFilterPriority(p)}
            >
              <Text style={[styles.chipText, { color: filterPriority === p ? colors.white : palette.textSecondary }]}>
                {t(p) || p.charAt(0).toUpperCase() + p.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Issues List */}
      <FlatList
        data={filteredIssues}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={[styles.issueCard, { backgroundColor: palette.backgroundSecondary, borderColor: palette.border }]}
            onPress={() => setSelectedIssue(item)}
          >
            <View style={styles.issueHeader}>
              <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(item.priority) + '20' }]}>
                <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(item.priority) }]} />
                <Text style={[styles.priorityText, { color: getPriorityColor(item.priority) }]}>
                  {t(item.priority) || item.priority.toUpperCase()}
                </Text>
              </View>
              <Text style={[styles.statusTag, { color: palette.textTertiary }]}>{item.status.replace('_', ' ')}</Text>
            </View>
            <Text style={[styles.issueTitle, { color: palette.text }]}>{item.title}</Text>
            {item.description ? <Text style={[styles.issueDesc, { color: palette.textSecondary }]} numberOfLines={2}>{item.description}</Text> : null}
            <View style={styles.issueFooter}>
              <View style={styles.footerItem}>
                <Ionicons name="person-outline" size={14} color={palette.textTertiary} />
                <Text style={[styles.footerText, { color: palette.textTertiary }]}>{item.reporterName || 'System'}</Text>
              </View>
              {item.cardId && (
                <View style={styles.footerItem}>
                  <Ionicons name="barcode-outline" size={14} color={palette.textTertiary} />
                  <Text style={[styles.footerText, { color: palette.textTertiary }]}>{item.cardId}</Text>
                </View>
              )}
              <Text style={[styles.dateText, { color: palette.textTertiary }]}>
                {new Date(item.createdAt).toLocaleDateString()}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-done-circle-outline" size={60} color={palette.border} />
            <Text style={[styles.emptyTitle, { color: palette.textSecondary }]}>{t('noIssuesFound') || 'No issues found'}</Text>
            <Text style={[styles.emptySubtitle, { color: palette.textTertiary }]}>{t('cleanFloor') || 'The production floor is running smoothly.'}</Text>
          </View>
        }
      />

      {/* Create Issue Modal */}
      <Modal visible={isCreateModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: palette.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: palette.text }]}>{t('reportNewIssue') || 'Report New Issue'}</Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                <Ionicons name="close" size={24} color={palette.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              <Text style={[styles.label, { color: palette.textSecondary }]}>{t('title') || 'Title'}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: palette.backgroundSecondary, borderColor: palette.border, color: palette.text }]}
                placeholder="e.g. SMT Machine #4 Calibration Required"
                placeholderTextColor={palette.textTertiary}
                value={newTitle}
                onChangeText={setNewTitle}
              />

              <Text style={[styles.label, { color: palette.textSecondary }]}>{t('description') || 'Description'}</Text>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: palette.backgroundSecondary, borderColor: palette.border, color: palette.text }]}
                placeholder="Details about the issue..."
                placeholderTextColor={palette.textTertiary}
                value={newDesc}
                onChangeText={setNewDesc}
                multiline
              />

              <Text style={[styles.label, { color: palette.textSecondary }]}>{t('priority') || 'Priority'}</Text>
              <View style={styles.prioritySelector}>
                {(['low', 'medium', 'high', 'critical'] as const).map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.priorityOption,
                      { borderColor: newPriority === p ? getPriorityColor(p) : palette.border },
                      newPriority === p && { backgroundColor: getPriorityColor(p) + '10' }
                    ]}
                    onPress={() => setNewPriority(p)}
                  >
                    <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(p) }]} />
                    <Text style={[styles.priorityOptionText, { color: newPriority === p ? getPriorityColor(p) : palette.textSecondary }]}>
                      {t(p) || p.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.label, { color: palette.textSecondary }]}>{t('relatedCardId') || 'Related Card ID (Optional)'}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: palette.backgroundSecondary, borderColor: palette.border, color: palette.text }]}
                placeholder="CARD123"
                placeholderTextColor={palette.textTertiary}
                value={newCardId}
                onChangeText={setNewCardId}
              />
            </ScrollView>

            <TouchableOpacity 
              style={[styles.submitBtn, createIssueMutation.isPending && { opacity: 0.7 }]}
              onPress={handleCreateIssue}
              disabled={createIssueMutation.isPending}
            >
              {createIssueMutation.isPending ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.submitBtnText}>{t('submitReport') || 'Submit Report'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Details View Modal (Simplified for this task) */}
      <Modal visible={!!selectedIssue} animationType="fade" transparent>
         <View style={styles.modalOverlay}>
            <View style={[styles.detailsModal, { backgroundColor: palette.background }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: palette.text }]} numberOfLines={1}>{selectedIssue?.title}</Text>
                <TouchableOpacity onPress={() => setSelectedIssue(null)}>
                  <Ionicons name="close" size={24} color={palette.text} />
                </TouchableOpacity>
              </View>
              
              <ScrollView contentContainerStyle={styles.detailsScroll}>
                <View style={styles.detailsMeta}>
                   <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(selectedIssue?.priority || 'medium') + '20' }]}>
                    <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(selectedIssue?.priority || 'medium') }]} />
                    <Text style={[styles.priorityText, { color: getPriorityColor(selectedIssue?.priority || 'medium') }]}>
                      {selectedIssue?.priority.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={[styles.statusTag, { color: palette.textSecondary }]}>{selectedIssue?.status}</Text>
                </View>

                <Text style={[styles.detailsLabel, { color: palette.textTertiary }]}>{t('description') || 'Description'}</Text>
                <Text style={[styles.detailsText, { color: palette.text }]}>{selectedIssue?.description || 'No description provided.'}</Text>
                
                <View style={styles.divider} />

                {/* Task List Placeholder */}
                <Text style={[styles.detailsLabel, { color: palette.textTertiary }]}>{t('taskManagement') || 'Checklist & Tasks'}</Text>
                <View style={styles.placeholderBox}>
                   <Ionicons name="list" size={24} color={palette.border} />
                   <Text style={{ color: palette.textTertiary, marginTop: 8 }}>Task management and comments integration pending.</Text>
                </View>

                {selectedIssue?.cardId && (
                  <TouchableOpacity 
                    style={[styles.viewCardBtn, { backgroundColor: colors.primary + '10' }]}
                    onPress={() => {
                      const id = selectedIssue.cardId;
                      setSelectedIssue(null);
                      router.push(`/card/${id}`);
                    }}
                  >
                    <Ionicons name="eye-outline" size={20} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontWeight: '700' }}>View Card Passport</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
              
              <View style={styles.detailsFooter}>
                  <TouchableOpacity 
                    style={[styles.resolveBtn, { backgroundColor: colors.primary }]}
                    onPress={() => setSelectedIssue(null)}
                  >
                    <Text style={styles.submitBtnText}>{t('done') || 'Done'}</Text>
                  </TouchableOpacity>
              </View>
            </View>
         </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  title: { ...typography.h1, fontWeight: '800' },
  subtitle: { ...typography.small, marginTop: 2 },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.md,
  },
  filterSection: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    height: 48,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  searchInput: { flex: 1, ...typography.body },
  chipScroll: { paddingHorizontal: spacing.sm, gap: spacing.sm },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  chipText: { ...typography.small, fontWeight: '700' },
  listContent: { padding: spacing.md, gap: spacing.md },
  issueCard: {
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    ...shadows.sm,
  },
  issueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.md,
    gap: 6,
  },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  priorityText: { ...typography.tiny, fontWeight: '800' },
  statusTag: { ...typography.tiny, fontWeight: '700', textTransform: 'uppercase' },
  issueTitle: { ...typography.bodyBold, fontSize: 16 },
  issueDesc: { ...typography.small, marginTop: 4 },
  issueFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#00000005',
    paddingTop: spacing.sm,
  },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerText: { ...typography.tiny },
  dateText: { ...typography.tiny, marginLeft: 'auto' },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
  },
  emptyTitle: { ...typography.h2, marginTop: 16 },
  emptySubtitle: { ...typography.small, textAlign: 'center', marginTop: 8 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    padding: spacing.lg,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: { ...typography.h2, fontWeight: '800' },
  modalScroll: { gap: spacing.md },
  label: { ...typography.small, fontWeight: '700', marginBottom: 4 },
  input: {
    height: 50,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    ...typography.body,
  },
  textArea: { height: 120, paddingTop: spacing.md, textAlignVertical: 'top' },
  prioritySelector: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  priorityOption: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: 8,
  },
  priorityOptionText: { ...typography.tiny, fontWeight: '700' },
  submitBtn: {
    backgroundColor: colors.primary,
    height: 56,
    borderRadius: borderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
    ...shadows.md,
  },
  submitBtnText: { ...typography.bodyBold, color: colors.white },
  detailsModal: {
     height: '90%',
     borderTopLeftRadius: borderRadius.xxl,
     borderTopRightRadius: borderRadius.xxl,
     padding: spacing.lg,
  },
  detailsScroll: { gap: spacing.md, paddingBottom: 40 },
  detailsMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailsLabel: { ...typography.tiny, fontWeight: '800', textTransform: 'uppercase', marginBottom: 4 },
  detailsText: { ...typography.body, lineHeight: 22 },
  divider: { height: 1, backgroundColor: '#00000008', marginVertical: spacing.md },
  placeholderBox: {
    padding: spacing.xl,
    backgroundColor: '#00000003',
    borderRadius: borderRadius.lg,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#00000010',
    alignItems: 'center',
  },
  viewCardBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: spacing.md,
      borderRadius: borderRadius.lg,
      marginTop: spacing.md,
  },
  detailsFooter: { paddingTop: spacing.md },
  resolveBtn: {
    height: 56,
    borderRadius: borderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.md,
  }
});
