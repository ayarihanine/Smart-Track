import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/design';
import { useTheme } from '@/components/ThemeProvider';

interface DashboardWidgetProps {
  id: string;
  title: string;
  children: React.ReactNode;
  onHide?: () => void;
  visible?: boolean;
}

export function DashboardWidget({ title, children, onHide, visible = true }: DashboardWidgetProps) {
  const { palette } = useTheme();

  if (!visible) return null;

  return (
    <View style={[styles.container, { backgroundColor: palette.background, borderColor: palette.border }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
        <TouchableOpacity style={styles.hideBtn} onPress={onHide}>
            <Ionicons name="eye-off-outline" size={18} color={palette.textTertiary} />
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    ...shadows.sm,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#00000005',
    backgroundColor: '#00000002',
  },
  title: {
    ...typography.small,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hideBtn: {
    padding: 4,
  },
  content: {
    padding: spacing.md,
  },
});
