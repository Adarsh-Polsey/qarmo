import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ml from './locales/ml.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ml: { translation: ml },
    },
    lng: 'en',
    fallbackLng: 'en',
    compatibilityJSON: 'v3', // Hermes doesn't support Intl.PluralRules
    interpolation: {
      escapeValue: false, // React already safe from XSS
    },
  });

export { i18n };
export { useTranslation, Trans } from 'react-i18next';
