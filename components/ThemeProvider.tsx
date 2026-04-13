import React, { createContext, useContext, useEffect, useRef, ReactNode } from 'react';
import { useColorScheme, Animated } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSettingsStore } from '@/store/settingsStore';
import { getPalette, ThemePalette, colors } from '@/constants/design';

interface ThemeContextType {
    palette: ThemePalette;
    isDark: boolean;
    theme: 'light' | 'dark';
    setTheme: (theme: 'light' | 'dark' | 'auto') => void;
}

const ThemeContext = createContext<ThemeContextType>({
    palette: colors.light as ThemePalette,
    isDark: false,
    theme: 'light',
    setTheme: () => { },
});

export function ThemeProvider({ children }: { children: ReactNode }) {
    const systemScheme = useColorScheme();
    const themeSetting = useSettingsStore((state) => state.theme);
    const setSettings = useSettingsStore((state) => state.setSettings);

    const isDark = themeSetting === 'auto'
        ? systemScheme === 'dark'
        : themeSetting === 'dark';

    const palette: ThemePalette = getPalette(isDark);

    const setTheme = (t: 'light' | 'dark' | 'auto') => {
        setSettings({ theme: t });
    };

    // Animate a fade on theme change
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const prevIsDark = useRef(isDark);

    useEffect(() => {
        if (prevIsDark.current === isDark) return;
        prevIsDark.current = isDark;

        // Quick fade out → in creates a smooth transition
        Animated.sequence([
            Animated.timing(fadeAnim, { toValue: 0.85, duration: 120, useNativeDriver: true }),
            Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        ]).start();
    }, [fadeAnim, isDark]);

    return (
        <ThemeContext.Provider value={{
            palette,
            isDark,
            theme: isDark ? 'dark' : 'light',
            setTheme,
        }}>
            <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor="transparent" translucent />
            <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
                {children}
            </Animated.View>
        </ThemeContext.Provider>
    );
}

export const useTheme = () => useContext(ThemeContext);
