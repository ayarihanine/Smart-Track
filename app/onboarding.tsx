import React, { useRef, useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Dimensions,
    Animated, FlatList, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSettingsStore } from '@/store/settingsStore';
import { colors, spacing, typography, borderRadius } from '@/constants/design';
import { useTranslation } from '@/hooks/useTranslation';

const { width } = Dimensions.get('window');

export default function OnboardingScreen() {
    const { t } = useTranslation();
    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);
    const scrollX = useRef(new Animated.Value(0)).current;
    const setHasSeenOnboarding = useSettingsStore(s => s.setHasSeenOnboarding);

    const SLIDES = [
        {
            id: '1',
            icon: 'radio-outline' as const,
            iconBg: '#DBEAFE',
            iconColor: '#2563EB',
            accentColor: '#2563EB',
            title: t('slide1Title'),
            subtitle: t('slide1Subtitle'),
            body: t('slide1Body'),
        },
        {
            id: '2',
            icon: 'scan-outline' as const,
            iconBg: '#D1FAE5',
            iconColor: '#10B981',
            accentColor: '#10B981',
            title: t('slide2Title'),
            subtitle: t('slide2Subtitle'),
            body: t('slide2Body'),
        },
        {
            id: '3',
            icon: 'shield-checkmark-outline' as const,
            iconBg: '#EDE9FE',
            iconColor: '#8B5CF6',
            accentColor: '#8B5CF6',
            title: t('slide3Title'),
            subtitle: t('slide3Subtitle'),
            body: t('slide3Body'),
        },
    ];

    function handleNext() {
        if (currentIndex < SLIDES.length - 1) {
            flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
            setCurrentIndex(currentIndex + 1);
        } else {
            handleFinish();
        }
    }

    function handleFinish() {
        setHasSeenOnboarding(true);
        router.replace('/(tabs)');
    }

    function handleSkip() {
        setHasSeenOnboarding(true);
        router.replace('/(tabs)');
    }

    const slide = SLIDES[currentIndex];

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            {/* Skip */}
            <SafeAreaView style={styles.topBar} edges={['top']}>
                <TouchableOpacity onPress={handleSkip} style={styles.skipBtn}>
                    <Text style={styles.skipText}>{t('skip')}</Text>
                </TouchableOpacity>
            </SafeAreaView>

            {/* Slides */}
            <Animated.FlatList
                ref={flatListRef as any}
                data={SLIDES}
                keyExtractor={item => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                scrollEnabled={true}
                onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
                onMomentumScrollEnd={(e) => {
                    const index = Math.round(e.nativeEvent.contentOffset.x / width);
                    setCurrentIndex(index);
                }}
                renderItem={({ item }) => (
                    <View style={styles.slide}>
                        {/* Big Icon */}
                        <View style={[styles.iconCircle, { backgroundColor: item.iconBg }]}>
                            <Ionicons name={item.icon} size={80} color={item.iconColor} />
                        </View>

                        {/* Accent line */}
                        <View style={[styles.accentLine, { backgroundColor: item.accentColor }]} />

                        <Text style={styles.subtitle}>{item.subtitle}</Text>
                        <Text style={styles.title}>{item.title}</Text>
                        <Text style={styles.body}>{item.body}</Text>
                    </View>
                )}
            />

            {/* Dots */}
            <View style={styles.dotsRow}>
                {SLIDES.map((s, i) => {
                    const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
                    const dotWidth = scrollX.interpolate({ inputRange, outputRange: [8, 24, 8], extrapolate: 'clamp' });
                    const opacity = scrollX.interpolate({ inputRange, outputRange: [0.3, 1, 0.3], extrapolate: 'clamp' });
                    return (
                        <Animated.View
                            key={s.id}
                            style={[styles.dot, { width: dotWidth, opacity, backgroundColor: slide.accentColor }]}
                        />
                    );
                })}
            </View>

            {/* CTA */}
            <SafeAreaView edges={['bottom']} style={styles.bottomArea}>
                <TouchableOpacity
                    style={[styles.nextBtn, { backgroundColor: slide.accentColor }]}
                    onPress={handleNext}
                    activeOpacity={0.85}
                >
                    <Text style={styles.nextBtnText}>
                        {currentIndex === SLIDES.length - 1 ? t('letsGo') : t('next')}
                    </Text>
                    <Ionicons
                        name={currentIndex === SLIDES.length - 1 ? 'checkmark' : 'arrow-forward'}
                        size={20}
                        color={colors.white}
                    />
                </TouchableOpacity>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.white },
    topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: spacing.lg },
    skipBtn: { padding: spacing.md },
    skipText: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
    slide: {
        width,
        paddingHorizontal: spacing.xl,
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: spacing.xxl,
        flex: 1,
    },
    iconCircle: {
        width: 160,
        height: 160,
        borderRadius: 80,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.xl,
    },
    accentLine: {
        width: 40,
        height: 4,
        borderRadius: 2,
        marginBottom: spacing.md,
    },
    subtitle: {
        ...typography.small,
        fontWeight: '700',
        color: colors.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: spacing.sm,
        textAlign: 'center',
    },
    title: {
        ...typography.h1,
        color: colors.text,
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    body: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 26,
        maxWidth: 320,
    },
    dotsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.xs,
        paddingBottom: spacing.lg,
    },
    dot: {
        height: 8,
        borderRadius: 4,
    },
    bottomArea: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
    nextBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        height: 56,
        borderRadius: borderRadius.xl,
    },
    nextBtnText: { ...typography.bodyBold, color: colors.white },
});
