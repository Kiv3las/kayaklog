import { supabase } from './supabase';
import { Day, Settings } from './types';

export async function fetchDaysFromSupabase(userId: string): Promise<Day[]> {
  const { data, error } = await supabase
    .from('days')
    .select('id, date, notes, rivers')
    .eq('user_id', userId)
    .order('date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Day[];
}

// Devuelven true si la escritura llegó al servidor; false si falló (p. ej.
// sin conexión) para que el llamador la encole y la reintente al reconectar.
export async function upsertDay(day: Day, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('days').upsert({
      id: day.id,
      user_id: userId,
      date: day.date,
      notes: day.notes,
      rivers: day.rivers,
      updated_at: new Date().toISOString(),
    });
    if (__DEV__ && error) console.warn('[sync] upsertDay:', error.message);
    return !error;
  } catch {
    return false;
  }
}

export async function deleteDay(id: number, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('days').delete().eq('id', id).eq('user_id', userId);
    if (__DEV__ && error) console.warn('[sync] deleteDay:', error.message);
    return !error;
  } catch {
    return false;
  }
}

export async function fetchSettings(userId: string): Promise<Settings | null> {
  const { data, error } = await supabase
    .from('settings')
    .select('notif_enabled, notif_time')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return { notifEnabled: data.notif_enabled, notifTime: data.notif_time };
}

export async function upsertSettings(settings: Settings, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('settings').upsert({
      user_id: userId,
      notif_enabled: settings.notifEnabled,
      notif_time: settings.notifTime,
      updated_at: new Date().toISOString(),
    });
    if (__DEV__ && error) console.warn('[sync] upsertSettings:', error.message);
    return !error;
  } catch {
    return false;
  }
}

export async function pushAllDays(days: Day[], userId: string): Promise<boolean> {
  if (days.length === 0) return true;
  try {
    const rows = days.map((d) => ({
      id: d.id,
      user_id: userId,
      date: d.date,
      notes: d.notes,
      rivers: d.rivers,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from('days').upsert(rows);
    if (__DEV__ && error) console.warn('[sync] pushAllDays:', error.message);
    return !error;
  } catch {
    return false;
  }
}
