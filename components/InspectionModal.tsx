import React, { useState } from 'react';
import {
  Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/components/ThemeProvider';
import { borderRadius, shadows, spacing, typography } from '@/constants/design';
import { RootCauseCategory, ROOT_CAUSE_LABELS, ROOT_CAUSE_DESCRIPTIONS, InspectedLoss } from '@/types';

interface InspectionModalProps {
  visible: boolean;
  loss: InspectedLoss | null;
  operatorId: string;
  onClose: () => void;
  onSubmit: (params: {
    lossId: string;
    category: RootCauseCategory;
    details?: string;
    operatorId: string;
    photoUri?: string;
  }) => Promise<{ success: boolean; error?: string }>;
}

const CATEGORIES: RootCauseCategory[] = [
  'feeder_jam', 'paste_defect', 'conveyor_issue',
  'sensor_false_trigger', 'component_shortage', 'placement_error',
  'reflow_defect', 'operator_error', 'other',
];

export default function InspectionModal({
  visible, loss, operatorId, onClose, onSubmit,
}: InspectionModalProps) {
  const { palette, isDark } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState<RootCauseCategory | null>(null);
  const [details, setDetails] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const reset = () => {
    setSelectedCategory(null);
    setDetails('');
    setPhotoUri(null);
    setValidationError(null);
    setSubmitting(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handlePickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Required', 'Camera roll access is needed to attach photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleTakePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Required', 'Camera access is needed to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!selectedCategory) {
      setValidationError('Please select a root cause category.');
      return;
    }
    if (selectedCategory === 'other' && !details.trim()) {
      setValidationError('Please describe the issue when selecting "Other".');
      return;
    }
    setValidationError(null);
    setSubmitting(true);

    const result = await onSubmit({
      lossId: loss!.id,
      category: selectedCategory,
      details: details.trim() || undefined,
      operatorId,
      photoUri: photoUri || undefined,
    });

    setSubmitting(false);

    if (result.success) {
      Alert.alert('Inspection Saved', 'The root cause has been recorded.', [
        { text: 'OK', onPress: handleClose },
      ]);
    } else {
      Alert.alert('Error', result.error || 'Failed to submit inspection. Please try again.');
    }
  };

  if (!loss) return null;

  const date = new Date(loss.created_at);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleClose} />
        <View style={[styles.sheet, { backgroundColor: isDark ? '#0F172A' : '#FFFFFF' }]}>
          <View style={[styles.handle, { backgroundColor: palette.border }]} />
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Loss Summary */}
            <View style={[styles.summaryCard, { backgroundColor: isDark ? '#47556915' : '#FEF2F2', borderColor: isDark ? '#47556930' : '#FECACA' }]}>
              <Text style={[styles.summaryTitle, { color: palette.text }]}>Loss Inspection</Text>
              <View style={styles.summaryRow}>
                <Ionicons name="hardware-chip-outline" size={14} color={palette.textTertiary} />
                <Text style={[styles.summaryText, { color: palette.textSecondary }]}>{loss.machine_name || 'Unknown'}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Ionicons name="layers-outline" size={14} color={palette.textTertiary} />
                <Text style={[styles.summaryText, { color: palette.textSecondary }]}>{loss.loss_count} card{loss.loss_count !== 1 ? 's' : ''} affected</Text>
              </View>
              <View style={styles.summaryRow}>
                <Ionicons name="cash-outline" size={14} color={palette.textTertiary} />
                <Text style={[styles.summaryText, { color: palette.textSecondary }]}>Cost: {loss.cost_tnd.toFixed(3)} TND</Text>
              </View>
              <View style={styles.summaryRow}>
                <Ionicons name="time-outline" size={14} color={palette.textTertiary} />
                <Text style={[styles.summaryText, { color: palette.textSecondary }]}>
                  {date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })} · {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>

            {/* Root Cause Selector */}
            <Text style={[styles.sectionLabel, { color: palette.text }]}>
              Root Cause <Text style={{ color: '#EF4444' }}>*</Text>
            </Text>
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.radioItem,
                    {
                      backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
                      borderColor: isSelected ? '#6366F1' : palette.border,
                    },
                  ]}
                  onPress={() => { setSelectedCategory(cat); setValidationError(null); }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.radio, isSelected && { backgroundColor: '#6366F1', borderColor: '#6366F1' }]}>
                    {isSelected && <Ionicons name="checkmark" size={10} color="#FFF" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.radioLabel, { color: palette.text }]}>{ROOT_CAUSE_LABELS[cat]}</Text>
                    <Text style={[styles.radioDesc, { color: palette.textTertiary }]}>{ROOT_CAUSE_DESCRIPTIONS[cat]}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Details Input */}
            <Text style={[styles.sectionLabel, { color: palette.text }]}>
              Details {selectedCategory === 'other' ? <Text style={{ color: '#EF4444' }}>*</Text> : null}
            </Text>
            <TextInput
              style={[
                styles.textArea,
                {
                  backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
                  borderColor: palette.border,
                  color: palette.text,
                },
              ]}
              placeholder="Describe the issue (optional unless 'Other' is selected)..."
              placeholderTextColor={palette.textTertiary}
              multiline
              numberOfLines={3}
              value={details}
              onChangeText={(t) => { setDetails(t); setValidationError(null); }}
            />

            {/* Photo Attachment */}
            <Text style={[styles.sectionLabel, { color: palette.text }]}>Photo (optional)</Text>
            {photoUri ? (
              <View style={styles.photoPreview}>
                <View style={[styles.photoThumb, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]}>
                  <Ionicons name="image-outline" size={24} color={palette.textTertiary} />
                  <Text style={[styles.photoLabel, { color: palette.textTertiary }]}>Photo attached</Text>
                </View>
                <TouchableOpacity onPress={() => setPhotoUri(null)} style={styles.removePhoto}>
                  <Ionicons name="close-circle" size={22} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.photoActions}>
                <TouchableOpacity
                  style={[styles.photoBtn, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC', borderColor: palette.border }]}
                  onPress={handlePickPhoto}
                >
                  <Ionicons name="images-outline" size={20} color={palette.textSecondary} />
                  <Text style={[styles.photoBtnText, { color: palette.textSecondary }]}>Gallery</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.photoBtn, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC', borderColor: palette.border }]}
                  onPress={handleTakePhoto}
                >
                  <Ionicons name="camera-outline" size={20} color={palette.textSecondary} />
                  <Text style={[styles.photoBtnText, { color: palette.textSecondary }]}>Camera</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Validation Error */}
            {validationError ? (
              <View style={styles.validationRow}>
                <Ionicons name="alert-circle" size={16} color="#EF4444" />
                <Text style={styles.validationText}>{validationError}</Text>
              </View>
            ) : null}

            {/* Action Buttons */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: palette.border }]}
                onPress={handleClose}
                disabled={submitting}
              >
                <Text style={[styles.cancelBtnText, { color: palette.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: submitting ? '#6366F180' : '#6366F1' }]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.submitBtnText}>Submit Inspection</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: borderRadius.xxl,
    borderTopRightRadius: borderRadius.xxl,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  scrollContent: { padding: spacing.md, gap: spacing.md },
  summaryCard: { borderRadius: borderRadius.xl, padding: spacing.md, borderWidth: 1, gap: 8 },
  summaryTitle: { ...typography.bodyBold, fontSize: 15, marginBottom: 4 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryText: { ...typography.small },
  sectionLabel: { ...typography.bodyBold, fontSize: 14, marginTop: spacing.xs },
  radioItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: spacing.sm + 2, borderRadius: borderRadius.lg, borderWidth: 1,
  },
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2,
    borderColor: '#9CA3AF', alignItems: 'center', justifyContent: 'center',
  },
  radioLabel: { ...typography.small, fontWeight: '600' },
  radioDesc: { ...typography.tiny, marginTop: 1 },
  textArea: {
    borderRadius: borderRadius.lg, borderWidth: 1,
    padding: spacing.sm + 2, minHeight: 80,
    ...typography.small, textAlignVertical: 'top',
  },
  photoPreview: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  photoThumb: { flex: 1, borderRadius: borderRadius.lg, padding: spacing.md, alignItems: 'center', gap: 4 },
  photoLabel: { ...typography.tiny },
  removePhoto: { padding: 4 },
  photoActions: { flexDirection: 'row', gap: 10 },
  photoBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: borderRadius.lg, borderWidth: 1,
  },
  photoBtnText: { ...typography.small, fontWeight: '600' },
  validationRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  validationText: { color: '#EF4444', fontSize: 12, fontWeight: '600', flex: 1 },
  actions: { flexDirection: 'row', gap: 10, marginTop: spacing.sm },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: borderRadius.lg,
    alignItems: 'center', borderWidth: 1,
  },
  cancelBtnText: { ...typography.bodyBold },
  submitBtn: {
    flex: 1, paddingVertical: 14, borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  submitBtnText: { ...typography.bodyBold, color: '#FFFFFF' },
});
