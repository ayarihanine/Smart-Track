import React, { useMemo } from 'react';
import { Dimensions, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart } from 'react-native-chart-kit';
import Svg, { Line, Rect, Text as SvgText, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { router } from 'expo-router';

import { spacing, typography } from '../../constants/design';
import { useTheme } from '../../components/ThemeProvider';
import { useTranslation } from '../../hooks/useTranslation';
import {
  fetchLossesByDay,
  fetchLossesByMachine,
  fetchProductionByDay,
  fetchTRGHistory,
  fetchTRSHistory,
  getCardUnitCost,
} from '../../lib/api';
import { PerteParMachine, ProductionParJour, PerteParJour } from '../../types/production';
import { TRGRow, TRSRow } from '../../types';

const screenWidth = Dimensions.get('window').width;
const LOSS_COLOR = '#EF4444';
const SENSOR_COLORS = ['#38BDF8', '#818CF8', '#34D399']; // Modern vibrant colors
const EMPTY_TEXT = 'No data recorded yet';

function dayLabel(value: string) {
  const date = new Date(value);
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function ChartCard({
  title,
  palette,
  isDark,
  children,
  delay = 0,
}: {
  title: string;
  palette: any;
  isDark: boolean;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <Animated.View 
      entering={FadeInDown.delay(delay).duration(600).springify()}
      style={[styles.card, { backgroundColor: palette.background, borderColor: palette.border, shadowColor: isDark ? '#38BDF8' : palette.border }]}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.cardTitleDot, { backgroundColor: isDark ? '#38BDF8' : '#2563eb' }]} />
        <Text style={[styles.cardTitle, { color: palette.text }]}>{title}</Text>
      </View>
      {children}
    </Animated.View>
  );
}

function NoDataState({ text, palette }: { text: string; palette: any }) {
  return (
    <View style={styles.noDataState}>
      <Ionicons name="bar-chart-outline" size={32} color={palette.border} style={{ marginBottom: 12 }} />
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
  const groupWidth = 36;
  const barWidth = 8;
  const chartWidth = Math.max(screenWidth - spacing.lg * 4, data.length * groupWidth + leftPad + 16);
  const maxValue = Math.max(
    1,
    ...data.flatMap((item) => [item.machine1, item.machine2, item.machine3])
  );

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -spacing.md }}>
      <Svg width={chartWidth} height={chartHeight + labelHeight} style={{ marginLeft: spacing.md }}>
        <Defs>
          <SvgGradient id="grad0" x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0" stopColor={SENSOR_COLORS[0]} stopOpacity="0.4" />
            <Stop offset="1" stopColor={SENSOR_COLORS[0]} stopOpacity="1" />
          </SvgGradient>
          <SvgGradient id="grad1" x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0" stopColor={SENSOR_COLORS[1]} stopOpacity="0.4" />
            <Stop offset="1" stopColor={SENSOR_COLORS[1]} stopOpacity="1" />
          </SvgGradient>
          <SvgGradient id="grad2" x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0" stopColor={SENSOR_COLORS[2]} stopOpacity="0.4" />
            <Stop offset="1" stopColor={SENSOR_COLORS[2]} stopOpacity="1" />
          </SvgGradient>
        </Defs>

        {/* Horizontal background gridlines */}
        {[0.25, 0.5, 0.75].map((ratio) => {
          const y = chartHeight - ratio * (chartHeight - 16);
          return (
            <Line
              key={`grid-${ratio}`}
              x1={leftPad}
              y1={y}
              x2={chartWidth - 12}
              y2={y}
              stroke={palette.border}
              strokeWidth="1"
              strokeDasharray="4,4"
            />
          );
        })}

        <Line
          x1={leftPad}
          y1={chartHeight}
          x2={chartWidth - 12}
          y2={chartHeight}
          stroke={palette.border}
          strokeWidth="2"
          strokeLinecap="round"
        />

        {data.map((item, index) => {
          const baseX = leftPad + index * groupWidth;
          const values = [item.machine1, item.machine2, item.machine3];

          return (
            <React.Fragment key={`${item.jour}-${index}`}>
              {values.map((value, seriesIndex) => {
                const height = Math.max(4, (value / maxValue) * (chartHeight - 16));
                return (
                  <Rect
                    key={`${item.jour}-${seriesIndex}`}
                    x={baseX + seriesIndex * (barWidth + 3)}
                    y={chartHeight - height - 1}
                    width={barWidth}
                    height={height}
                    rx={3}
                    fill={`url(#grad${seriesIndex})`}
                  />
                );
              })}

              <SvgText
                x={baseX + barWidth + 4}
                y={chartHeight + 18}
                fontSize="11"
                fontWeight="600"
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
  const { t, language } = useTranslation();
  const { palette, isDark } = useTheme();

  const unitCostLabelText = useMemo(() => {
    switch (language) {
      case 'fr':
        return "Coût unitaire d'une carte";
      case 'ar':
        return "تكلفة وحدة البطاقة";
      default:
        return "Card Unit Cost";
    }
  }, [language]);

  const lossesQuery = useQuery<PerteParJour[]>({
    queryKey: ['production', 'stats', 'losses-per-day'],
    queryFn: fetchLossesByDay,
  });

  const productionQuery = useQuery<ProductionParJour[]>({
    queryKey: ['production', 'stats', 'production-per-day'],
    queryFn: fetchProductionByDay,
  });

  const machineQuery = useQuery<PerteParMachine[]>({
    queryKey: ['production', 'stats', 'losses-per-machine'],
    queryFn: fetchLossesByMachine,
  });

  const trgHistoryQuery = useQuery<TRGRow[]>({
    queryKey: ['production', 'stats', 'trg-history'],
    queryFn: () => fetchTRGHistory(20),
  });

  const trsHistoryQuery = useQuery<TRSRow[]>({
    queryKey: ['production', 'stats', 'trs-history'],
    queryFn: () => fetchTRSHistory(20),
  });

  const costQuery = useQuery<number>({
    queryKey: ['production', 'stats', 'card-cost'],
    queryFn: getCardUnitCost,
  });

  const lossesData: PerteParJour[] = useMemo(() => (lossesQuery.data || []).slice(-30), [lossesQuery.data]);
  const productionData: ProductionParJour[] = useMemo(() => (productionQuery.data || []).slice(-30), [productionQuery.data]);
  const machineStats: PerteParMachine[] = machineQuery.data || [];
  const trgHistory = useMemo(() => [...(trgHistoryQuery.data || [])].reverse(), [trgHistoryQuery.data]);
  const trsHistory = useMemo(() => [...(trsHistoryQuery.data || [])].reverse(), [trsHistoryQuery.data]);

  const lossesChart = useMemo(() => {
    if (lossesData.length === 0) return null;

    return {
      labels: lossesData.map((item: PerteParJour) => dayLabel(item.jour)),
      datasets: [{ data: lossesData.map((item: PerteParJour) => item.total_cartes) }],
    };
  }, [lossesData]);

  const lossesChartWidth = Math.max(screenWidth - spacing.lg * 4, (lossesChart?.labels.length || 0) * 52);
  const trgChart = useMemo(() => {
    if (trgHistory.length === 0) return null;
    return {
      labels: trgHistory.map((item) => dayLabel(item.date_temps)),
      datasets: [{ data: trgHistory.map((item) => Number(item.trg_pourcentage ?? 0)) }],
    };
  }, [trgHistory]);
  const trsChart = useMemo(() => {
    if (trsHistory.length === 0) return null;
    return {
      labels: trsHistory.map((item) => dayLabel(item.date_temps)),
      datasets: [{ data: trsHistory.map((item) => Number(item.trs_pourcentage ?? 0)) }],
    };
  }, [trsHistory]);
  const trgChartWidth = Math.max(screenWidth - spacing.lg * 4, (trgChart?.labels.length || 0) * 52);
  const trsChartWidth = Math.max(screenWidth - spacing.lg * 4, (trsChart?.labels.length || 0) * 52);

  const chartConfig = {
    backgroundGradientFrom: palette.background,
    backgroundGradientTo: palette.background,
    backgroundGradientFromOpacity: 0,
    backgroundGradientToOpacity: 0,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`,
    labelColor: () => palette.textSecondary,
    barPercentage: 0.6,
    fillShadowGradient: LOSS_COLOR,
    fillShadowGradientOpacity: 0.8,
    fillShadowGradientFrom: '#EF4444',
    fillShadowGradientTo: '#B91C1C',
    propsForBackgroundLines: {
      stroke: palette.border,
      strokeDasharray: '4',
    },
    propsForLabels: {
      fontSize: 11,
      fontWeight: '600',
    },
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.backgroundSecondary }]}>
      {/* Immersive Hero Header */}
      <Animated.View entering={FadeInUp.duration(600).springify()} style={[styles.heroBanner, { backgroundColor: palette.background, shadowColor: isDark ? '#38BDF8' : palette.border, borderBottomColor: palette.border, borderBottomWidth: 1 }]}>
        <SafeAreaView edges={['top']}>
          <View style={styles.heroTopNav}>
            <TouchableOpacity style={[styles.heroBackBtn, { borderColor: palette.border }]} onPress={() => router.push('/(tabs)')}>
              <Ionicons name="arrow-back" size={16} color={palette.text} />
            </TouchableOpacity>
            <Text style={[styles.heroNavTitle, { color: palette.text }]}>{t('statisticsTab') || 'Statistics'}</Text>
            <View style={styles.heroBackBtn} />
          </View>
          <View style={styles.heroContent}>
            <View style={styles.heroTitleRow}>
              <Text style={[styles.heroTitle, { color: palette.text }]}>{t('statisticsTab') || 'Statistics'}</Text>
            </View>
            <Text style={[styles.heroSubtitle, { color: palette.textSecondary }]}>Operational KPIs and trend intelligence</Text>
          </View>
        </SafeAreaView>
      </Animated.View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={
              lossesQuery.isFetching ||
              productionQuery.isFetching ||
              machineQuery.isFetching ||
              trgHistoryQuery.isFetching ||
              trsHistoryQuery.isFetching ||
              costQuery.isFetching
            }
            onRefresh={async () => {
              await Promise.all([
                lossesQuery.refetch(),
                productionQuery.refetch(),
                machineQuery.refetch(),
                trgHistoryQuery.refetch(),
                trsHistoryQuery.refetch(),
                costQuery.refetch(),
              ]);
            }}
            tintColor={palette.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <Animated.View 
          entering={FadeInDown.delay(100).duration(600).springify()} 
          style={[styles.unitCostCard, { borderColor: palette.border }]}
        >
          <LinearGradient
            colors={isDark ? ['#1e293b', '#0f172a'] : ['#eff6ff', '#dbeafe']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.unitCostInner}>
            <View style={styles.unitCostContent}>
              <View style={styles.unitCostHeader}>
                <Ionicons name="analytics-outline" size={20} color={palette.primary} style={{ marginRight: 8 }} />
                <Text style={[styles.unitCostLabel, { color: isDark ? '#94a3b8' : '#4b5563' }]}>
                  {unitCostLabelText}
                </Text>
              </View>
              <View style={styles.unitCostRow}>
                <Text style={[styles.unitCostValue, { color: palette.text }]}>
                  {(costQuery.data ?? 0).toFixed(3)}
                </Text>
                <Text style={[styles.unitCostCurrency, { color: palette.primary }]}>TND</Text>
              </View>
            </View>
            
            <View style={[styles.unitCostIconWrap, { backgroundColor: isDark ? '#0f172a' : '#ffffff' }]}>
              <Ionicons name="cash" size={28} color={palette.primary} />
            </View>
          </View>
        </Animated.View>

        <ChartCard title={t('dailyLossesChart')} palette={palette} isDark={isDark} delay={200}>
          {lossesChart ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -spacing.md }}>
              <View style={{ marginLeft: spacing.md }}>
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
              </View>
            </ScrollView>
          ) : (
            <NoDataState text={EMPTY_TEXT} palette={palette} />
          )}
        </ChartCard>

        <ChartCard title={t('productionBySensorChart')} palette={palette} isDark={isDark} delay={300}>
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
            <NoDataState text={EMPTY_TEXT} palette={palette} />
          )}
        </ChartCard>

        <ChartCard title="TRG History" palette={palette} isDark={isDark} delay={350}>
          {trgChart ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -spacing.md }}>
              <View style={{ marginLeft: spacing.md }}>
                <BarChart
                  data={trgChart}
                  width={trgChartWidth}
                  height={220}
                  yAxisLabel=""
                  yAxisSuffix="%"
                  fromZero
                  showValuesOnTopOfBars
                  withInnerLines
                  chartConfig={{ ...chartConfig, color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`, fillShadowGradient: '#10B981' }}
                  style={styles.chart}
                />
              </View>
            </ScrollView>
          ) : (
            <NoDataState text={EMPTY_TEXT} palette={palette} />
          )}
        </ChartCard>

        <ChartCard title="TRS History" palette={palette} isDark={isDark} delay={375}>
          {trsChart ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -spacing.md }}>
              <View style={{ marginLeft: spacing.md }}>
                <BarChart
                  data={trsChart}
                  width={trsChartWidth}
                  height={220}
                  yAxisLabel=""
                  yAxisSuffix="%"
                  fromZero
                  showValuesOnTopOfBars
                  withInnerLines
                  chartConfig={{ ...chartConfig, color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`, fillShadowGradient: '#3B82F6' }}
                  style={styles.chart}
                />
              </View>
            </ScrollView>
          ) : (
            <NoDataState text={EMPTY_TEXT} palette={palette} />
          )}
        </ChartCard>

        {machineStats.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(400).duration(600).springify()}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>{t('lossesByMachineTable')}</Text>
            {machineStats.map((row: PerteParMachine, index: number) => (
              <Animated.View
                key={`${row.machine}-${index}`}
                entering={FadeInDown.delay(500 + index * 100).springify()}
                style={[styles.machineCard, { backgroundColor: palette.background, borderColor: palette.border }]}
              >
                <View style={[styles.machineIconWrap, { backgroundColor: isDark ? '#EF444420' : '#fee2e2' }]}>
                  <Ionicons name="hardware-chip" size={22} color="#EF4444" />
                </View>
                <View style={styles.machineInfo}>
                  <Text style={[styles.machineName, { color: palette.text }]}>{row.machine}</Text>
                  <View style={styles.machineStats}>
                    <Text style={[styles.machineStatText, { color: palette.textSecondary }]}>{row.nb_incidents} {t('incidentsColumn')}</Text>
                    <View style={[styles.statDivider, { backgroundColor: palette.border }]} />
                    <Text style={[styles.machineStatText, { color: palette.textSecondary }]}>{row.total_cartes_perdues} {t('lostCardsColumn')}</Text>
                  </View>
                </View>
                <View style={styles.machineCostWrap}>
                  <Text style={[styles.machineCostValue, { color: LOSS_COLOR }]}>-{row.cout_total.toFixed(3)}</Text>
                  <Text style={[styles.machineCostCurrency, { color: LOSS_COLOR }]}>TND</Text>
                </View>
              </Animated.View>
            ))}
          </Animated.View>
        ) : (
          <NoDataState text={EMPTY_TEXT} palette={palette} />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroBanner: {
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
    marginBottom: spacing.sm,
  },

  heroContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  heroTopNav: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroBackBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroNavTitle: {
    ...typography.bodyBold,
    fontSize: 16,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroTitle: {
    ...typography.h2,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    ...typography.small,
    marginTop: spacing.xs,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  heroBadgeText: {
    ...typography.smallBold,
    marginLeft: 6,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: spacing.lg,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  cardTitleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  cardTitle: {
    ...typography.h4,
    fontWeight: '800',
  },
  unitCostCard: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
  },

  unitCostInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.xl,
    justifyContent: 'space-between',
  },
  unitCostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  unitCostLabel: {
    ...typography.smallBold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  unitCostRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  unitCostValue: {
    ...typography.h1,
    fontWeight: '900',
    fontSize: 42,
    letterSpacing: -1,
  },
  unitCostCurrency: {
    ...typography.h3,
    fontWeight: '700',
    marginLeft: 8,
  },
  unitCostIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  unitCostContent: {
    flex: 1,
  },
  chart: {
    borderRadius: 16,
    marginLeft: -16,
  },
  noDataState: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noDataText: {
    ...typography.body,
    fontWeight: '600',
  },
  legendRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
    flexWrap: 'wrap',
    paddingHorizontal: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    ...typography.smallBold,
  },
  sectionTitle: {
    ...typography.h3,
    fontWeight: '900',
    marginBottom: spacing.md,
    marginLeft: spacing.xs,
  },
  machineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: 20,
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  machineIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  machineInfo: {
    flex: 1,
  },
  machineName: {
    ...typography.bodyBold,
    fontSize: 16,
    marginBottom: 4,
  },
  machineStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  machineStatText: {
    ...typography.tiny,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statDivider: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 8,
  },
  machineCostWrap: {
    alignItems: 'flex-end',
  },
  machineCostValue: {
    ...typography.h4,
    fontWeight: '900',
  },
  machineCostCurrency: {
    ...typography.tiny,
    fontWeight: '700',
  },
});
