import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/components/ThemeProvider';
import { spacing, typography, borderRadius } from '@/constants/design';

interface ScanEvent {
  id: string;
  type: 'RFID' | 'QR' | 'BARCODE';
  cardId: string;
  station: string;
  timestamp: Date;
  status: 'success' | 'warning' | 'error';
}

export default function ScannerLogScreen() {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const [events, setEvents] = useState<ScanEvent[]>([
    { id: '1', type: 'RFID', cardId: 'CARD-8821', station: 'SMT-Line-01', timestamp: new Date(Date.now() - 2000), status: 'success' },
    { id: '2', type: 'QR', cardId: 'CARD-4412', station: 'QC-Station-B', timestamp: new Date(Date.now() - 15000), status: 'success' },
    { id: '3', type: 'RFID', cardId: 'CARD-7731', station: 'Assembly-03', timestamp: new Date(Date.now() - 45000), status: 'warning' },
  ]);

  // Simulate real-time events
  useEffect(() => {
    const interval = setInterval(() => {
      const newEvent: ScanEvent = {
        id: Math.random().toString(),
        type: Math.random() > 0.5 ? 'RFID' : 'QR',
        cardId: `CARD-${Math.floor(1000 + Math.random() * 9000)}`,
        station: ['SMT-01', 'QC-02', 'PACK-01', 'TEST-03'][Math.floor(Math.random() * 4)],
        timestamp: new Date(),
        status: Math.random() > 0.9 ? 'error' : (Math.random() > 0.8 ? 'warning' : 'success'),
      };
      setEvents(prev => [newEvent, ...prev].slice(0, 20));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return '#10B981';
      case 'warning': return '#F59E0B';
      case 'error': return '#EF4444';
      default: return palette.textSecondary;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: palette.text }]}>{t('liveScannerLog') || 'Live Scanner Log'}</Text>
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {events.map((event, index) => (
          <Animated.View 
            key={event.id} 
            entering={FadeInDown.delay(index * 100)}
            style={[styles.eventCard, { backgroundColor: palette.backgroundSecondary, borderColor: palette.border }]}
          >
            <View style={[styles.typeBadge, { backgroundColor: getStatusColor(event.status) + '20' }]}>
              <Ionicons 
                name={event.type === 'RFID' ? 'radio' : 'qr-code'} 
                size={16} 
                color={getStatusColor(event.status)} 
              />
              <Text style={[styles.typeText, { color: getStatusColor(event.status) }]}>{event.type}</Text>
            </View>

            <View style={styles.eventInfo}>
              <Text style={[styles.cardId, { color: palette.text }]}>{event.cardId}</Text>
              <Text style={[styles.station, { color: palette.textSecondary }]}>{event.station}</Text>
            </View>

            <View style={styles.eventTime}>
              <Text style={[styles.timeText, { color: palette.textTertiary }]}>
                {event.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </Text>
              <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(event.status) }]} />
            </View>
          </Animated.View>
        ))}
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
  liveIndicator: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' },
  liveText: { ...typography.tiny, color: '#EF4444', fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg },
  eventCard: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing.md, borderRadius: borderRadius.lg,
    marginBottom: spacing.md, borderWidth: 1,
  },
  typeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
    marginRight: spacing.md, width: 70, justifyContent: 'center',
  },
  typeText: { ...typography.tiny, fontWeight: '700' },
  eventInfo: { flex: 1 },
  cardId: { ...typography.bodyBold },
  station: { ...typography.small, marginTop: 2 },
  eventTime: { alignItems: 'flex-end', gap: 6 },
  timeText: { ...typography.tiny },
  statusIndicator: { width: 8, height: 8, borderRadius: 4 },
});
