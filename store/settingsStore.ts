import { create } from 'zustand';
import { AppSettings } from '@/types';
import { getSettings as fetchSettings, saveSettings } from '@/lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ExtraState {
    hasSeenOnboarding: boolean;
    stuckCardThresholdHours: number;
    isLoaded: boolean;
    setHasSeenOnboarding: (v: boolean) => Promise<void>;
    setStuckCardThreshold: (hours: number) => Promise<void>;
    resetOnboarding: () => Promise<void>;
}

interface SettingsState extends Omit<AppSettings, 'stuckCardThresholdHours'>, ExtraState {
    setSettings: (settings: Partial<AppSettings>) => Promise<void>;
    loadSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
    // Default AppSettings
    webhookUrl: '',
    n8nUrl: 'http://localhost:5678/mcp-server/http',
    n8nToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1Zjg5Y2RhNC1lOTA1LTQ0OTUtYWNlOC1hMWUzOWY5NDY5YTIiLCJpc3MiOiJuOG4iLCJhdWQiOiJtY3Atc2VydmVyLWFwaSIsImp0aSI6ImI4ZTE1MjA3LTkyODUtNDdkMC04NjJlLTQ1OTcyMzMzYzg2NSIsImlhdCI6MTc3ODU5NDAxMn0.8a7Igdi60i3hnQ3HWBKoq7ZvpcZTRejwbCex4XXG9rg',
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
    stuckCardThresholdHours: 10, // Treated as minutes (max 10) throughout the app
    isLoaded: false,

    setHasSeenOnboarding: async (v: boolean) => {
        set({ hasSeenOnboarding: v });
        try {
            await AsyncStorage.setItem('smarttrack_has_seen_onboarding', JSON.stringify(v));
        } catch (err) {
            console.error('Failed to save onboarding state:', err);
        }
    },
    resetOnboarding: async () => {
        set({ hasSeenOnboarding: false });
        try {
            await AsyncStorage.setItem('smarttrack_has_seen_onboarding', JSON.stringify(false));
        } catch (err) {
            console.error('Failed to reset onboarding state:', err);
        }
    },
    setStuckCardThreshold: async (hours: number) => {
        set({ stuckCardThresholdHours: hours });
        await saveSettings({ stuckCardThresholdHours: hours });
    },

    setSettings: async (updates) => {
        const currentSettings = get();
        const newSettings = { ...currentSettings, ...updates };
        set(updates);
        await saveSettings(newSettings as AppSettings);
    },

    loadSettings: async () => {
        try {
            const settings = await fetchSettings();
            if (settings) {
                set(settings);
            }
            // Reset onboarding state on application startup to ensure onboarding always appears on launch
            await AsyncStorage.setItem('smarttrack_has_seen_onboarding', JSON.stringify(false));
            set({ hasSeenOnboarding: false });
        } catch (err) {
            console.error('Failed to load settings:', err);
        } finally {
            set({ isLoaded: true });
        }
    },
}));
