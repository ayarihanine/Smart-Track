import React, { useMemo } from 'react';
import { Dimensions, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart } from 'react-native-chart-kit';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import { useQuery } from '@tanstack/react-query';

import { borderRadius, shadows, spacing, typography } from '@/constants/design';
import { useTheme } from '@/components/ThemeProvider';
import { useTranslation } from '@/hooks/useTranslation';
import {
  getCardUnitCost,
  getDailyLossesStats,
  getDailyProductionStats,
  getLossesByMachineStats,
} from '@/lib/api';
import { PerteParMachine, ProductionParJour } from '@/types/production';

const screenWidth = Dimensions.get('window').width;
const LOSS_COLOR = '#EF4444';
const SENSOR_COLORS = ['#2563EB', '#F59E0B', '#10B981'];

function dayLabel(value: string) {
  const date = new Date(value);
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function ChartCard({
  title,
  palette,
  children,
}: {
  title: string;
  palette: any;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.card, { backgroundColor: palette.background, borderColor: palette.border }]}>
      <Text style={[styles.cardTitle, { color: palette.text }]}>{title}</Text>
      {children}
    </View>
  );
}

function NoDataState({ text, palette }: { text: string; palette: any }) {
  return (
    <View style={styles.noDataState}>
      <Text style={[styles.noDataText, { color: palette.textSecondary }]}>{text}</Text>
    </View>
  );
}

function SensorProductionChart({
  data,
  palette,
}: {
  data: ProductionParJour[];
  palette: any;
}) {
  const chartHeight = 170;
  const labelHeight = 28;
  const leftPad = 24;
  const groupWidth = 32;
  const barWidth = 7;
  const chartWidth = Math.max(screenWidth - spacing.lg * 4, data.length * groupWidth + leftPad + 16);
  const maxValue = Math.max(
    1,
    ...data.flatMap((item) => [item.machine1, item.machine2, item.machine3])
  );

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <Svg width={chartWidth} height={chartHeight + labelHeight}>
        <Line
          x1={leftPad}
          y1={chartHeight}
          x2={chartWidth - 12}
          y2={chartHeight}
          stroke={palette.border}
          strokeWidth="1"
        />

        {data.map((item, index) => {
          const baseX = leftPad + index * groupWidth;
          const values = [item.machine1, item.machine2, item.machine3];

          return (
            <React.Fragment key={`${item.jour}-${index}`}>
              {values.map((value, seriesIndex) => {
                const height = (value / maxValue) * (chartHeight - 12);
                return (
                  <Rect
                    key={`${item.jour}-${seriesIndex}`}
                    x={baseX + seriesIndex * (barWidth + 2)}
                    y={chartHeight - height}
                    width={barWidth}
                    height={height}
                    rx={2}
                    fill={SENSOR_COLORS[seriesIndex]}
                  />
                );
              })}

              <SvgText
                x={baseX + barWidth + 3}
                y={chartHeight + 16}
                fontSize="10"
                fill={palette.textSecondary}
                textAnchor="middle"
              >
                {dayLabel(item.jour)}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </ScrollView>
  );
}

export default function StatisticsScreen() {
  const { t } = useTranslation();
  const { palette } = useTheme();

  const lossesQuery = useQuery({
    queryKey: ['production', 'stats', 'losses-per-day'],
    queryFn: getDailyLossesStats,
  });

  const productionQuery = useQuery({
    queryKey: ['production', 'stats', 'production-per-day'],
    queryFn: getDailyProductionStats,
  });

  const machineQuery = useQuery({
    queryKey: ['production', 'stats', 'losses-per-machine'],
    queryFn: getLossesByMachineStats,
  });

  const costQuery = useQuery({
    queryKey: ['production', 'stats', 'card-cost'],
    queryFn: getCardUnitCost,
  });

  const lossesData = useMemo(() => (lossesQuery.data || []).slice(-30), [lossesQuery.data]);
  const productionData = useMemo(() => (productionQuery.data || []).slice(-30), [productionQuery.data]);
  const machineStats = machineQuery.data || [];

  const lossesChart = useMemo(() => {
    if (lossesData.length === 0) return null;

    return {
      labels: lossesData.map((item) => dayLabel(item.jour)),
      datasets: [{ data: lossesData.map((item) => item.total_cartes) }],
    };
  }, [lossesData]);

  const lossesChartWidth = Math.max(screenWidth - spacing.lg * 4, (lossesChart?.labels.length || 0) * 48);

  const chartConfig = {
    backgroundGradientFrom: palette.background,
    backgroundGradientTo: palette.background,
    decimalPlaces: 0,
    color: () => LOSS_COLOR,
    labelColor: () => palette.textSecondary,
    barPercentage: 0.6,
    fillShadowGradient: LOSS_COLOR,
    fillShadowGradientOpacity: 1,
    propsForBackgroundLines: {
      stroke: palette.border,
    },
    propsForLabels: {
      fontSize: 10,
    },
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.backgroundSecondary }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={
              lossesQuery.isFetching ||
              productionQuery.isFetching ||
              machineQuery.isFetching ||
              costQuery.isFetching
            }
            onRefresh={async () => {
              await Promise.all([
                lossesQuery.refetch(),
                productionQuery.refetch(),
                machineQuery.refetch(),
                costQuery.refetch(),
              ]);
            }}
            tintColor={palette.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.costBadge, { backgroundColor: palette.background, borderColor: palette.border }]}>
          <Text style={[styles.costBadgeText, { color: palette.primary }]}>
            {t('unitCostBadge').replace('{{cost}}', costQuery.data?.toFixed(3) || '0.000')}
          </Text>
        </View>

        <ChartCard title={t('dailyLossesChart')} palette={palette}>
          {lossesChart ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <BarChart
                data={lossesChart}
                width={lossesChartWidth}
                height={220}
                yAxisLabel=""
                yAxisSuffix=""
                fromZero
                showValuesOnTopOfBars
                withInnerLines
                chartConfig={chartConfig}
                style={styles.chart}
              />
            </ScrollView>
          ) : (
            <NoDataState text={t('insufficientData')} palette={palette} />
          )}
        </ChartCard>

        <ChartCard title={t('productionBySensorChart')} palette={palette}>
          {productionData.length > 0 ? (
            <>
              <SensorProductionChart data={productionData} palette={palette} />
              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: SENSOR_COLORS[0] }]} />
                  <Text style={[styles.legendText, { color: palette.textSecondary }]}>{t('sensor1Short')}</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: SENSOR_COLORS[1] }]} />
                  <Text style={[styles.legendText, { color: palette.textSecondary }]}>{t('sensor2Short')}</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: SENSOR_COLORS[2] }]} />
                  <Text style={[styles.legendText, { color: palette.textSecondary }]}>{t('sensor3Short')}</Text>
                </View>
              </View>
            </>
          ) : (
            <NoDataState text={t('insufficientData')} palette={palette} />
          )}
        </ChartCard>

        {machineStats.length > 0 ? (
          <View style={[styles.card, { backgroundColor: palette.background, borderColor: palette.border }]}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>{t('lossesByMachineTable')}</Text>

            <View style={[styles.tableHeader, { borderBottomColor: palette.border }]}>
              <Text style={[styles.tableHeaderText, { flex: 1.6, color: palette.textSecondary }]}>{t('machineColumn')}</Text>
              <Text style={[styles.tableHeaderText, { flex: 1, color: palette.textSecondary, textAlign: 'center' }]}>
                {t('incidentsColumn')}
              </Text>
              <Text style={[styles.tableHeaderText, { flex: 1.2, color: palette.textSecondary, textAlign: 'center' }]}>
                {t('lostCardsColumn')}
              </Text>
              <Text style={[styles.tableHeaderText, { flex: 1.2, color: palette.textSecondary, textAlign: 'right' }]}>
                {t('costTndColumn')}
              </Text>
            </View>

            {machineStats.map((row: PerteParMachine, index) => (
              <View
                key={`${row.machine}-${index}`}
                style={[
                  styles.tableRow,
                  index < machineStats.length - 1 && { borderBottomColor: palette.border, borderBottomWidth: 1 },
                ]}
              >
                <Text style={[styles.tableValue, { flex: 1.6, color: palette.text }]}>{row.machine}</Text>
                <Text style={[styles.tableValue, { flex: 1, color: palette.text, textAlign: 'center' }]}>{row.nb_incidents}</Text>
                <Text style={[styles.tableValue, { flex: 1.2, color: palette.text, textAlign: 'center' }]}>
                  {row.total_cartes_perdues}
                </Text>
                <Text style={[styles.tableValue, { flex: 1.2, color: LOSS_COLOR, textAlign: 'right' }]}>
                  {row.cout_total.toFixed(3)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  card: {
    borderWidth: 1,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  cardTitle: {
    ...typography.h4,
    marginBottom: spacing.md,
  },
  costBadge: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignSelf: 'flex-start',
    ...shadows.xs,
  },
  costBadgeText: {
    ...typography.bodyBold,
  },
  chart: {
    borderRadius: 16,
    marginLeft: -12,
  },
  noDataState: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noDataText: {
    ...typography.body,
  },
  legendRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    ...typography.small,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
  },
  tableHeaderText: {
    ...typography.tiny,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  tableValue: {
    ...typography.small,
    fontWeight: '600',
  },
});
