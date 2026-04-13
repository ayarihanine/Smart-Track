import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LoadingPlanEntry, ComponentInsertion } from '@/types';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/design';
import { useTranslation } from '@/hooks/useTranslation';

interface GuidedOperatorModeProps {
  loadingPlan: LoadingPlanEntry[];
  insertions: ComponentInsertion[];
  onScanPress?: () => void;
}

export const GuidedOperatorMode: React.FC<GuidedOperatorModeProps> = ({ 
  loadingPlan, 
  insertions,
  onScanPress 
}) => {
  const { t } = useTranslation();

  // Find the next incomplete part based on insertionOrder
  const nextTarget = useMemo(() => {
    const sortedPlan = [...loadingPlan].sort((a, b) => (a.insertionOrder || 0) - (b.insertionOrder || 0));
    
    return sortedPlan.find(entry => {
      const actual = insertions
        .filter(i => i.partReference === entry.partReference && i.machineReference === entry.machineReference)
        .reduce((acc, i) => acc + i.insertedQuantity, 0);
      return actual < entry.requiredQuantity;
    });
  }, [loadingPlan, insertions]);

  if (!nextTarget) {
    return (
      <View style={styles.completedContainer}>
        <View style={styles.completedIcon}>
          <Ionicons name="checkmark-done-circle" size={48} color="#10B981" />
        </View>
        <Text style={styles.completedTitle}>{t('allComponentsInserted' as any) || 'All Components Inserted'}</Text>
        <Text style={styles.completedSub}>
          {t('readyForNextMachine' as any) || 'The loading plan for this card is complete.'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="navigate-circle" size={20} color={colors.primary} />
        <Text style={styles.headerText}>{t('guidedOperatorMode' as any) || 'Guided Operator Mode'}</Text>
      </View>

      <View style={styles.targetCard}>
        <View style={styles.targetMain}>
          <Text style={styles.targetLabel}>{t('nextComponent' as any) || 'NEXT COMPONENT'}</Text>
          <Text style={styles.targetPart}>{nextTarget.partReference}</Text>
          
          <View style={styles.targetMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="settings-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.metaText}>{nextTarget.machineReference}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="grid-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.metaText}>Table {nextTarget.tableNumber || 'N/A'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.quantityBadge}>
          <Text style={styles.qtyLabel}>{t('needed' as any) || 'Needed'}</Text>
          <Text style={styles.qtyValue}>{nextTarget.requiredQuantity}</Text>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.scanButton}
        onPress={onScanPress}
      >
        <Ionicons name="scan" size={24} color={colors.white} />
        <Text style={styles.scanButtonText}>{t('scanComponent' as any) || 'Scan Component'}</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Ionicons name="information-circle-outline" size={14} color={colors.textTertiary} />
        <Text style={styles.footerText}>
          {t('guidedInstruction' as any) || 'Scan the barcode on the component reel to record insertion.'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    ...shadows.md,
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerText: {
    ...typography.smallBold,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  targetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  targetMain: {
    flex: 1,
    gap: 4,
  },
  targetLabel: {
    ...typography.tiny,
    color: colors.textTertiary,
    fontWeight: '700',
    letterSpacing: 1,
  },
  targetPart: {
    ...typography.h3,
    color: colors.text,
  },
  targetMeta: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    ...typography.small,
    color: colors.textSecondary,
  },
  quantityBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    width: 70,
    height: 70,
    borderRadius: borderRadius.md,
    ...shadows.sm,
  },
  qtyLabel: {
    ...typography.tiny,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '700',
  },
  qtyValue: {
    ...typography.h2,
    color: colors.white,
    lineHeight: 32,
  },
  scanButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    height: 56,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    ...shadows.md,
  },
  scanButtonText: {
    ...typography.bodyBold,
    color: colors.white,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  footerText: {
    ...typography.tiny,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  completedContainer: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: '#10B981',
    gap: spacing.md,
  },
  completedIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedTitle: {
    ...typography.h4,
    color: '#065F46',
    textAlign: 'center',
  },
  completedSub: {
    ...typography.body,
    color: '#047857',
    textAlign: 'center',
  },
});
