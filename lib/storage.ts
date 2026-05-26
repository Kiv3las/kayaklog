import AsyncStorage from '@react-native-async-storage/async-storage';
import { Day, Settings } from './types';
import { todayISO, addDaysToISO } from './dates';

const DAYS_KEY = 'kayak_days_v4';
const SETTINGS_KEY = 'kayak_settings_v1';

function seedDays(): Day[] {
  const today = todayISO();
  return [
    {
      id: Date.now() - 6,
      date: today,
      notes: 'Gran día en el Maipo, aguas rápidas.',
      rivers: [{
        name: 'Río Maipo',
        country: 'CL',
        difficulty: 'III',
        laps: [{ km: 8, hours: 1, minutes: 30, stars: 4, note: 'Perfectas condiciones' }],
      }],
    },
    {
      id: Date.now() - 5,
      date: addDaysToISO(today, -1),
      notes: 'Entrenamiento corto.',
      rivers: [{
        name: 'Río Claro',
        country: 'CL',
        difficulty: 'II',
        laps: [{ km: 5, hours: 0, minutes: 55, stars: 3, note: '' }],
      }],
    },
    {
      id: Date.now() - 4,
      date: addDaysToISO(today, -2),
      notes: 'Exploración de nuevo tramo.',
      rivers: [{
        name: 'Río Biobío',
        country: 'CL',
        difficulty: 'IV',
        laps: [
          { km: 12, hours: 2, minutes: 15, stars: 5, note: 'Increíble!' },
          { km: 6, hours: 1, minutes: 0, stars: 4, note: 'Segunda vuelta' },
        ],
      }],
    },
    {
      id: Date.now() - 3,
      date: addDaysToISO(today, -5),
      notes: 'Salida con el grupo.',
      rivers: [{
        name: 'Río Fuy',
        country: 'CL',
        difficulty: 'IV',
        laps: [{ km: 10, hours: 1, minutes: 45, stars: 5, note: 'Clase IV puro' }],
      }],
    },
    {
      id: Date.now() - 2,
      date: addDaysToISO(today, -12),
      notes: 'Primer río en Argentina.',
      rivers: [{
        name: 'Río Ñirihuau',
        country: 'AR',
        difficulty: 'III',
        laps: [{ km: 15, hours: 2, minutes: 30, stars: 4, note: 'Patagonia hermosa' }],
      }],
    },
    {
      id: Date.now() - 1,
      date: addDaysToISO(today, -65),
      notes: 'Temporada anterior.',
      rivers: [{
        name: 'Río Trancura',
        country: 'CL',
        difficulty: 'III',
        laps: [{ km: 7, hours: 1, minutes: 20, stars: 4, note: '' }],
      }],
    },
    {
      id: Date.now(),
      date: addDaysToISO(today, -400),
      notes: 'Año pasado, inicio de temporada.',
      rivers: [{
        name: 'Río Maule',
        country: 'CL',
        difficulty: 'II',
        laps: [{ km: 20, hours: 3, minutes: 0, stars: 3, note: 'Aguas bajas' }],
      }],
    },
  ];
}

export async function loadDays(): Promise<Day[]> {
  try {
    const raw = await AsyncStorage.getItem(DAYS_KEY);
    if (!raw) {
      const seed = seedDays();
      await AsyncStorage.setItem(DAYS_KEY, JSON.stringify(seed));
      return seed;
    }
    return JSON.parse(raw) as Day[];
  } catch {
    return [];
  }
}

export async function saveDays(days: Day[]): Promise<void> {
  await AsyncStorage.setItem(DAYS_KEY, JSON.stringify(days));
}

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return { notifEnabled: false, notifTime: '21:00' };
    return JSON.parse(raw) as Settings;
  } catch {
    return { notifEnabled: false, notifTime: '21:00' };
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
