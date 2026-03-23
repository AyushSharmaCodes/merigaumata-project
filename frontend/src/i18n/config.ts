import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

/**
 * Auto-detect and load all locale files from ./locales/*.json
 * This makes the i18n system truly language-agnostic:
 * - Adding a new language requires only creating a new .json file
 * - No code changes needed
 * - Supports any number of languages
 */
const localeModules = import.meta.glob('./locales/*.json', { eager: true });

// Build resources object dynamically
const resources: Record<string, { translation: any }> = {};
const availableLanguages: string[] = [];

Object.entries(localeModules).forEach(([path, module]) => {
  // Extract language code from path: './locales/en.json' -> 'en'
  const match = path.match(/\.\/locales\/([^.]+)\.json$/);
  if (match) {
    const langCode = match[1];
    // Skip backup files
    if (!langCode.endsWith('.bak')) {
      resources[langCode] = { translation: (module as any).default || module };
      availableLanguages.push(langCode);
    }
  }
});

// Validate that we have at least English as fallback
if (!resources.en) {
  const error = new Error('[i18n] Critical: en.json not found. i18n will not work correctly.');
  console.error(error);
  if (import.meta.env.DEV) {
    throw error;
  }
}

if (import.meta.env.DEV) {
  console.log(`[i18n] Auto-detected languages: ${availableLanguages.join(', ')}`);
}


i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: localStorage.getItem('language') || 'en',
    fallbackLng: 'en',
    supportedLngs: availableLanguages,
    interpolation: {
      escapeValue: false,
    },
    // Enable ICU message format for pluralization, gender, etc.
    // Uncomment when needed:
    // interpolation: {
    //   escapeValue: false,
    //   format: (value, format, lng) => {
    //     if (format === 'uppercase') return value.toUpperCase();
    //     if (format === 'lowercase') return value.toLowerCase();
    //     if (value instanceof Date) return new Intl.DateTimeFormat(lng).format(value);
    //     return value;
    //   }
    // }
  });

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  hi: 'हिन्दी',
  ta: 'தமிழ்',
  te: 'తెలుగు'
};

export default i18n;
export { availableLanguages, LANGUAGE_NAMES };
