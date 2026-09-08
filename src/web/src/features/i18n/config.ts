import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
  detectDefaultLocale,
  LOCALE_STORAGE_KEY,
  type Locale,
} from '../../shared/lib/constants';
import en from './locales/en.json';
import ru from './locales/ru.json';

function readStoredLocale(): Locale {
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (raw === 'ru' || raw === 'en') return raw;
  } catch {
    /* ignore */
  }
  return detectDefaultLocale();
}

const initialLocale = readStoredLocale();
document.documentElement.lang = initialLocale;

void i18n.use(initReactI18next).init({
  resources: {
    ru: { translation: ru },
    en: { translation: en },
  },
  lng: initialLocale,
  fallbackLng: 'ru',
  interpolation: { escapeValue: false },
});

export default i18n;

export function changeAppLocale(locale: Locale) {
  void i18n.changeLanguage(locale);
  document.documentElement.lang = locale;
  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}
