import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/components/ThemeProvider';
import { useSettingsStore } from '@/store/settingsStore';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface OnboardingSlide {
  titleKey: 'slide1Title' | 'slide2Title' | 'slide3Title';
  subtitleKey: 'slide1Subtitle' | 'slide2Subtitle' | 'slide3Subtitle';
  bodyKey: 'slide1Body' | 'slide2Body' | 'slide3Body';
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

const slides: OnboardingSlide[] = [
  {
    titleKey: 'slide1Title',
    subtitleKey: 'slide1Subtitle',
    bodyKey: 'slide1Body',
    icon: 'cube-outline',
    color: '#3b82f6',
  },
  {
    titleKey: 'slide2Title',
    subtitleKey: 'slide2Subtitle',
    bodyKey: 'slide2Body',
    icon: 'scan-outline',
    color: '#8b5cf6',
  },
  {
    titleKey: 'slide3Title',
    subtitleKey: 'slide3Subtitle',
    bodyKey: 'slide3Body',
    icon: 'people-outline',
    color: '#10b981',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { t, language, setLanguage } = useTranslation();
  const { palette, isDark } = useTheme();
  const setHasSeenOnboarding = useSettingsStore((state) => state.setHasSeenOnboarding);
  
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleFinish = () => {
    setHasSeenOnboarding(true);
    router.replace('/auth');
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / SCREEN_WIDTH);
    if (index >= 0 && index < slides.length) {
      setCurrentSlideIndex(index);
    }
  };

  const handleNext = () => {
    if (currentSlideIndex < slides.length - 1) {
      const nextIndex = currentSlideIndex + 1;
      scrollViewRef.current?.scrollTo({
        x: nextIndex * SCREEN_WIDTH,
        animated: true,
      });
      setCurrentSlideIndex(nextIndex);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (currentSlideIndex > 0) {
      const prevIndex = currentSlideIndex - 1;
      scrollViewRef.current?.scrollTo({
        x: prevIndex * SCREEN_WIDTH,
        animated: true,
      });
      setCurrentSlideIndex(prevIndex);
    }
  };

  const toggleLanguage = () => {
    const nextLang = language === 'en' ? 'fr' : language === 'fr' ? 'ar' : 'en';
    setLanguage(nextLang);
  };

  const isRTL = language === 'ar';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}>
      {/* Decorative premium gradient background blobs */}
      <View style={[styles.blob1, { backgroundColor: slides[currentSlideIndex].color + '15' }]} />
      <View style={[styles.blob2, { backgroundColor: slides[currentSlideIndex].color + '10' }]} />

      {/* Top Header Row */}
      <View style={styles.header}>
        {/* Language Toggler */}
        <TouchableOpacity
          style={[styles.headerButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}
          onPress={toggleLanguage}
          activeOpacity={0.7}
        >
          <Ionicons name="language-outline" size={16} color={palette.text} style={{ marginRight: 6 }} />
          <Text style={[styles.headerButtonText, { color: palette.text }]}>
            {language === 'en' ? 'EN' : language === 'fr' ? 'FR' : 'AR'}
          </Text>
        </TouchableOpacity>

        {/* Skip button (hide on last slide) */}
        {currentSlideIndex < slides.length - 1 && (
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}
            onPress={handleFinish}
            activeOpacity={0.7}
          >
            <Text style={[styles.headerButtonText, { color: palette.textSecondary }]}>
              {t('skip')}
            </Text>
            <Ionicons
              name={isRTL ? "chevron-back" : "chevron-forward"}
              size={14}
              color={palette.textSecondary}
              style={{ marginLeft: 4 }}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Horizontal Slides ScrollView */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
        contentContainerStyle={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}
      >
        {slides.map((slide, idx) => {
          const slideIconColor = slide.color;
          return (
            <View key={idx} style={styles.slideContainer}>
              {/* Glassmorphic Icon Container */}
              <View style={[styles.iconWrapper, { borderColor: slideIconColor + '30', backgroundColor: isDark ? '#1e293b80' : '#f8fafc80' }]}>
                <Ionicons name={slide.icon} size={72} color={slideIconColor} />
              </View>

              {/* Text Contents */}
              <View style={styles.textWrapper}>
                <Text style={[styles.subtitle, { color: slideIconColor }]}>
                  {t(slide.subtitleKey)}
                </Text>
                <Text style={[styles.title, { color: palette.text }]}>
                  {t(slide.titleKey)}
                </Text>
                <Text style={[styles.body, { color: palette.textSecondary }]}>
                  {t(slide.bodyKey)}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Bottom Actions Area */}
      <View style={styles.footer}>
        {/* Navigation Dot Indicators */}
        <View style={styles.indicatorContainer}>
          {slides.map((_, idx) => {
            const isSelected = idx === currentSlideIndex;
            return (
              <View
                key={idx}
                style={[
                  styles.indicatorDot,
                  {
                    backgroundColor: isSelected
                      ? slides[currentSlideIndex].color
                      : isDark
                      ? '#475569'
                      : '#cbd5e1',
                    width: isSelected ? 20 : 8,
                  },
                ]}
              />
            );
          })}
        </View>

        {/* Button Controls */}
        <View style={styles.buttonRow}>
          {/* Back Button (Only visible past slide 0) */}
          {currentSlideIndex > 0 ? (
            <TouchableOpacity
              style={[styles.controlBtn, styles.backBtn, { borderColor: palette.border }]}
              onPress={handleBack}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isRTL ? "arrow-forward" : "arrow-back"}
                size={20}
                color={palette.textSecondary}
              />
            </TouchableOpacity>
          ) : (
            <View style={[styles.controlBtn, styles.backBtnPlaceholder]} />
          )}

          {/* Primary Action Button ("Next" or "Finish") */}
          <TouchableOpacity
            style={[styles.controlBtn, styles.primaryBtn, { backgroundColor: slides[currentSlideIndex].color }]}
            onPress={handleNext}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryBtnText}>
              {currentSlideIndex === slides.length - 1 ? t('letsGo') : t('next')}
            </Text>
            {currentSlideIndex < slides.length - 1 && (
              <Ionicons
                name={isRTL ? "arrow-back" : "arrow-forward"}
                size={16}
                color="#fff"
                style={{ marginLeft: 6 }}
              />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  blob1: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    zIndex: 0,
  },
  blob2: {
    position: 'absolute',
    bottom: -150,
    left: -150,
    width: 400,
    height: 400,
    borderRadius: 200,
    zIndex: 0,
  },
  header: {
    height: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  headerButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  slideContainer: {
    width: SCREEN_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    zIndex: 2,
  },
  iconWrapper: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 3,
  },
  textWrapper: {
    alignItems: 'center',
    width: '100%',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  footer: {
    paddingBottom: 32,
    paddingHorizontal: 32,
    zIndex: 10,
  },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  indicatorDot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  controlBtn: {
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtn: {
    width: 52,
    borderWidth: 1,
  },
  backBtnPlaceholder: {
    width: 52,
  },
  primaryBtn: {
    flex: 1,
    marginLeft: 16,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
