import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import kn from './kn.json';
import ta from './ta.json';

const resources = {
  en: { translation: en },
  kn: { translation: kn },
  ta: { translation: ta },
};

const fallbackLanguage = 'en';
const preferredLanguage = import.meta.env.VITE_DEFAULT_LANGUAGE || fallbackLanguage;
const browserLanguage = typeof navigator !== 'undefined' ? navigator.language?.slice(0, 2).toLowerCase() : fallbackLanguage;
const storedLanguage = typeof window !== 'undefined' ? localStorage.getItem('soulvest_language') : null;
const initialLanguage = [storedLanguage, preferredLanguage, browserLanguage, fallbackLanguage].find((language) => resources[language]) || fallbackLanguage;

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources,
    lng: initialLanguage,
    fallbackLng: fallbackLanguage,
    interpolation: {
      escapeValue: false,
    },
  });

  if (typeof window !== 'undefined') {
    i18n.on('languageChanged', (language) => {
      localStorage.setItem('soulvest_language', language);
    });
  }
}

export default i18n;