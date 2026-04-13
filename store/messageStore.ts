import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  timestamp: string;
  read: boolean;
  attachment?: {
    uri: string;
    type: 'image' | 'pdf';
    name?: string;
  };
}

interface MessageStore {
  messages: ChatMessage[];
  isLoading: boolean;
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp' | 'read'>) => Promise<void>;
  fetchMessages: (userId: string, targetId: string) => Promise<void>;
  subscribeToMessages: (userId: string) => () => void;
  markAsRead: (senderId: string, receiverId: string) => Promise<void>;
  getConversation: (userId1: string, userId2: string) => ChatMessage[];
  getUnreadCount: (senderId: string, receiverId: string) => number;
  clearHistory: () => void;
}

let messageSubscription: RealtimeChannel | null = null;

export const useMessageStore = create<MessageStore>()(
  persist(
    (set, get) => ({
      messages: [],
      isLoading: false,
      
      addMessage: async (message) => {
        const supabase = getSupabaseClient();
        const newMessage: ChatMessage = {
          ...message,
          id: 'temp-' + Date.now().toString() + Math.random().toString(36).substring(7),
          timestamp: new Date().toISOString(),
          read: false,
        };

        // Optimistic update
        set((state) => ({
          messages: [...state.messages, newMessage]
        }));

        if (supabase) {
          try {
            const { data, error } = await (supabase.from('messages') as any)
              .insert({
                sender_id: message.senderId,
                receiver_id: message.receiverId,
                text: message.text,
                attachment: message.attachment,
              })
              .select()
              .single();

            if (error) throw error;
            
            // Replace temp message with actual one from DB
            if (data) {
              set((state) => ({
                messages: state.messages.map(m => m.id === newMessage.id ? {
                  id: data.id,
                  senderId: data.sender_id,
                  receiverId: data.receiver_id,
                  text: data.text,
                  timestamp: data.timestamp,
                  read: data.read,
                  attachment: data.attachment,
                } : m)
              }));
            }
          } catch (err) {
            console.error('Error adding message to Supabase:', err);
          }
        }
      },

      fetchMessages: async (userId, targetId) => {
        const supabase = getSupabaseClient();
        if (!supabase) return;

        set({ isLoading: true });
        try {
          const { data, error } = await (supabase.from('messages') as any)
            .select('*')
            .or(`and(sender_id.eq.${userId},receiver_id.eq.${targetId}),and(sender_id.eq.${targetId},receiver_id.eq.${userId})`)
            .order('timestamp', { ascending: true });

          if (error) throw error;

          if (data) {
            const mappedMessages: ChatMessage[] = data.map((m: any) => ({
              id: m.id,
              senderId: m.sender_id,
              receiverId: m.receiver_id,
              text: m.text,
              timestamp: m.timestamp,
              read: m.read,
              attachment: m.attachment,
            }));

            set((state) => {
              // Merge with local messages, avoiding duplicates by ID
              const existingIds = new Set(state.messages.map(m => m.id));
              const newMessages = mappedMessages.filter(m => !existingIds.has(m.id));
              
              // Also filter out any temp messages that might have been synced
              const nonTempExisting = state.messages.filter(m => !m.id.startsWith('temp-'));
              
              return {
                messages: [...nonTempExisting, ...newMessages].sort((a, b) => 
                  new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                )
              };
            });
          }
        } catch (err) {
          console.error('Error fetching messages:', err);
        } finally {
          set({ isLoading: false });
        }
      },

      subscribeToMessages: (userId) => {
        const supabase = getSupabaseClient();
        if (!supabase) return () => {};

        if (messageSubscription) {
          messageSubscription.unsubscribe();
        }

        messageSubscription = supabase
          .channel(`public:messages:receiver_id=eq.${userId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
              filter: `receiver_id=eq.${userId}`,
            },
            (payload) => {
              const data = payload.new;
              const newMessage: ChatMessage = {
                id: data.id,
                senderId: data.sender_id,
                receiverId: data.receiver_id,
                text: data.text,
                timestamp: data.timestamp,
                read: data.read,
                attachment: data.attachment,
              };

              set((state) => {
                if (state.messages.some(m => m.id === newMessage.id)) return state;
                return {
                  messages: [...state.messages, newMessage].sort((a, b) => 
                    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                  )
                };
              });
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'messages',
              filter: `sender_id=eq.${userId}`,
            },
            (payload) => {
              const data = payload.new;
              set((state) => ({
                messages: state.messages.map(m => m.id === data.id ? {
                  ...m,
                  read: data.read,
                } : m)
              }));
            }
          )
          .subscribe();

        return () => {
          if (messageSubscription) {
            messageSubscription.unsubscribe();
            messageSubscription = null;
          }
        };
      },
      
      getConversation: (userId1, userId2) => {
        return get().messages
          .filter(
            m => (m.senderId === userId1 && m.receiverId === userId2) ||
                 (m.senderId === userId2 && m.receiverId === userId1)
          )
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      },
      
      markAsRead: async (senderId, receiverId) => {
        const supabase = getSupabaseClient();
        
        // Optimistic local update
        set((state) => ({
          messages: state.messages.map(m => 
            (m.senderId === senderId && m.receiverId === receiverId) 
              ? { ...m, read: true } 
              : m
          )
        }));

        if (supabase) {
          try {
            const { error } = await (supabase.from('messages') as any)
              .update({ read: true })
              .eq('sender_id', senderId)
              .eq('receiver_id', receiverId)
              .eq('read', false);

            if (error) throw error;
          } catch (err) {
            console.error('Error marking messages as read in Supabase:', err);
          }
        }
      },
      
      getUnreadCount: (senderId, receiverId) => {
        return get().messages.filter(m => m.senderId === senderId && m.receiverId === receiverId && !m.read).length;
      },
      
      clearHistory: () => set({ messages: [] }),
    }),
    {
      name: 'smarttrack-messages',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ messages: state.messages }), // Only persist messages, not loading state
    }
  )
);

