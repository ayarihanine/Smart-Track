import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { borderRadius, shadows, spacing, typography } from '@/constants/design';
import { useTheme } from '@/components/ThemeProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { addArticle, deleteArticle, getArticles, getCardUnitCost } from '@/lib/api';
import { Article } from '@/types/production';
import { useRoleGuard } from '@/hooks/useRoleGuard';

function AccessDenied({ t, palette }: { t: (key: any) => string; palette: any }) {
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.backgroundSecondary }]} edges={['top']}>
      <View style={styles.deniedWrap}>
        <Ionicons name="lock-closed" size={64} color="#EF4444" />
        <Text style={[styles.deniedTitle, { color: palette.text }]}>{t('accessDeniedTitle')}</Text>
        <Text style={[styles.deniedMessage, { color: palette.textSecondary }]}>{t('productionAccessDeniedMessage')}</Text>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.back()}
          style={[styles.primaryButton, { backgroundColor: palette.primary }]}
        >
          <Text style={styles.primaryButtonText}>{t('goBack')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function ArticleRow({
  article,
  canDelete,
  onDelete,
  palette,
  t,
}: {
  article: Article;
  canDelete: boolean;
  onDelete: (article: Article) => void;
  palette: any;
  t: (key: any) => string;
}) {
  return (
    <View style={[styles.articleRow, { backgroundColor: palette.background, borderColor: palette.border }]}>
      <View style={styles.articleMeta}>
        <Text style={[styles.articleRef, { color: palette.primary }]}>{article.reference}</Text>
        <Text style={[styles.articleDesignation, { color: palette.textSecondary }]}>{article.designation}</Text>
        <Text style={[styles.articleQuantity, { color: palette.textTertiary }]}>
          {t('articleQuantityValue').replace('{{count}}', String(article.assembly_count))}
        </Text>
      </View>

      <View style={styles.articleActions}>
        <Text style={[styles.articlePrice, { color: palette.text }]}>{(article.unit_price || 0).toFixed(3)} TND</Text>
        {canDelete ? (
          <TouchableOpacity activeOpacity={0.8} onPress={() => onDelete(article)} style={styles.deleteButton}>
            <Ionicons name="trash-outline" size={18} color="#EF4444" />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

export default function ArticlesScreen() {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const { isAuthorized } = useRoleGuard(['admin', 'supervisor']);
  const [search, setSearch] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draft, setDraft] = useState({
    reference: '',
    designation: '',
    assembly_count: '1',
    unit_price: '',
  });

  const canDelete = isAuthorized;

  const articlesQuery = useQuery({
    queryKey: ['production', 'articles'],
    queryFn: getArticles,
  });

  const costQuery = useQuery({
    queryKey: ['production', 'card-unit-cost'],
    queryFn: getCardUnitCost,
  });

  const filteredArticles = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return articlesQuery.data || [];
    }

    return (articlesQuery.data || []).filter(
      (article) =>
        (article.reference || '').toLowerCase().includes(query) ||
        (article.designation || '').toLowerCase().includes(query)
    );
  }, [articlesQuery.data, search]);

  if (!isAuthorized) {
    return <AccessDenied t={t} palette={palette} />;
  }

  const reloadData = async () => {
    await Promise.all([articlesQuery.refetch(), costQuery.refetch()]);
  };

  const confirmDelete = (article: Article) => {
    Alert.alert(
      t('delete'),
      t('deleteArticleConfirm').replace('{{reference}}', article.reference),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            const deleted = await deleteArticle(article.id);
            if (deleted) {
              await reloadData();
              Alert.alert(t('success'), t('articleDeleted'));
              return;
            }

            Alert.alert(t('error'), t('articleSaveError'));
          },
        },
      ]
    );
  };

  const submitArticle = async () => {
    if (!draft.reference.trim() || !draft.designation.trim() || !draft.unit_price.trim()) {
      Alert.alert(t('error'), t('articleRequiredFields'));
      return;
    }

    setIsSubmitting(true);

    const created = await addArticle({
      reference: draft.reference.trim(),
      designation: draft.designation.trim(),
      assembly_count: Number(draft.assembly_count.replace(/[^0-9]/g, '')) || 1,
      unit_price: Number(draft.unit_price.replace(',', '.')) || 0,
    });

    setIsSubmitting(false);

    if (!created) {
      Alert.alert(t('error'), t('articleSaveError'));
      return;
    }

    setDraft({
      reference: '',
      designation: '',
      assembly_count: '1',
      unit_price: '',
    });
    setIsModalVisible(false);
    await reloadData();
    Alert.alert(t('success'), t('articleAdded'));
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.backgroundSecondary }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: palette.background, borderBottomColor: palette.border }]}>
        <TouchableOpacity activeOpacity={0.8} onPress={() => router.back()} style={styles.headerBack}>
          <Ionicons name="arrow-back" size={22} color={palette.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: palette.text }]}>{t('articlesTitle')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={filteredArticles}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={articlesQuery.isFetching || costQuery.isFetching} onRefresh={reloadData} tintColor={palette.primary} />}
        ListHeaderComponent={
          <>
            <View style={[styles.costBadge, { backgroundColor: palette.background, borderColor: palette.border }]}>
              <Text style={[styles.costBadgeText, { color: palette.primary }]}>
                {t('unitCostBadge').replace('{{cost}}', costQuery.data?.toFixed(3) || '0.000')}
              </Text>
            </View>

            <View style={[styles.searchBar, { backgroundColor: palette.background, borderColor: palette.border }]}>
              <Ionicons name="search" size={18} color={palette.textTertiary} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={t('searchArticlesPlaceholder')}
                placeholderTextColor={palette.textTertiary}
                style={[styles.searchInput, { color: palette.text }]}
              />
            </View>
          </>
        }
        ListEmptyComponent={
          articlesQuery.isLoading ? (
            <ActivityIndicator color={palette.primary} style={styles.emptyLoader} />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="layers-outline" size={56} color={palette.textTertiary} />
              <Text style={[styles.emptyTitle, { color: palette.text }]}>{t('articlesEmptyTitle')}</Text>
              <Text style={[styles.emptySubtitle, { color: palette.textSecondary }]}>{t('articlesEmptySubtitle')}</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <ArticleRow article={item} canDelete={canDelete} onDelete={confirmDelete} palette={palette} t={t} />
        )}
      />

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setIsModalVisible(true)}
        style={[styles.fab, { backgroundColor: palette.primary }]}
      >
        <Text style={styles.fabText}>{t('addArticleFab')}</Text>
      </TouchableOpacity>

      <Modal visible={isModalVisible} transparent animationType="slide" onRequestClose={() => setIsModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setIsModalVisible(false)}>
          <Pressable onPress={(event) => event.stopPropagation()} style={styles.modalPressable}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={[styles.modalCard, { backgroundColor: palette.background }]}
            >
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: palette.text }]}>{t('addArticleTitle')}</Text>
                <TouchableOpacity activeOpacity={0.8} onPress={() => setIsModalVisible(false)}>
                  <Ionicons name="close" size={22} color={palette.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: palette.textSecondary }]}>{t('refSagemLabel')}</Text>
                <TextInput
                  value={draft.reference}
                  onChangeText={(value) => setDraft((current) => ({ ...current, reference: value }))}
                  placeholder={t('refSagemPlaceholder')}
                  placeholderTextColor={palette.textTertiary}
                  style={[styles.input, { backgroundColor: palette.backgroundSecondary, borderColor: palette.border, color: palette.text }]}
                />
              </View>

              <View style={styles.formField}>
                <Text style={[styles.formLabel, { color: palette.textSecondary }]}>{t('designationLabel')}</Text>
                <TextInput
                  value={draft.designation}
                  onChangeText={(value) => setDraft((current) => ({ ...current, designation: value }))}
                  placeholder={t('designationPlaceholder')}
                  placeholderTextColor={palette.textTertiary}
                  style={[styles.input, { backgroundColor: palette.backgroundSecondary, borderColor: palette.border, color: palette.text }]}
                />
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formField, styles.formFieldHalf]}>
                  <Text style={[styles.formLabel, { color: palette.textSecondary }]}>{t('nbMontageLabel')}</Text>
                  <TextInput
                    value={draft.assembly_count}
                    onChangeText={(value) => setDraft((current) => ({ ...current, assembly_count: value }))}
                    placeholder={t('nbMontagePlaceholder')}
                    placeholderTextColor={palette.textTertiary}
                    keyboardType="number-pad"
                    style={[styles.input, { backgroundColor: palette.backgroundSecondary, borderColor: palette.border, color: palette.text }]}
                  />
                </View>

                <View style={[styles.formField, styles.formFieldHalf]}>
                  <Text style={[styles.formLabel, { color: palette.textSecondary }]}>{t('unitPriceTndLabel')}</Text>
                  <TextInput
                    value={draft.unit_price}
                    onChangeText={(value) => setDraft((current) => ({ ...current, unit_price: value }))}
                    placeholder={t('unitPriceTndPlaceholder')}
                    placeholderTextColor={palette.textTertiary}
                    keyboardType="decimal-pad"
                    style={[styles.input, { backgroundColor: palette.backgroundSecondary, borderColor: palette.border, color: palette.text }]}
                  />
                </View>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setIsModalVisible(false)}
                  style={[styles.secondaryButton, { borderColor: palette.border }]}
                >
                  <Text style={[styles.secondaryButtonText, { color: palette.text }]}>{t('cancel')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={submitArticle}
                  disabled={isSubmitting}
                  style={[styles.primaryButton, { backgroundColor: palette.primary, flex: 1 }]}
                >
                  {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>{t('addArticleButton')}</Text>}
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  headerBack: {
    width: 40,
  },
  headerTitle: {
    ...typography.h4,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: 120,
  },
  costBadge: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
    ...shadows.xs,
  },
  costBadgeText: {
    ...typography.bodyBold,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.md,
    minHeight: 52,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  searchInput: {
    ...typography.body,
    flex: 1,
  },
  articleRow: {
    borderWidth: 1,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    ...shadows.xs,
  },
  articleMeta: {
    flex: 1,
    marginRight: spacing.md,
  },
  articleRef: {
    ...typography.bodyBold,
    marginBottom: 4,
  },
  articleDesignation: {
    ...typography.small,
    marginBottom: 4,
  },
  articleQuantity: {
    ...typography.tiny,
  },
  articleActions: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  articlePrice: {
    ...typography.bodyBold,
  },
  deleteButton: {
    marginTop: spacing.sm,
    padding: 4,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xl,
    minHeight: 54,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  fabText: {
    ...typography.bodyBold,
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalPressable: {
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.lg,
  },
  modalHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    ...typography.h4,
  },
  formField: {
    marginBottom: spacing.md,
  },
  formRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  formFieldHalf: {
    flex: 1,
  },
  formLabel: {
    ...typography.captionBold,
    marginBottom: 8,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    ...typography.body,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  secondaryButton: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    ...typography.bodyBold,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  primaryButtonText: {
    ...typography.bodyBold,
    color: '#FFFFFF',
  },
  emptyLoader: {
    marginTop: spacing.xl,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 64,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    ...typography.h4,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...typography.body,
    textAlign: 'center',
  },
  deniedWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  deniedTitle: {
    ...typography.h2,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  deniedMessage: {
    ...typography.body,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
});
