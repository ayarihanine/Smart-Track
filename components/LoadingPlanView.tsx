import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LoadingPlanEntry, ComponentInsertion } from '@/types';
import { colors, spacing, typography, borderRadius } from '@/constants/design';
import { useTranslation } from '@/hooks/useTranslation';

interface LoadingPlanViewProps {
  loadingPlan: LoadingPlanEntry[];
  insertions: ComponentInsertion[];
}

export const LoadingPlanView: React.FC<LoadingPlanViewProps> = ({ loadingPlan, insertions }) => {
  const { t } = useTranslation();

  // Group by machine
  const machines = Array.from(new Set(loadingPlan.map(p => p.machineReference)));

  return (
    <View style={styles.container}>
      {machines.map(machine => {
        const machineEntries = loadingPlan.filter(p => p.machineReference === machine);
        
        return (
          <View key={machine} style={styles.machineGroup}>
            <View style={styles.machineHeader}>
              <Ionicons name="settings-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.machineTitle}>{machine}</Text>
            </View>

            {machineEntries.map(entry => {
              const entryInsertions = insertions.filter(i => 
                i.partReference === entry.partReference && 
                i.machineReference === entry.machineReference
              );
              const actual = entryInsertions.reduce((acc, i) => acc + i.insertedQuantity, 0);
              const required = entry.requiredQuantity;
              
              const isComplete = actual >= required;
              const isOver = actual > required;
              const isPending = actual === 0;

              let statusColor = colors.border;
              let bgColor = 'transparent';
              let iconName: any = 'ellipse-outline';
              let iconColor = colors.border;

              if (isOver) {
                statusColor = '#EF4444';
                bgColor = '#FEF2F2';
                iconName = 'warning';
                iconColor = '#EF4444';
              } else if (isComplete) {
                statusColor = '#10B981';
                bgColor = '#F0FDF4';
                iconName = 'checkmark-circle';
                iconColor = '#10B981';
              } else if (!isPending) {
                statusColor = '#2563EB';
                bgColor = '#EFF6FF';
                iconName = 'radio-button-on';
                iconColor = '#2563EB';
              }

              return (
                <View 
                  key={entry.id} 
                  style={[
                    styles.entryCard, 
                    { borderColor: statusColor, backgroundColor: bgColor }
                  ]}
                >
                  <View style={styles.entryInfo}>
                    <Text style={[styles.partRef, { color: isPending ? colors.textSecondary : colors.text }]}>
                      {entry.partReference}
                    </Text>
                    {entry.tableNumber !== undefined && (
                      <Text style={styles.tableRef}>
                        {t('table' as any) || 'Table'} {entry.tableNumber}
                      </Text>
                    )}
                  </View>
                  
                  <View style={styles.entryStatus}>
                    <Text style={[styles.quantityText, { color: isOver ? '#EF4444' : colors.text }]}>
                      {actual} / {required}
                    </Text>
                    <Ionicons name={iconName} size={20} color={iconColor} />
                  </View>
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  machineGroup: {
    gap: spacing.sm,
  },
  machineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  machineTitle: {
    ...typography.smallBold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  entryInfo: {
    flex: 1,
    gap: 2,
  },
  partRef: {
    ...typography.bodyBold,
  },
  tableRef: {
    ...typography.tiny,
    color: colors.textTertiary,
  },
  entryStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  quantityText: {
    ...typography.bodyBold,
  },
});
