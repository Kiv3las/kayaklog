import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Day, Settings } from './types';
import { loadDays, saveDays, loadSettings, saveSettings } from './storage';
import { refreshNotificationSchedule } from './notifications';

interface AppContextValue {
  days: Day[];
  settings: Settings;
  addDay: (day: Day) => Promise<void>;
  updateDay: (day: Day) => Promise<void>;
  deleteDay: (id: number) => Promise<void>;
  updateSettings: (settings: Settings) => Promise<void>;
  isLoading: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [days, setDays] = useState<Day[]>([]);
  const [settings, setSettings] = useState<Settings>({ notifEnabled: false, notifTime: '21:00' });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const [loadedDays, loadedSettings] = await Promise.all([loadDays(), loadSettings()]);
      const sorted = [...loadedDays].sort((a, b) => b.date.localeCompare(a.date));
      setDays(sorted);
      setSettings(loadedSettings);
      setIsLoading(false);
    }
    init();
  }, []);

  const addDay = useCallback(async (day: Day) => {
    setDays((prev) => {
      const next = [day, ...prev].sort((a, b) => b.date.localeCompare(a.date));
      saveDays(next);
      return next;
    });
  }, []);

  const updateDay = useCallback(async (day: Day) => {
    setDays((prev) => {
      const next = prev.map((d) => (d.id === day.id ? day : d)).sort((a, b) => b.date.localeCompare(a.date));
      saveDays(next);
      return next;
    });
  }, []);

  const deleteDay = useCallback(async (id: number) => {
    setDays((prev) => {
      const next = prev.filter((d) => d.id !== id);
      saveDays(next);
      refreshNotificationSchedule(settings, next);
      return next;
    });
  }, [settings]);

  const updateSettings = useCallback(async (newSettings: Settings) => {
    setSettings(newSettings);
    await saveSettings(newSettings);
    await refreshNotificationSchedule(newSettings, days);
  }, [days]);

  return (
    <AppContext.Provider value={{ days, settings, addDay, updateDay, deleteDay, updateSettings, isLoading }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
