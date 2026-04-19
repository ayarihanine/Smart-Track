import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, Animated, ScrollView, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/design';
import { recordScan, getCard } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/components/ThemeProvider';
import { useOfflineStore } from '@/store/offlineStore';
import { useSettingsStore } from '@/store/settingsStore';
import { SyncBanner } from '@/components/SyncBanner';
import { CameraView, useCameraPermissions } from 'expo-camera';

const QUICK_IDS = ['CARD00001', 'CARD00002', 'CARD99887', 'CARD55443', 'CARD12345'];

type ScanMode = 'camera' | 'manual';

export default function ScanScreen() {
  const { t } = useTranslation();
  const { palette, isDark } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<ScanMode>('camera');
  const [cardInput, setCardInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [scannedCard, setScannedCard] = useState<{ cardId: string; stage: string; productName?: string } | null>(null);

  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchQueue, setBatchQueue] = useState<{ cardId: string; stage: string; productName?: string }[]>([]);

  const addPendingScan = useOfflineStore(s => s.addPendingScan);
  const offlineModeEnabled = useSettingsStore(s => s.offlineModeEnabled);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (mode === 'camera' && !permission?.granted) {
      requestPermission();
    }
  }, [mode, permission, requestPermission]);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  async function processTrack(id: string, source: string) {
    setScanning(true);
    try {
      // 1. Try to find in real database
      const card = await getCard(id);
      const stage = card?.currentStage || 'Stage 1: Assembly';

      // 2. Record the scan
      try {
        await recordScan({
          cardId: id,
          location: source,
          stage: stage,
        });
      } catch {
        // Offline fallback - ONLY if enabled in settings
        if (offlineModeEnabled) {
          addPendingScan({
            cardId: id,
            location: source,
            stage: stage,
          });
          if (!isBatchMode) {
            Alert.alert(t('offlineMode'), t('connectionFailedQueue'));
          }
        } else {
          Alert.alert(t('scanFailed'), t('connectionErrorNoQueue'));
        }
      }

      if (isBatchMode) {
        setBatchQueue(prev => [...prev, { cardId: id, stage, productName: card?.productName }]);
        setCardInput('');
      } else {
        setScannedCard({ cardId: id, stage, productName: card?.productName });
        setScanned(true);

        // Success animation
        Animated.spring(slideAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }).start();
      }

    } catch {
      Alert.alert(t('scanFailed'), t('unableToVerify'));
    } finally {
      setScanning(false);
    }
  }

  function handleManualTrack() {
    if (!cardInput.trim()) return;
    processTrack(cardInput.trim().toUpperCase(), 'Manual App Entry');
  }



  function handleViewDetails() {
    if (scannedCard) {
      router.push(`/card/${scannedCard.cardId}` as any);
    }
  }

  function handleReset() {
    setScanned(false);
    setScannedCard(null);
    setCardInput('');
    slideAnim.setValue(0);
  }

  function handleCommitBatch() {
    setBatchQueue([]);
    Alert.alert(t('batchComplete'), t('batchMessage'));
  }

  if (scanned && scannedCard) {
    return (
      <View style={styles.successScreen}>
        <Animated.View style={[styles.successIcon, { transform: [{ scale: pulseAnim }], backgroundColor: 'transparent' }]}>
          <View style={styles.successIconBadge}>
            <Ionicons name="card-outline" size={42} color={colors.primary} />
            <View style={styles.successCheck}>
              <Ionicons name="checkmark" size={14} color={colors.white} />
            </View>
          </View>
        </Animated.View>

        <Text style={styles.successTitle}>{t('scanSuccessfulTitle')}</Text>

        <Animated.View style={[styles.successCard, {
          transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [100, 0] }) }]
        }]}>
          <View style={styles.successHeader}>
            <Ionicons name="cube-outline" size={24} color={colors.primary} />
            <Text style={styles.successCardTitle}>{scannedCard.productName || t('pcbUnit')}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{t('cardIdLabel')}</Text>
              <Text style={styles.infoValue}>{scannedCard.cardId}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{t('stationLabel')}</Text>
              <Text style={styles.infoValue}>{scannedCard.stage}</Text>
            </View>
          </View>
        </Animated.View>

        <TouchableOpacity style={styles.primaryBtn} onPress={handleViewDetails}>
          <Text style={styles.primaryBtnText}>{t('detailedAnalytics')}</Text>
          <Ionicons name="stats-chart" size={18} color={colors.white} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryBtn} onPress={handleReset}>
          <Text style={styles.secondaryBtnText}>{t('dismissNext')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const getHeaderSubtitle = () => {
    switch (mode) {
      case 'camera': return t('qrScanner');

      case 'manual': return t('manualRegistry');
      default: return '';
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.backgroundSecondary }]} edges={['top']}>
      <SyncBanner />
      {/* Dynamic Header */}
      <View style={[styles.header, { backgroundColor: palette.background, borderBottomColor: palette.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: palette.text }]}>{t('cardIdentifier')}</Text>
          <Text style={styles.headerSubtitle}>{getHeaderSubtitle()}</Text>
        </View>
        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={[styles.batchToggle, isBatchMode && styles.batchToggleActive]}
            onPress={() => setIsBatchMode(!isBatchMode)}
          >
            <Ionicons name="layers-outline" size={18} color={isBatchMode ? colors.white : palette.textTertiary} />
            <Text style={[styles.batchToggleText, { color: isBatchMode ? colors.white : palette.textTertiary }]}>
              {t('batch')}
            </Text>
          </TouchableOpacity>
          <View style={styles.modeToggle}>
            {(['camera', 'manual'] as ScanMode[]).map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => setMode(m)}
                style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
              >
                <Ionicons
                  name={m === 'camera' ? 'camera' : 'keypad'}
                  size={18}
                  color={mode === m ? colors.white : palette.textTertiary}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {mode === 'camera' && (
          <View style={styles.centerContent}>
            <View style={styles.viewfinderContainer}>
              <View style={[styles.viewfinder, { backgroundColor: isDark ? '#1e293b' : '#0F172A', overflow: 'hidden' }]}>
                {mode === 'camera' && permission?.granted ? (
                  <CameraView
                    style={StyleSheet.absoluteFill}
                    facing="back"
                    onBarcodeScanned={({ data }) => {
                      if (!scanning && !scanned) {
                        processTrack(data, 'Optical Scanner');
                      }
                    }}
                  />
                ) : (
                  <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                    <Ionicons name="camera-reverse-outline" size={48} color={palette.textTertiary} />
                    <Text style={{ color: palette.textTertiary, marginTop: 10 }}>{t('cameraReady')}</Text>
                  </View>
                )}
                <Animated.View style={[styles.scanFrame, { transform: [{ scale: pulseAnim }] }]}>
                  <View style={styles.cornerTL} />
                  <View style={styles.cornerTR} />
                  <View style={styles.cornerBL} />
                  <View style={styles.cornerBR} />
                </Animated.View>
              </View>
              <View style={styles.cameraOverlay}>
                <Ionicons name="flash-off" size={24} color={colors.white} />
              </View>
            </View>
            <Text style={[styles.hintText, { color: palette.textSecondary }]}>{t('opticalReader')}</Text>
            <View style={styles.statusIndicator}>
              <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
              <Text style={[styles.statusText, { color: palette.textSecondary }]}>{t('cameraReady')}</Text>
            </View>
          </View>
        )}



        {mode === 'manual' && (
          <View style={styles.manualEntry}>
            <Text style={styles.inputLabel}>{t('registryIdentifier')}</Text>
            <View style={[styles.inputWrapper, { backgroundColor: palette.background, borderColor: palette.border }]}>
              <Ionicons name="search" size={20} color={palette.textTertiary} />
              <TextInput
                style={[styles.input, { color: palette.text }]}
                placeholder={t('cardIdPlaceholder')}
                placeholderTextColor={palette.textTertiary}
                value={cardInput}
                onChangeText={setCardInput}
                autoCapitalize="characters"
                onSubmitEditing={handleManualTrack}
              />
            </View>

            <TouchableOpacity
              style={[styles.trackBtn, !cardInput.trim() && styles.trackBtnDisabled]}
              onPress={handleManualTrack}
              disabled={!cardInput.trim() || scanning}
            >
              {scanning ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Text style={styles.trackBtnText}>{t('initializeTracking')}</Text>
                  <Ionicons name="navigate-circle" size={20} color={colors.white} />
                </>
              )}
            </TouchableOpacity>

            <View style={styles.quickSection}>
              <Text style={styles.quickLabel}>{t('frequentEntries')}</Text>
              <View style={styles.quickGrid}>
                {QUICK_IDS.map(id => (
                  <TouchableOpacity
                    key={id}
                    style={[styles.quickChip, { backgroundColor: palette.background, borderColor: palette.border }]}
                    onPress={() => setCardInput(id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.quickChipText}>{id}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}

        {isBatchMode && batchQueue.length > 0 && (
          <View style={styles.batchSection}>
            <View style={styles.batchHeader}>
              <Text style={[styles.batchTitle, { color: palette.text }]}>{t('batchQueue').replace('(X)', `(${batchQueue.length})`)}</Text>
              <TouchableOpacity onPress={() => setBatchQueue([])}>
                <Text style={styles.clearText}>{t('clearAll')}</Text>
              </TouchableOpacity>
            </View>
            {batchQueue.map((item, idx) => (
              <View key={`${item.cardId}-${idx}`} style={[styles.batchItem, { backgroundColor: palette.background, borderColor: palette.border }]}>
                <View style={styles.batchItemInfo}>
                  <Text style={[styles.batchItemId, { color: palette.text }]}>{item.cardId}</Text>
                  <Text style={[styles.batchItemStage, { color: palette.textSecondary }]}>{item.stage}</Text>
                </View>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              </View>
            ))}
            <TouchableOpacity style={styles.commitBtn} onPress={handleCommitBatch}>
              <Text style={styles.commitBtnText}>{t('commitAll')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSecondary },
  header: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { ...typography.h4, color: colors.text },
  headerSubtitle: { ...typography.tiny, color: colors.textTertiary, fontWeight: '700', textTransform: 'uppercase' },
  modeToggle: {
    flexDirection: 'row', backgroundColor: colors.backgroundTertiary,
    borderRadius: borderRadius.md, padding: 4, gap: 4,
  },
  headerRightActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  batchToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: borderRadius.full,
    backgroundColor: colors.backgroundTertiary,
  },
  batchToggleActive: { backgroundColor: colors.primary },
  batchToggleText: { ...typography.tiny, fontWeight: '700' },
  modeBtn: { padding: 8, borderRadius: borderRadius.sm },
  modeBtnActive: { backgroundColor: colors.primary, ...shadows.xs },
  scrollContent: { flexGrow: 1 },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing.xxl },
  viewfinderContainer: { position: 'relative', marginBottom: spacing.xl },
  viewfinder: {
    width: 280, height: 280, backgroundColor: '#0F172A',
    borderRadius: 32, alignItems: 'center', justifyContent: 'center',
    ...shadows.lg,
  },
  scanFrame: { width: 180, height: 180, position: 'relative' },
  cornerTL: { position: 'absolute', top: 0, left: 0, width: 30, height: 30, borderTopWidth: 4, borderLeftWidth: 4, borderColor: colors.primary, borderTopLeftRadius: 12 },
  cornerTR: { position: 'absolute', top: 0, right: 0, width: 30, height: 30, borderTopWidth: 4, borderRightWidth: 4, borderColor: colors.primary, borderTopRightRadius: 12 },
  cornerBL: { position: 'absolute', bottom: 0, left: 0, width: 30, height: 30, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: colors.primary, borderBottomLeftRadius: 12 },
  cornerBR: { position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderBottomWidth: 4, borderRightWidth: 4, borderColor: colors.primary, borderBottomRightRadius: 12 },
  cameraOverlay: { position: 'absolute', top: 16, right: 16 },
  hintText: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.sm },
  statusIndicator: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  hardwarePlate: {
    width: '85%', backgroundColor: colors.white, borderRadius: borderRadius.xl,
    padding: spacing.xl, alignItems: 'center', ...shadows.md, borderWidth: 1, borderColor: colors.border,
  },
  hardwareTitle: { ...typography.h4, color: colors.text, marginTop: spacing.md },
  hardwareDesc: { ...typography.small, color: colors.textTertiary, textAlign: 'center', marginTop: spacing.sm, lineHeight: 18 },
  connectBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%',
    backgroundColor: colors.primary, borderRadius: borderRadius.md,
    height: 52, justifyContent: 'center', marginTop: spacing.xl,
  },
  connectBtnDisabled: { backgroundColor: colors.textTertiary },
  connectBtnText: { ...typography.bodyBold, color: colors.white },
  waitingText: { ...typography.tiny, color: colors.primary, marginTop: spacing.md, fontWeight: 'bold' },
  manualEntry: { padding: spacing.xl },
  inputLabel: { ...typography.captionBold, color: colors.textTertiary, marginBottom: spacing.sm },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white,
    paddingHorizontal: spacing.md, height: 56, borderRadius: borderRadius.md,
    borderWidth: 2, borderColor: colors.border, gap: spacing.sm,
  },
  input: { flex: 1, ...typography.bodyBold, color: colors.text },
  trackBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%',
    backgroundColor: colors.text, borderRadius: borderRadius.md,
    height: 52, justifyContent: 'center', marginTop: spacing.lg,
  },
  trackBtnDisabled: { opacity: 0.5 },
  trackBtnText: { ...typography.bodyBold, color: colors.white },
  quickSection: { marginTop: spacing.xxl },
  quickLabel: { ...typography.captionBold, color: colors.textTertiary, marginBottom: spacing.md },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  quickChip: {
    backgroundColor: colors.white, paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm, borderRadius: borderRadius.full,
    borderWidth: 1, borderColor: colors.border,
  },
  quickChipText: { ...typography.smallBold, color: colors.primary },
  // Success Screen
  successScreen: { flex: 1, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  successIcon: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#10B98120', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl },
  successIconBadge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successCheck: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: { ...typography.h2, color: colors.white, marginBottom: spacing.xxl },
  successCard: { width: '100%', backgroundColor: colors.white, borderRadius: borderRadius.xl, padding: spacing.xl, ...shadows.xl },
  successHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  successCardTitle: { ...typography.h4, color: colors.text },
  divider: { height: 1, backgroundColor: colors.border, marginBottom: spacing.md },
  infoGrid: { flexDirection: 'row', gap: spacing.xl },
  infoItem: { flex: 1 },
  infoLabel: { ...typography.tiny, color: colors.textTertiary, fontWeight: 'bold', marginBottom: 4 },
  infoValue: { ...typography.bodyBold, color: colors.text },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, width: '100%',
    backgroundColor: colors.primary, borderRadius: borderRadius.md,
    height: 56, justifyContent: 'center', marginTop: spacing.xxl,
  },
  primaryBtnText: { ...typography.bodyBold, color: colors.white },
  secondaryBtn: { marginTop: spacing.lg, padding: spacing.md },
  secondaryBtnText: { ...typography.body, color: colors.textTertiary },
  // Batch Section
  batchSection: { padding: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border },
  batchHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  batchTitle: { ...typography.captionBold, textTransform: 'uppercase' },
  clearText: { ...typography.tiny, color: colors.primary, fontWeight: 'bold' },
  batchItem: {
    flexDirection: 'row', alignItems: 'center', padding: spacing.md,
    borderRadius: borderRadius.lg, borderWidth: 1, marginBottom: spacing.sm,
    ...shadows.xs,
  },
  batchItemInfo: { flex: 1 },
  batchItemId: { ...typography.bodyBold },
  batchItemStage: { ...typography.tiny, marginTop: 2 },
  commitBtn: {
    backgroundColor: colors.primary, height: 48, borderRadius: borderRadius.md,
    alignItems: 'center', justifyContent: 'center', marginTop: spacing.md,
    ...shadows.sm,
  },
  commitBtnText: { ...typography.bodyBold, color: colors.white },
});
