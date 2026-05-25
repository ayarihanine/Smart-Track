import { create } from 'zustand';
import { clearPersistedSupabaseSession, getSupabaseClient } from '@/lib/supabase';
import { UserProfile, UserRole } from '@/types';
import { RealtimeChannel } from '@supabase/supabase-js';

interface AuthState {
  user: UserProfile | null;
  profile: { role: UserRole } | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setUser: (user: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string, role: UserRole) => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
  refreshProfile: (userId: string) => Promise<void>;
}

let profileSubscription: RealtimeChannel | null = null;

function isInvalidRefreshTokenError(error: unknown) {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  return message.includes('invalid refresh token') || message.includes('refresh token not found');
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  isLoading: true,
  isAuthenticated: false,

  setUser: (user) => set({
    user,
    profile: user ? { role: user.role } : null,
    isAuthenticated: !!user,
    isLoading: false,
  }),
  setLoading: (loading) => set({ isLoading: loading }),

  refreshProfile: async (userId: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      const { data, error } = await (supabase.from('profiles') as any)
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.warn('Profile not found for user:', userId);
        } else {
          throw error;
        }
      }

      if (data) {
        const current = get().user
        const updatedUser = {
          ...current,
          id: data.id,
          email: data.email,
          displayName: data.display_name || data.displayName || current?.displayName || '',
          role: data.role as UserRole,
          avatarUrl: data.avatar_url || data.avatarUrl,
          createdAt: data.created_at || data.createdAt,
        } as UserProfile
        set({
          user: updatedUser,
          profile: { role: updatedUser.role },
          isAuthenticated: true,
        });
      }
    } catch (err) {
      console.error('Error refreshing profile:', err);
    }
  },

  initialize: async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      set({ isLoading: false });
      return;
    }

    const setupSubscription = (userId: string) => {
      if (profileSubscription) {
        profileSubscription.unsubscribe();
      }

      profileSubscription = supabase
        .channel(`public:profiles:id=eq.${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${userId}`,
          },
          (payload) => {
            console.log('Profile update received:', payload.new);
            const data = payload.new;
            set((state) => {
              const updatedUser = state.user ? {
                ...state.user,
                displayName: data.display_name || data.displayName || state.user.displayName,
                role: data.role as UserRole,
                avatarUrl: data.avatar_url || data.avatarUrl,
                email: data.email || state.user.email,
              } : null
              return {
                user: updatedUser,
                profile: updatedUser ? { role: updatedUser.role } : null,
              }
            });
          }
        )
        .subscribe();
    };

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      if (isInvalidRefreshTokenError(sessionError)) {
        console.warn('Supabase session refresh failed. Clearing the stale local session and continuing signed out.');
        await clearPersistedSupabaseSession();
        set({ user: null, profile: null, isAuthenticated: false, isLoading: false });
        return;
      }

      console.error('Failed to restore Supabase session:', sessionError);
      set({ isLoading: false });
      return;
    }

    if (session?.user) {
      const user = session.user;
      
      // Set initial user from metadata as fallback
      const initialUser = {
        id: user.id,
        email: user.email || '',
        displayName: user.user_metadata?.displayName || user.email?.split('@')[0] || 'User',
        role: user.user_metadata?.role as UserRole || 'operator',
        badgeId: user.user_metadata?.badgeId,
        department: user.user_metadata?.department,
        avatarUrl: user.user_metadata?.avatarUrl,
      }
      set({
        user: initialUser,
        profile: { role: initialUser.role },
        isAuthenticated: true,
      });

      // Fetch actual profile from DB
      await get().refreshProfile(user.id);
      setupSubscription(user.id);
      set({ isLoading: false });
    } else {
      set({ isLoading: false });
    }

    // Listener for auth state changes
    supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        const user = session.user;
        
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          const sessionUser = {
            id: user.id,
            email: user.email || '',
            displayName: user.user_metadata?.displayName || user.email?.split('@')[0] || 'User',
            role: user.user_metadata?.role as UserRole || 'operator',
            avatarUrl: user.user_metadata?.avatarUrl,
          }
          set({
            user: sessionUser,
            profile: { role: sessionUser.role },
            isAuthenticated: true,
          });

          void (async () => {
            await get().refreshProfile(user.id);
            setupSubscription(user.id);
          })();
        }
      } else {
        if (profileSubscription) {
          profileSubscription.unsubscribe();
          profileSubscription = null;
        }
        set({ user: null, profile: null, isAuthenticated: false });
      }
    });
  },

  signIn: async (email, password) => {
    set({ isLoading: true });
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase not configured');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      if (data.user) {
        // initialize will handle profile fetch and subscription
      }
    } catch (e) {
      set({ isLoading: false });
      throw e;
    }
  },

  signUp: async (email, password, displayName, role) => {
    set({ isLoading: true });
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase not configured');

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            displayName,
            role,
          },
        },
      });
      if (error) throw error;

      if (data.user) {
        const user = data.user;

        // Insert into public.profiles
        await (supabase.from('profiles') as any).insert({
          id: user.id,
          email: email,
          display_name: displayName,
          role: role,
        });

        // initialize will handle profile fetch and subscription
      }
    } catch (e) {
      set({ isLoading: false });
      throw e;
    }
  },

  signOut: async () => {
    const supabase = getSupabaseClient();
    if (profileSubscription) {
      profileSubscription.unsubscribe();
      profileSubscription = null;
    }
    if (supabase) {
      await supabase.auth.signOut();
    }
    set({ user: null, profile: null, isAuthenticated: false });
  },
}));
