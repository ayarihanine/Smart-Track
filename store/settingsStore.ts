import { create } from 'zustand';
import { AppSettings } from '@/types';
import { getSettings as fetchSettings, saveSettings as persistSettings } from '@/lib/api';

interface ExtraState {
    hasSeenOnboarding: boolean;
    stuckCardThresholdHours: number;
    setHasSeenOnboarding: (v: boolean) => void;
    setStuckCardThreshold: (hours: number) => Promise<void>;
}

interface SettingsState extends AppSettings, ExtraState {
    setSettings: (settings: Partial<AppSettings>) => Promise<void>;
    loadSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
    // Default AppSettings
    webhookUrl: '',
    n8nUrl: '',
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
    notificationsEnabled: true,
    vibrationEnabled: true,
    offlineModeEnabled: true,
    autoSyncInterval: 30,
    theme: 'light',
    language: 'en',
    dashboardWidgets: [
        { id: 'metrics', visible: true, order: 0 },
        { id: 'completion', visible: true, order: 1 },
        { id: 'breakdown', visible: true, order: 2 },
        { id: 'heatmap', visible: true, order: 3 },
        { id: 'cycle', visible: true, order: 4 },
        { id: 'insight', visible: true, order: 5 },
    ],

    // Extra State
    hasSeenOnboarding: false,
    stuckCardThresholdHours: 4,

    setHasSeenOnboarding: (v: boolean) => set({ hasSeenOnboarding: v }),
    setStuckCardThreshold: async (hours: number) => {
        set({ stuckCardThresholdHours: hours });
    },

    setSettings: async (updates) => {
        const currentSettings = get();
        const newSettings = { ...currentSettings, ...updates };
        set(updates);
        await persistSettings(newSettings as AppSettings);
    },

    loadSettings: async () => {
        try {
            const settings = await fetchSettings();
            if (settings) {
                set(settings);
            }
        } catch (err) {
            console.error('Failed to load settings:', err);
        }
    },
}));
