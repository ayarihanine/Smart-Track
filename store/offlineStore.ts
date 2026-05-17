import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as api from '@/lib/api';

interface PendingScan {
    cardId: string;
    location: string;
    stage: string;
    timestamp: number;
}

interface OfflineStore {
    isOnline: boolean;
    isSyncing: boolean;
    pendingScans: PendingScan[];
    setOnline: (online: boolean) => void;
    addPendingScan: (scan: Omit<PendingScan, 'timestamp'>) => void;
    syncPending: () => Promise<void>;
    clearQueue: () => void;
}

export const useOfflineStore = create<OfflineStore>()(
    persist(
        (set, get) => ({
            isOnline: true,
            isSyncing: false,
            pendingScans: [],
            setOnline: (online) => set({ isOnline: online }),
            addPendingScan: (scan) => set((state) => ({
                pendingScans: [...state.pendingScans, { ...scan, timestamp: Date.now() }]
            })),
            syncPending: async () => {
                const { pendingScans, isSyncing } = get();
                if (isSyncing || pendingScans.length === 0) return;

                set({ isSyncing: true });
                const remaining = [...pendingScans];
                let successCount = 0;
                
                for (const scan of pendingScans) {
                    try {
                        await api.recordScan({
                            cardId: scan.cardId,
                            location: scan.location,
                            stage: scan.stage,
                        });
                        // Remove from the list if successful
                        const idx = remaining.indexOf(scan);
                        if (idx > -1) remaining.splice(idx, 1);
                        successCount++;
                        set({ pendingScans: [...remaining] });
                    } catch (err: any) {
                        console.error('Failed to sync scan:', err);
                        
                        // If it's a definitive failure (like card not found), discard it so it doesn't block the queue
                        if (err.code === 'CARD_NOT_FOUND' || err.code === 'PGRST116' || err.message?.includes('Card not found')) {
                            const idx = remaining.indexOf(scan);
                            if (idx > -1) remaining.splice(idx, 1);
                            set({ pendingScans: [...remaining] });
                            continue;
                        }
                        
                        // Otherwise, assume it's a network error and stop syncing for now
                        break;
                    }
                }
                set({ isSyncing: false });

                if (successCount > 0) {
                    try {
                        const Notifications = require('expo-notifications');
                        await Notifications.scheduleNotificationAsync({
                            content: {
                                title: 'Sync Complete',
                                body: `Successfully synced ${successCount} pending scans.`,
                            },
                            trigger: null,
                        });
                    } catch (e) {
                        console.warn('Failed to schedule notification', e);
                    }
                }
            },
            clearQueue: () => set({ pendingScans: [] }),
        }),
        {
            name: 'offline-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({ pendingScans: state.pendingScans }),
        }
    )
);
