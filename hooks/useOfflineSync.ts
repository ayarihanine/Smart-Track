import { useEffect, useState } from 'react';
import { useOfflineStore } from '@/store/offlineStore';

export function useOfflineSync() {
  const { isOnline, setOnline, pendingScans, isSyncing, syncPending } = useOfflineStore();

  useEffect(() => {
    // Simple connectivity check
    const checkConnection = async () => {
      try {
        const response = await fetch('https://google.com', { method: 'HEAD', mode: 'no-cors' });
        setOnline(true);
      } catch (err) {
        setOnline(false);
      }
    };

    const interval = setInterval(checkConnection, 10000); // Check every 10s
    checkConnection();

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isOnline && pendingScans.length > 0 && !isSyncing) {
        syncPending();
    }
  }, [isOnline, pendingScans]);

  return { isOnline, syncing: isSyncing, queueSize: pendingScans.length };
}
