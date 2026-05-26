import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { Day, Settings } from './types';
import { loadDays, saveDays, loadSettings, saveSettings } from './storage';
import { refreshNotificationSchedule } from './notifications';
import { supabase } from './supabase';
import {
  fetchDaysFromSupabase,
  fetchSettings,
  upsertDay,
  deleteDay as remoteDeleteDay,
  upsertSettings,
  pushAllDays,
} from './sync';

interface AppContextValue {
  days: Day[];
  settings: Settings;
  user: User | null;
  isLoading: boolean;
  isSyncing: boolean;
  addDay: (day: Day) => Promise<void>;
  updateDay: (day: Day) => Promise<void>;
  deleteDay: (id: number) => Promise<void>;
  updateSettings: (settings: Settings) => Promise<void>;
  signOut: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [days, setDays] = useState<Day[]>([]);
  const [settings, setSettings] = useState<Settings>({ notifEnabled: false, notifTime: '21:00' });
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const loadUserData = useCallback(async (userId: string) => {
    setIsLoading(true);

    // 1. Load local cache immediately for snappy UX
    const [localDays, localSettings] = await Promise.all([
      loadDays(userId),
      loadSettings(userId),
    ]);
    setDays([...localDays].sort((a, b) => b.date.localeCompare(a.date)));
    setSettings(localSettings);
    setIsLoading(false);

    // 2. Background sync from Supabase (source of truth)
    setIsSyncing(true);
    try {
      const [remoteDays, remoteSettings] = await Promise.all([
        fetchDaysFromSupabase(),
        fetchSettings(),
      ]);

      // If remote has data → use it; if empty and local has seed → push seed up
      if (remoteDays.length > 0) {
        const sorted = [...remoteDays].sort((a, b) => b.date.localeCompare(a.date));
        setDays(sorted);
        await saveDays(sorted, userId);
      } else if (localDays.length > 0) {
        // First login: push local seed data to Supabase
        await pushAllDays(localDays, userId);
      }

      if (remoteSettings) {
        setSettings(remoteSettings);
        await saveSettings(remoteSettings, userId);
      }
    } catch {
      // Offline — local cache is fine
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        await loadUserData(currentUser.id);
      } else {
        setDays([]);
        setSettings({ notifEnabled: false, notifTime: '21:00' });
        setIsLoading(false);
      }
    });

    // Check existing session on mount
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        await loadUserData(currentUser.id);
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadUserData]);

  const addDay = useCallback(async (day: Day) => {
    const userId = user?.id ?? 'local';
    setDays((prev) => {
      const next = [...prev, day].sort((a, b) => b.date.localeCompare(a.date));
      void saveDays(next, userId);
      return next;
    });
    if (user) void upsertDay(day, user.id);
  }, [user]);

  const updateDay = useCallback(async (day: Day) => {
    const userId = user?.id ?? 'local';
    setDays((prev) => {
      const next = prev
        .map((d) => (d.id === day.id ? day : d))
        .sort((a, b) => b.date.localeCompare(a.date));
      void saveDays(next, userId);
      return next;
    });
    if (user) void upsertDay(day, user.id);
  }, [user]);

  const deleteDay = useCallback(async (id: number) => {
    const userId = user?.id ?? 'local';
    setDays((prev) => {
      const next = prev.filter((d) => d.id !== id);
      void saveDays(next, userId);
      void refreshNotificationSchedule(settings, next);
      return next;
    });
    if (user) void remoteDeleteDay(id);
  }, [user, settings]);

  const updateSettings = useCallback(async (newSettings: Settings) => {
    const userId = user?.id ?? 'local';
    setSettings(newSettings);
    await saveSettings(newSettings, userId);
    await refreshNotificationSchedule(newSettings, days);
    if (user) void upsertSettings(newSettings, user.id);
  }, [user, days]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AppContext.Provider value={{
      days, settings, user, isLoading, isSyncing,
      addDay, updateDay, deleteDay, updateSettings, signOut,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
