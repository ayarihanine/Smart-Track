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

/**
 * Convert blob to ArrayBuffer for reliable binary upload
 * Works reliably in React Native
 */
function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as ArrayBuffer);
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
}

/**
 * Upload a file to Supabase storage with retry logic
 * Uses PUT with binary data for better React Native compatibility
 * Handles React Native blob uploads with exponential backoff
 */
export async function uploadFileToStorage(
  bucketName: string,
  fileName: string,
  blob: Blob,
  options?: { contentType?: string; maxRetries?: number }
): Promise<{ error: any; data: any }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { error: new Error('Supabase client not initialized'), data: null };
  }

  if (!supabaseUrl) {
    return { error: new Error('Supabase URL not configured'), data: null };
  }

  const maxRetries = options?.maxRetries ?? 3;
  let lastError: any = null;

  // Get the session to include auth header if user is logged in
  const { data: { session } } = await supabase.auth.getSession();
  const authToken = session?.access_token;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`[Upload Attempt ${attempt + 1}/${maxRetries}] Uploading ${fileName} to ${bucketName}`);
      
      // Convert blob to ArrayBuffer for reliable binary upload
      console.log('[Upload] Converting blob to binary data...');
      const arrayBuffer = await blobToArrayBuffer(blob);
      console.log(`[Upload] Binary data prepared: ${arrayBuffer.byteLength} bytes`);

      // Upload via REST API using PUT with binary data (more reliable than SDK in React Native)
      const url = `${supabaseUrl}/storage/v1/object/${bucketName}/${encodeURIComponent(fileName)}`;
      console.log('[Upload] Uploading via REST API (PUT binary)');

      const headers: Record<string, string> = {
        'Content-Type': options?.contentType || 'application/octet-stream',
      };

      // Add authorization header if user is authenticated
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
        console.log('[Upload] Using authenticated request');
      } else {
        console.log('[Upload] Using anonymous request (no auth token)');
      }

      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: arrayBuffer, // Send raw binary data
      });

      console.log(`[Upload Attempt ${attempt + 1}] Response status: ${response.status}`);

      if (!response.ok) {
        const responseText = await response.text();
        console.warn(`[Upload Attempt ${attempt + 1}] HTTP Error:`, {
          status: response.status,
          statusText: response.statusText,
          body: responseText.substring(0, 300),
        });

        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);

        // Don't retry on auth errors (403) or bucket not found (404)
        if (response.status === 403 || response.status === 404) {
          return { error: lastError, data: null };
        }

        // For other errors, retry
        if (attempt < maxRetries - 1) {
          const waitTime = Math.min(1000 * Math.pow(2, attempt), 5000);
          console.log(`[Upload] Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
      } else {
        const responseData = await response.json().catch(() => ({}));
        console.log(`[Upload] Success on attempt ${attempt + 1}:`, responseData);
        return { error: null, data: responseData };
      }
    } catch (err: any) {
      lastError = err;
      console.error(`[Upload Attempt ${attempt + 1}] Exception:`, {
        message: err.message,
        code: err.code,
        type: err.type,
      });

      if (attempt < maxRetries - 1) {
        const waitTime = Math.min(1000 * Math.pow(2, attempt), 5000);
        console.log(`[Upload] Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  return { error: lastError || new Error('Upload failed after all retries'), data: null };
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

/**
 * Diagnostic function to test Supabase connectivity
 * Helps identify network/CORS issues
 */
export async function testSupabaseConnectivity(): Promise<{
  configured: boolean;
  clientInitialized: boolean;
  urlAccessible: boolean;
  storageAccessible: boolean;
  errors: string[];
}> {
  const errors: string[] = [];

  // Check if configured
  if (!supabaseUrl || !supabaseAnonKey) {
    errors.push('Supabase URL or Anon Key not configured');
    return {
      configured: false,
      clientInitialized: false,
      urlAccessible: false,
      storageAccessible: false,
      errors,
    };
  }

  // Check if client is initialized
  const supabase = getSupabaseClient();
  if (!supabase) {
    errors.push('Supabase client failed to initialize');
    return {
      configured: true,
      clientInitialized: false,
      urlAccessible: false,
      storageAccessible: false,
      errors,
    };
  }

  // Test URL accessibility
  let urlAccessible = false;
  try {
    const response = await fetch(supabaseUrl, { method: 'HEAD' });
    urlAccessible = response.ok || response.status === 405; // 405 Method Not Allowed is fine for HEAD
    console.log('[Diagnostics] Supabase URL accessible:', urlAccessible, `(status: ${response.status})`);
  } catch (err: any) {
    errors.push(`Supabase URL not accessible: ${err.message}`);
    console.error('[Diagnostics] URL access error:', err.message);
  }

  // Test storage accessibility
  let storageAccessible = false;
  try {
    const testUrl = `${supabaseUrl}/storage/v1/object/`;
    const response = await fetch(testUrl, {
      method: 'HEAD',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
    });
    storageAccessible = response.ok || response.status === 405;
    console.log('[Diagnostics] Storage endpoint accessible:', storageAccessible, `(status: ${response.status})`);
  } catch (err: any) {
    errors.push(`Storage endpoint not accessible: ${err.message}`);
    console.error('[Diagnostics] Storage access error:', err.message);
  }

  return {
    configured: true,
    clientInitialized: true,
    urlAccessible,
    storageAccessible,
    errors,
  };
}

export function getSupabaseUrlForDiagnostics(): string {
  return supabaseUrl;
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
  get auth() {
    return requireSupabaseClient().auth;
  },
};
