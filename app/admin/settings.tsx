import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/design';
import { useTheme } from '@/components/ThemeProvider';
import { useRoleGuard } from '@/hooks/useRoleGuard';

export default function AdminSettings() {
  useRoleGuard(['admin']);

  const { palette, isDark } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.backgroundSecondary }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.header, { backgroundColor: palette.background, borderBottomColor: palette.border }]}>
          <Text style={[styles.headerTitle, { color: palette.text }]}>Admin Settings</Text>
          <Text style={[styles.headerSub, { color: palette.textTertiary }]}>Administrator-only configuration</Text>
        </View>

        <View style={[styles.card, { backgroundColor: palette.background }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="shield-checkmark" size={24} color="#8B5CF6" />
            <Text style={[styles.cardTitle, { color: palette.text }]}>Admin Access Granted</Text>
          </View>
          <Text style={[styles.cardBody, { color: palette.textSecondary }]}>
            You are authenticated as an administrator. This section is restricted to users with the admin role.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: palette.background }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>System Configuration</Text>
          <Text style={[styles.cardBody, { color: palette.textSecondary }]}>
            System-wide settings and configuration options will appear here.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 32 },
  header: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    marginBottom: spacing.md,
  },
  headerTitle: { fontSize: 22, fontWeight: '700' },
  headerSub: { fontSize: 12, marginTop: 2 },
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardBody: { fontSize: 13, lineHeight: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
});
