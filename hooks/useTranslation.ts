import { useSettingsStore } from '@/store/settingsStore';
import { translations, TranslationKey } from '@/translations';

export function useTranslation() {
    const language = useSettingsStore((state) => state.language);
    const setSettings = useSettingsStore((state) => state.setSettings);

    const t = (key: TranslationKey): string => {
        const currentLanguage = language || 'en';
        const langResStr = translations[currentLanguage];
        if (!langResStr) return translations.en[key] || key;
        return langResStr[key] || translations.en[key] || key;
    };

    const setLanguage = (lang: any) => {
        if (typeof setSettings === 'function') {
            setSettings({ language: lang });
        }
    };

    return { t, language, setLanguage };
}
