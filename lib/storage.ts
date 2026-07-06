import AsyncStorage from '@react-native-async-storage/async-storage';
import { Day, Settings } from './types';

function daysKey(userId: string) { return `kayak_days_v4_${userId}`; }
function settingsKey(userId: string) { return `kayak_settings_v1_${userId}`; }
function pendingKey(userId: string) { return `kayak_pending_v1_${userId}`; }
const LAST_USER_KEY = 'kayak_last_user_v1';

// Último usuario autenticado en este dispositivo. Permite ARRANCAR OFFLINE:
// cuando supabase-js se queda reintentando el refresh del token contra una
// red muerta, la app entra igual con la caché local de este usuario en vez
// de colgarse en el splash (el bug offline de la v1).
export interface LastUser { id: string; name?: string }

export async function saveLastUser(u: LastUser): Promise<void> {
  try { await AsyncStorage.setItem(LAST_USER_KEY, JSON.stringify(u)); } catch { /* best-effort */ }
}

export async function loadLastUser(): Promise<LastUser | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_USER_KEY);
    return raw ? (JSON.parse(raw) as LastUser) : null;
  } catch {
    return null;
  }
}

// Operaciones hechas offline que aún no llegan al servidor. Sin esta cola,
// el sync al reconectar pisaba con la versión remota los días editados o
// borrados sin conexión (solo sobrevivían los días NUEVOS).
export interface PendingOps {
  upserts: number[];       // ids de días creados/editados offline
  deletes: number[];       // ids de días borrados offline
  settingsDirty: boolean;  // settings cambiados offline
}

export const EMPTY_PENDING: PendingOps = { upserts: [], deletes: [], settingsDirty: false };

export async function loadPendingOps(userId: string): Promise<PendingOps> {
  try {
    const raw = await AsyncStorage.getItem(pendingKey(userId));
    if (!raw) return { ...EMPTY_PENDING };
    return { ...EMPTY_PENDING, ...(JSON.parse(raw) as Partial<PendingOps>) };
  } catch {
    return { ...EMPTY_PENDING };
  }
}

export async function savePendingOps(ops: PendingOps, userId: string): Promise<void> {
  await AsyncStorage.setItem(pendingKey(userId), JSON.stringify(ops));
}

export async function loadDays(userId: string): Promise<Day[]> {
  try {
    const raw = await AsyncStorage.getItem(daysKey(userId));
    if (!raw) return [];
    return JSON.parse(raw) as Day[];
  } catch {
    return [];
  }
}

export async function saveDays(days: Day[], userId: string): Promise<void> {
  await AsyncStorage.setItem(daysKey(userId), JSON.stringify(days));
}

export async function loadSettings(userId: string): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(settingsKey(userId));
    if (!raw) return { notifEnabled: false, notifTime: '21:00' };
    return JSON.parse(raw) as Settings;
  } catch {
    return { notifEnabled: false, notifTime: '21:00' };
  }
}

export async function saveSettings(settings: Settings, userId: string): Promise<void> {
  await AsyncStorage.setItem(settingsKey(userId), JSON.stringify(settings));
}

export async function clearUserData(userId: string): Promise<void> {
  await AsyncStorage.multiRemove([daysKey(userId), settingsKey(userId), pendingKey(userId), LAST_USER_KEY]);
}
