import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ScrollView, KeyboardAvoidingView,
  Platform, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/design';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/components/ThemeProvider';
import { getAnalytics } from '@/lib/api';
import { AnalyticsData } from '@/types';

interface Message {
  id: string;
  text: string;
  isAi: boolean;
  timestamp: Date;
}

export default function AIAssistantScreen() {
  const { t } = useTranslation();
  const { palette, isDark } = useTheme();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hello! I'm your SmartTrack AI Assistant. How can I help you optimize your production today?",
      isAi: true,
      timestamp: new Date(),
    },
  ]);
  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    getAnalytics('today').then(setAnalytics).catch(console.error);
  }, []);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const [isLoading, setIsLoading] = useState(false);

  const getAIResponse = async (userText: string, history: Message[]) => {
    const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

    const systemInstruction = `You are the SmartTrack AI Assistant, an expert in factory production and electronic card tracking. 
    Your goal is to help operators, supervisors, and admins optimize production, identify bottlenecks, and understand factory analytics.
    
    Context about the app:
    - SmartTrack tracks electronic cards through stages like SMT, THT, Assembly, Testing, QC, and Shipping.
    - Users can scan cards via Camera, RFID, or Manual entry.
    
    ${analytics ? `Current Real-Time Factory Data:
    - Total Cards tracked: ${analytics.totalCards}
    - Completion Rate: ${analytics.completionRate}% (Target: 85%)
    - Active Cards: ${analytics.activeNow}
    - Stage Breakdown: ${analytics.stageBreakdown.map(s => `${s.stage}: ${s.count} (${s.percent}%)`).join(', ')}
    - Insight: ${analytics.insight}` : ''}
    
    Guidelines:
    - Be professional, helpful, and concise.
    - Use technical factory terms accurately.
    - If asked about specific cards you don't have, explain that you have access to general analytics but might need a card ID for specifics.
    - Always encourage efficiency and quality.
    - Keep responses short and suitable for a mobile screen.`;

    // Gemini API expects history to start with a 'user' message or just be an alternation.
    // If our history starts with the greeting (isAi: true), we should probably skip it for the API call 
    // unless we want to map it to a 'user' message or something.
    const recentHistory = history
      .filter(m => m.id !== '1') // Skip the initial greeting to ensure it doesn't break the role alternation
      .slice(-5)
      .map(msg => ({
        role: msg.isAi ? "model" : "user",
        parts: [{ text: msg.text }]
      }));

    try {
      console.log("Calling Gemini API with key present:", !!API_KEY);
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            ...recentHistory,
            {
              role: "user",
              parts: [{ text: userText }]
            }
          ],
          system_instruction: {
            parts: [{ text: systemInstruction }]
          }
        }),
      });

      const data = await response.json();
      console.log("Gemini API Response Status:", response.status);
      
      if (!response.ok) {
        console.error("Gemini API Error Data:", data);
        if (response.status === 429) {
          return "I've been thinking quite a bit lately! My brain needs a small break (rate limit reached). Please try again in about a minute.";
        }
        if (response.status >= 500) {
          return "My connection to the AI servers is a bit shaky right now. Please try again in a few moments.";
        }
        return `I encountered an issue (${response.status}). My engineers have been notified. Please try again soon.`;
      }

      const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!aiText) {
        console.error("Gemini API Unexpected Structure:", data);
        return "I'm sorry, the AI returned an empty response. Could you try asking in a different way?";
      }

      return aiText;
    } catch (error) {
      console.error("Gemini API Fetch Error:", error);
      return "I'm having trouble connecting to my brain right now. Please check your internet connection.";
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userText = input;
    const userMsg: Message = {
      id: Date.now().toString(),
      text: userText,
      isAi: false,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const aiResponseText = await getAIResponse(userText, messages);
    
    const aiMsg: Message = {
      id: (Date.now() + 1).toString(),
      text: aiResponseText,
      isAi: true,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, aiMsg]);
    setIsLoading(false);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.backgroundSecondary }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: palette.background, borderBottomColor: palette.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={palette.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: palette.text }]}>{t('aiAssistant')}</Text>
          <View style={styles.onlineBadge}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>AI Active</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.moreBtn}>
          <Ionicons name="ellipsis-horizontal" size={22} color={palette.textSecondary} />
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
        >
          {messages.map((msg, idx) => (
            <Animated.View
              key={msg.id}
              style={[
                styles.messageBubble,
                msg.isAi ? [styles.aiBubble, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }] : [styles.userBubble, { backgroundColor: colors.primary }],
                { opacity: fadeAnim }
              ]}
            >
              <Text style={[styles.messageText, { color: msg.isAi ? palette.text : colors.white }]}>
                {msg.text}
              </Text>
              <Text style={[styles.messageTime, { color: msg.isAi ? palette.textTertiary : 'rgba(255,255,255,0.7)' }]}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </Animated.View>
          ))}
          {isLoading && (
            <View style={[styles.messageBubble, styles.aiBubble, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
              <Text style={[styles.messageText, { color: palette.textTertiary }]}>Thinking...</Text>
            </View>
          )}
        </ScrollView>

        <View style={[styles.inputContainer, { backgroundColor: palette.background, borderTopColor: palette.border }]}>
          <TextInput
            style={[styles.input, { backgroundColor: palette.backgroundSecondary, color: palette.text, borderColor: palette.border }]}
            placeholder="Type your question..."
            placeholderTextColor={palette.textTertiary}
            value={input}
            onChangeText={setInput}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: input.trim() ? colors.primary : palette.border }]}
            onPress={handleSend}
            disabled={!input.trim()}
          >
            <Ionicons name="send" size={20} color={colors.white} />
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
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitleContainer: { alignItems: 'center' },
  headerTitle: { ...typography.h4, fontWeight: '700' },
  onlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  onlineText: { ...typography.tiny, color: '#10B981', fontWeight: '700' },
  moreBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  chatContainer: { flex: 1 },
  messagesList: { flex: 1 },
  scrollContent: { padding: spacing.lg, gap: spacing.md },
  messageBubble: {
    maxWidth: '85%',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.xs,
  },
  aiBubble: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  userBubble: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  messageText: { ...typography.body, lineHeight: 22 },
  messageTime: { ...typography.tiny, marginTop: 4, textAlign: 'right' },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing.md, gap: spacing.sm,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderWidth: 1,
    ...typography.body,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    ...shadows.sm,
  },
});
