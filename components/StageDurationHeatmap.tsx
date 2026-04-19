import React from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { useTheme } from './ThemeProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { spacing, borderRadius, typography } from '@/constants/design';

const { width } = Dimensions.get('window');
const GRID_COLS = 24; // Hours
const STAGES = ['SMT', 'THT', 'Assembly', 'QC'];
const CELL_SIZE = Math.max(30, (width - spacing.lg * 4) / 12); // Show 12 hours at a time

export function StageDurationHeatmap() {
  const { palette } = useTheme();
  const { t } = useTranslation();

  // Mock data generation for heatmap
  const getCellColor = (stageIndex: number, hour: number) => {
    // Generate some "realistic" looking variance
    const value = (Math.sin(stageIndex + hour / 4) + 1) / 2;
    if (value > 0.8) return '#EF4444'; // Hot (Slow)
    if (value > 0.5) return '#F59E0B'; // Warm
    if (value > 0.2) return '#10B981'; // Cool (Fast)
    return '#E2E8F0'; // Empty/Very Fast
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: palette.text }]}>
          {t('stageDurationHeatmap' as any) || 'Stage Duration Heatmap'}
        </Text>
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendBox, { backgroundColor: '#10B981' }]} />
            <Text style={[styles.legendText, { color: palette.textSecondary }]}>Fast</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendBox, { backgroundColor: '#F59E0B' }]} />
            <Text style={[styles.legendText, { color: palette.textSecondary }]}>Avg</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendBox, { backgroundColor: '#EF4444' }]} />
            <Text style={[styles.legendText, { color: palette.textSecondary }]}>Slow</Text>
          </View>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
        <View>
          {/* Hour Labels */}
          <View style={styles.row}>
            <View style={styles.labelCol} />
            {Array.from({ length: GRID_COLS }).map((_, i) => (
              <View key={`h-${i}`} style={[styles.cell, styles.labelCell]}>
                <Text style={[styles.hourText, { color: palette.textSecondary }]}>{i}h</Text>
              </View>
            ))}
          </View>

          {/* Data Rows */}
          {STAGES.map((stage, sIdx) => (
            <View key={stage} style={styles.row}>
              <View style={styles.labelCol}>
                <Text style={[styles.stageText, { color: palette.text }]} numberOfLines={1}>
                  {stage}
                </Text>
              </View>
              {Array.from({ length: GRID_COLS }).map((_, hIdx) => (
                <View
                  key={`${stage}-${hIdx}`}
                  style={[
                    styles.cell,
                    { 
                      backgroundColor: getCellColor(sIdx, hIdx),
                      borderColor: palette.background,
                      borderWidth: 1
                    }
                  ]}
                />
              ))}
            </View>
          ))}
        </View>
      </ScrollView>

      <Text style={[styles.footerText, { color: palette.textSecondary }]}>
        {t('heatmapFooter' as any) || 'Showing average duration per stage/hour (mock data)'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginVertical: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.bodyBold,
  },
  legend: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendBox: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  legendText: {
    ...typography.tiny,
  },
  scroll: {
    marginHorizontal: -spacing.md,
    paddingHorizontal: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  labelCol: {
    width: 60,
    justifyContent: 'center',
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  labelCell: {
    height: 20,
  },
  hourText: {
    ...typography.tiny,
    fontSize: 9,
  },
  stageText: {
    ...typography.caption,
    fontWeight: '700',
  },
  footerText: {
    ...typography.tiny,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
});
