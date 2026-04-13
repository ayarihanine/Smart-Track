import React, { useState, useMemo } from 'react';
import {
    View, Text, ScrollView, StyleSheet, TouchableOpacity, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/design';
import { getLeaderboard } from '@/lib/api';
import { LeaderboardEntry, AnalyticsPeriod } from '@/types';
import { useTranslation } from '@/hooks/useTranslation';

function PodiumItem({ entry, rank, height }: { entry?: LeaderboardEntry, rank: number, height: number }) {
    const { t } = useTranslation();
    const config = {
        1: { color: '#FCD34D', icon: 'medal', label: t('gold') },
        2: { color: '#CBD5E1', icon: 'ribbon', label: t('silver') },
        3: { color: '#D97706', icon: 'trophy', label: t('bronze') },
    }[rank as 1 | 2 | 3];

    if (!entry) return <View style={[styles.podiumCol, { height }]} />;

    return (
        <View style={styles.podiumCol}>
            <View style={styles.avatarContainer}>
                <View style={[styles.avatarBorder, { borderColor: config.color }]}>
                    <View style={[styles.avatarPlaceholder, { backgroundColor: colors.backgroundTertiary }]}>
                        {entry.avatarUrl ? (
                            <Image
                                source={{ uri: entry.avatarUrl }}
                                style={styles.avatarImg}
                            />
                        ) : (
                            <Text style={styles.avatarInitial}>{entry.displayName.charAt(0)}</Text>
                        )}
                    </View>
                </View>
                <View style={[styles.rankBadge, { backgroundColor: config.color }]}>
                    <Text style={styles.rankBadgeText}>{rank}</Text>
                </View>
            </View>
            <Text style={styles.podiumName} numberOfLines={1}>{entry.displayName.split(' ')[0]}</Text>
            <Text style={styles.podiumScore}>{entry.cardsScanned} {t('cardsCount')}</Text>
            <View style={[styles.podiumBase, { height, backgroundColor: config.color + '20', borderColor: config.color }]}>
                <Ionicons name={config.icon as any} size={24} color={config.color} />
            </View>
        </View>
    );
}

function RankingItem({ entry, index }: { entry: LeaderboardEntry, index: number }) {
    const { t } = useTranslation();
    return (
        <View style={[styles.rankingCard, entry.isCurrentUser && styles.rankingCardSelf]}>
            <Text style={styles.listRank}>#{entry.rank}</Text>
            <View style={styles.listAvatar}>
                {entry.avatarUrl ? (
                    <Image
                        source={{ uri: entry.avatarUrl }}
                        style={styles.listAvatarImg}
                    />
                ) : (
                    <Text style={styles.listAvatarText}>{entry.displayName.charAt(0)}</Text>
                )}
            </View>
            <View style={styles.listInfo}>
                <Text style={styles.listName}>
                    {entry.displayName} {entry.isCurrentUser && `(${t('you')})`}
                </Text>
                <View style={styles.listMeta}>
                    <Text style={styles.listMetaText}>{entry.avgTimeMinutes} {t('minPerStage')}</Text>
                    <View style={styles.dot} />
                    <Ionicons
                        name={entry.trend === 'up' ? 'trending-up' : entry.trend === 'down' ? 'trending-down' : 'remove'}
                        size={12}
                        color={entry.trend === 'up' ? '#10B981' : entry.trend === 'down' ? '#EF4444' : '#6B7280'}
                    />
                </View>
            </View>
            <View style={styles.listScoreContainer}>
                <Text style={styles.listScore}>{entry.cardsScanned}</Text>
                <Text style={styles.listScoreLabel}>{t('cardsCount')}</Text>
            </View>
        </View>
    );
}

export default function LeaderboardScreen() {
    const { t } = useTranslation();
    const [period, setPeriod] = useState<AnalyticsPeriod>('this_week');

    const PERIOD_LABELS = {
        today: t('today'),
        this_week: t('thisWeek'),
        all_time: t('allTime'),
    };

    const { data: users } = useQuery({
        queryKey: ['leaderboard', period],
        queryFn: () => getLeaderboard(period),
    });

    const podiumData = useMemo(() => {
        if (!users) return { first: undefined, second: undefined, third: undefined };
        return {
            first: users.find(e => e.rank === 1),
            second: users.find(e => e.rank === 2),
            third: users.find(e => e.rank === 3),
        };
    }, [users]);

    const otherRankings = useMemo(() => {
        if (!users) return [];
        return users.filter(e => e.rank > 3).sort((a, b) => a.rank - b.rank);
    }, [users]);

    const myEntry = useMemo(() => {
        return users?.find(e => e.isCurrentUser);
    }, [users]);

    const avgProduction = 95; // Mock daily average

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('floorLeaderboard')}</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.filterBar}>
                {(['today', 'this_week', 'all_time'] as AnalyticsPeriod[]).map((p) => (
                    <TouchableOpacity
                        key={p}
                        style={[styles.filterBtn, period === p && styles.filterBtnActive]}
                        onPress={() => setPeriod(p)}
                    >
                        <Text style={[styles.filterText, period === p && styles.filterTextActive]}>
                            {PERIOD_LABELS[p]}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* Podium Section */}
                <View style={styles.podiumContainer}>
                    <PodiumItem rank={2} entry={podiumData.second} height={100} />
                    <PodiumItem rank={1} entry={podiumData.first} height={140} />
                    <PodiumItem rank={3} entry={podiumData.third} height={80} />
                </View>

                {/* Ranking List */}
                <View style={styles.listSection}>
                    <Text style={styles.sectionTitle}>{t('rankingDetails')}</Text>
                    {otherRankings.map((entry, idx) => (
                        <RankingItem key={entry.userId} entry={entry} index={idx} />
                    ))}
                </View>
            </ScrollView>

            {/* Persistent My Performance Card */}
            {myEntry && (
                <View style={styles.myCardContainer}>
                    <View style={styles.myCard}>
                        <View style={styles.myCardInfo}>
                            <View style={styles.myRankBadge}>
                                <Text style={styles.myRankText}>#{myEntry.rank}</Text>
                            </View>
                            <View>
                                <Text style={styles.myCardLabel}>{t('myPerformance')}</Text>
                                <Text style={styles.myCardSub}>
                                    {t(myEntry.cardsScanned > avgProduction ? 'above' : 'below')} {t('dailyAverage')}
                                </Text>
                            </View>
                        </View>
                        <View style={styles.myCardScore}>
                            <Text style={styles.myScoreText}>{myEntry.cardsScanned}</Text>
                            <Text style={styles.myScoreLabel}> / {avgProduction}</Text>
                        </View>
                    </View>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.backgroundSecondary },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
        backgroundColor: colors.white,
    },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { ...typography.h4, color: colors.text },
    filterBar: {
        flexDirection: 'row', padding: spacing.sm, backgroundColor: colors.white,
        gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    filterBtn: {
        flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: borderRadius.md,
        backgroundColor: colors.backgroundTertiary,
    },
    filterBtnActive: { backgroundColor: colors.primary },
    filterText: { ...typography.small, color: colors.textSecondary, fontWeight: '600' },
    filterTextActive: { color: colors.white },
    scrollContent: { paddingBottom: 120 },
    podiumContainer: {
        flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center',
        paddingTop: spacing.xl, paddingHorizontal: spacing.lg, height: 280,
    },
    podiumCol: { flex: 1, alignItems: 'center' },
    avatarContainer: { position: 'relative', marginBottom: spacing.xs },
    avatarBorder: {
        width: 60, height: 60, borderRadius: 30, borderWidth: 3, padding: 2,
    },
    avatarPlaceholder: {
        flex: 1, backgroundColor: colors.backgroundTertiary, borderRadius: 28,
        alignItems: 'center', justifyContent: 'center',
    },
    avatarInitial: { ...typography.h4, color: colors.textTertiary },
    rankBadge: {
        position: 'absolute', bottom: -4, right: -4, width: 24, height: 24,
        borderRadius: 12, alignItems: 'center', justifyContent: 'center',
        borderWidth: 2, borderColor: colors.white,
    },
    rankBadgeText: { ...typography.tiny, color: colors.white, fontWeight: 'bold' },
    podiumName: { ...typography.smallBold, color: colors.text, marginBottom: 2 },
    podiumScore: { ...typography.tiny, color: colors.textSecondary, fontWeight: '700', marginBottom: spacing.sm },
    podiumBase: {
        width: '80%', borderTopLeftRadius: borderRadius.md, borderTopRightRadius: borderRadius.md,
        alignItems: 'center', paddingVertical: spacing.md, borderWidth: 1, borderBottomWidth: 0,
    },
    listSection: { padding: spacing.lg },
    sectionTitle: { ...typography.captionBold, color: colors.textTertiary, marginBottom: spacing.md, textTransform: 'uppercase' },
    rankingCard: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white,
        padding: spacing.md, borderRadius: borderRadius.lg, marginBottom: spacing.sm,
        ...shadows.xs, borderWidth: 1, borderColor: colors.border,
    },
    rankingCardSelf: { borderColor: colors.primary, backgroundColor: colors.primary + '05', borderWidth: 2 },
    listRank: { width: 32, ...typography.bodyBold, color: colors.textSecondary },
    listAvatar: {
        width: 36, height: 36, borderRadius: 18, backgroundColor: colors.backgroundTertiary,
        alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm,
    },
    listAvatarText: { ...typography.bodyBold, color: colors.textTertiary },
    listInfo: { flex: 1 },
    listName: { ...typography.bodyBold, color: colors.text },
    listMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    listMetaText: { ...typography.tiny, color: colors.textTertiary },
    dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.textTertiary },
    listScoreContainer: { alignItems: 'flex-end', minWidth: 60 },
    listScore: { ...typography.h4, color: colors.primary },
    listScoreLabel: { ...typography.tiny, color: colors.textTertiary, fontWeight: '700' },
    myCardContainer: {
        position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.lg,
        backgroundColor: 'transparent',
    },
    myCard: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: colors.text, padding: spacing.md, borderRadius: borderRadius.xl,
        ...shadows.lg,
    },
    myCardInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    myRankBadge: {
        width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary,
        alignItems: 'center', justifyContent: 'center',
    },
    myRankText: { ...typography.h4, color: colors.white },
    myCardLabel: { ...typography.bodyBold, color: colors.white },
    myCardSub: { ...typography.tiny, color: '#94A3B8' },
    myCardScore: { flexDirection: 'row', alignItems: 'baseline' },
    myScoreText: { ...typography.h3, color: colors.white },
    myScoreLabel: { ...typography.body, color: '#94A3B8' },
    avatarImg: {
        width: '100%',
        height: '100%',
        borderRadius: 28,
    },
    listAvatarImg: {
        width: '100%',
        height: '100%',
        borderRadius: 18,
    },
});
