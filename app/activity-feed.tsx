import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { spacing, typography, borderRadius, shadows } from '@/constants/design';
import { useTheme } from '@/components/ThemeProvider';
import { useTranslation } from '@/hooks/useTranslation';

import { getScanEvents } from '@/lib/api';
import { ScanEvent } from '@/types';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { getSupabaseClient } from '@/lib/supabase';

function ActivityItem({ item, palette }: { item: ScanEvent; palette: any }) {
    const { t } = useTranslation();
    const date = new Date(item.timestamp);
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });

    return (
        <View style={[styles.activityItem, { backgroundColor: palette.background, borderColor: palette.border }]}>
            <View style={[styles.statusLine, { backgroundColor: palette.primary }]} />
            <View style={styles.itemContent}>
                <View style={styles.itemHeader}>
                    <Text style={[styles.cardId, { color: palette.text }]}>{item.cardId}</Text>
                    <Text style={[styles.timestamp, { color: palette.textTertiary }]}>{dateStr}, {timeStr}</Text>
                </View>
                <Text style={[styles.details, { color: palette.textSecondary }]}>
                    {t('movedTo')} <Text style={{ fontWeight: '700', color: palette.text }}>{item.stageName || t('nextStage')}</Text>
                </Text>
                <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                        <Ionicons name="person-outline" size={12} color={palette.textTertiary} />
                        <Text style={[styles.metaText, { color: palette.textTertiary }]}>{item.scannedBy}</Text>
                    </View>
                    <View style={styles.metaItem}>
                        <Ionicons name="location-outline" size={12} color={palette.textTertiary} />
                        <Text style={[styles.metaText, { color: palette.textTertiary }]}>{item.location}</Text>
                    </View>
                </View>
            </View>
        </View>
    );
}

export default function ActivityFeedScreen() {
    useRoleGuard(['admin', 'supervisor']);
    const { t } = useTranslation();
    const { palette } = useTheme();

    const [events, setEvents] = useState<ScanEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchEvents = async () => {
        try {
            const data = await getScanEvents();
            setEvents(data || []);
        } catch (error) {
            console.error('fetchEvents failed:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchEvents();

        const supabase = getSupabaseClient();
        if (!supabase) return;

        const channel = supabase
            .channel('activity-feed-live')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'sensor_events' },
                () => {
                    fetchEvents();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: palette.backgroundSecondary }]} edges={['top']}>
            <View style={[styles.header, { backgroundColor: palette.background, borderBottomColor: palette.border }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color={palette.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: palette.text }]}>{t('activityFeed')}</Text>
                <TouchableOpacity onPress={() => fetchEvents()} style={styles.refreshBtn}>
                    <Ionicons name="refresh" size={20} color={palette.primary} />
                </TouchableOpacity>
            </View>

            <Text style={[styles.testNote, { color: palette.textTertiary }]}>
              Showing test cards. Real cards appear after QR scanning begins.
            </Text>

            <FlatList
                data={events}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <ActivityItem item={item} palette={palette} />}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={isLoading} onRefresh={fetchEvents} tintColor={palette.primary} />
                }
                ListEmptyComponent={
                    !isLoading ? (
                        <View style={styles.empty}>
                            <Ionicons name="list-outline" size={64} color={palette.border} />
                            <Text style={[styles.emptyText, { color: palette.textSecondary }]}>{t('noActivityRecorded')}</Text>
                        </View>
                    ) : null
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
        borderBottomWidth: 1,
    },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { ...typography.h4 },
    refreshBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    testNote: { ...typography.small, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, fontStyle: 'italic' },
    listContent: { padding: spacing.lg, paddingBottom: 40 },
    activityItem: {
        flexDirection: 'row',
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        marginBottom: spacing.md,
        overflow: 'hidden',
        ...shadows.xs,
    },
    statusLine: { width: 4 },
    itemContent: { flex: 1, padding: spacing.md },
    itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    cardId: { ...typography.bodyBold },
    timestamp: { ...typography.tiny, fontWeight: '600' },
    details: { ...typography.body, marginBottom: spacing.sm },
    metaRow: { flexDirection: 'row', gap: spacing.md },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { ...typography.tiny, fontWeight: '600' },
    empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 100, gap: spacing.md },
    emptyText: { ...typography.body },
});
