import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput, Platform, KeyboardAvoidingView } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/design';
import { useTheme } from '@/components/ThemeProvider';
import { getSupabaseClient } from '@/lib/supabase';
import { UserProfile, UserRole } from '@/types';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { createClient } from '@supabase/supabase-js';

type SortOption = 'name' | 'role' | 'newest';
const ROLE_ORDER: Record<string, number> = { admin: 0, supervisor: 1, operator: 2 };

export default function AdminPanelScreen() {
  useRoleGuard(['admin']);
  const { palette } = useTheme();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  // User Provisioning State
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [createRole, setCreateRole] = useState<UserRole>('operator');
  const [createDisplayName, setCreateDisplayName] = useState('');
  const [createUsername, setCreateUsername] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error('Supabase not configured');

      const { data, error: fetchError } = await (supabase.from('profiles') as any).select('*').order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const mappedUsers: UserProfile[] = (data || []).map((row: any) => ({
        id: row.id,
        email: row.email,
        displayName: row.display_name,
        role: row.role,
        avatarUrl: row.avatar_url,
        createdAt: row.created_at,
      }));
      setUsers(mappedUsers);
    } catch (err: any) {
      console.warn('Failed to fetch users, falling back to mock data:', err);
      console.warn('Failed to fetch users:', err);
      setUsers([]);
      if (err?.code === 'PGRST205' || err?.message?.includes('schema cache')) {
        setError('Schema Cache error: Table might be missing or cache is stale. Run the SQL script to create public.profiles.');
      } else {
        setError(err?.message || 'Could not load users. Check database connection.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleColor = (role: string) => {
    if (role === 'admin') return '#8B5CF6'; // Purple
    if (role === 'supervisor') return '#2563EB'; // Blue
    return '#10B981'; // Green
  };

  const sortedUsers = useMemo(() => {
    const sorted = [...users];
    switch (sortBy) {
      case 'name':
        sorted.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
        break;
      case 'role':
        sorted.sort((a, b) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9));
        break;
      case 'newest':
      default:
        sorted.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        break;
    }
    return sorted;
  }, [users, sortBy]);

  const [activeUser, setActiveUser] = useState<UserProfile | null>(null);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [menuView, setMenuView] = useState<'main' | 'role'>('main');

  const handleUserAction = (targetUser: UserProfile) => {
    setActiveUser(targetUser);
    setMenuView('main');
    setIsMenuVisible(true);
  };

  const closeMenu = () => {
    setIsMenuVisible(false);
    setTimeout(() => setActiveUser(null), 300);
  };

  const openCreateModal = (role: UserRole) => {
    setCreateRole(role);
    setCreateDisplayName('');
    setCreateUsername('');
    setCreatePassword('');
    setIsCreateModalVisible(true);
  };

  const handleCreateUser = async () => {
    if (!createDisplayName.trim() || !createUsername.trim() || !createPassword) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    try {
      setIsCreatingUser(true);
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase configuration is missing in environment variables.');
      }

      // Create a temporary client that does NOT persist the session
      const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      });

      const generatedEmail = `${createUsername.toLowerCase().trim()}@${createRole}.smarttrack.com`;

      const { data, error: signupError } = await tempClient.auth.signUp({
        email: generatedEmail,
        password: createPassword,
        options: {
          data: {
            displayName: createDisplayName.trim(),
            role: createRole,
          }
        }
      });

      if (signupError) throw signupError;

      Alert.alert(
        'Success',
        `User "${createDisplayName.trim()}" successfully registered as ${createRole.toUpperCase()}.\n\nEmail: ${generatedEmail}`
      );

      setIsCreateModalVisible(false);
      fetchUsers();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create user.');
    } finally {
      setIsCreatingUser(false);
    }
  };

  const updateUserRole = async (newRole: string) => {
    if (!activeUser) return;
    try {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      
      const username = activeUser.email.split('@')[0];
      const newEmail = `${username}@${newRole}.smarttrack.com`;

      const { error: updateError } = await (supabase.from('profiles') as any)
        .update({ 
          role: newRole,
          email: newEmail,
          display_name: activeUser.displayName // Keep existing display name
        })
        .eq('id', activeUser.id);
        
      if (updateError) {
        console.error('Role update error:', updateError);
        throw updateError;
      }
      
      // Update local state to reflect the change immediately
      setUsers(prev => prev.map(u => 
        u.id === activeUser.id ? { ...u, role: newRole as any, email: newEmail } : u
      ));
      
      Alert.alert('Success', `Role updated to ${newRole} and email updated to ${newEmail} successfully.`);
      closeMenu();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update user role. Make sure you have admin permissions.');
    }
  };

  const deleteUser = async () => {
    if (!activeUser) return;
    
    Alert.alert(
      'Delete User?',
      `Are you sure you want to permanently delete ${activeUser.displayName || activeUser.email}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              const supabase = getSupabaseClient();
              if (!supabase) return;
              
              const { error: deleteError } = await (supabase.from('profiles') as any)
                .delete()
                .eq('id', activeUser.id);
                
              if (deleteError) throw deleteError;
              
              // Update local state
              setUsers(prev => prev.filter(u => u.id !== activeUser.id));
              Alert.alert('Success', 'User has been deleted from the database.');
              closeMenu();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete user.');
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.backgroundSecondary }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header summary */}
        <View style={[styles.summaryCard, { backgroundColor: palette.background, borderColor: palette.border, borderWidth: 1 }]}>
          <Text style={[styles.summaryTitle, { color: palette.textSecondary }]}>System Users</Text>
          <Text style={[styles.summaryNumber, { color: palette.text }]}>{users.length}</Text>
          <Text style={[styles.summarySubtitle, { color: palette.textTertiary }]}>Active personnel registered</Text>
        </View>

        {/* Roles Distribution */}
        <View style={styles.statsRow}>
          <View style={[styles.statBox, { backgroundColor: palette.background, borderColor: '#8B5CF6' }]}>
            <Text style={[styles.statCount, { color: '#8B5CF6' }]}>{users.filter(u => u.role === 'admin').length}</Text>
            <Text style={[styles.statLabel, { color: palette.textSecondary }]}>Admins</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: palette.background, borderColor: palette.primary }]}>
            <Text style={[styles.statCount, { color: palette.primary }]}>{users.filter(u => u.role === 'supervisor').length}</Text>
            <Text style={[styles.statLabel, { color: palette.textSecondary }]}>Supervisors</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: palette.background, borderColor: '#10B981' }]}>
            <Text style={[styles.statCount, { color: '#10B981' }]}>{users.filter(u => u.role === 'operator').length}</Text>
            <Text style={[styles.statLabel, { color: palette.textSecondary }]}>Operators</Text>
          </View>
        </View>

        {/* User Provisioning Card */}
        <View style={[styles.provisioningCard, { backgroundColor: palette.background, borderColor: palette.border, borderWidth: 1 }]}>
          <View style={styles.provisioningHeaderRow}>
            <Ionicons name="people-circle" size={24} color={palette.primary} />
            <Text style={[styles.provisioningTitle, { color: palette.text }]}>User Provisioning</Text>
          </View>
          <Text style={[styles.provisioningSubtitle, { color: palette.textSecondary }]}>
            Securely register and authorize new personnel directly on this device.
          </Text>
          <View style={styles.provisioningButtons}>
            <TouchableOpacity 
              style={[styles.provisionActionButton, { backgroundColor: '#10B98115', borderColor: '#10B981' }]} 
              onPress={() => openCreateModal('operator')}
            >
              <Ionicons name="construct-outline" size={16} color="#10B981" />
              <Text style={[styles.provisionActionButtonText, { color: '#10B981' }]}>+ Create Operator</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.provisionActionButton, { backgroundColor: palette.primary + '15', borderColor: palette.primary }]} 
              onPress={() => openCreateModal('supervisor')}
            >
              <Ionicons name="eye-outline" size={16} color={palette.primary} />
              <Text style={[styles.provisionActionButtonText, { color: palette.primary }]}>+ Create Supervisor</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.provisionActionButton, { backgroundColor: '#8B5CF615', borderColor: '#8B5CF6' }]} 
              onPress={() => openCreateModal('admin')}
            >
              <Ionicons name="shield-checkmark-outline" size={16} color="#8B5CF6" />
              <Text style={[styles.provisionActionButtonText, { color: '#8B5CF6' }]}>+ Create Admin</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: palette.text }]}>User Directory</Text>

        {/* Sort Filter Bar */}
        <View style={styles.sortBar}>
          {([
            { key: 'name' as SortOption, label: 'Name A→Z', icon: 'text-outline' as const },
            { key: 'role' as SortOption, label: 'Role', icon: 'shield-checkmark-outline' as const },
            { key: 'newest' as SortOption, label: 'Newest', icon: 'time-outline' as const },
          ]).map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[
                styles.sortChip,
                { backgroundColor: palette.background, borderColor: palette.border },
                sortBy === opt.key && { backgroundColor: palette.primary, borderColor: palette.primary },
              ]}
              onPress={() => setSortBy(opt.key)}
            >
              <Ionicons
                name={opt.icon}
                size={14}
                color={sortBy === opt.key ? "#fff" : palette.textSecondary}
              />
              <Text style={[
                styles.sortChipText,
                { color: palette.textSecondary },
                sortBy === opt.key && { color: "#fff" },
              ]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={palette.primary} />
            <Text style={[styles.loadingText, { color: palette.textSecondary }]}>Loading users...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <Ionicons name="warning-outline" size={48} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchUsers}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.userList}>
            {sortedUsers.map((u) => {
              const roleColor = getRoleColor(u.role);
              return (
                <View key={u.id} style={[styles.userCard, { backgroundColor: palette.background, borderColor: palette.border, borderWidth: 1 }]}>
                  <View style={[styles.avatar, { backgroundColor: roleColor + '20' }]}>
                    <Text style={[styles.avatarText, { color: roleColor }]}>
                      {u.displayName?.[0]?.toUpperCase() || 'U'}
                    </Text>
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={[styles.userName, { color: palette.text }]}>{u.displayName || 'Unknown User'}</Text>
                    <Text style={[styles.userEmail, { color: palette.textSecondary }]}>{u.email}</Text>
                  </View>
                  <View style={[styles.roleBadge, { backgroundColor: roleColor + '15', borderColor: roleColor + '30' }]}>
                    <Text style={[styles.roleText, { color: roleColor }]}>{u.role}</Text>
                  </View>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => handleUserAction(u)}>
                    <Ionicons name="ellipsis-vertical" size={20} color={palette.textTertiary} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Custom Bottom Sheet Action Menu */}
      <Modal visible={isMenuVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeMenu}>
          <TouchableOpacity style={[styles.bottomSheet, { backgroundColor: palette.background }]} activeOpacity={1}>
            <View style={styles.sheetHeader}>
              <View style={[styles.sheetHandle, { backgroundColor: palette.border }]} />
              <Text style={[styles.sheetTitle, { color: palette.text }]}>
                {menuView === 'main' ? 'Manage User' : 'Change Role'}
              </Text>
              <Text style={[styles.sheetSubtitle, { color: palette.textSecondary }]}>
                {activeUser?.displayName || activeUser?.email}
              </Text>
            </View>

            {menuView === 'main' ? (
              <View>
                <TouchableOpacity style={[styles.sheetActionBtn, { borderBottomColor: palette.border }]} onPress={() => setMenuView('role')}>
                  <View style={[styles.sheetActionIcon, { backgroundColor: palette.primary + '20' }]}>
                    <Ionicons name="shield-checkmark" size={20} color={palette.primary} />
                  </View>
                  <Text style={[styles.sheetActionText, { color: palette.text }]}>Change Role</Text>
                  <Ionicons name="chevron-forward" size={20} color={palette.textTertiary} style={{ marginLeft: 'auto' }} />
                </TouchableOpacity>

                <TouchableOpacity 
                   style={[styles.sheetActionBtn, { borderBottomColor: palette.border }]}
                   onPress={() => {
                    closeMenu();
                    router.push(`/chat/${activeUser?.id}?name=${encodeURIComponent(activeUser?.displayName || 'User')}`);
                  }}
                >
                  <View style={[styles.sheetActionIcon, { backgroundColor: '#FEF3C7' }]}>
                    <Ionicons name="mail" size={20} color="#D97706" />
                  </View>
                  <Text style={[styles.sheetActionText, { color: palette.text }]}>Send Message</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.sheetActionBtn, { borderBottomWidth: 0 }]} onPress={deleteUser}>
                  <View style={[styles.sheetActionIcon, { backgroundColor: '#FEE2E2' }]}>
                    <Ionicons name="trash-outline" size={20} color="#DC2626" />
                  </View>
                  <Text style={[styles.sheetActionText, { color: '#DC2626' }]}>Delete User</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                {['operator', 'supervisor', 'admin'].map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[
                      styles.roleOptionBtn,
                      { borderColor: palette.border },
                      activeUser?.role === role && { borderColor: palette.primary, backgroundColor: palette.primary + '10' }
                    ]}
                    onPress={() => updateUserRole(role)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={[styles.sheetActionIcon, { backgroundColor: getRoleColor(role) + '20' }]}>
                        <Ionicons name="person" size={18} color={getRoleColor(role)} />
                      </View>
                      <Text style={[styles.sheetActionText, { color: palette.text, textTransform: 'capitalize' }]}>{role}</Text>
                    </View>
                    {activeUser?.role === role && (
                      <Ionicons name="checkmark-circle" size={24} color={palette.primary} />
                    )}
                  </TouchableOpacity>
                ))}
                
                <TouchableOpacity style={[styles.sheetActionBtn, { marginTop: spacing.md, justifyContent: 'center', borderBottomWidth: 0 }]} onPress={() => setMenuView('main')}>
                  <Text style={[styles.sheetActionText, { color: palette.textSecondary }]}>Back</Text>
                </TouchableOpacity>
              </View>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* User Provisioning Modal */}
      <Modal visible={isCreateModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ width: '100%' }}
          >
            <View style={[styles.createSheet, { backgroundColor: palette.background }]}>
              <View style={styles.sheetHeader}>
                <View style={[styles.sheetHandle, { backgroundColor: palette.border }]} />
                <Text style={[styles.sheetTitle, { color: palette.text }]}>
                  Create {createRole.toUpperCase()}
                </Text>
                <Text style={[styles.sheetSubtitle, { color: palette.textSecondary }]}>
                  Provision a new authenticated user profile.
                </Text>
              </View>

              <ScrollView style={styles.createFormScroll} keyboardShouldPersistTaps="handled">
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: palette.textSecondary }]}>Full Name</Text>
                  <View style={[styles.inputRow, { borderColor: palette.border }]}>
                    <Ionicons name="person-outline" size={20} color={palette.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.textInput, { color: palette.text }]}
                      placeholder="e.g. John Doe"
                      placeholderTextColor={palette.textTertiary}
                      value={createDisplayName}
                      onChangeText={setCreateDisplayName}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: palette.textSecondary }]}>Username</Text>
                  <View style={[styles.inputRow, { borderColor: palette.border }]}>
                    <Ionicons name="person-circle-outline" size={20} color={palette.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.textInput, { color: palette.text }]}
                      placeholder="e.g. johndoe"
                      placeholderTextColor={palette.textTertiary}
                      value={createUsername}
                      onChangeText={setCreateUsername}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                  <Text style={[styles.generatedEmailText, { color: palette.textTertiary }]}>
                    Generated Email: {createUsername.toLowerCase().trim() || '...' }@{createRole}.smarttrack.com
                  </Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: palette.textSecondary }]}>Initial Password</Text>
                  <View style={[styles.inputRow, { borderColor: palette.border }]}>
                    <Ionicons name="lock-closed-outline" size={20} color={palette.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.textInput, { color: palette.text }]}
                      placeholder="At least 6 characters"
                      placeholderTextColor={palette.textTertiary}
                      secureTextEntry
                      value={createPassword}
                      onChangeText={setCreatePassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>

                <View style={styles.modalActionButtons}>
                  <TouchableOpacity
                    style={[styles.modalCancelButton, { borderColor: palette.border }]}
                    onPress={() => setIsCreateModalVisible(false)}
                    disabled={isCreatingUser}
                  >
                    <Text style={[styles.modalCancelButtonText, { color: palette.textSecondary }]}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalSubmitButton, { backgroundColor: getRoleColor(createRole) }]}
                    onPress={handleCreateUser}
                    disabled={isCreatingUser}
                  >
                    {isCreatingUser ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.modalSubmitButtonText}>Create Account</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  summaryCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.lg,
    marginBottom: spacing.md,
  },
  summaryTitle: {
    ...typography.body,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  summaryNumber: {
    fontSize: 48,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  summarySubtitle: {
    ...typography.small,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  statBox: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
    ...shadows.sm,
  },
  statCount: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    ...typography.small,
    fontWeight: '500',
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  userList: {
    gap: spacing.sm,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: 2,
  },
  userEmail: {
    ...typography.small,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    marginRight: spacing.sm,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  actionBtn: {
    padding: 4,
  },
  centerContainer: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    ...typography.body,
    marginTop: spacing.md,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  retryBtn: {
    backgroundColor: colors.error,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  retryBtnText: {
    color: colors.white,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    ...shadows.lg,
  },
  sheetHeader: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: spacing.md,
  },
  sheetTitle: {
    ...typography.h3,
  },
  sheetSubtitle: {
    ...typography.small,
    marginTop: 2,
  },
  sheetActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  sheetActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  sheetActionText: {
    ...typography.body,
    fontWeight: '600',
  },
  roleOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
  },
  roleOptionActive: {
  },
  sortBar: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    gap: 6,
  },
  sortChipActive: {
  },
  sortChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sortChipTextActive: {
  },
  provisioningCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.md,
    marginBottom: spacing.xl,
  },
  provisioningHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 4,
  },
  provisioningTitle: {
    ...typography.bodyBold,
    fontSize: 16,
  },
  provisioningSubtitle: {
    ...typography.small,
    marginBottom: spacing.md,
  },
  provisioningButtons: {
    flexDirection: 'column',
    gap: spacing.sm,
  },
  provisionActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  provisionActionButtonText: {
    ...typography.bodyBold,
    fontSize: 14,
  },
  createSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    ...shadows.lg,
  },
  createFormScroll: {
    marginTop: spacing.sm,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    ...typography.small,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  textInput: {
    flex: 1,
    ...typography.body,
  },
  generatedEmailText: {
    ...typography.tiny,
    marginTop: 4,
    fontStyle: 'italic',
  },
  modalActionButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  modalCancelButton: {
    flex: 1,
    height: 48,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelButtonText: {
    ...typography.bodyBold,
  },
  modalSubmitButton: {
    flex: 2,
    height: 48,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  modalSubmitButtonText: {
    ...typography.bodyBold,
    color: colors.white,
  },
});
