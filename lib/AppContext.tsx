import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { Day, Settings } from './types';
import { loadDays, saveDays, loadSettings, saveSettings, clearUserData } from './storage';
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
  displayName: string;
  isLoading: boolean;
  isSyncing: boolean;
  addDay: (day: Day) => Promise<void>;
  updateDay: (day: Day) => Promise<void>;
  deleteDay: (id: number) => Promise<void>;
  updateSettings: (settings: Settings) => Promise<void>;
  updateName: (name: string) => Promise<boolean>;
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
        fetchDaysFromSupabase(userId),
        fetchSettings(userId),
      ]);

      // Merge instead of overwriting: any day in the local cache whose id is
      // NOT in the remote set was added/edited while offline and never made
      // it to the server. Overwriting would silently lose those rows. Keep
      // them and push them up now that we're online again.
      if (remoteDays.length > 0) {
        const remoteIds = new Set(remoteDays.map((d) => d.id));
        const pendingLocal = localDays.filter((d) => !remoteIds.has(d.id));
        const merged = [...remoteDays, ...pendingLocal]
          .sort((a, b) => b.date.localeCompare(a.date));
        setDays(merged);
        await saveDays(merged, userId);
        if (pendingLocal.length > 0) {
          await pushAllDays(pendingLocal, userId);
        }
      } else if (localDays.length > 0) {
        // First login or empty remote: push the whole local cache up.
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
    let mounted = true;

    // Listen for auth state changes (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED,
    // INITIAL_SESSION). supabase-js v2 fires INITIAL_SESSION on subscribe
    // with the cached session, so this also handles app bootstrap.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        await loadUserData(currentUser.id);
        if (event === 'INITIAL_SESSION') {
          // Validate the cached JWT against the server in the background.
          // Only sign out on definitive auth rejection (401/403). Network
          // errors are ignored so the user stays signed in offline.
          supabase.auth.getUser().then(({ error }) => {
            if (!mounted) return;
            if (error?.status === 401 || error?.status === 403) {
              supabase.auth.signOut();
            }
          });
        }
      } else {
        setDays([]);
        setSettings({ notifEnabled: false, notifTime: '21:00' });
        setIsLoading(false);
      }
    });

    return () => { mounted = false; subscription.unsubscribe(); };
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
    if (user) void remoteDeleteDay(id, user.id);
  }, [user, settings]);

  const updateSettings = useCallback(async (newSettings: Settings) => {
    const userId = user?.id ?? 'local';
    setSettings(newSettings);
    await saveSettings(newSettings, userId);
    await refreshNotificationSchedule(newSettings, days);
    if (user) void upsertSettings(newSettings, user.id);
  }, [user, days]);

  const updateName = useCallback(async (name: string): Promise<boolean> => {
    const { data, error } = await supabase.auth.updateUser({ data: { name } });
    if (error) return false;
    if (data.user) setUser(data.user);
    return true;
  }, []);

  const signOut = useCallback(async () => {
    // Capture the current user id before signOut wipes the session, so we
    // can purge their local cache files. Without this, a logout on a shared
    // device leaves the previous user's data sitting in AsyncStorage.
    const previousUserId = user?.id;
    await supabase.auth.signOut();
    if (previousUserId) {
      try { await clearUserData(previousUserId); } catch { /* best-effort */ }
    }
  }, [user]);

  const displayName: string = user?.user_metadata?.name ?? 'paddler';

  return (
    <AppContext.Provider value={{
      days, settings, user, displayName, isLoading, isSyncing,
      addDay, updateDay, deleteDay, updateSettings, updateName, signOut,
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
