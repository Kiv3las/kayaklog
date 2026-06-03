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
import { Day, River, Lap, Difficulty, LatLng, SectionLoc } from '../../lib/types';
import { isoFromDate, parseDateISO, formatDisplayDate } from '../../lib/dates';
import { haversineKm } from '../../lib/geo';
import { normalizeSection, isPresetCombo, sectionParts } from '../../lib/sections';
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

// Display label for a single section part: translate the presets, show custom
// names verbatim.
function sectionLabel(part: string, t: (key: any) => string): string {
  return SECTION_I18N[part] ? t(SECTION_I18N[part]) : part;
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
    // already selected). Stored as the explicit combo so each sub-section gets
    // its own per-section location block.
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

// Straight-line distance summed across a lap's selected sections. Only
// sections with BOTH pins contribute. Returns 0 when nothing is measurable.
function autoKm(section: string | undefined, sl: Record<string, SectionLoc> | undefined): number {
  let total = 0;
  for (const part of sectionParts(section)) {
    const loc = sl?.[part];
    if (loc?.start && loc?.end) total += haversineKm(loc.start, loc.end);
  }
  return Math.round(total * 10) / 10;
}

// Previously-logged pins for one section of a river, so re-logging a known
// section pre-fills its put-in/take-out. Checks the per-section store first,
// then legacy single-section laps.
function findSectionPins(days: Day[], riverName: string, part: string): SectionLoc | undefined {
  const normName = riverName.trim().toLowerCase();
  if (!normName) return undefined;
  const target = normalizeSection(part);
  for (const day of days) {
    for (const river of day.rivers) {
      if (river.name.trim().toLowerCase() !== normName) continue;
      for (const lap of river.laps) {
        const sl = lap.sectionLocations?.[part];
        if (sl?.start || sl?.end) return { start: sl.start, end: sl.end };
        if (normalizeSection((lap.section ?? '').trim()) === target && (lap.startLocation || lap.endLocation)) {
          return { start: lap.startLocation, end: lap.endLocation };
        }
      }
    }
  }
  return undefined;
}

// Per-section pin store for a lap switching to `section`: migrate a legacy
// single location once (start→first section, end→last section), then pre-fill
// each section's pins from history where the lap doesn't already have them.
// Existing pins are never overwritten, and legacy fields are left intact.
function buildSectionLocations(days: Day[], riverName: string, lap: Lap, section: string): Record<string, SectionLoc> {
  const parts = sectionParts(section);
  const sl: Record<string, SectionLoc> = { ...(lap.sectionLocations ?? {}) };
  if (Object.keys(sl).length === 0 && (lap.startLocation || lap.endLocation) && parts.length > 0) {
    const first = parts[0];
    const last = parts[parts.length - 1];
    sl[first] = { ...(sl[first] ?? {}), start: lap.startLocation };
    sl[last] = { ...(sl[last] ?? {}), end: lap.endLocation };
  }
  for (const part of parts) {
    const cur = sl[part];
    if (!cur?.start && !cur?.end) {
      const hist = findSectionPins(days, riverName, part);
      if (hist) sl[part] = hist;
    }
  }
  return sl;
}

// On edit-load, surface a legacy single location inside the per-section UI so
// old pins are visible immediately (start→first section, end→last section).
// Pure remap of the saved location — never pulls from history and never
// touches km, so the user's saved values are preserved until they edit a pin.
function migrateLegacyLap(lap: Lap): Lap {
  const parts = sectionParts(lap.section);
  if (lap.sectionLocations || parts.length === 0 || (!lap.startLocation && !lap.endLocation)) return lap;
  const sl: Record<string, SectionLoc> = {};
  sl[parts[0]] = { start: lap.startLocation };
  const last = parts[parts.length - 1];
  sl[last] = { ...(sl[last] ?? {}), end: lap.endLocation };
  return { ...lap, sectionLocations: sl };
}

function migrateRivers(rivers: River[]): River[] {
  return rivers.map((r) => ({ ...r, laps: r.laps.map(migrateLegacyLap) }));
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
    sectionLocBlock: { marginBottom: 8 },
    sectionLocLabel: { fontSize: 12, fontWeight: '600', color: c.textSecondary, marginBottom: 4 },
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
  // `section` is the section part the picker targets (Alto/Medio/…); null
  // means the legacy single put-in/take-out (laps with no section selected).
  const [mapPicker, setMapPicker] = useState<{ ri: number; li: number; section: string | null } | null>(null);
  const [notes, setNotes] = useState(existingDay?.notes ?? '');
  const [rivers, setRivers] = useState<River[]>(existingDay ? migrateRivers(existingDay.rivers) : [emptyRiver()]);

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
        setRivers(migrateRivers(day.rivers));
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

  // Change a lap's section: migrate/pre-fill its per-section pins from history
  // and recompute km from those pins. A manual km override persists until the
  // user moves a pin (km is only overwritten when there's something to measure).
  function changeLapSection(ri: number, li: number, newSection: string) {
    setRivers((prev) => prev.map((r, i) => {
      if (i !== ri) return r;
      return {
        ...r,
        laps: r.laps.map((l, j) => {
          if (j !== li) return l;
          const sl = buildSectionLocations(days, r.name, l, newSection);
          const km = autoKm(newSection, sl);
          return {
            ...l,
            section: newSection,
            sectionLocations: Object.keys(sl).length > 0 ? sl : l.sectionLocations,
            ...(km > 0 ? { km } : {}),
          };
        }),
      };
    }));
  }

  // Write the put-in/take-out for one section, then recompute the lap's km
  // from all its sections (pins always win, like the legacy picker did).
  function setSectionPins(ri: number, li: number, section: string, start?: LatLng, end?: LatLng) {
    setRivers((prev) => prev.map((r, i) => {
      if (i !== ri) return r;
      return {
        ...r,
        laps: r.laps.map((l, j) => {
          if (j !== li) return l;
          const sl = { ...(l.sectionLocations ?? {}), [section]: { start, end } };
          const km = autoKm(l.section, sl);
          return { ...l, sectionLocations: sl, ...(km > 0 ? { km } : {}) };
        }),
      };
    }));
  }

  function addRiver() { setRivers((prev) => [...prev, emptyRiver()]); }
  function removeRiver(ri: number) { setRivers((prev) => prev.filter((_, i) => i !== ri)); }
  function addLap(ri: number) {
    setRivers((prev) => prev.map((r, i) => {
      if (i !== ri) return r;
      const last = r.laps[r.laps.length - 1];
      const section = last?.section ?? '';
      const blank: Lap = { ...emptyLap(), difficulty: last?.difficulty ?? 'III', section };
      const sl = buildSectionLocations(days, r.name, blank, section);
      if (Object.keys(sl).length > 0) blank.sectionLocations = sl;
      const km = autoKm(section, sl);
      if (km > 0) blank.km = km;
      return { ...r, laps: [...r.laps, blank] };
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
                updateRiver(ri, { name, country });
                updateLap(ri, 0, { difficulty: difficulty ?? 'III' });
                changeLapSection(ri, 0, section ?? '');
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
                      onPress={() => changeLapSection(ri, li, togglePreset(lap.section ?? '', s))}
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
                          onPress={() => changeLapSection(ri, li, active ? '' : name)}
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
                  onChangeText={(section) => changeLapSection(ri, li, section)}
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
                {sectionParts(lap.section).length === 0 ? (
                  <View style={styles.locationRow}>
                    <TouchableOpacity style={[styles.locationBtn, lap.startLocation && styles.locationBtnSet]} onPress={() => setMapPicker({ ri, li, section: null })}>
                      <View style={[styles.locationDot, { backgroundColor: '#34c759' }]} />
                      <Text style={[styles.locationBtnText, lap.startLocation && styles.locationBtnTextSet]}>
                        {lap.startLocation ? t('add.startSet') : t('add.start')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.locationBtn, lap.endLocation && styles.locationBtnSet]} onPress={() => setMapPicker({ ri, li, section: null })}>
                      <View style={[styles.locationDot, { backgroundColor: '#ff3b30' }]} />
                      <Text style={[styles.locationBtnText, lap.endLocation && styles.locationBtnTextSet]}>
                        {lap.endLocation ? t('add.endSet') : t('add.end')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  sectionParts(lap.section).map((part) => {
                    const loc = lap.sectionLocations?.[part];
                    return (
                      <View key={part} style={styles.sectionLocBlock}>
                        <Text style={styles.sectionLocLabel}>{sectionLabel(part, t)}</Text>
                        <View style={styles.locationRow}>
                          <TouchableOpacity style={[styles.locationBtn, loc?.start && styles.locationBtnSet]} onPress={() => setMapPicker({ ri, li, section: part })}>
                            <View style={[styles.locationDot, { backgroundColor: '#34c759' }]} />
                            <Text style={[styles.locationBtnText, loc?.start && styles.locationBtnTextSet]}>
                              {loc?.start ? t('add.startSet') : t('add.start')}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.locationBtn, loc?.end && styles.locationBtnSet]} onPress={() => setMapPicker({ ri, li, section: part })}>
                            <View style={[styles.locationDot, { backgroundColor: '#ff3b30' }]} />
                            <Text style={[styles.locationBtnText, loc?.end && styles.locationBtnTextSet]}>
                              {loc?.end ? t('add.endSet') : t('add.end')}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })
                )}

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

      {mapPicker !== null && (() => {
        const lap = rivers[mapPicker.ri]?.laps[mapPicker.li];
        const sec = mapPicker.section;
        const loc = sec === null
          ? { start: lap?.startLocation, end: lap?.endLocation }
          : (lap?.sectionLocations?.[sec] ?? {});
        // Other sections' pins, shown faded for context while placing this one.
        const referencePins = sec === null ? [] : sectionParts(lap?.section)
          .filter((p) => p !== sec)
          .map((p) => ({
            label: sectionLabel(p, t),
            start: lap?.sectionLocations?.[p]?.start,
            end: lap?.sectionLocations?.[p]?.end,
          }))
          .filter((r) => r.start || r.end);
        return (
          <MapPicker
            visible
            riverName={rivers[mapPicker.ri]?.name || undefined}
            initialStart={loc.start}
            initialEnd={loc.end}
            referencePins={referencePins}
            onConfirm={(start, end) => {
              if (sec === null) {
                // Legacy single location: pins win, recompute km from them.
                updateLap(mapPicker.ri, mapPicker.li, {
                  startLocation: start,
                  endLocation: end,
                  ...(start && end ? { km: Math.round(haversineKm(start, end) * 10) / 10 } : {}),
                });
              } else {
                setSectionPins(mapPicker.ri, mapPicker.li, sec, start, end);
              }
              setMapPicker(null);
            }}
            onCancel={() => setMapPicker(null)}
          />
        );
      })()}
    </SafeAreaView>
  );
}
