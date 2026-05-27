import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/components/ThemeProvider';
import { getSupabaseClient } from '@/lib/supabase';
import { getTodayLossesSummary } from '@/lib/api';

export default function TabLayout() {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const [lossesCount, setLossesCount] = useState(0);

  useEffect(() => {
    let mounted = true;

    const loadCount = async () => {
      const summary = await getTodayLossesSummary();
      if (mounted) {
        setLossesCount(summary.totalCards);
      }
    };

    loadCount();

    const supabase = getSupabaseClient();
    if (!supabase) return () => { mounted = false; };

    const channel = supabase
      .channel('losses-tab-badge')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'production_losses' }, (payload: any) => {
        const row = payload.new as any;
        const dateValue = row?.loss_date || row?.timestamp;
        if (!dateValue) return;

        const date = new Date(dateValue);
        const today = new Date();
        if (date.toDateString() !== today.toDateString()) return;

        setLossesCount((current) => current + Number(row?.quantity ?? 0));
      })
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const badgeLabel = useMemo(() => {
    if (lossesCount <= 0) return null;
    if (lossesCount > 99) return '99+';
    return String(lossesCount);
  }, [lossesCount]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.textSecondary,
        tabBarStyle: {
          backgroundColor: palette.background,
          borderTopWidth: 0,
          height: Platform.OS === 'ios' ? 84 : 70,
          paddingBottom: Platform.OS === 'ios' ? 22 : 10,
          paddingTop: 10,
          marginHorizontal: 14,
          marginBottom: Platform.OS === 'ios' ? 10 : 8,
          borderRadius: 18,
          position: 'absolute',
          shadowColor: '#000000',
          shadowOpacity: 0.08,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarItemStyle: { paddingTop: 2 },
        sceneStyle: {
          paddingBottom: Platform.OS === 'ios' ? 96 : 88,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('home'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: t('dashboardTab'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="losses"
        options={{
          title: t('lossesTab'),
          tabBarIcon: ({ color, size }) => (
            <View style={styles.badgeWrap}>
              <Ionicons name="trending-down" size={size} color={color} />
              {badgeLabel ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{badgeLabel}</Text>
                </View>
              ) : null}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: t('scan'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="scan" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('profile'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          href: null,
          title: t('cardsTab'),
        }}
      />
      <Tabs.Screen
        name="statistics"
        options={{
          href: null,
          title: t('statisticsTab'),
        }}
      />
      <Tabs.Screen
        name="sensors"
        options={{
          href: null,
          title: 'Sensors',
        }}
      />
      <Tabs.Screen name="quality-report" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badgeWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -12,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
