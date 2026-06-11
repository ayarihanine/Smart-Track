import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, Animated, ScrollView, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/design';
import { recordScan } from '@/lib/api';
import { getSupabaseClient } from '@/lib/supabase';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/components/ThemeProvider';
import { useRouter } from 'expo-router';

export default function ScanScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { palette, isDark } = useTheme();

  const [cardInput, setCardInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [scannedCard, setScannedCard] = useState<{ cardId: string; stage: string; productName?: string } | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  async function processTrack(id: string) {
    if (!id.trim()) return;
    setScanning(true);
    try {
      // Case-insensitive card lookup to handle mixed-case card IDs
      let actualCardId = id.trim().toUpperCase();
      let stage = 'Assembly';
      let productName: string | undefined;

      const supabase = getSupabaseClient();
      if (supabase) {
        const { data: cards } = await supabase
          .from('electronic_cards')
          .select('card_id, current_machine, product_name')
          .ilike('card_id', id.trim())
          .limit(1);
        const found = cards?.[0];
        if (found) {
          actualCardId = found.card_id;
          stage = found.current_machine || 'Assembly';
          productName = found.product_name;
        }
      }

      await recordScan({
        cardId: actualCardId,
        location: 'Manual Entry',
        stage,
      });

      setScannedCard({ cardId: actualCardId, stage, productName });
      setScanned(true);
      setCardInput('');

      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
    } catch (err: any) {
      console.error('processTrack error:', err?.message || err);
      const msg = err?.message?.includes('Card not found')
        ? `Card "${id}" not found in the system.`
        : `Tracking failed: ${err?.message || 'Unknown error'}`;
      Alert.alert('Scan Failed', msg);
    } finally {
      setScanning(false);
    }
  }

  function handleReset() {
    setScanned(false);
    setScannedCard(null);
    setCardInput('');
    slideAnim.setValue(0);
    fadeAnim.setValue(0);
  }

  /* ─── Success Screen ─── */
  if (scanned && scannedCard) {
    return (
      <SafeAreaView style={[styles.successContainer, { backgroundColor: isDark ? '#0f172a' : '#0F172A' }]} edges={['top', 'bottom']}>
        <Animated.View style={[styles.successPulse, { transform: [{ scale: pulseAnim }] }]}>
          <LinearGradient colors={['#10B981', '#059669']} style={styles.successCircle}>
            <Ionicons name="checkmark" size={48} color="#fff" />
          </LinearGradient>
        </Animated.View>

        <Text style={styles.successHeadline}>Card Tracked!</Text>

        <Animated.View style={[
          styles.successCard,
          { transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [80, 0] }) }], opacity: fadeAnim }
        ]}>
          <View style={styles.successRow}>
            <View style={styles.successDot} />
            <View>
              <Text style={styles.successCardLabel}>CARD ID</Text>
              <Text style={styles.successCardValue}>{scannedCard.cardId}</Text>
            </View>
          </View>
          <View style={[styles.successRow, { borderTopWidth: 1, borderTopColor: '#F3F4F6', marginTop: 12, paddingTop: 12 }]}>
            <View style={[styles.successDot, { backgroundColor: '#8B5CF6' }]} />
            <View>
              <Text style={styles.successCardLabel}>CURRENT STAGE</Text>
              <Text style={styles.successCardValue}>{scannedCard.stage}</Text>
            </View>
          </View>
          {scannedCard.productName && (
            <View style={[styles.successRow, { borderTopWidth: 1, borderTopColor: '#F3F4F6', marginTop: 12, paddingTop: 12 }]}>
              <View style={[styles.successDot, { backgroundColor: '#F59E0B' }]} />
              <View>
                <Text style={styles.successCardLabel}>PRODUCT</Text>
                <Text style={styles.successCardValue}>{scannedCard.productName}</Text>
              </View>
            </View>
          )}
        </Animated.View>

        <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
          <Ionicons name="scan-outline" size={20} color="#fff" />
          <Text style={styles.resetBtnText}>Track Another Card</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  /* ─── Main Scan Screen ─── */
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.backgroundSecondary }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: palette.background, borderBottomColor: palette.border }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: isDark ? '#1e293b' : '#F3F4F6' }]}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={20} color={palette.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.headerTitle, { color: palette.text }]}>Card Identifier</Text>
          <Text style={[styles.headerSub, { color: palette.textSecondary }]}>
            Manual Registry Entry
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.manualSection}>
          {/* Icon Banner */}
          <View style={[styles.iconBanner, { backgroundColor: isDark ? '#1e293b' : '#EEF2FF', borderColor: isDark ? '#334155' : '#C7D2FE' }]}>
            <LinearGradient colors={['#6366F1', '#4F46E5']} style={styles.iconGradient}>
              <Ionicons name="card-outline" size={32} color="#fff" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={[styles.iconBannerTitle, { color: palette.text }]}>Manual Card Tracking</Text>
              <Text style={[styles.iconBannerSub, { color: palette.textSecondary }]}>
                Enter the card reference number to track its production stage
              </Text>
            </View>
          </View>

          {/* Input */}
          <Text style={[styles.inputLabel, { color: palette.textSecondary }]}>Card Reference</Text>
          <View style={[styles.inputWrapper, {
            backgroundColor: palette.background,
            borderColor: cardInput.trim() ? palette.primary : palette.border,
          }]}>
            <Ionicons name="search-outline" size={20} color={cardInput.trim() ? palette.primary : palette.textTertiary} />
            <TextInput
              style={[styles.input, { color: palette.text }]}
              placeholder="e.g. CARD00001"
              placeholderTextColor={palette.textTertiary}
              value={cardInput}
              onChangeText={(v) => setCardInput(v.toUpperCase())}
              autoCapitalize="characters"
              returnKeyType="go"
              onSubmitEditing={() => processTrack(cardInput)}
            />
            {cardInput.length > 0 && (
              <TouchableOpacity onPress={() => setCardInput('')}>
                <Ionicons name="close-circle" size={18} color={palette.textTertiary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Track Button */}
          <TouchableOpacity
            style={[styles.trackBtn, (!cardInput.trim() || scanning) && { opacity: 0.5 }]}
            onPress={() => processTrack(cardInput)}
            disabled={!cardInput.trim() || scanning}
            activeOpacity={0.85}
          >
            {scanning ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="navigate-circle-outline" size={22} color="#fff" />
                <Text style={styles.trackBtnText}>Initialize Tracking</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Info Card */}
          <View style={[styles.infoCard, { backgroundColor: isDark ? '#1e293b' : '#F0FDF4', borderColor: isDark ? '#334155' : '#BBF7D0' }]}>
            <Ionicons name="information-circle-outline" size={18} color="#10B981" />
            <Text style={[styles.infoCardText, { color: palette.textSecondary }]}>
              Cards are automatically registered if not yet in the system. Their stage is updated on every scan.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { ...typography.h4, fontWeight: '800' },
  headerSub: { ...typography.tiny, marginTop: 2, fontWeight: '600' },
  modeToggle: {
    flexDirection: 'row',
    borderRadius: borderRadius.md,
    padding: 3,
    gap: 3,
  },
  modeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: borderRadius.sm,
  },
  modeBtnText: { ...typography.tiny, fontWeight: '700' },
  scrollContent: { flexGrow: 1, padding: spacing.lg },
  manualSection: { gap: spacing.md },
  iconBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    ...shadows.xs,
  },
  iconGradient: {
    width: 60,
    height: 60,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBannerTitle: { ...typography.bodyBold, marginBottom: 2 },
  iconBannerSub: { ...typography.tiny },
  inputLabel: { ...typography.captionBold, marginBottom: 4 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    height: 56,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    gap: spacing.sm,
  },
  input: { flex: 1, ...typography.bodyBold, letterSpacing: 1 },
  trackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 56,
    borderRadius: borderRadius.lg,
    backgroundColor: '#4F46E5',
    ...shadows.md,
  },
  trackBtnText: { ...typography.bodyBold, color: '#fff' },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginTop: spacing.sm,
  },
  infoCardText: { ...typography.small, flex: 1, lineHeight: 18 },
  // Success screen
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.xl,
  },
  successPulse: {
    marginBottom: spacing.sm,
  },
  successCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.xl,
  },
  successHeadline: {
    ...typography.h2,
    color: '#fff',
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  successCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.xl,
  },
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  successDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
  },
  successCardLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.8,
  },
  successCardValue: {
    ...typography.bodyBold,
    color: '#111827',
    marginTop: 2,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#4F46E5',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    ...shadows.md,
  },
  resetBtnText: { ...typography.bodyBold, color: '#fff' },
});
