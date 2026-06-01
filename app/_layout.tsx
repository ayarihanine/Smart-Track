import { Stack, useRouter } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { configureSupabaseAuthAutoRefresh, getSupabaseClient } from '@/lib/supabase';
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
  
  useEffect(() => {
    if (typeof loadSettings === 'function') loadSettings();
    if (typeof initializeAuth === 'function') initializeAuth();
  }, [loadSettings, initializeAuth]);

  useEffect(() => configureSupabaseAuthAutoRefresh(), []);

  useEffect(() => {
    if (user?.id) {
      const loadUserDbSettings = async () => {
        try {
          const supabase = getSupabaseClient();
          if (supabase) {
            const { data: userSettings } = await supabase
              .from('user_settings')
              .select('stuck_card_threshold_hours')
              .eq('user_id', user.id)
              .maybeSingle();

            if (userSettings?.stuck_card_threshold_hours !== undefined) {
              useSettingsStore.setState({
                stuckCardThresholdHours: userSettings.stuck_card_threshold_hours,
              });
            }
          }
        } catch (err) {
          console.error('Failed to load stuck card threshold:', err);
        }
      };
      loadUserDbSettings();
    }
  }, [user?.id]);

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
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="auth" />
      <Stack.Screen name="(tabs)" />
      
      <Stack.Screen name="card/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="configuration/index" options={{ headerShown: false }} />
      <Stack.Screen name="articles/index" options={{ headerShown: false }} />
      
      <Stack.Screen
        name="export"
        options={{
          headerShown: true,
          headerTitle: t('exportData'),
          headerStyle: { backgroundColor: palette.primary },
          headerTintColor: '#fff',
        }}
      />
      
      <Stack.Screen
        name="stuck-cards"
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      
      <Stack.Screen
        name="notifications"
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
      
      {/* Admin Routes - with i18n + theme colors */}
      <Stack.Screen
        name="admin"
        options={{
          headerShown: true,
          headerTitle: t('adminPanel'), // ✅ Fixed
          headerStyle: { backgroundColor: palette.primary }, // ✅ Theme-consistent
          headerTintColor: '#fff',
        }}
      />
      <Stack.Screen
        name="admin/settings"
        options={{
          headerShown: true,
          headerTitle: t('adminSettings'), // ✅ Fixed
          headerStyle: { backgroundColor: palette.primary },
          headerTintColor: '#fff',
        }}
      />
      <Stack.Screen
        name="admin/users"
        options={{
          headerShown: true,
          headerTitle: t('userManagement'), // ✅ Fixed
          headerStyle: { backgroundColor: palette.primary },
          headerTintColor: '#fff',
        }}
      />
      <Stack.Screen
        name="issues"
        options={{
          headerShown: false,
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