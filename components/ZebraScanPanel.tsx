import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Alert, ActivityIndicator } from 'react-native';
import { getSupabaseClient } from '@/lib/supabase';

export function ZebraScanPanel() {
  const [scannedCardId, setScannedCardId] = useState('');
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState<Date | null>(null);

  const resetScan = () => {
    setScannedCardId('');
    setScanning(false);
  };

  const processScan = async (cardId: string) => {
    const trimmed = cardId.trim().toUpperCase();
    if (!trimmed) return;

    const supabase = getSupabaseClient();
    if (!supabase) {
      Alert.alert('Error', 'Supabase not configured');
      return;
    }

    try {
      setScanning(true);

      const { data: existingCard, error: findError } = await supabase
        .from('electronic_cards')
        .select('id, status, current_machine, scan_points')
        .eq('card_id', trimmed)
        .maybeSingle();

      if (findError) throw findError;

      const now = new Date().toISOString();

      if (existingCard) {
        const { error: updateError } = await supabase
          .from('electronic_cards')
          .update({
            stage_entered_at: now,
            scan_points: (existingCard.scan_points || 0) + 1,
            current_machine_status: 'in_progress',
            updated_at: now,
          })
          .eq('id', existingCard.id);

        if (updateError) throw updateError;

        Alert.alert(
          'Card Scanned',
          `Card ${trimmed} updated\nMachine: ${existingCard.current_machine || 'Unknown'}`,
          [{ text: 'OK', onPress: resetScan }]
        );
      } else {
        const { error: createError } = await supabase.from('electronic_cards').insert([
          {
            card_id: trimmed,
            product_id: null,
            status: 'in_progress',
            current_machine: 'NPM-DX-1',
            current_machine_status: 'in_progress',
            stage_entered_at: now,
            created_at: now,
            updated_at: now,
            scan_points: 1,
            batch_id: null,
          },
        ]);

        if (createError) throw createError;

        Alert.alert('New Card Created', `Card ${trimmed} registered`, [
          { text: 'OK', onPress: resetScan },
        ]);
      }

      setLastScan(new Date());
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to process card';
      console.error('Scan error:', err);
      Alert.alert('Scan Failed', message, [{ text: 'Retry', onPress: resetScan }]);
    } finally {
      setScanning(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.scannerBox}>
        {scanning ? (
          <>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.processingText}>Processing...</Text>
          </>
        ) : (
          <>
            <Text style={styles.scannerIcon}>📷</Text>
            <Text style={styles.scannerText}>Ready to scan...</Text>
            <Text style={styles.scannerSubtext}>Point Zebra scanner at card QR code</Text>
          </>
        )}
      </View>

      {!scanning && (
        <TextInput
          autoFocus
          style={styles.hiddenInput}
          value={scannedCardId}
          onChangeText={setScannedCardId}
          onSubmitEditing={() => processScan(scannedCardId)}
          returnKeyType="done"
          autoCapitalize="characters"
          autoCorrect={false}
          spellCheck={false}
          blurOnSubmit={false}
        />
      )}

      <View style={styles.manualEntry}>
        <Text style={styles.manualLabel}>Or enter card ID manually:</Text>
        <TextInput
          style={styles.manualInput}
          placeholder="Card ID"
          autoCapitalize="characters"
          onSubmitEditing={(e) => processScan(e.nativeEvent.text)}
          returnKeyType="go"
        />
      </View>

      {lastScan && (
        <View style={styles.lastScanBox}>
          <Text style={styles.lastScanLabel}>Last scan:</Text>
          <Text style={styles.lastScanTime}>{lastScan.toLocaleTimeString('fr-FR')}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  scannerBox: {
    backgroundColor: '#fff',
    padding: 40,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#3b82f6',
    borderStyle: 'dashed',
  },
  scannerIcon: { fontSize: 48, marginBottom: 12 },
  scannerText: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  scannerSubtext: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
  processingText: { fontSize: 16, fontWeight: '600', marginTop: 12 },
  hiddenInput: { position: 'absolute', opacity: 0, height: 1, width: 1, top: 0, left: 0 },
  manualEntry: { backgroundColor: '#fff', padding: 16, borderRadius: 12 },
  manualLabel: { fontSize: 13, color: '#6b7280', marginBottom: 8 },
  manualInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
  },
  lastScanBox: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastScanLabel: { fontSize: 13, color: '#6b7280' },
  lastScanTime: { fontSize: 14, fontWeight: '600' },
});
