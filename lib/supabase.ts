import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseProjectRef = (() => {
  if (!supabaseUrl) return 'smarttrack';

  try {
    return new URL(supabaseUrl).hostname.split('.')[0] || 'smarttrack';
  } catch {
    return 'smarttrack';
  }
})();

export const SUPABASE_AUTH_STORAGE_KEY = `sb-${supabaseProjectRef}-auth-token`;

let supabaseClient: SupabaseClient | null = null;
let appStateSubscription: { remove: () => void } | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) {
    return supabaseClient;
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    console.debug('Supabase configuration is missing. Ensure variables are loaded properly.');
    return null;
  }

  try {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storageKey: SUPABASE_AUTH_STORAGE_KEY,
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error);
  }

  return supabaseClient;
}

export async function clearPersistedSupabaseSession() {
  const keys = [
    SUPABASE_AUTH_STORAGE_KEY,
    `${SUPABASE_AUTH_STORAGE_KEY}-code-verifier`,
    `${SUPABASE_AUTH_STORAGE_KEY}-user`,
  ];

  await Promise.all(keys.map(key => AsyncStorage.removeItem(key)));

  if (supabaseClient) {
    try {
      await supabaseClient.auth.stopAutoRefresh();
    } catch {
      // Ignore teardown issues while resetting an invalid session.
    }
  }

  supabaseClient = null;
}

export function configureSupabaseAuthAutoRefresh() {
  if (appStateSubscription) {
    return () => { };
  }

  const handleAppStateChange = (state: AppStateStatus) => {
    const supabase = supabaseClient ?? getSupabaseClient();
    if (!supabase) return;

    if (state === 'active') {
      supabase.auth.startAutoRefresh();
      return;
    }

    supabase.auth.stopAutoRefresh();
  };

  handleAppStateChange(AppState.currentState);
  appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

  return () => {
    appStateSubscription?.remove();
    appStateSubscription = null;
  };
}

function requireSupabaseClient(): SupabaseClient {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase not configured');
  }
  return client;
}

export const supabase = {
  from: (...args: Parameters<SupabaseClient['from']>) => requireSupabaseClient().from(...args),
  channel: (...args: Parameters<SupabaseClient['channel']>) => requireSupabaseClient().channel(...args),
  removeChannel: (channel: Parameters<SupabaseClient['removeChannel']>[0]) =>
    requireSupabaseClient().removeChannel(channel),
};
