import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, TextInput, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useApp } from '../../lib/AppContext';
import { useTheme } from '../../lib/themeContext';
import type { Colors } from '../../constants/theme';
import { Day, River, Lap, Difficulty, LatLng } from '../../lib/types';
import { isoFromDate, parseDateISO, formatDisplayDate } from '../../lib/dates';
import { haversineKm } from '../../lib/geo';
import { addFormSignal } from '../../lib/addFormSignal';
import { spacing, radius } from '../../constants/theme';
import { refreshNotificationSchedule } from '../../lib/notifications';
import StarRating from '../../components/StarRating';
import RiverAutocomplete from '../../components/RiverAutocomplete';
import CountryPicker from '../../components/CountryPicker';
import MapPicker from '../../components/MapPicker';

const DIFFICULTIES: Difficulty[] = ['I', 'II', 'III', 'IV', 'V', 'VI'];
const SECTION_PRESETS = ['Alto', 'Medio', 'Bajo', 'Todo'];
const SECTION_PRESET_PARTS = ['Alto', 'Medio', 'Bajo'] as const;
const SECTION_I18N: Record<string, string> = {
  Alto: 'add.sectionAlto', Medio: 'add.sectionMedio', Bajo: 'add.sectionBajo', Todo: 'add.sectionTodo',
};

// "Todo" is treated as the combination Alto-Medio-Bajo for matching purposes.
// Storage normalizes "Todo" → "Alto-Medio-Bajo" so the existing combo lookup
// path (split on "-") sums them automatically. This helper covers legacy
// records still stored as the literal "Todo".
function normalizeSection(section: string): string {
  return section.trim() === 'Todo' ? 'Alto-Medio-Bajo' : section.trim();
}

function isPresetActive(section: string | undefined, preset: string): boolean {
  if (!section) return false;
  if (preset === 'Todo') {
    if (section === 'Todo') return true;
    const parts = section.split('-');
    return SECTION_PRESET_PARTS.every((p) => parts.includes(p));
  }
  return section === preset || section.split('-').includes(preset);
}

function togglePreset(current: string, preset: string): string {
  if (preset === 'Todo') {
    // Tapping Todo selects all three sub-sections (or clears, if all are
    // already selected). Stored as the explicit combo so suggestForLap can
    // sum the individual histories without a special case.
    return isPresetActive(current, 'Todo') ? '' : 'Alto-Medio-Bajo';
  }
  const parts: string[] = current.split('-').filter((p) => p === 'Alto' || p === 'Medio' || p === 'Bajo');
  const idx = parts.indexOf(preset);
  if (idx >= 0) {
    parts.splice(idx, 1);
  } else {
    parts.push(preset);
    parts.sort((a, b) => SECTION_PRESETS.indexOf(a) - SECTION_PRESETS.indexOf(b));
  }
  return parts.join('-');
}

// True if a section string is just a combination of Alto/Medio/Bajo (or the
// legacy literal "Todo"). Used to separate "custom" section names from the
// standard preset combos when listing per-river custom buttons.
function isPresetCombo(section: string): boolean {
  const s = section.trim();
  if (!s) return false;
  if (s === 'Todo') return true;
  const parts = s.split('-');
  return parts.every((p) => p === 'Alto' || p === 'Medio' || p === 'Bajo');
}

// Derive the list of custom section names the user has previously logged for
// a given river — anything that isn't a preset combo becomes a quick-pick
// button alongside Alto/Medio/Bajo/Todo.
function customSectionsForRiver(days: Day[], riverName: string): string[] {
  const normName = riverName.trim().toLowerCase();
  if (!normName) return [];
  const set = new Set<string>();
  for (const day of days) {
    for (const r of day.rivers) {
      if (r.name.trim().toLowerCase() !== normName) continue;
      for (const lap of r.laps) {
        const sec = (lap.section ?? '').trim();
        if (sec && !isPresetCombo(sec)) set.add(sec);
      }
    }
  }
  return Array.from(set).sort();
}

function emptyLap(): Lap {
  return { km: 0, hours: 0, minutes: 0, stars: 0, note: '', difficulty: 'III', section: '' };
}
function emptyRiver(): River {
  return { name: '', country: 'CL', laps: [emptyLap()] };
}

// Client-minted bigint ID for local-first offline writes. Date.now() alone
// collides across devices writing in the same millisecond — RLS silently
// drops the second write. The 3 random low digits drop that to ~1-in-1000.
function newDayId(): number {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}

// Suggestion for a new/edited lap based on previous trips for the same river.
// Match priority:
//   1) Exact section match → reuse that lap's km + pins
//   2) Multi-section combo (e.g. "Alto-Medio") → if every sub-section has a
//      historical lap, return the SUM of their km and assemble the route:
//      start = first sub-section's start pin, end = last sub-section's end pin
//   3) Any lap of this river (pins only) → so a new section still gets a
//      starting reference pin to drag from
// Callers decide when to apply each piece (typically only when the user
// hasn't already typed/placed something).
function suggestForLap(
  days: Day[],
  riverName: string,
  section: string,
): { km?: number; startLocation?: LatLng; endLocation?: LatLng } {
  const normName = riverName.trim().toLowerCase();
  if (!normName) return {};
  // Normalize so "Todo" and "Alto-Medio-Bajo" match each other in lookup,
  // covering both new entries (stored as the combo) and legacy "Todo" rows.
  const normSection = normalizeSection(section ?? '');

  function findLap(sec: string): Lap | undefined {
    const target = normalizeSection(sec);
    for (const day of days) {
      for (const river of day.rivers) {
        if (river.name.trim().toLowerCase() !== normName) continue;
        for (const lap of river.laps) {
          if (normalizeSection((lap.section ?? '').trim()) === target) return lap;
        }
      }
    }
    return undefined;
  }

  // 1) Exact section match → authoritative (km always returned, even if 0,
  //    so callers can distinguish "matched but no km recorded" from "no match").
  const exact = findLap(normSection);
  if (exact) {
    return {
      km: exact.km,
      startLocation: exact.startLocation,
      endLocation: exact.endLocation,
    };
  }

  // 2) Multi-section combo: only suggest when every sub-section has a
  //    historical lap, otherwise the sum would underrepresent the distance.
  //    Authoritative — caller should overwrite pins and km.
  const parts = normSection.split('-').filter(Boolean);
  if (parts.length > 1) {
    const subLaps = parts.map((p) => findLap(p));
    if (subLaps.every((l): l is Lap => l !== undefined)) {
      const totalKm = subLaps.reduce((sum, l) => sum + (l.km || 0), 0);
      return {
        km: Math.round(totalKm * 10) / 10,
        startLocation: subLaps[0].startLocation,
        endLocation: subLaps[subLaps.length - 1].endLocation,
      };
    }
  }

  // 3) Reference fallback: any lap with pins on this river. Non-authoritative
  //    (no km returned) — the user is paddling an unfamiliar section so the
  //    pins are just a starting reference to drag from.
  for (const day of days) {
    for (const river of day.rivers) {
      if (river.name.trim().toLowerCase() !== normName) continue;
      for (const lap of river.laps) {
        if (lap.startLocation) {
          return {
            startLocation: lap.startLocation,
            endLocation: lap.endLocation,
          };
        }
      }
    }
  }

  return {};
}

// Build a partial Lap update from a suggestion. A suggestion is
// "authoritative" when it came from a real historical match (exact section
// or full multi-section combo) — in that case the new pins and km should
// REPLACE whatever was on the lap, since the previous values were tied to
// a different section and are no longer relevant. A non-authoritative
// suggestion (just any pin on this river) only fills empty fields.
// `forcePins` is used by the MapPicker confirm — pins the user just placed
// always win, regardless of authority.
function applySuggestion(
  current: Lap,
  newSection: string,
  suggestion: { km?: number; startLocation?: LatLng; endLocation?: LatLng },
  forcePins?: { startLocation?: LatLng; endLocation?: LatLng },
): Partial<Lap> {
  const patch: Partial<Lap> = { section: newSection };
  const authoritative = suggestion.km !== undefined;

  if (forcePins) {
    patch.startLocation = forcePins.startLocation;
    patch.endLocation = forcePins.endLocation;
  } else if (authoritative) {
    if (suggestion.startLocation) patch.startLocation = suggestion.startLocation;
    if (suggestion.endLocation) patch.endLocation = suggestion.endLocation;
  } else {
    if (!current.startLocation && suggestion.startLocation) patch.startLocation = suggestion.startLocation;
    if (!current.endLocation && suggestion.endLocation) patch.endLocation = suggestion.endLocation;
  }

  const finalStart = patch.startLocation ?? current.startLocation;
  const finalEnd = patch.endLocation ?? current.endLocation;

  if (authoritative) {
    if ((suggestion.km ?? 0) > 0) {
      patch.km = suggestion.km;
    } else if (finalStart && finalEnd) {
      patch.km = Math.round(haversineKm(finalStart, finalEnd) * 10) / 10;
    }
    // else: authoritative match but no km and no pins — leave current alone.
  } else if (current.km === 0 && finalStart && finalEnd) {
    patch.km = Math.round(haversineKm(finalStart, finalEnd) * 10) / 10;
  }

  return patch;
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      backgroundColor: c.cardBg,
    },
    title: { fontSize: 17, fontWeight: '700', color: c.textPrimary },
    cancelLink: { fontSize: 15, color: c.danger },
    saveLink: { fontSize: 15, color: c.primary, fontWeight: '700' },
    saveLinkDisabled: { color: c.textTertiary },
    scroll: { padding: spacing.md, paddingBottom: 48 },
    section: { marginBottom: spacing.md },
    fieldLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: c.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: 6,
    },
    dateRow: { flexDirection: 'row', gap: 8 },
    dateBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.sm,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: c.cardBg,
    },
    dateBtnText: { fontSize: 14, color: c.textPrimary },
    todayBtn: {
      backgroundColor: c.primary,
      borderRadius: radius.sm,
      paddingHorizontal: 14,
      paddingVertical: 10,
      justifyContent: 'center',
    },
    todayBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    input: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.sm,
      paddingHorizontal: 10,
      paddingVertical: 10,
      fontSize: 14,
      color: c.textPrimary,
      backgroundColor: c.cardBg,
    },
    textArea: { minHeight: 70, textAlignVertical: 'top' },
    diffRow: { flexDirection: 'row', gap: 6 },
    diffBtn: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: radius.sm,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.cardBg,
    },
    diffBtnActive: { borderColor: c.primary, backgroundColor: c.primary },
    diffBtnText: { fontSize: 14, fontWeight: '700', color: c.textSecondary },
    diffBtnTextActive: { color: '#fff' },
    sectionRow: { flexDirection: 'row', gap: 6 },
    sectionBtn: {
      flex: 1,
      paddingVertical: 8,
      alignItems: 'center',
      borderRadius: radius.sm,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.cardBg,
    },
    sectionBtnActive: { borderColor: c.primary, backgroundColor: `${c.primary}18` },
    sectionBtnText: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
    sectionBtnTextActive: { color: c.primary },
    customSectionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
    customSectionBtn: {
      paddingVertical: 7,
      paddingHorizontal: 12,
      alignItems: 'center',
      borderRadius: radius.sm,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.cardBg,
    },
    riverCard: {
      backgroundColor: c.cardBg,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: c.border,
    },
    riverCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    riverCardTitle: { fontSize: 15, fontWeight: '700', color: c.textPrimary },
    lapCard: {
      backgroundColor: c.bg,
      borderRadius: radius.sm,
      padding: 10,
      marginTop: 10,
      borderWidth: 1,
      borderColor: c.border,
    },
    lapHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    lapTitle: { fontSize: 13, fontWeight: '700', color: c.textSecondary },
    lapActions: { flexDirection: 'row', gap: 10 },
    lapRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    lapField: { flex: 1 },
    addLapBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10, alignSelf: 'flex-start' },
    addLapText: { color: c.primary, fontSize: 14, fontWeight: '600' },
    locationRow: { flexDirection: 'row', gap: 8 },
    locationBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: radius.sm,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.cardBg,
    },
    locationBtnSet: { borderColor: c.primary, backgroundColor: `${c.primary}12` },
    locationDot: { width: 8, height: 8, borderRadius: 4 },
    locationBtnText: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
    locationBtnTextSet: { color: c.primary },
    addRiverBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: c.primary,
      borderStyle: 'dashed',
      marginBottom: spacing.md,
    },
    addRiverText: { color: c.primary, fontSize: 15, fontWeight: '600' },
    saveBtn: { backgroundColor: c.primary, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
    saveBtnDisabled: { backgroundColor: c.border },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  });
}

export default function AddScreen() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { days, addDay, updateDay, settings } = useApp();
  const router = useRouter();
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const isEdit = !!editId;

  const existingDay = useMemo(
    () => (editId ? days.find((d) => d.id === Number(editId)) : undefined),
    [editId, days]
  );

  const [date, setDate] = useState<Date>(existingDay ? parseDateISO(existingDay.date) : new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [mapPicker, setMapPicker] = useState<{ ri: number; li: number } | null>(null);
  const [notes, setNotes] = useState(existingDay?.notes ?? '');
  const [rivers, setRivers] = useState<River[]>(existingDay?.rivers ?? [emptyRiver()]);

  // The (tabs)/add screen stays mounted across navigations, so the useState
  // initializers above only run on first mount. Re-sync the form whenever
  // editId changes — load the day's data for edits, clear for new entries.
  // Guard with a ref so in-progress edits aren't wiped by background syncs
  // that mutate `days` (which would otherwise re-run this on every refresh).
  const lastSyncedEditIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (editId === lastSyncedEditIdRef.current) return;
    lastSyncedEditIdRef.current = editId;
    if (editId) {
      const day = days.find((d) => d.id === Number(editId));
      if (day) {
        setDate(parseDateISO(day.date));
        setNotes(day.notes);
        setRivers(day.rivers);
      } else {
        // The edit target no longer exists — it was deleted from the Log
        // tab or removed by a sync from another device. Bail out instead of
        // leaving stale form state from the previous edit on screen.
        if (router.canGoBack()) router.back();
        else router.replace('/(tabs)/log' as any);
        return;
      }
    } else {
      setDate(new Date());
      setNotes('');
      setRivers([emptyRiver()]);
    }
    setMapPicker(null);
    setShowDatePicker(false);
  }, [editId, days, router]);

  // The "+" tab button sets addFormSignal.resetPending and then navigates.
  // On focus, consume the flag and blank the form regardless of the URL's
  // editId (which the tab navigator preserves across switches).
  useFocusEffect(
    useCallback(() => {
      if (!addFormSignal.resetPending) return;
      addFormSignal.resetPending = false;
      setDate(new Date());
      setNotes('');
      setRivers([emptyRiver()]);
      setMapPicker(null);
      setShowDatePicker(false);
      lastSyncedEditIdRef.current = undefined;
      if (editId) router.setParams({ editId: undefined });
    }, [editId, router]),
  );

  const today = new Date();

  function updateRiver(ri: number, partial: Partial<River>) {
    setRivers((prev) => prev.map((r, i) => (i === ri ? { ...r, ...partial } : r)));
  }

  function updateLap(ri: number, li: number, partial: Partial<Lap>) {
    setRivers((prev) => prev.map((r, i) =>
      i === ri ? { ...r, laps: r.laps.map((l, j) => (j === li ? { ...l, ...partial } : l)) } : r
    ));
  }

  function addRiver() { setRivers((prev) => [...prev, emptyRiver()]); }
  function removeRiver(ri: number) { setRivers((prev) => prev.filter((_, i) => i !== ri)); }
  function addLap(ri: number) {
    setRivers((prev) => prev.map((r, i) => {
      if (i !== ri) return r;
      const last = r.laps[r.laps.length - 1];
      const section = last?.section ?? '';
      const blank = { ...emptyLap(), difficulty: last?.difficulty ?? 'III', section };
      const suggestion = suggestForLap(days, r.name, section);
      const patch = applySuggestion(blank, section, suggestion);
      return { ...r, laps: [...r.laps, { ...blank, ...patch }] };
    }));
  }
  function removeLap(ri: number, li: number) { setRivers((prev) => prev.map((r, i) => i === ri ? { ...r, laps: r.laps.filter((_, j) => j !== li) } : r)); }
  function duplicateLap(ri: number, li: number) {
    setRivers((prev) => prev.map((r, i) => {
      if (i !== ri) return r;
      const lap = { ...r.laps[li] };
      const newLaps = [...r.laps];
      newLaps.splice(li + 1, 0, lap);
      return { ...r, laps: newLaps };
    }));
  }

  const canSave = rivers.length > 0 && rivers.every((r) => r.name.trim().length > 0);

  // Leave the form behind cleanly. If we were editing, strip editId from the
  // URL so the next visit to this tab (via the "+" button or tab bar) opens
  // a blank entry instead of restoring the just-edited day.
  function leaveForm() {
    if (editId) router.setParams({ editId: undefined });
    router.back();
  }

  async function handleSave() {
    if (!canSave) return;
    const dayData: Day = { id: existingDay?.id ?? newDayId(), date: isoFromDate(date), notes, rivers };
    if (isEdit) await updateDay(dayData);
    else await addDay(dayData);
    await refreshNotificationSchedule(settings, [...days, dayData]);
    leaveForm();
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={leaveForm} accessibilityLabel={t('add.cancel')}>
          <Text style={styles.cancelLink}>{t('add.cancel')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{isEdit ? t('add.editDay') : t('add.newDay')}</Text>
        <TouchableOpacity onPress={handleSave} disabled={!canSave} accessibilityLabel={t('add.save')}>
          <Text style={[styles.saveLink, !canSave && styles.saveLinkDisabled]}>
            {isEdit ? t('add.saveChanges') : t('add.save')}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>{t('add.date')}</Text>
          <View style={styles.dateRow}>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDatePicker(true)}>
              <Ionicons name="calendar-outline" size={18} color={colors.primary} />
              <Text style={styles.dateBtnText}>{formatDisplayDate(isoFromDate(date))}</Text>
            </TouchableOpacity>
            {!isEdit && (
              <TouchableOpacity style={styles.todayBtn} onPress={() => setDate(new Date())}>
                <Text style={styles.todayBtnText}>{t('add.today')}</Text>
              </TouchableOpacity>
            )}
          </View>
          {showDatePicker && (
            <DateTimePicker
              value={date} mode="date" maximumDate={today}
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              themeVariant={isDark ? 'dark' : 'light'}
              onChange={(_, selected) => { setShowDatePicker(false); if (selected) setDate(selected); }}
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.fieldLabel}>{t('add.dayNotes')}</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes} onChangeText={setNotes}
            placeholder={t('add.notesPlaceholder')} placeholderTextColor={colors.textTertiary}
            multiline numberOfLines={3}
          />
        </View>

        {rivers.map((river, ri) => {
          const customSections = customSectionsForRiver(days, river.name);
          return (
          <View key={ri} style={styles.riverCard}>
            <View style={styles.riverCardHeader}>
              <Text style={styles.riverCardTitle}>{t('add.river', { n: ri + 1 })}</Text>
              {rivers.length > 1 && (
                <TouchableOpacity onPress={() => removeRiver(ri)} accessibilityLabel={t('add.removeRiver')}>
                  <Ionicons name="close-circle" size={20} color={colors.danger} />
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.fieldLabel}>{t('add.riverName')}</Text>
            <RiverAutocomplete
              value={river.name}
              onChange={(name) => updateRiver(ri, { name })}
              onSelect={(name, country, difficulty, section) => {
                const finalSection = section ?? '';
                const currentLap = rivers[ri]?.laps[0] ?? emptyLap();
                const suggestion = suggestForLap(days, name, finalSection);
                const patch = applySuggestion(currentLap, finalSection, suggestion);
                updateRiver(ri, { name, country });
                updateLap(ri, 0, { difficulty: difficulty ?? 'III', ...patch });
              }}
              days={days}
              placeholder={t('add.riverNamePlaceholder')}
            />

            <Text style={[styles.fieldLabel, { marginTop: 10 }]}>{t('add.country')}</Text>
            <CountryPicker value={river.country} onChange={(country) => updateRiver(ri, { country })} />

            {river.laps.map((lap, li) => (
              <View key={li} style={styles.lapCard}>
                <View style={styles.lapHeader}>
                  <Text style={styles.lapTitle}>{t('add.lap', { n: li + 1 })}</Text>
                  <View style={styles.lapActions}>
                    <TouchableOpacity onPress={() => duplicateLap(ri, li)} accessibilityLabel={t('add.duplicateLap')}>
                      <Ionicons name="copy-outline" size={18} color={colors.primary} />
                    </TouchableOpacity>
                    {river.laps.length > 1 && (
                      <TouchableOpacity onPress={() => removeLap(ri, li)} accessibilityLabel={t('add.removeLap')}>
                        <Ionicons name="trash-outline" size={18} color={colors.danger} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                <Text style={styles.fieldLabel}>{t('add.section')}</Text>
                <View style={styles.sectionRow}>
                  {SECTION_PRESETS.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.sectionBtn, isPresetActive(lap.section, s) && styles.sectionBtnActive]}
                      onPress={() => {
                        const section = togglePreset(lap.section ?? '', s);
                        const suggestion = suggestForLap(days, river.name, section);
                        updateLap(ri, li, applySuggestion(lap, section, suggestion));
                      }}
                    >
                      <Text style={[styles.sectionBtnText, isPresetActive(lap.section, s) && styles.sectionBtnTextActive]}>
                        {t(SECTION_I18N[s] as any)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {customSections.length > 0 && (
                  <View style={styles.customSectionRow}>
                    {customSections.map((name) => {
                      const active = (lap.section ?? '').trim() === name;
                      return (
                        <TouchableOpacity
                          key={name}
                          style={[styles.customSectionBtn, active && styles.sectionBtnActive]}
                          onPress={() => {
                            const section = active ? '' : name;
                            const suggestion = suggestForLap(days, river.name, section);
                            updateLap(ri, li, applySuggestion(lap, section, suggestion));
                          }}
                        >
                          <Text style={[styles.sectionBtnText, active && styles.sectionBtnTextActive]} numberOfLines={1}>
                            {name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
                <TextInput
                  style={[styles.input, { marginTop: 6 }]}
                  value={lap.section ?? ''}
                  onChangeText={(section) => {
                    const suggestion = suggestForLap(days, river.name, section);
                    updateLap(ri, li, applySuggestion(lap, section, suggestion));
                  }}
                  placeholder={t('add.sectionPlaceholder')}
                  placeholderTextColor={colors.textTertiary}
                  returnKeyType="done"
                />

                <Text style={[styles.fieldLabel, { marginTop: 10 }]}>{t('add.class')}</Text>
                <View style={styles.diffRow}>
                  {DIFFICULTIES.map((d) => (
                    <TouchableOpacity
                      key={d}
                      style={[styles.diffBtn, (lap.difficulty ?? 'III') === d && styles.diffBtnActive]}
                      onPress={() => updateLap(ri, li, { difficulty: d })}
                      accessibilityLabel={t('rivers.class', { level: d })}
                    >
                      <Text style={[styles.diffBtnText, (lap.difficulty ?? 'III') === d && styles.diffBtnTextActive]}>{d}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.fieldLabel, { marginTop: 10 }]}>{t('add.location')}</Text>
                <View style={styles.locationRow}>
                  <TouchableOpacity style={[styles.locationBtn, lap.startLocation && styles.locationBtnSet]} onPress={() => setMapPicker({ ri, li })}>
                    <View style={[styles.locationDot, { backgroundColor: '#34c759' }]} />
                    <Text style={[styles.locationBtnText, lap.startLocation && styles.locationBtnTextSet]}>
                      {lap.startLocation ? t('add.startSet') : t('add.start')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.locationBtn, lap.endLocation && styles.locationBtnSet]} onPress={() => setMapPicker({ ri, li })}>
                    <View style={[styles.locationDot, { backgroundColor: '#ff3b30' }]} />
                    <Text style={[styles.locationBtnText, lap.endLocation && styles.locationBtnTextSet]}>
                      {lap.endLocation ? t('add.endSet') : t('add.end')}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={[styles.lapRow, { marginTop: 10 }]}>
                  {[
                    { key: 'km', label: t('add.km'), value: lap.km, field: 'km', pad: 'decimal-pad' },
                    { key: 'h', label: t('add.hours'), value: lap.hours, field: 'hours', pad: 'number-pad' },
                    { key: 'm', label: t('add.minutes'), value: lap.minutes, field: 'minutes', pad: 'number-pad' },
                  ].map(({ key, label, value, field, pad }) => (
                    <View key={key} style={styles.lapField}>
                      <Text style={styles.fieldLabel}>{label}</Text>
                      <TextInput
                        style={styles.input}
                        value={value === 0 ? '' : String(value)}
                        onChangeText={(v) => {
                          // Accept comma as decimal separator (ES/EU keyboards)
                          // and clamp to non-negative — negative km/time make
                          // no sense and would corrupt downstream stats.
                          const n = Number(v.replace(',', '.'));
                          const clamped = Number.isFinite(n) && n > 0 ? n : 0;
                          updateLap(ri, li, { [field]: clamped } as any);
                        }}
                        keyboardType={pad as any}
                        placeholder="0"
                        placeholderTextColor={colors.textTertiary}
                      />
                    </View>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>{t('add.rating')}</Text>
                <StarRating value={lap.stars} onChange={(stars) => updateLap(ri, li, { stars })} />

                <Text style={[styles.fieldLabel, { marginTop: 8 }]}>{t('add.comment')}</Text>
                <TextInput
                  style={styles.input}
                  value={lap.note}
                  onChangeText={(note) => updateLap(ri, li, { note })}
                  placeholder={t('add.optional')}
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
            ))}

            <TouchableOpacity style={styles.addLapBtn} onPress={() => addLap(ri)}>
              <Ionicons name="add" size={16} color={colors.primary} />
              <Text style={styles.addLapText}>{t('add.addLap')}</Text>
            </TouchableOpacity>
          </View>
          );
        })}

        <TouchableOpacity style={styles.addRiverBtn} onPress={addRiver}>
          <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
          <Text style={styles.addRiverText}>{t('add.addRiver')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]} onPress={handleSave} disabled={!canSave}>
          <Text style={styles.saveBtnText}>{isEdit ? t('add.saveChanges') : t('add.save')}</Text>
        </TouchableOpacity>
      </ScrollView>

      {mapPicker !== null && (
        <MapPicker
          visible
          riverName={rivers[mapPicker.ri]?.name || undefined}
          initialStart={rivers[mapPicker.ri]?.laps[mapPicker.li]?.startLocation}
          initialEnd={rivers[mapPicker.ri]?.laps[mapPicker.li]?.endLocation}
          onConfirm={(start, end) => {
            const currentRiver = rivers[mapPicker.ri];
            const currentLap = currentRiver?.laps[mapPicker.li] ?? emptyLap();
            const section = currentLap.section ?? '';
            const suggestion = suggestForLap(days, currentRiver?.name ?? '', section);
            updateLap(
              mapPicker.ri,
              mapPicker.li,
              applySuggestion(currentLap, section, suggestion, { startLocation: start, endLocation: end }),
            );
            setMapPicker(null);
          }}
          onCancel={() => setMapPicker(null)}
        />
      )}
    </SafeAreaView>
  );
}
