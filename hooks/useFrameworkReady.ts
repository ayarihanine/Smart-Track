import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';

/**
 * useFrameworkReady
 * 
 * This hook is used in the root _layout.tsx to manage the application's 
 * initial loading state. It ensures that the splash screen remains visible 
 * until the framework and basic resources are ready.
 */

// Prevent the splash screen from auto-hiding before we're ready
SplashScreen.preventAutoHideAsync().catch(() => {
  /* Ignore errors during development reloads */
});

export function useFrameworkReady() {
  useEffect(() => {
    async function prepare() {
      try {
        // Pre-load any required resources here (fonts, assets, etc.)
        // This is where you would call Font.loadAsync if needed.
        
        // For now, we just ensure the splash screen is hidden
        await SplashScreen.hideAsync();
      } catch (e) {
        console.warn('Framework initialization warning:', e);
      }
    }

    prepare();
  }, []);
}
