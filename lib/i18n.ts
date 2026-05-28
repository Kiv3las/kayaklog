import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import es from './locales/es';
import en from './locales/en';

const LANG_KEY = 'kayak_language_v1';

export type AppLanguage = 'auto' | 'es' | 'en';

// Synchronous init with Spanish as safe default — language is updated
// before first render via initLanguage() in _layout.tsx.
//
// escapeValue: false is safe here because the only render target is React
// Native, which never parses interpolated strings as HTML. If this app is
// ever deployed via `expo start --web` to a multi-user web environment,
// flip this to true (and audit each t() call that intentionally embeds
// markup) to prevent XSS from user-controlled values like river names.
i18n.use(initReactI18next).init({
  resources: {
    es: { translation: es },
    en: { translation: en },
  },
  lng: 'es',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v4',
});

export function getDeviceLanguage(): 'es' | 'en' {
  const code = getLocales()[0]?.languageCode ?? 'en';
  return code.startsWith('es') ? 'es' : 'en';
}

export async function loadSavedLanguage(): Promise<AppLanguage> {
  try {
    const val = await AsyncStorage.getItem(LANG_KEY);
    if (val === 'es' || val === 'en' || val === 'auto') return val;
  } catch {}
  return 'auto';
}

export async function saveLanguage(lang: AppLanguage): Promise<void> {
  await AsyncStorage.setItem(LANG_KEY, lang);
}

export function resolveLanguage(pref: AppLanguage): 'es' | 'en' {
  if (pref === 'auto') return getDeviceLanguage();
  return pref;
}

export async function initLanguage(): Promise<AppLanguage> {
  const pref = await loadSavedLanguage();
  await i18n.changeLanguage(resolveLanguage(pref));
  return pref;
}

export async function changeAppLanguage(pref: AppLanguage): Promise<void> {
  await saveLanguage(pref);
  await i18n.changeLanguage(resolveLanguage(pref));
}

export default i18n;
