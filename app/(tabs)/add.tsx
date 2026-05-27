import React, { useState, useMemo, useCallback } from 'react';
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
import { spacing, radius } from '../../constants/theme';
import { refreshNotificationSchedule } from '../../lib/notifications';
import StarRating from '../../components/StarRating';
import RiverAutocomplete from '../../components/RiverAutocomplete';
import CountryPicker from '../../components/CountryPicker';
import MapPicker from '../../components/MapPicker';

const DIFFICULTIES: Difficulty[] = ['I', 'II', 'III', 'IV', 'V', 'VI'];
const SECTION_PRESETS = ['Alto', 'Medio', 'Bajo', 'Todo'];
const SECTION_I18N: Record<string, string> = {
  Alto: 'add.sectionAlto', Medio: 'add.sectionMedio', Bajo: 'add.sectionBajo', Todo: 'add.sectionTodo',
};

function isPresetActive(section: string | undefined, preset: string): boolean {
  if (!section) return false;
  return section === preset || section.split('-').includes(preset);
}

function togglePreset(current: string, preset: string): string {
  if (preset === 'Todo') {
    return isPresetActive(current, 'Todo') ? '' : 'Todo';
  }
  const parts = current.split('-').filter((p) => SECTION_PRESETS.includes(p) && p !== 'Todo');
  const idx = parts.indexOf(preset);
  if (idx >= 0) {
    parts.splice(idx, 1);
  } else {
    parts.push(preset);
    parts.sort((a, b) => SECTION_PRESETS.indexOf(a) - SECTION_PRESETS.indexOf(b));
  }
  return parts.join('-');
}

function emptyLap(): Lap {
  return { km: 0, hours: 0, minutes: 0, stars: 0, note: '', difficulty: 'III', section: '' };
}
function emptyRiver(): River {
  return { name: '', country: 'CL', laps: [emptyLap()] };
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
  const { colors } = useTheme();
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

  useFocusEffect(
    useCallback(() => {
      if (!editId) {
        setDate(new Date());
        setNotes('');
        setRivers([emptyRiver()]);
        setMapPicker(null);
        setShowDatePicker(false);
      }
    }, [editId])
  );

  const today = new Date();

  function lastLocationsForRiver(name: string): { startLocation?: LatLng; endLocation?: LatLng } {
    for (const day of days) {
      const river = day.rivers.find((r) => r.name.toLowerCase() === name.toLowerCase());
      if (river) {
        const lap = river.laps.find((l) => l.startLocation);
        if (lap?.startLocation) return { startLocation: lap.startLocation, endLocation: lap.endLocation };
      }
    }
    return {};
  }

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
      return { ...r, laps: [...r.laps, { ...emptyLap(), difficulty: last?.difficulty ?? 'III', section: last?.section ?? '' }] };
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

  async function handleSave() {
    if (!canSave) return;
    const dayData: Day = { id: existingDay?.id ?? Date.now(), date: isoFromDate(date), notes, rivers };
    if (isEdit) await updateDay(dayData);
    else await addDay(dayData);
    await refreshNotificationSchedule(settings, [...days, dayData]);
    router.back();
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel={t('add.cancel')}>
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

        {rivers.map((river, ri) => (
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
                const locs = lastLocationsForRiver(name);
                updateRiver(ri, { name, country });
                updateLap(ri, 0, { difficulty: difficulty ?? 'III', section: section ?? '', ...locs });
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
                      onPress={() => updateLap(ri, li, { section: togglePreset(lap.section ?? '', s) })}
                    >
                      <Text style={[styles.sectionBtnText, isPresetActive(lap.section, s) && styles.sectionBtnTextActive]}>
                        {t(SECTION_I18N[s] as any)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={[styles.input, { marginTop: 6 }]}
                  value={lap.section ?? ''}
                  onChangeText={(section) => updateLap(ri, li, { section })}
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
                        onChangeText={(v) => updateLap(ri, li, { [field]: Number(v) || 0 } as any)}
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
        ))}

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
            updateLap(mapPicker.ri, mapPicker.li, { startLocation: start, endLocation: end });
            setMapPicker(null);
          }}
          onCancel={() => setMapPicker(null)}
        />
      )}
    </SafeAreaView>
  );
}
