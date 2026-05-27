import AsyncStorage from '@react-native-async-storage/async-storage';
import { Day, Settings } from './types';

function daysKey(userId: string) { return `kayak_days_v4_${userId}`; }
function settingsKey(userId: string) { return `kayak_settings_v1_${userId}`; }

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
  await AsyncStorage.multiRemove([daysKey(userId), settingsKey(userId)]);
}
