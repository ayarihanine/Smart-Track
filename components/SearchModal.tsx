import React, { useDeferredValue, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { borderRadius, shadows, spacing, typography } from '@/constants/design';
import { useTheme } from '@/components/ThemeProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { getCards } from '@/lib/api';
import { ElectronicCard } from '@/types';

interface SearchModalProps {
  visible: boolean;
  onClose: () => void;
}

function cardMatchesQuery(card: ElectronicCard, query: string) {
  if (!query) return true;

  const haystack = [
    card.cardId,
    card.productId,
    card.currentStage,
    card.currentLocation,
    card.status,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(query);
}

function formatStatus(status: ElectronicCard['status']) {
  return status.replace(/_/g, ' ');
}

export function SearchModal({ visible, onClose }: SearchModalProps) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().toLowerCase();

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ['cards'],
    queryFn: () => getCards(),
    enabled: visible,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!visible) {
      setQuery('');
    }
  }, [visible]);

  const results = normalizedQuery
    ? cards.filter(card => cardMatchesQuery(card, normalizedQuery))
    : cards.slice(0, 12);

  const handleSelect = (cardId: string) => {
    onClose();
    router.push(`/card/${cardId}` as any);
  };

  const resultLabel = results.length === 1 ? t('result') : t('results');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: palette.background }]}>
          <View style={[styles.handle, { backgroundColor: palette.border }]} />

          <View style={styles.header}>
            <View style={[styles.searchField, { backgroundColor: palette.backgroundSecondary, borderColor: palette.border }]}>
              <Ionicons name="search" size={18} color={palette.textTertiary} />
              <TextInput
                autoFocus
                value={query}
                onChangeText={setQuery}
                placeholder={t('searchPlaceholder') || 'Search by ID, product, stage...'}
                placeholderTextColor={palette.textTertiary}
                style={[styles.input, { color: palette.text }]}
                selectionColor={palette.primary}
                returnKeyType="search"
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery('')} hitSlop={10}>
                  <Ionicons name="close-circle" size={18} color={palette.textTertiary} />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={[styles.closeText, { color: palette.primary }]}>{t('cancel') || 'Cancel'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.resultsHeader}>
            <Text style={[styles.resultsTitle, { color: palette.text }]}>
              {normalizedQuery ? t('searchResults') || 'Search Results' : t('recentCards') || 'Recent Cards'}
            </Text>
            <Text style={[styles.resultsCount, { color: palette.textSecondary }]}>
              {results.length} {resultLabel}
            </Text>
          </View>

          {isLoading ? (
            <View style={styles.stateContainer}>
              <ActivityIndicator size="small" color={palette.primary} />
              <Text style={[styles.stateText, { color: palette.textSecondary }]}>{t('loading') || 'Loading...'}</Text>
            </View>
          ) : results.length === 0 ? (
            <View style={styles.stateContainer}>
              <Ionicons name="search-outline" size={32} color={palette.textTertiary} />
              <Text style={[styles.stateText, { color: palette.textSecondary }]}>
                {t('noResultsMatch') || t('noMatches') || 'No cards match'}
              </Text>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.resultsList}
            >
              {results.map(card => (
                <TouchableOpacity
                  key={card.id}
                  style={[styles.resultCard, { backgroundColor: palette.backgroundSecondary, borderColor: palette.border }]}
                  activeOpacity={0.8}
                  onPress={() => handleSelect(card.cardId)}
                >
                  <View style={styles.resultMain}>
                    <Text style={[styles.cardId, { color: palette.text }]}>{card.cardId}</Text>
                    <Text style={[styles.cardStage, { color: palette.textSecondary }]}>
                      {card.currentStage || card.currentLocation || card.productId || t('unknownProduct')}
                    </Text>
                  </View>

                  <View style={styles.resultMeta}>
                    <View style={[styles.statusPill, { backgroundColor: palette.primaryTint }]}>
                      <Text style={[styles.statusText, { color: palette.primary }]}>{formatStatus(card.status)}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={palette.textTertiary} />
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.32)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    minHeight: '70%',
    maxHeight: '88%',
    borderTopLeftRadius: borderRadius.xxxl,
    borderTopRightRadius: borderRadius.xxxl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    ...shadows.lg,
  },
  handle: {
    width: 48,
    height: 5,
    borderRadius: borderRadius.full,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  searchField: {
    flex: 1,
    minHeight: 52,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    ...typography.body,
    paddingVertical: spacing.sm,
  },
  closeBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  closeText: {
    ...typography.bodyBold,
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  resultsTitle: {
    ...typography.bodyBold,
  },
  resultsCount: {
    ...typography.small,
  },
  resultsList: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  resultCard: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultMain: {
    flex: 1,
    marginRight: spacing.md,
  },
  cardId: {
    ...typography.bodyBold,
    marginBottom: 2,
  },
  cardStage: {
    ...typography.small,
  },
  resultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  statusText: {
    ...typography.tiny,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  stateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxxl,
  },
  stateText: {
    ...typography.body,
  },
});
