import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { Day, Settings } from './types';
import {
  loadDays, saveDays, loadSettings, saveSettings, clearUserData,
  loadPendingOps, savePendingOps, loadLastUser, saveLastUser,
} from './storage';
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
  deleteAccount: () => Promise<boolean>;
}

const AppContext = createContext<AppContextValue | null>(null);

// Registran el resultado de una escritura remota en la cola offline: si
// falló queda pendiente para el próximo sync; si llegó, se saca de la cola
// (cubre el caso "editado offline y re-editado ya con conexión").
async function markUpsertResult(userId: string, dayId: number, ok: boolean): Promise<void> {
  try {
    const p = await loadPendingOps(userId);
    const queued = p.upserts.includes(dayId);
    if (ok && queued) p.upserts = p.upserts.filter((i) => i !== dayId);
    else if (!ok && !queued) p.upserts.push(dayId);
    else return;
    await savePendingOps(p, userId);
  } catch { /* best-effort */ }
}

async function markDeleteResult(userId: string, dayId: number, ok: boolean): Promise<void> {
  try {
    const p = await loadPendingOps(userId);
    // Un borrado anula cualquier edición pendiente del mismo día.
    p.upserts = p.upserts.filter((i) => i !== dayId);
    const queued = p.deletes.includes(dayId);
    if (ok && queued) p.deletes = p.deletes.filter((i) => i !== dayId);
    else if (!ok && !queued) p.deletes.push(dayId);
    await savePendingOps(p, userId);
  } catch { /* best-effort */ }
}

async function markSettingsResult(userId: string, ok: boolean): Promise<void> {
  try {
    const p = await loadPendingOps(userId);
    if (p.settingsDirty === !ok) return;
    p.settingsDirty = !ok;
    await savePendingOps(p, userId);
  } catch { /* best-effort */ }
}

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
      // 2a. Drenar la cola offline ANTES de leer el remoto: así el fetch ya
      // trae las ediciones/borrados hechos sin conexión y el merge no los
      // pisa con la versión antigua del servidor.
      const pending = await loadPendingOps(userId);
      if (pending.upserts.length > 0) {
        const toPush = localDays.filter((d) => pending.upserts.includes(d.id));
        if (await pushAllDays(toPush, userId)) pending.upserts = [];
      }
      if (pending.deletes.length > 0) {
        const results = await Promise.all(pending.deletes.map((id) => remoteDeleteDay(id, userId)));
        pending.deletes = pending.deletes.filter((_, i) => !results[i]);
      }
      if (pending.settingsDirty) {
        if (await upsertSettings(localSettings, userId)) pending.settingsDirty = false;
      }
      await savePendingOps(pending, userId);
      const stillPendingUpserts = new Set(pending.upserts);
      const stillPendingDeletes = new Set(pending.deletes);

      const [remoteDays, remoteSettings] = await Promise.all([
        fetchDaysFromSupabase(userId),
        fetchSettings(userId),
      ]);

      // Merge instead of overwriting: any day in the local cache whose id is
      // NOT in the remote set was added/edited while offline and never made
      // it to the server. Overwriting would silently lose those rows. Keep
      // them and push them up now that we're online again. Days still in the
      // pending queue (push failed above) win over their remote version, and
      // pending deletes are filtered out of the remote set.
      if (remoteDays.length > 0) {
        const remoteIds = new Set(remoteDays.map((d) => d.id));
        const remoteKept = remoteDays.filter(
          (d) => !stillPendingDeletes.has(d.id) && !stillPendingUpserts.has(d.id),
        );
        const localWins = localDays.filter(
          (d) => stillPendingUpserts.has(d.id) || (!remoteIds.has(d.id) && !stillPendingDeletes.has(d.id)),
        );
        const newToRemote = localDays.filter((d) => !remoteIds.has(d.id) && !stillPendingDeletes.has(d.id));
        const merged = [...remoteKept, ...localWins]
          .sort((a, b) => b.date.localeCompare(a.date));
        setDays(merged);
        await saveDays(merged, userId);
        if (newToRemote.length > 0) {
          await pushAllDays(newToRemote, userId);
        }
      } else if (localDays.length > 0) {
        // First login or empty remote: push the whole local cache up.
        await pushAllDays(localDays, userId);
      }

      // Settings editados offline (aún en cola) no se pisan con los remotos.
      if (remoteSettings && !pending.settingsDirty) {
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
    let sessionUserSeen = false;

    // ARRANQUE OFFLINE: si hay un usuario conocido en el dispositivo, cargar
    // su caché local de inmediato sin esperar a supabase-js. Cuando el token
    // está vencido y no hay red, la librería se queda reintentando el refresh
    // y el evento INITIAL_SESSION tarda (o llega con sesión nula) — sin este
    // arranque la app quedaba pegada en el splash (bug offline de la v1).
    loadLastUser().then((last) => {
      if (!mounted || sessionUserSeen || !last) return;
      // Stub mínimo: la app solo usa id y user_metadata.name. La sesión real
      // lo reemplaza apenas supabase-js logre restaurarla.
      setUser({ id: last.id, user_metadata: { name: last.name } } as unknown as User);
      void loadUserData(last.id);
    });

    // Listen for auth state changes (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED,
    // INITIAL_SESSION, PASSWORD_RECOVERY). supabase-js v2 fires
    // INITIAL_SESSION on subscribe with the cached session, so this also
    // handles app bootstrap.
    // IMPORTANTE: este callback es SÍNCRONO a propósito y no espera (await)
    // ninguna llamada a supabase. supabase-js lo invoca desde dentro de su
    // candado de sesión (`_notifyAllSubscribers`, p. ej. en TOKEN_REFRESHED),
    // y su documentación advierte que hacer `await` de otra llamada de la
    // librería aquí puede provocar un deadlock: la consulta necesita
    // getSession(), que espera el mismo candado que este callback bloquea.
    // Todo lo que toque supabase o el almacenamiento se aplaza con
    // setTimeout(0), que ya corre fuera del candado. (Con supabase-js 2.106
    // el caso concreto de abajo no llegaba a trabarse — probado con la
    // librería real —, pero depender de ese detalle interno no vale la pena.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      // During password recovery the user is on /auth/reset to update their
      // password and then re-login. Skip the full data load — it serves no
      // purpose for the reset flow and was holding the HTTP client busy long
      // enough for the subsequent updateUser to time out on slower networks.
      if (event === 'PASSWORD_RECOVERY') {
        setUser(session?.user ?? null);
        return;
      }
      const currentUser = session?.user ?? null;
      if (currentUser) {
        sessionUserSeen = true;
        setUser(currentUser);
        setTimeout(() => {
          if (!mounted) return;
          void saveLastUser({ id: currentUser.id, name: currentUser.user_metadata?.name });
          void loadUserData(currentUser.id);
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
        }, 0);
      } else {
        // Sesión nula: solo desloguear si es un cierre de sesión real. Una
        // INITIAL_SESSION nula con usuario conocido en el dispositivo es el
        // caso "offline con token vencido" — mantener el arranque offline.
        setTimeout(async () => {
          if (!mounted) return;
          const last = event === 'SIGNED_OUT' ? null : await loadLastUser();
          if (!mounted) return;
          if (!last) {
            sessionUserSeen = false;
            setUser(null);
            setDays([]);
            setSettings({ notifEnabled: false, notifTime: '21:00' });
            setIsLoading(false);
          }
        }, 0);
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
    if (user) {
      const uid = user.id;
      void upsertDay(day, uid).then((ok) => markUpsertResult(uid, day.id, ok));
    }
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
    if (user) {
      const uid = user.id;
      void upsertDay(day, uid).then((ok) => markUpsertResult(uid, day.id, ok));
    }
  }, [user]);

  const deleteDay = useCallback(async (id: number) => {
    const userId = user?.id ?? 'local';
    setDays((prev) => {
      const next = prev.filter((d) => d.id !== id);
      void saveDays(next, userId);
      void refreshNotificationSchedule(settings, next);
      return next;
    });
    if (user) {
      const uid = user.id;
      void remoteDeleteDay(id, uid).then((ok) => markDeleteResult(uid, id, ok));
    }
  }, [user, settings]);

  const updateSettings = useCallback(async (newSettings: Settings) => {
    const userId = user?.id ?? 'local';
    setSettings(newSettings);
    await saveSettings(newSettings, userId);
    await refreshNotificationSchedule(newSettings, days);
    if (user) {
      const uid = user.id;
      void upsertSettings(newSettings, uid).then((ok) => markSettingsResult(uid, ok));
    }
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
    // Local scope clears the device session without a network round-trip, so
    // sign-out is instant and works even on a flaky/offline connection. A
    // global sign-out can hang indefinitely waiting to revoke server-side.
    await supabase.auth.signOut({ scope: 'local' });
    if (previousUserId) {
      try { await clearUserData(previousUserId); } catch { /* best-effort */ }
    }
  }, [user]);

  const deleteAccount = useCallback(async (): Promise<boolean> => {
    // Account + auth-user deletion needs the service_role, so it runs in the
    // `delete-account` Edge Function (invoke attaches the user's JWT). On
    // success the auth user is gone — sign out and purge the local cache so
    // nothing lingers on the device.
    const previousUserId = user?.id;
    const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
    if (error) return false;
    await supabase.auth.signOut();
    if (previousUserId) {
      try { await clearUserData(previousUserId); } catch { /* best-effort */ }
    }
    return true;
  }, [user]);

  const displayName: string = user?.user_metadata?.name ?? 'paddler';

  return (
    <AppContext.Provider value={{
      days, settings, user, displayName, isLoading, isSyncing,
      addDay, updateDay, deleteDay, updateSettings, updateName, signOut, deleteAccount,
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
