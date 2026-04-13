import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/design';
import { useAuthStore } from '@/store/authStore';
import { useTranslation } from '@/hooks/useTranslation';
import { UserRole } from '@/types';

export default function AuthScreen() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<UserRole>('operator');
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, signUp, isLoading } = useAuthStore();

  const ROLES: { value: UserRole; label: string; icon: string; color: string }[] = useMemo(() => [
    { value: 'operator', label: t('operator'), icon: 'construct', color: '#10B981' },
    { value: 'supervisor', label: t('supervisor'), icon: 'eye', color: '#2563EB' },
    { value: 'admin', label: t('admin'), icon: 'shield', color: '#8B5CF6' },
  ], [t]);

  async function handleSubmit() {
    const finalEmail = mode === 'signup'
      ? `${username.toLowerCase()}@${role}.com`
      : email;

    if ((mode === 'login' && !email) || (mode === 'signup' && !username) || !password) {
      Alert.alert(t('error'), t('fillFields'));
      return;
    }
    try {
      if (mode === 'login') {
        await signIn(finalEmail, password);
      } else {
        if (!displayName) {
          Alert.alert(t('error'), t('enterDisplayName'));
          return;
        }
        await signUp(finalEmail, password, displayName, role);
      }
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert(t('authError'), e.message || t('authFailed'));
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Ionicons name="hardware-chip" size={40} color={colors.white} />
            </View>
            <Text style={styles.title}>SmartTrack</Text>
            <Text style={styles.subtitle}>{t('authSubtitle')}</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            {/* Mode Toggle */}
            <View style={styles.toggleRow}>
              {(['login', 'signup'] as const).map(m => (
                <TouchableOpacity
                  key={m}
                  style={[styles.toggleBtn, mode === m && styles.toggleBtnActive]}
                  onPress={() => setMode(m)}
                >
                  <Text style={[styles.toggleText, mode === m && styles.toggleTextActive]}>
                    {m === 'login' ? t('login') : t('register')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Fields */}
            {mode === 'signup' && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t('selectRole')}</Text>
                  <View style={styles.roleRow}>
                    {ROLES.map(r => (
                      <TouchableOpacity
                        key={r.value}
                        style={[styles.roleBtn, role === r.value && { backgroundColor: r.color, borderColor: r.color }]}
                        onPress={() => setRole(r.value)}
                      >
                        <Ionicons name={r.icon as any} size={18} color={role === r.value ? colors.white : colors.textSecondary} />
                        <Text style={[styles.roleBtnText, role === r.value && { color: colors.white }]}>
                          {r.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t('fullName')}</Text>
                  <View style={styles.inputRow}>
                    <Ionicons name="person-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder={t('fullNamePlaceholder')}
                      value={displayName}
                      onChangeText={setDisplayName}
                      autoCapitalize="words"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t('username')}</Text>
                  <View style={styles.inputRow}>
                    <Ionicons name="person-circle-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder={t('usernamePlaceholder')}
                      value={username}
                      onChangeText={setUsername}
                      autoCapitalize="none"
                    />
                    <View style={styles.domainBadge}>
                      <Text style={styles.domainText}>@{role}.com</Text>
                    </View>
                  </View>
                  <Text style={styles.generatedEmail}>
                    {username.toLowerCase() || '...'}@{role}.com
                  </Text>
                </View>
              </>
            )}

            {mode === 'login' && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('email')}</Text>
                <View style={styles.inputRow}>
                  <Ionicons name="mail-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder={t('emailPlaceholder')}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('password')}</Text>
              <View style={styles.inputRow}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={t('passwordPlaceholder')}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>



            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleSubmit}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.submitBtnText}>
                  {mode === 'login' ? t('login') : t('createAccount')}
                </Text>
              )}
            </TouchableOpacity>

            {/* Demo hint */}
            <TouchableOpacity
              style={styles.demoHint}
              onPress={() => {
                setEmail('demo@smarttrack.com');
                setPassword('demo1234');
                setMode('login');
              }}
            >
              <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
              <Text style={styles.demoHintText}>{t('demoHint')}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.footer}>{t('authFooter')}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: spacing.lg },
  header: { alignItems: 'center', paddingVertical: spacing.xl },
  logoContainer: {
    width: 80, height: 80, borderRadius: 20,
    backgroundColor: colors.primary, alignItems: 'center',
    justifyContent: 'center', marginBottom: spacing.md,
    ...shadows.lg,
  },
  title: { ...typography.h1, color: colors.white, marginBottom: spacing.xs },
  subtitle: { ...typography.caption, color: colors.textTertiary },
  card: {
    backgroundColor: colors.white, borderRadius: borderRadius.xl,
    padding: spacing.lg, ...shadows.xl,
  },
  toggleRow: {
    flexDirection: 'row', backgroundColor: colors.backgroundTertiary,
    borderRadius: borderRadius.lg, padding: 4, marginBottom: spacing.lg,
  },
  toggleBtn: {
    flex: 1, paddingVertical: spacing.sm, borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  toggleBtnActive: { backgroundColor: colors.white, ...shadows.sm },
  toggleText: { ...typography.captionBold, color: colors.textSecondary },
  toggleTextActive: { color: colors.text },
  inputGroup: { marginBottom: spacing.md },
  label: { ...typography.small, color: colors.textSecondary, marginBottom: spacing.xs, fontWeight: '600' },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
    borderRadius: borderRadius.md, paddingHorizontal: spacing.md,
    height: 48,
  },
  inputIcon: { marginRight: spacing.sm },
  input: { flex: 1, ...typography.body, color: colors.text },
  roleRow: { flexDirection: 'row', gap: spacing.sm },
  roleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: spacing.sm, borderRadius: borderRadius.md,
    borderWidth: 1.5, borderColor: colors.border,
  },
  roleBtnText: { ...typography.small, color: colors.textSecondary, fontWeight: '600' },
  domainBadge: {
    backgroundColor: colors.backgroundTertiary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  domainText: { ...typography.smallBold, color: colors.textTertiary },
  generatedEmail: { ...typography.tiny, color: colors.textTertiary, marginTop: 4, fontStyle: 'italic' },
  submitBtn: {
    backgroundColor: colors.primary, borderRadius: borderRadius.md,
    height: 52, alignItems: 'center', justifyContent: 'center',
    marginTop: spacing.sm, ...shadows.md,
  },
  submitBtnText: { ...typography.bodyBold, color: colors.white },
  demoHint: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.xs, marginTop: spacing.md,
  },
  demoHintText: { ...typography.small, color: colors.primary },
  footer: { ...typography.small, color: colors.textTertiary, textAlign: 'center', marginTop: spacing.xl },
});
