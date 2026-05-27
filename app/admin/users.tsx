import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRoleGuard } from '@/hooks/useRoleGuard';

export default function AdminUsersScreen() {
  useRoleGuard(['admin'])

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Admin User Management</Text>
      <Text style={styles.subtitle}>Only administrators can view this panel.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#6b7280' },
})
