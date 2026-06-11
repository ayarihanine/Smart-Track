import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Alert, ActivityIndicator, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getSupabaseClient } from '@/lib/supabase';
import { spacing } from '@/constants/design';

const ZEBRA_VENDOR_ID = 0x05e0;

const HID_KEY_MAP: Record<number, [string, string]> = {
  4: ['a', 'A'],
  5: ['b', 'B'],
  6: ['c', 'C'],
  7: ['d', 'D'],
  8: ['e', 'E'],
  9: ['f', 'F'],
  10: ['g', 'G'],
  11: ['h', 'H'],
  12: ['i', 'I'],
  13: ['j', 'J'],
  14: ['k', 'K'],
  15: ['l', 'L'],
  16: ['m', 'M'],
  17: ['n', 'N'],
  18: ['o', 'O'],
  19: ['p', 'P'],
  20: ['q', 'Q'],
  21: ['r', 'R'],
  22: ['s', 'S'],
  23: ['t', 'T'],
  24: ['u', 'U'],
  25: ['v', 'V'],
  26: ['w', 'W'],
  27: ['x', 'X'],
  28: ['y', 'Y'],
  29: ['z', 'Z'],
  30: ['1', '!'],
  31: ['2', '@'],
  32: ['3', '#'],
  33: ['4', '$'],
  34: ['5', '%'],
  35: ['6', '^'],
  36: ['7', '&'],
  37: ['8', '*'],
  38: ['9', '('],
  39: ['0', ')'],
  44: [' ', ' '],
  45: ['-', '_'],
  46: ['=', '+'],
  47: ['[', '{'],
  48: [']', '}'],
  49: ['\\', '|'],
  51: [';', ':'],
  52: ["'", '"'],
  53: ['`', '~'],
  54: [',', '<'],
  55: ['.', '>'],
  56: ['/', '?'],
};

function normalizeScanValue(value: string) {
  return value.replace(/[\u0000\r\n\t]/g, '').trim().toUpperCase();
}

function getBrowserNavigator(): any {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return null;
  return navigator as any;
}

export function ZebraScanPanel() {
  const inputRef = useRef<TextInput>(null);
  const scanBufferRef = useRef('');
  const scanningRef = useRef(false);
  const previousHidCodesRef = useRef<Set<number>>(new Set());
  const hidDeviceRef = useRef<any>(null);
  const hidListenerRef = useRef<((event: any) => void) | null>(null);
  const usbDeviceRef = useRef<any>(null);
  const usbReadCancelledRef = useRef(false);

  const [scannedCardId, setScannedCardId] = useState('');
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState<Date | null>(null);
  const [usbStatus, setUsbStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [usbDeviceName, setUsbDeviceName] = useState<string | null>(null);

  const browserNavigator = getBrowserNavigator();
  const canReadUsb = !!(browserNavigator?.hid?.requestDevice || browserNavigator?.usb?.requestDevice);

  const focusHiddenInput = useCallback(() => {
    setTimeout(() => inputRef.current?.focus(), 80);
  }, []);

  const resetScan = useCallback(() => {
    scanBufferRef.current = '';
    scanningRef.current = false;
    setScannedCardId('');
    setScanning(false);
    focusHiddenInput();
  }, [focusHiddenInput]);

  const processScan = useCallback(async (cardId: string) => {
    const trimmed = normalizeScanValue(cardId);
    if (!trimmed || scanningRef.current) return;

    const supabase = getSupabaseClient();
    if (!supabase) {
      Alert.alert('Error', 'Supabase not configured');
      return;
    }

    try {
      scanningRef.current = true;
      setScanning(true);
      setScannedCardId(trimmed);

      const { data: existingCard, error: findError } = await supabase
        .from('electronic_cards')
        .select('id, status, current_machine, scan_points')
        .ilike('card_id', trimmed)
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
      scanningRef.current = false;
      setScanning(false);
      focusHiddenInput();
    }
  }, [focusHiddenInput, resetScan]);

  const appendScannedText = useCallback((chunk: string) => {
    if (!chunk) return;

    let pending = scanBufferRef.current;
    for (const char of chunk) {
      if (char === '\u0000') continue;
      if (char === '\b') {
        pending = pending.slice(0, -1);
        continue;
      }
      if (char === '\r' || char === '\n') {
        const completeValue = pending;
        pending = '';
        if (normalizeScanValue(completeValue)) {
          processScan(completeValue);
        }
        continue;
      }
      pending += char;
    }

    scanBufferRef.current = pending;
    setScannedCardId(pending.replace(/[\u0000\r\n]/g, ''));
  }, [processScan]);

  const handleKeyboardInput = useCallback((value: string) => {
    if (/[\r\n]/.test(value)) {
      const parts = value.split(/[\r\n]+/);
      const trailing = parts.pop() ?? '';
      parts.forEach((part) => {
        if (normalizeScanValue(part)) processScan(part);
      });
      scanBufferRef.current = trailing;
      setScannedCardId(trailing);
      return;
    }

    scanBufferRef.current = value;
    setScannedCardId(value);
  }, [processScan]);

  const decodeHidInputReport = useCallback((dataView: DataView) => {
    const bytes = Array.from(new Uint8Array(dataView.buffer, dataView.byteOffset, dataView.byteLength));
    const keyCodes = bytes.slice(2).filter(Boolean);
    const keyboardFrame = bytes.length >= 8 && bytes[1] === 0;
    const keyboardLike = keyboardFrame && (
      keyCodes.length === 0 ||
      keyCodes.some(code => code === 40 || code === 42 || Boolean(HID_KEY_MAP[code]))
    );

    if (!keyboardLike) {
      return bytes
        .filter(byte => byte === 8 || byte === 10 || byte === 13 || (byte >= 32 && byte <= 126))
        .map(byte => (byte === 8 ? '\b' : String.fromCharCode(byte)))
        .join('');
    }

    const shifted = Boolean((bytes[0] || 0) & 0x22);
    const previousCodes = previousHidCodesRef.current;
    let text = '';

    for (const code of keyCodes) {
      if (previousCodes.has(code)) continue;
      if (code === 40) text += '\n';
      else if (code === 42) text += '\b';
      else {
        const pair = HID_KEY_MAP[code];
        if (pair) text += shifted ? pair[1] : pair[0];
      }
    }

    previousHidCodesRef.current = new Set(keyCodes);
    return text;
  }, []);

  const handleHidInputReport = useCallback((event: any) => {
    if (!event?.data) return;
    appendScannedText(decodeHidInputReport(event.data));
  }, [appendScannedText, decodeHidInputReport]);

  const attachHidDevice = useCallback(async (device: any) => {
    if (!device.opened) await device.open();

    if (hidDeviceRef.current && hidListenerRef.current) {
      hidDeviceRef.current.removeEventListener('inputreport', hidListenerRef.current);
    }

    const listener = (event: any) => handleHidInputReport(event);
    device.addEventListener('inputreport', listener);
    hidDeviceRef.current = device;
    hidListenerRef.current = listener;
    setUsbDeviceName(device.productName || 'Zebra USB scanner');
    setUsbStatus('connected');
    focusHiddenInput();
  }, [focusHiddenInput, handleHidInputReport]);

  const readUsbLoop = useCallback(async (device: any, endpointNumber: number) => {
    usbReadCancelledRef.current = false;
    const decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;

    try {
      while (!usbReadCancelledRef.current && device.opened) {
        const result = await device.transferIn(endpointNumber, 64);
        if (!result?.data) continue;

        const bytes = new Uint8Array(result.data.buffer, result.data.byteOffset, result.data.byteLength);
        const text = decoder
          ? decoder.decode(bytes).replace(/\u0000/g, '')
          : Array.from(bytes)
            .filter(byte => byte === 8 || byte === 10 || byte === 13 || (byte >= 32 && byte <= 126))
            .map(byte => (byte === 8 ? '\b' : String.fromCharCode(byte)))
            .join('');

        appendScannedText(text);
      }
    } catch (err) {
      if (!usbReadCancelledRef.current) {
        console.error('Zebra USB read failed:', err);
        setUsbStatus('error');
      }
    }
  }, [appendScannedText]);

  const attachUsbDevice = useCallback(async (device: any) => {
    if (!device.opened) await device.open();
    if (!device.configuration) {
      await device.selectConfiguration(device.configurations?.[0]?.configurationValue ?? 1);
    }

    for (const usbInterface of device.configuration?.interfaces ?? []) {
      for (const alternate of usbInterface.alternates ?? []) {
        const inputEndpoint = alternate.endpoints?.find((endpoint: any) => endpoint.direction === 'in');
        if (!inputEndpoint) continue;

        try {
          await device.claimInterface(usbInterface.interfaceNumber);
          if (alternate.alternateSetting) {
            await device.selectAlternateInterface(usbInterface.interfaceNumber, alternate.alternateSetting);
          }

          usbDeviceRef.current = device;
          setUsbDeviceName(device.productName || 'Zebra USB scanner');
          setUsbStatus('connected');
          focusHiddenInput();
          readUsbLoop(device, inputEndpoint.endpointNumber);
          return;
        } catch (err) {
          console.warn('Could not claim Zebra USB interface:', err);
        }
      }
    }

    throw new Error('No readable USB input endpoint found on this Zebra device.');
  }, [focusHiddenInput, readUsbLoop]);

  const connectUsbScanner = useCallback(async () => {
    const nav = getBrowserNavigator();
    if (!nav?.hid?.requestDevice && !nav?.usb?.requestDevice) {
      setUsbStatus('error');
      Alert.alert('USB Not Supported', 'Open the web app in a Chromium browser or scan in keyboard-wedge mode.');
      focusHiddenInput();
      return;
    }

    try {
      setUsbStatus('connecting');

      // Try USB first (as default)
      if (nav.usb?.requestDevice) {
        try {
          const device = await nav.usb.requestDevice({ filters: [{ vendorId: ZEBRA_VENDOR_ID }] });
          if (device) {
            await attachUsbDevice(device);
            return;
          }
        } catch (err: any) {
          if (err?.name !== 'NotFoundError' || !nav.hid?.requestDevice) throw err;
        }
      }

      // Fall back to HID
      if (nav.hid?.requestDevice) {
        const devices = await nav.hid.requestDevice({ filters: [{ vendorId: ZEBRA_VENDOR_ID }] });
        if (devices?.[0]) {
          await attachHidDevice(devices[0]);
          return;
        }
      }

      setUsbStatus('idle');
      focusHiddenInput();
    } catch (err: any) {
      const cancelled = err?.name === 'NotFoundError';
      setUsbStatus(cancelled ? 'idle' : 'error');
      if (!cancelled) {
        const message = err instanceof Error ? err.message : 'Could not connect to Zebra USB scanner.';
        Alert.alert('USB Connect Failed', message);
      }
      focusHiddenInput();
    }
  }, [attachHidDevice, attachUsbDevice, focusHiddenInput]);

  useEffect(() => {
    focusHiddenInput();

    return () => {
      usbReadCancelledRef.current = true;
      if (hidDeviceRef.current && hidListenerRef.current) {
        hidDeviceRef.current.removeEventListener('inputreport', hidListenerRef.current);
      }
      hidDeviceRef.current?.close?.().catch?.(() => {});
      usbDeviceRef.current?.close?.().catch?.(() => {});
    };
  }, [focusHiddenInput]);

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={['#1e293b', '#0f172a']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.scannerBox}
      >
        {scanning ? (
          <View style={styles.scannerInner}>
            <ActivityIndicator size="large" color="#818cf8" />
            <Text style={styles.processingText}>Processing scan...</Text>
          </View>
        ) : (
          <View style={styles.scannerInner}>
            <View style={styles.scannerIconWrap}>
              <Ionicons name="scan-outline" size={40} color="#818cf8" />
            </View>
            <Text style={styles.scannerText}>
              {usbStatus === 'connected' ? 'Zebra USB Connected' : 'Zebra Scanner Active'}
            </Text>
            <Text style={styles.scannerSubtext}>
              {usbStatus === 'connected'
                ? `${usbDeviceName || 'USB scanner'} is listening for scans`
                : 'Connect USB, scan as keyboard input, or type card ID'}
            </Text>
          </View>
        )}
      </LinearGradient>

      {Platform.OS === 'web' && (
        <View style={styles.usbPanel}>
          <TouchableOpacity
            style={[
              styles.usbButton,
              usbStatus === 'connected' && styles.usbButtonConnected,
              (!canReadUsb || usbStatus === 'connecting') && styles.usbButtonDisabled,
            ]}
            onPress={connectUsbScanner}
            disabled={!canReadUsb || usbStatus === 'connecting'}
            activeOpacity={0.82}
          >
            {usbStatus === 'connecting' ? (
              <ActivityIndicator size="small" color="#f8fafc" />
            ) : (
              <Ionicons
                name={usbStatus === 'connected' ? 'checkmark-circle-outline' : 'barcode-outline'}
                size={18}
                color="#f8fafc"
              />
            )}
            <Text style={styles.usbButtonText}>
              {usbStatus === 'connected' ? 'USB Reader Online' : usbStatus === 'connecting' ? 'Connecting...' : 'Connect Zebra USB'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.usbStatusText}>
            {canReadUsb
              ? usbStatus === 'connected'
                ? 'Scans are read directly from the selected USB device.'
                : 'Keyboard-wedge scanning still works without pairing.'
              : 'Direct USB requires WebHID or WebUSB browser support.'}
          </Text>
        </View>
      )}

      {!scanning && (
        <TextInput
          ref={inputRef}
          autoFocus
          style={styles.hiddenInput}
          value={scannedCardId}
          onChangeText={handleKeyboardInput}
          onSubmitEditing={() => processScan(scannedCardId)}
          returnKeyType="done"
          autoCapitalize="characters"
          autoCorrect={false}
          spellCheck={false}
          blurOnSubmit={false}
        />
      )}

      {lastScan && (
        <LinearGradient
          colors={['#1e293b', '#0f172a']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.lastScanBox}
        >
          <View style={styles.lastScanLeft}>
            <Ionicons name="checkmark-circle" size={16} color="#34d399" />
            <Text style={styles.lastScanLabel}>Last scan</Text>
          </View>
          <Text style={styles.lastScanTime}>{lastScan.toLocaleTimeString('fr-FR')}</Text>
        </LinearGradient>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  scannerBox: {
    padding: spacing.xl,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  scannerInner: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  scannerIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: spacing.xs,
  },
  scannerText: { fontSize: 17, fontWeight: '700', color: '#f1f5f9', letterSpacing: 0.3 },
  scannerSubtext: { fontSize: 13, color: '#94a3b8', textAlign: 'center', lineHeight: 18 },
  processingText: { fontSize: 15, fontWeight: '600', color: '#94a3b8', marginTop: spacing.xs },
  usbPanel: {
    gap: 6,
  },
  usbButton: {
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: '#4f46e5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  usbButtonConnected: {
    backgroundColor: '#0f766e',
    borderColor: '#14b8a6',
  },
  usbButtonDisabled: {
    opacity: 0.62,
  },
  usbButtonText: { fontSize: 14, fontWeight: '700', color: '#f8fafc' },
  usbStatusText: { fontSize: 12, color: '#64748b', lineHeight: 17, textAlign: 'center' },
  hiddenInput: { position: 'absolute', opacity: 0, height: 1, width: 1, top: 0, left: 0 },
  lastScanBox: {
    padding: spacing.sm + 4,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  lastScanLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lastScanLabel: { fontSize: 13, color: '#94a3b8', fontWeight: '500' },
  lastScanTime: { fontSize: 14, fontWeight: '700', color: '#f1f5f9' },
});
