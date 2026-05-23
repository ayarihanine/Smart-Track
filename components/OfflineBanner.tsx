import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { colors, spacing, typography } from '@/constants/design';

export function OfflineBanner() {
  const { isOnline, queueSize, syncing } = useOfflineSync();

  if (isOnline && queueSize === 0) return null;

  return (
    <SafeAreaView 
      edges={['top']} 
      style={{ backgroundColor: isOnline ? '#10B981' : '#EF4444' }}
    >
      <View style={styles.container}>
        <Ionicons 
          name={isOnline ? (syncing ? 'cloud-upload' : 'checkmark-circle') : 'cloud-offline'} 
          size={16} 
          color={colors.white} 
        />
        <Text style={styles.text}>
          {isOnline 
            ? (syncing ? `Syncing ${queueSize} changes...` : 'Back Online') 
            : 'Offline Mode - Changes will sync later'
          }
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  text: {
    ...typography.tiny,
    color: colors.white,
    fontWeight: '700',
  },
});
