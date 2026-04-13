import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ScrollView, Animated, KeyboardAvoidingView, Platform, Linking, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, spacing, typography, shadows, borderRadius } from '@/constants/design';
import { useTheme } from '@/components/ThemeProvider';
import { useAuthStore } from '@/store/authStore';
import { useMessageStore } from '@/store/messageStore';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'react-native';

export default function ChatScreen() {
  const { id: targetUserId, name: targetUserNameParam } = useLocalSearchParams<{ id: string, name: string }>();
  // Decode the name parameter if encoded
  const targetUserName = targetUserNameParam ? decodeURIComponent(targetUserNameParam) : 'User';
  
  const { user: currentUser } = useAuthStore();
  const { palette, isDark } = useTheme();
  
  const { getConversation, addMessage, markAsRead, fetchMessages, subscribeToMessages, isLoading } = useMessageStore();
  
  const [input, setInput] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Load history and subscribe to real-time updates
  useEffect(() => {
    if (currentUser?.id && targetUserId) {
      fetchMessages(currentUser.id, targetUserId);
      const unsubscribe = subscribeToMessages(currentUser.id);
      markAsRead(targetUserId, currentUser.id);
      return () => unsubscribe();
    }
  }, [currentUser?.id, targetUserId, fetchMessages, subscribeToMessages, markAsRead]);

  // Fade in animation
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  if (!currentUser) return null;

  const messages = getConversation(currentUser.id, targetUserId as string);

  const handleSend = async () => {
    if (!input.trim() || !targetUserId) return;

    const messageText = input.trim();
    setInput('');
    
    await addMessage({
      senderId: currentUser.id,
      receiverId: targetUserId,
      text: messageText,
    });

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets[0].uri && targetUserId) {
      addMessage({
        senderId: currentUser.id,
        receiverId: targetUserId,
        text: '',
        attachment: {
          uri: result.assets[0].uri,
          type: 'image',
          name: result.assets[0].fileName || 'image.jpg',
        },
      });
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0].uri && targetUserId) {
        addMessage({
          senderId: currentUser.id,
          receiverId: targetUserId,
          text: '',
          attachment: {
            uri: result.assets[0].uri,
            type: 'pdf',
            name: result.assets[0].name || 'document.pdf',
          },
        });
      }
    } catch (err) {
      console.warn('Document picker error:', err);
    }
  };

  const handleAttach = () => {
    Alert.alert(
      'Attach File',
      'Choose a file type to send',
      [
        { text: 'Image', onPress: pickImage },
        { text: 'PDF Document', onPress: pickDocument },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleCall = () => {
    // If we have a phone number, call it. Otherwise, show a placeholder alert.
    // In a real app, this would come from the targetUser profile.
    const phoneNumber = '1234567890'; // Placeholder
    Linking.openURL(`tel:${phoneNumber}`);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.backgroundSecondary }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: palette.background, borderBottomColor: palette.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={palette.text} />
        </TouchableOpacity>
        
        <View style={styles.headerInfo}>
          <View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>
              {targetUserName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: palette.text }]}>{targetUserName}</Text>
            <Text style={styles.headerSubtitle}>User</Text>
          </View>
        </View>
        
        <TouchableOpacity style={styles.moreBtn} onPress={handleCall}>
          <Ionicons name="call-outline" size={22} color={palette.textSecondary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.chatContainer}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesList}
          contentContainerStyle={styles.scrollContent}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
        >
          {messages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={48} color={palette.border} />
              <Text style={[styles.emptyText, { color: palette.textSecondary }]}>
                Start a conversation with {targetUserName}
              </Text>
            </View>
          ) : (
            messages.map((msg) => {
              const isMe = msg.senderId === currentUser.id;
              const msgDate = new Date(msg.timestamp);
              
              return (
                <Animated.View
                  key={msg.id}
                  style={[
                    styles.messageBubble,
                    isMe ? [styles.myBubble, { backgroundColor: colors.primary }] : [styles.theirBubble, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }],
                    msg.attachment?.type === 'image' && styles.imageBubble,
                    { opacity: fadeAnim }
                  ]}
                >
                  {msg.attachment?.type === 'image' ? (
                    <TouchableOpacity onPress={() => {/* Full screen viewer */}}>
                      <Image 
                        source={{ uri: msg.attachment.uri }} 
                        style={styles.attachedImage} 
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  ) : msg.attachment?.type === 'pdf' ? (
                    <TouchableOpacity style={styles.pdfContainer} onPress={() => Linking.openURL(msg.attachment!.uri)}>
                      <View style={styles.pdfIcon}>
                        <Ionicons name="document-text" size={24} color={isMe ? colors.white : colors.primary} />
                      </View>
                      <View style={styles.pdfInfo}>
                        <Text style={[styles.pdfName, { color: isMe ? colors.white : palette.text }]} numberOfLines={1}>
                          {msg.attachment.name || 'document.pdf'}
                        </Text>
                        <Text style={[styles.pdfSize, { color: isMe ? 'rgba(255,255,255,0.7)' : palette.textTertiary }]}>
                          PDF Document
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ) : null}

                  {msg.text ? (
                    <Text style={[styles.messageText, { color: isMe ? colors.white : palette.text, marginTop: msg.attachment ? 8 : 0 }]}>
                      {msg.text}
                    </Text>
                  ) : null}

                  <View style={styles.messageFooter}>
                    <Text style={[styles.messageTime, { color: isMe ? 'rgba(255,255,255,0.7)' : palette.textTertiary }]}>
                      {msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    {isMe && (
                      <Ionicons 
                        name={msg.read ? "checkmark-done" : "checkmark"} 
                        size={14} 
                        color={msg.read ? "#60A5FA" : "rgba(255,255,255,0.7)"} 
                        style={{ marginLeft: 4 }} 
                      />
                    )}
                  </View>
                </Animated.View>
              );
            })
          )}
        </ScrollView>

        <View style={[styles.inputContainer, { backgroundColor: palette.background, borderTopColor: palette.border }]}>
          <TouchableOpacity style={styles.attachBtn} onPress={handleAttach}>
            <Ionicons name="add" size={24} color={palette.textSecondary} />
          </TouchableOpacity>
          <TextInput
            style={[styles.input, { backgroundColor: palette.backgroundSecondary, color: palette.text, borderColor: palette.border }]}
            placeholder="Type a message..."
            placeholderTextColor={palette.textTertiary}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: input.trim() ? colors.primary : palette.border }]}
            onPress={handleSend}
            disabled={!input.trim()}
          >
            <Ionicons name="send" size={18} color={colors.white} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { ...typography.bodyBold },
  headerTitle: { ...typography.bodyBold },
  headerSubtitle: { ...typography.tiny, color: colors.primary, fontWeight: '600' },
  moreBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  chatContainer: { flex: 1 },
  messagesList: { flex: 1 },
  scrollContent: { padding: spacing.md, gap: spacing.sm },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '40%',
  },
  emptyText: {
    ...typography.body,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 10,
    borderRadius: 16,
    ...shadows.xs,
  },
  myBubble: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  messageText: { ...typography.body, lineHeight: 22 },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  messageTime: { ...typography.tiny },
  imageBubble: { padding: 4, borderRadius: 12 },
  attachedImage: { width: 220, height: 160, borderRadius: 10 },
  pdfContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
    minWidth: 180,
  },
  pdfIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  pdfInfo: { flex: 1 },
  pdfName: { ...typography.small, fontWeight: '700' },
  pdfSize: { ...typography.tiny },
  inputContainer: {
    flexDirection: 'row', alignItems: 'flex-end',
    padding: spacing.sm, paddingBottom: spacing.md, gap: spacing.sm,
    borderTopWidth: 1,
  },
  attachBtn: {
    width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingTop: 10,
    paddingBottom: 10,
    borderWidth: 1,
    ...typography.body,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
    ...shadows.sm,
  },
});
