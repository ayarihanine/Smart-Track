import { Stack, router } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { configureSupabaseAuthAutoRefresh } from '@/lib/supabase';
import { useSettingsStore } from '@/store/settingsStore';
import { ThemeProvider, useTheme } from '@/components/ThemeProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useNotifications } from '@/hooks/useNotifications';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 2, retry: 1 },
  },
});



function AuthListener() {
  const user = useAuthStore(state => state.user);
  const initializeAuth = useAuthStore(state => state.initialize);
  const loadSettings = useSettingsStore(state => state.loadSettings);
  const hasSeenOnboarding = useSettingsStore(state => state.hasSeenOnboarding);


  useEffect(() => {
    if (typeof loadSettings === 'function') {
      loadSettings();
    }
    if (typeof initializeAuth === 'function') {
      initializeAuth();
    }
  }, [loadSettings, initializeAuth]);

  useEffect(() => {
    return configureSupabaseAuthAutoRefresh();
  }, []);



  useEffect(() => {
    if (hasSeenOnboarding === false) {
      setTimeout(() => {
        router.replace('/onboarding');
      }, 0);
    }
  }, [hasSeenOnboarding]);

  return null;
}

function RootNavigator() {
  const { t } = useTranslation();
  const { palette } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: palette.background },
        headerTintColor: palette.text,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="auth" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="card/[id]"
        options={{
          headerShown: true,
          headerTitle: t('cardDetails'),
          headerStyle: { backgroundColor: palette.primary },
          headerTintColor: '#fff',
        }}
      />
      <Stack.Screen
        name="system-status"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="configuration/index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="articles/index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="export"
        options={{
          headerShown: true,
          headerTitle: t('exportData'),
          headerStyle: { backgroundColor: palette.primary },
          headerTintColor: '#fff',
        }}
      />
      <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen
        name="admin"
        options={{
          headerShown: true,
          headerTitle: 'Admin Panel',
          headerStyle: { backgroundColor: '#8B5CF6' },
          headerTintColor: '#fff',
        }}
      />

      <Stack.Screen
        name="issues"
        options={{
          headerShown: true,
          headerTitle: t('issuesAndTasks'),
          headerStyle: { backgroundColor: palette.primary },
          headerTintColor: '#fff',
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  useFrameworkReady();
  useNotifications();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthListener />
        <OfflineBanner />
        <RootNavigator />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
