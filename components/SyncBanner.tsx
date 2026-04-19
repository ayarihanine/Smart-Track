import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOfflineStore } from '@/store/offlineStore';
import { useTheme } from './ThemeProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { spacing, borderRadius, typography, shadows } from '@/constants/design';

export function SyncBanner() {
  const { pendingScans, isSyncing, syncPending } = useOfflineStore();
  const { palette } = useTheme();
  const { t } = useTranslation();
  
  const count = pendingScans.length;
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const rotationAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (count > 0 || isSyncing) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [count, isSyncing]);

  useEffect(() => {
    if (isSyncing) {
      Animated.loop(
        Animated.timing(rotationAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      rotationAnim.setValue(0);
    }
  }, [isSyncing, rotationAnim]);

  if (count === 0 && !isSyncing) return null;

  const spin = rotationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View 
      style={[
        styles.container, 
        { 
          backgroundColor: isSyncing ? '#2563EB' : '#F59E0B',
          transform: [{ translateY: slideAnim }] 
        }
      ]}
    >
      <View style={styles.content}>
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
          <Ionicons 
            name={isSyncing ? 'sync' : 'cloud-offline-outline'} 
            size={18} 
            color="#FFF" 
          />
        </Animated.View>
        <Text style={styles.text}>
          {isSyncing 
            ? t('syncing' as any) || 'Sychronizing data...' 
            : `${t('pendingScans' as any) || 'Pending Scans: '} ${count}`}
        </Text>
        {!isSyncing && (
          <TouchableOpacity style={styles.syncBtn} onPress={syncPending}>
            <Text style={styles.syncBtnText}>{t('syncNow' as any) || 'Sync Now'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    ...shadows.sm,
    zIndex: 100,
    position: 'relative',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  text: {
    ...typography.captionBold,
    color: '#FFF',
    flex: 1,
  },
  syncBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  syncBtnText: {
    ...typography.tiny,
    fontWeight: '700',
    color: '#FFF',
  },
});
