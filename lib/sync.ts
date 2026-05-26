import { supabase } from './supabase';
import { Day, Settings } from './types';

export async function fetchDaysFromSupabase(): Promise<Day[]> {
  const { data, error } = await supabase
    .from('days')
    .select('id, date, notes, rivers')
    .order('date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Day[];
}

export async function upsertDay(day: Day, userId: string): Promise<void> {
  const { error } = await supabase.from('days').upsert({
    id: day.id,
    user_id: userId,
    date: day.date,
    notes: day.notes,
    rivers: day.rivers,
    updated_at: new Date().toISOString(),
  });
  if (error) console.warn('[sync] upsertDay:', error.message);
}

export async function deleteDay(id: number): Promise<void> {
  const { error } = await supabase.from('days').delete().eq('id', id);
  if (error) console.warn('[sync] deleteDay:', error.message);
}

export async function fetchSettings(): Promise<Settings | null> {
  const { data, error } = await supabase
    .from('settings')
    .select('notif_enabled, notif_time')
    .maybeSingle();
  if (error || !data) return null;
  return { notifEnabled: data.notif_enabled, notifTime: data.notif_time };
}

export async function upsertSettings(settings: Settings, userId: string): Promise<void> {
  const { error } = await supabase.from('settings').upsert({
    user_id: userId,
    notif_enabled: settings.notifEnabled,
    notif_time: settings.notifTime,
    updated_at: new Date().toISOString(),
  });
  if (error) console.warn('[sync] upsertSettings:', error.message);
}

export async function pushAllDays(days: Day[], userId: string): Promise<void> {
  if (days.length === 0) return;
  const rows = days.map((d) => ({
    id: d.id,
    user_id: userId,
    date: d.date,
    notes: d.notes,
    rivers: d.rivers,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase.from('days').upsert(rows);
  if (error) console.warn('[sync] pushAllDays:', error.message);
}
