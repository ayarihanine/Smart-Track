import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/design';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/components/ThemeProvider';
import { getUsers } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useMessageStore } from '@/store/messageStore';

export default function MessengerScreen() {
  const { t } = useTranslation();
  const { palette, isDark } = useTheme();
  const { user: currentUser } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const { getUnreadCount } = useMessageStore();

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => getUsers(),
  });

  const filteredUsers = (users || []).filter(u => 
    u.id !== currentUser?.id && 
    (u.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
     u.email?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return '#8B5CF6';
      case 'supervisor': return '#2563EB';
      default: return '#10B981';
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.backgroundSecondary }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: palette.background, borderBottomColor: palette.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={palette.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: palette.text }]}>{t('teamMessenger') || 'Team Messenger'}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search */}
      <View style={[styles.searchContainer, { backgroundColor: palette.background }]}>
        <View style={[styles.searchInputBox, { backgroundColor: palette.backgroundSecondary, borderColor: palette.border }]}>
          <Ionicons name="search" size={20} color={palette.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: palette.text }]}
            placeholder={t('searchMembers') || 'Search team members...'}
            placeholderTextColor={palette.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>
            {filteredUsers.length} {t('members') || 'MEMBERS'}
          </Text>
          
          {filteredUsers.map((u) => {
            const roleColor = getRoleColor(u.role);
            const unreadCount = currentUser ? getUnreadCount(u.id, currentUser.id) : 0;
            
            return (
              <TouchableOpacity 
                key={u.id} 
                style={[styles.userCard, { backgroundColor: palette.background, borderColor: palette.border }]}
                onPress={() => router.push(`/chat/${u.id}?name=${encodeURIComponent(u.displayName || 'User')}`)}
              >
                <View style={[styles.avatar, { backgroundColor: roleColor + '15' }]}>
                  {u.avatarUrl ? (
                    <Image source={{ uri: u.avatarUrl }} style={styles.avatarImg} />
                  ) : (
                    <Text style={[styles.avatarText, { color: roleColor }]}>
                      {u.displayName?.[0]?.toUpperCase() || 'U'}
                    </Text>
                  )}
                </View>
                
                <View style={styles.userInfo}>
                  <View style={styles.userNameRow}>
                    <Text style={[styles.userName, { color: palette.text }]}>{u.displayName || 'Unknown'}</Text>
                    <View style={[styles.roleBadge, { backgroundColor: roleColor + '10' }]}>
                      <Text style={[styles.roleText, { color: roleColor }]}>{u.role}</Text>
                    </View>
                  </View>
                  <Text style={[styles.userStatus, { color: palette.textTertiary }]} numberOfLines={1}>
                    {u.email}
                  </Text>
                </View>

                {unreadCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadCount}>{unreadCount}</Text>
                  </View>
                )}
                
                <Ionicons name="chevron-forward" size={18} color={palette.border} />
              </TouchableOpacity>
            );
          })}

          {filteredUsers.length === 0 && (
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={48} color={palette.border} />
              <Text style={[styles.emptyText, { color: palette.textTertiary }]}>{t('noMembersFound') || 'No members found'}</Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  headerTitle: { ...typography.h4, fontWeight: '700' },
  searchContainer: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  searchInputBox: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, height: 44,
    borderRadius: borderRadius.lg, borderWidth: 1,
  },
  searchInput: { flex: 1, marginLeft: spacing.sm, ...typography.body },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md },
  sectionLabel: { ...typography.tiny, fontWeight: '800', marginBottom: spacing.md, letterSpacing: 1, paddingLeft: 4 },
  userCard: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing.md, borderRadius: borderRadius.xl,
    marginBottom: spacing.sm, borderWidth: 1, ...shadows.xs,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.md, overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { ...typography.h4, fontWeight: '700' },
  userInfo: { flex: 1 },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  userName: { ...typography.bodyBold },
  roleBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  roleText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  userStatus: { ...typography.tiny },
  unreadBadge: {
    backgroundColor: colors.primary, minWidth: 20, height: 20,
    borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.sm, paddingHorizontal: 4,
  },
  unreadCount: { color: colors.white, fontSize: 10, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', marginTop: 100, gap: spacing.sm },
  emptyText: { ...typography.body },
});
