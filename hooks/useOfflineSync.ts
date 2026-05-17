import { useEffect } from 'react';
import { useOfflineStore } from '@/store/offlineStore';
import { getSupabaseClient } from '@/lib/supabase';

export function useOfflineSync() {
  const { isOnline, setOnline, pendingScans, isSyncing, syncPending } = useOfflineStore();

  useEffect(() => {
    const checkConnection = async () => {
      try {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
           setOnline(false);
           return;
        }
        
        const supabase = getSupabaseClient();
        if (supabase) {
           // A lightweight ping to our own database
           const { error } = await supabase.from('system_nodes').select('id').limit(1);
           if (error && error.message === 'Failed to fetch') {
              setOnline(false);
           } else {
              setOnline(true);
           }
        } else {
           setOnline(true);
        }
      } catch (err) {
        setOnline(false);
      }
    };

    const interval = setInterval(checkConnection, 10000); // Check every 10s
    checkConnection();

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      const handleOnline = () => checkConnection();
      const handleOffline = () => setOnline(false);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
        clearInterval(interval);
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isOnline && pendingScans.length > 0 && !isSyncing) {
        syncPending();
    }
  }, [isOnline, pendingScans, isSyncing, syncPending]);

  return { isOnline, syncing: isSyncing, queueSize: pendingScans.length };
}
