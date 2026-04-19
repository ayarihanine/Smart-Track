import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/components/ThemeProvider';
import { spacing, typography, borderRadius, shadows } from '@/constants/design';

export default function SmartOptimizationScreen() {
  const { t } = useTranslation();
  const { palette, isDark } = useTheme();

  const insights = [
    {
      title: 'Production Bottleneck',
      desc: 'SMT Line 01 is currently 12% slower than its 7-day average. Consider re-balancing tasks.',
      icon: 'speedometer',
      color: '#EF4444',
      type: 'Critical',
    },
    {
      title: 'Predictive Maintenance',
      desc: 'Optical Scanner at Station 01 is reporting intermittent connectivity. Maintenance recommended in next 24h.',
      icon: 'construct',
      color: '#F59E0B',
      type: 'Warning',
    },
    {
      title: 'Efficiency Gain',
      desc: 'Recent data suggests re-assigning Stage QC to Floor B could reduce travel time by 4 mins per card.',
      icon: 'trending-up',
      color: '#10B981',
      type: 'Opportunity',
    },
    {
      title: 'Inventory Alert',
      desc: 'Consumption rate of PCB-A4 has increased. Current stock will last 3 days instead of 5.',
      icon: 'cube',
      color: '#3B82F6',
      type: 'Insight',
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.backgroundSecondary }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: palette.background, borderBottomColor: palette.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: palette.text }]}>{t('smartOptimization') || 'Smart Optimization'}</Text>
        <Ionicons name="sparkles" size={24} color="#8B5CF6" />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.heroSection}>
          <Text style={[styles.heroText, { color: palette.textTertiary }]}>
            AI-powered analysis of your production efficiency.
          </Text>
        </View>

        {insights.map((insight, index) => (
          <Animated.View
            key={insight.title}
            entering={FadeInDown.delay(index * 150)}
            style={[styles.insightCard, { backgroundColor: palette.background, borderColor: palette.border }]}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconContainer, { backgroundColor: insight.color + '20' }]}>
                <Ionicons name={insight.icon as any} size={24} color={insight.color} />
              </View>
              <View style={styles.cardHeaderInfo}>
                <Text style={[styles.insightType, { color: insight.color }]}>{insight.type.toUpperCase()}</Text>
                <Text style={[styles.insightTitle, { color: palette.text }]}>{insight.title}</Text>
              </View>
            </View>
            <Text style={[styles.insightDesc, { color: palette.textSecondary }]}>{insight.desc}</Text>
            
            <TouchableOpacity style={[styles.actionBtn, { borderColor: palette.border }]}>
              <Text style={[styles.actionBtnText, { color: palette.text }]}>Apply AI Suggestion</Text>
              <Ionicons name="chevron-forward" size={16} color={palette.textTertiary} />
            </TouchableOpacity>
          </Animated.View>
        ))}

        <View style={[styles.footerCard, { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }]}>
          <Ionicons name="bulb" size={24} color="#8B5CF6" style={{ marginBottom: spacing.sm }} />
          <Text style={[styles.footerTitle, { color: '#5B21B6' }]}>Continuous Learning</Text>
          <Text style={[styles.footerDesc, { color: '#7C3AED' }]}>
            SmartTrack AI improves its accuracy the more scans it processes. Keep scanning to refine your insights.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  backBtn: { marginRight: spacing.md },
  title: { ...typography.bodyBold, fontSize: 18, flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg },
  heroSection: { marginBottom: spacing.lg },
  heroText: { ...typography.small, textAlign: 'center' },
  insightCard: {
    padding: spacing.lg, borderRadius: borderRadius.xl,
    marginBottom: spacing.lg, borderWidth: 1, ...shadows.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md, gap: spacing.md },
  iconContainer: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  cardHeaderInfo: { flex: 1 },
  insightType: { ...typography.tiny, fontWeight: '800', letterSpacing: 1 },
  insightTitle: { ...typography.bodyBold, fontSize: 17, marginTop: 2 },
  insightDesc: { ...typography.body, lineHeight: 22 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: spacing.lg, paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  actionBtnText: { ...typography.small, fontWeight: '600' },
  footerCard: {
    padding: spacing.xl, borderRadius: borderRadius.xl,
    borderWidth: 1, marginBottom: spacing.xl,
    alignItems: 'center',
  },
  footerTitle: { ...typography.bodyBold, fontSize: 18 },
  footerDesc: { ...typography.small, textAlign: 'center', marginTop: spacing.xs, lineHeight: 18 },
});
