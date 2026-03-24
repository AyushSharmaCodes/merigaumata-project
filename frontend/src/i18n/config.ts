import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

type TranslationModule = {
  default?: Record<string, unknown>;
};

const localeModules = import.meta.glob<TranslationModule>('./locales/*.json');
const loadedLanguages = new Set<string>();

const availableLanguages = Object.keys(localeModules)
  .map((path) => path.match(/\.\/locales\/([^.]+)\.json$/)?.[1])
  .filter((langCode): langCode is string => typeof langCode === 'string' && !langCode.endsWith('.bak'));

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  hi: 'हिन्दी',
  ta: 'தமிழ்',
  te: 'తెలుగు'
};

const getLocaleLoader = (langCode: string) => localeModules[`./locales/${langCode}.json`];

async function ensureLanguageLoaded(langCode: string) {
  if (!langCode || loadedLanguages.has(langCode)) {
    return;
  }

  const loader = getLocaleLoader(langCode);
  if (!loader) {
    return;
  }

  const module = await loader();
  const translation = module.default ?? {};
  i18n.addResourceBundle(langCode, 'translation', translation, true, true);
  loadedLanguages.add(langCode);
}

const requestedLanguage = localStorage.getItem('language') || 'en';
const initialLanguage = availableLanguages.includes(requestedLanguage) ? requestedLanguage : 'en';

const originalChangeLanguage = i18n.changeLanguage.bind(i18n);
i18n.changeLanguage = async (lang?: string, callback?: (err: Error | null, t: typeof i18n.t) => void) => {
  const targetLanguage = lang || initialLanguage;
  await ensureLanguageLoaded(targetLanguage);
  return originalChangeLanguage(targetLanguage, callback);
};

export const initI18n = (async () => {
  await i18n
    .use(initReactI18next)
    .init({
      resources: {},
      lng: initialLanguage,
      fallbackLng: 'en',
      supportedLngs: availableLanguages,
      interpolation: {
        escapeValue: false,
      },
    });

  await ensureLanguageLoaded('en');
  if (initialLanguage !== 'en') {
    await ensureLanguageLoaded(initialLanguage);
  }
})();

export default i18n;
export { availableLanguages, LANGUAGE_NAMES, ensureLanguageLoaded };
