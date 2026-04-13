import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, ActivityIndicator, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/design';
import { getSupabaseClient } from '@/lib/supabase';
import { ElectronicCard } from '@/types';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/components/ThemeProvider';

const { width } = Dimensions.get('window');

interface StationNode {
  id: string;
  name: string;
  x: number;
  y: number;
}

const STATIONS: StationNode[] = [
  { id: 'Station 1', name: 'SMT Line A', x: 20, y: 50 },
  { id: 'Station 2', name: 'SMT Line B', x: 20, y: 150 },
  { id: 'Station 3', name: 'THT Assembly', x: 140, y: 100 },
  { id: 'Station 4', name: 'Manual Assembly', x: 260, y: 50 },
  { id: 'Station 5', name: 'Testing Bay', x: 260, y: 150 },
  { id: 'Station 6', name: 'Quality Control', x: 140, y: 220 },
  { id: 'Station 7', name: 'Packaging', x: 20, y: 280 },
  { id: 'Station 8', name: 'Shipping', x: 260, y: 280 },
];

export default function ProductionMapScreen() {
  const { t } = useTranslation();
  const { palette, isDark } = useTheme();
  const [cards, setCards] = useState<ElectronicCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'in_progress' | 'completed' | 'on_hold'>('all');

  useEffect(() => {
    fetchCards();
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const channel = supabase
      .channel('map-updates')
      .on('postgres_changes', { event: '*', table: 'electronic_cards', schema: 'public' }, () => {
        fetchCards();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchCards = async () => {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) return;

      const { data, error } = await supabase
        .from('electronic_cards')
        .select('*');

      if (error) throw error;
      setCards(data || []);
    } catch (err) {
      console.error('Failed to fetch cards for map', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCards = useMemo(() => {
    return cards.filter(c => {
      const matchesSearch = (c.cardId || '').toLowerCase().includes(search.toLowerCase()) || 
                          (c.productName || '').toLowerCase().includes(search.toLowerCase());
      const matchesFilter = filter === 'all' || c.status === filter;
      return matchesSearch && matchesFilter;
    });
  }, [cards, search, filter]);

  const stationData = useMemo(() => {
    const counts: Record<string, { count: number; status: 'green' | 'yellow' | 'red' }> = {};
    STATIONS.forEach(s => {
      const atStation = filteredCards.filter(c => (c.currentLocation || '').includes(s.id));
      const hasOnHold = atStation.some(c => c.status === 'on_hold');
      const hasInProgress = atStation.some(c => c.status === 'in_progress');
      
      counts[s.id] = {
        count: atStation.length,
        status: hasOnHold ? 'red' : (hasInProgress ? 'green' : 'yellow'),
      };
    });
    return counts;
  }, [filteredCards]);

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: palette.background }]}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.backgroundSecondary }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
          <Ionicons name="chevron-back" size={24} color={palette.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: palette.text }]}>{t('productionMap')}</Text>
      </View>

      {/* Filter Bar */}
      <View style={[styles.searchBar, { backgroundColor: palette.background, borderColor: palette.border }]}>
        <Ionicons name="search" size={18} color={palette.textTertiary} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: palette.text }]}
          placeholder={t('searchPlaceholder') || "Search Card ID or Product..."}
          placeholderTextColor={palette.textTertiary}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={styles.filterRow}>
        {(['all', 'inProgress', 'completed', 'onHold'] as const).map(f => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f === 'inProgress' ? 'in_progress' : (f === 'onHold' ? 'on_hold' : f))}
            style={[
              styles.filterChip,
              { backgroundColor: palette.background, borderColor: palette.border },
              (filter === f || (filter === 'in_progress' && f === 'inProgress') || (filter === 'on_hold' && f === 'onHold')) && { backgroundColor: palette.primary, borderColor: palette.primary }
            ]}
          >
            <Text style={[
              styles.filterText,
              { color: palette.textSecondary },
              (filter === f || (filter === 'in_progress' && f === 'inProgress') || (filter === 'on_hold' && f === 'onHold')) && { color: '#fff' }
            ]}>
              {t(f)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Map View */}
      <ScrollView contentContainerStyle={styles.mapContainer} horizontal={false} showsVerticalScrollIndicator={false}>
        <View style={[styles.mapSurface, { backgroundColor: palette.background, borderColor: palette.border }]}>
          {/* Paths / Grid (Simple version) */}
          <View style={[styles.gridLineV, { backgroundColor: palette.border, opacity: 0.5 }]} />
          <View style={[styles.gridLineH, { backgroundColor: palette.border, opacity: 0.5 }]} />

          {STATIONS.map(station => {
            const data = stationData[station.id];
            const statusColor = data.status === 'green' ? '#10B981' : (data.status === 'red' ? '#EF4444' : '#F59E0B');
            
            return (
              <TouchableOpacity
                key={station.id}
                style={[styles.stationNode, { left: station.x, top: station.y, backgroundColor: palette.backgroundSecondary, borderColor: palette.border }]}
                onPress={() => {
                  // TODO: Show station card list sheet
                }}
              >
                <View style={[styles.statusIndicator, { backgroundColor: statusColor }]} />
                <View style={styles.stationBody}>
                  <Text style={[styles.stationName, { color: palette.text }]}>{station.name}</Text>
                  <Text style={[styles.stationId, { color: palette.textSecondary }]}>{station.id}</Text>
                </View>
                {data.count > 0 && (
                  <View style={[styles.countBadge, { backgroundColor: palette.primary, borderColor: palette.backgroundSecondary }]}>
                    <Text style={styles.countText}>{data.count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[styles.legend, { backgroundColor: palette.background, borderColor: palette.border, borderWidth: 1 }]}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
            <Text style={[styles.legendText, { color: palette.textSecondary }]}>{t('inProgress')}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
            <Text style={[styles.legendText, { color: palette.textSecondary }]}>{t('pending') || 'Pending'}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
            <Text style={[styles.legendText, { color: palette.textSecondary }]}>{t('issuesOnHold') || 'Issues / On Hold'}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  backBtn: {
    padding: spacing.xs,
    borderRadius: borderRadius.md,
  },
  title: {
    ...typography.h3,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    height: 48,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  filterChipActive: {
  },
  filterText: {
    ...typography.tiny,
    textTransform: 'capitalize',
    fontWeight: '600',
  },
  filterTextActive: {
  },
  mapContainer: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    minHeight: 400,
    alignItems: 'center',
  },
  mapSurface: {
    width: width - spacing.lg * 2,
    height: 450,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    padding: spacing.md,
  },
  gridLineV: {
    position: 'absolute',
    left: '50%',
    top: 50,
    bottom: 50,
    width: 2,
  },
  gridLineH: {
    position: 'absolute',
    top: '50%',
    left: 50,
    right: 50,
    height: 2,
  },
  stationNode: {
    position: 'absolute',
    width: 100,
    height: 60,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 6,
    alignItems: 'center',
    ...shadows.md,
  },
  statusIndicator: {
    width: 4,
    height: '80%',
    borderRadius: 2,
    marginRight: 8,
  },
  stationBody: {
    flex: 1,
  },
  stationName: {
    fontSize: 10,
    fontWeight: '700',
  },
  stationId: {
    fontSize: 8,
    marginTop: 2,
  },
  countBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  countText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  legend: {
    flexDirection: 'row',
    marginTop: spacing.xl,
    gap: spacing.lg,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    fontWeight: '500',
  },
});
