import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList,
  TextInput, Modal, ActivityIndicator, Alert, Platform, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/components/ThemeProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuthStore } from '@/store/authStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getIssues, createIssue, updateIssue } from '@/lib/api';
import { Issue, IssuePriority, IssueStatus } from '@/types';
import { borderRadius, shadows, spacing, typography } from '@/constants/design';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function IssuesScreen() {
  const { palette } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const router = useRouter();
  const params = useLocalSearchParams<{ photoUrl?: string; photoPath?: string }>();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState<IssuePriority | 'all'>('all');
  const [isCreateModalVisible, setCreateModalVisible] = useState(params.photoUrl ? true : false);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);

  // New Issue State
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState<IssuePriority>('medium');
  const [newCardId, setNewCardId] = useState('');
  const [photoUrl, setPhotoUrl] = useState(params.photoUrl || '');

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
      Alert.alert(t('success'), t('issueCreated') || 'Issue created successfully');
    },
    onError: (err: any) => Alert.alert(t('error'), err.message),
  });

  const handleCreateIssue = () => {
    if (!newTitle.trim()) {
      Alert.alert(t('error'), t('fillFields') || 'Please fill in all required fields.');
      return;
    }
    createIssueMutation.mutate({
      title: newTitle,
      description: newDesc,
      priority: newPriority,
      cardId: newCardId || undefined,
      photoUrl: photoUrl || undefined,
      reportedBy: user?.id || 'unknown',
      status: 'open',
    });
  };

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
      default: return '#6B7280';
    }
  };

  const colors = {
    primary: palette.primary || '#3B82F6',
    white: '#FFFFFF',
    text: palette.text,
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.backgroundSecondary }]} edges={['top']}>
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
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {(['all', 'critical', 'high', 'medium', 'low'] as const).map((priority) => (
            <TouchableOpacity
              key={priority}
              style={[
                styles.chip,
                {
                  backgroundColor: filterPriority === priority ? getPriorityColor(priority) : palette.backgroundSecondary,
                  borderColor: filterPriority === priority ? getPriorityColor(priority) : palette.border,
                },
              ]}
              onPress={() => setFilterPriority(priority)}
            >
              <Text
                style={[
                  styles.chipText,
                  {
                    color: filterPriority === priority ? colors.white : palette.text,
                  },
                ]}
              >
                {t(priority) || priority.toUpperCase()}
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
          !isLoading ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="checkmark-done-circle-outline" size={60} color={palette.border} />
              <Text style={[styles.emptyTitle, { color: palette.textSecondary }]}>{t('noIssuesFound') || 'No issues found'}</Text>
              <Text style={[styles.emptySubtitle, { color: palette.textTertiary }]}>{t('cleanFloor') || 'The production floor is running smoothly.'}</Text>
            </View>
          ) : null
        }
      />

      {isLoading && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}

      <Modal visible={isCreateModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: palette.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: palette.text }]}>{t('reportNewIssue') || 'Report New Issue'}</Text>
              <TouchableOpacity onPress={() => {
                setCreateModalVisible(false);
                setPhotoUrl('');
              }}>
                <Ionicons name="close" size={24} color={palette.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              {photoUrl && (
                <View style={[styles.photoPreview, { backgroundColor: palette.backgroundSecondary }]}>
                  <Image source={{ uri: photoUrl }} style={styles.photoImage} />
                </View>
              )}

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
                numberOfLines={4}
              />

              <Text style={[styles.label, { color: palette.textSecondary }]}>{t('priority') || 'Priority'}</Text>
              <View style={styles.priorityGrid}>
                {(['low', 'medium', 'high', 'critical'] as IssuePriority[]).map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.priorityOption,
                      {
                        backgroundColor: newPriority === p ? getPriorityColor(p) : palette.backgroundSecondary,
                        borderColor: getPriorityColor(p),
                      },
                    ]}
                    onPress={() => setNewPriority(p)}
                  >
                    <Text
                      style={[
                        styles.priorityOptionText,
                        { color: newPriority === p ? '#fff' : palette.text },
                      ]}
                    >
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
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>{t('submitReport') || 'Submit Report'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Details View Modal */}
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
                      {t(selectedIssue?.priority || 'medium') || (selectedIssue?.priority || 'medium').toUpperCase()}
                    </Text>
                  </View>
                  <Text style={{ color: palette.textTertiary, marginLeft: 'auto' }}>
                    {new Date(selectedIssue?.createdAt || '').toLocaleDateString()}
                  </Text>
                </View>

                {selectedIssue?.description && (
                  <View style={styles.detailsSection}>
                    <Text style={[styles.detailsLabel, { color: palette.textSecondary }]}>Description</Text>
                    <Text style={[styles.detailsValue, { color: palette.text }]}>{selectedIssue.description}</Text>
                  </View>
                )}

                {selectedIssue?.reporterName && (
                  <View style={styles.detailsSection}>
                    <Text style={[styles.detailsLabel, { color: palette.textSecondary }]}>Reported By</Text>
                    <Text style={[styles.detailsValue, { color: palette.text }]}>{selectedIssue.reporterName}</Text>
                  </View>
                )}

                {selectedIssue?.cardId && (
                  <View style={styles.detailsSection}>
                    <Text style={[styles.detailsLabel, { color: palette.textSecondary }]}>Related Card</Text>
                    <Text style={[styles.detailsValue, { color: palette.text }]}>{selectedIssue.cardId}</Text>
                  </View>
                )}

                <View style={{ color: palette.textTertiary, marginTop: 8 }}>
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1 },
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
    backgroundColor: '#3B82F6',
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
  priorityText: { ...typography.tiny, fontWeight: '700' },
  statusTag: { ...typography.tiny },
  issueTitle: { ...typography.body, fontWeight: '700', marginBottom: 4 },
  issueDesc: { ...typography.small, marginBottom: 8 },
  issueFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerText: { ...typography.tiny },
  dateText: { ...typography.tiny, marginLeft: 'auto' },
  emptyContainer: { alignItems: 'center', marginTop: 60, gap: spacing.md },
  emptyTitle: { ...typography.h2, fontWeight: '700' },
  emptySubtitle: { ...typography.body, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
  detailsModal: { borderRadius: borderRadius.xl, margin: spacing.lg, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg },
  modalTitle: { ...typography.h2, fontWeight: '800', flex: 1 },
  modalScroll: { gap: spacing.md, paddingBottom: 40, paddingHorizontal: spacing.lg },
  detailsScroll: { gap: spacing.md, paddingBottom: 40, paddingHorizontal: spacing.lg },
  detailsMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { ...typography.tiny, fontWeight: '800', textTransform: 'uppercase', marginBottom: 4 },
  input: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    ...typography.body,
  },
  textArea: { height: 100, textAlignVertical: 'top' },
  priorityGrid: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  priorityOption: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  priorityOptionText: { ...typography.small, fontWeight: '600' },
  submitBtn: {
    height: 56,
    borderRadius: borderRadius.xl,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  submitBtnText: { ...typography.body, fontWeight: '700', color: '#FFFFFF' },
  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  detailsLabel: { ...typography.tiny, fontWeight: '800', textTransform: 'uppercase', marginBottom: 4 },
  detailsValue: { ...typography.body, lineHeight: 22 },
  detailsSection: { marginVertical: spacing.md },
  detailsFooter: { paddingTop: spacing.md },
  viewCardBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: spacing.md,
      borderRadius: borderRadius.lg,
      marginTop: spacing.md,
  },
  resolveBtn: {
    height: 56,
    borderRadius: borderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.md,
  }
});
