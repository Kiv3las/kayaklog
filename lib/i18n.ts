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
