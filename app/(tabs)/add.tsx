import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, TextInput, Platform, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useApp } from '../../lib/AppContext';
import { Day, River, Lap, Difficulty } from '../../lib/types';
import { todayISO, isoFromDate, parseDateISO, formatDisplayDate } from '../../lib/dates';
import StarRating from '../../components/StarRating';
import RiverAutocomplete from '../../components/RiverAutocomplete';
import CountryPicker from '../../components/CountryPicker';
import GearButton from '../../components/GearButton';
import { colors, spacing, radius } from '../../constants/theme';
import { refreshNotificationSchedule } from '../../lib/notifications';

const DIFFICULTIES: Difficulty[] = ['I', 'II', 'III', 'IV', 'V', 'VI'];

function emptyLap(): Lap {
  return { km: 0, hours: 0, minutes: 0, stars: 0, note: '' };
}

function emptyRiver(): River {
  return { name: '', country: 'CL', difficulty: 'III', laps: [emptyLap()] };
}

export default function AddScreen() {
  const { days, addDay, updateDay, settings } = useApp();
  const router = useRouter();
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const isEdit = !!editId;

  const existingDay = useMemo(
    () => (editId ? days.find((d) => d.id === Number(editId)) : undefined),
    [editId, days]
  );

  const [date, setDate] = useState<Date>(
    existingDay ? parseDateISO(existingDay.date) : new Date()
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState(existingDay?.notes ?? '');
  const [rivers, setRivers] = useState<River[]>(
    existingDay?.rivers ?? [emptyRiver()]
  );

  const today = new Date();

  function updateRiver(ri: number, partial: Partial<River>) {
    setRivers((prev) => prev.map((r, i) => (i === ri ? { ...r, ...partial } : r)));
  }

  function updateLap(ri: number, li: number, partial: Partial<Lap>) {
    setRivers((prev) =>
      prev.map((r, i) =>
        i === ri
          ? { ...r, laps: r.laps.map((l, j) => (j === li ? { ...l, ...partial } : l)) }
          : r
      )
    );
  }

  function addRiver() {
    setRivers((prev) => [...prev, emptyRiver()]);
  }

  function removeRiver(ri: number) {
    setRivers((prev) => prev.filter((_, i) => i !== ri));
  }

  function addLap(ri: number) {
    setRivers((prev) =>
      prev.map((r, i) => (i === ri ? { ...r, laps: [...r.laps, emptyLap()] } : r))
    );
  }

  function removeLap(ri: number, li: number) {
    setRivers((prev) =>
      prev.map((r, i) =>
        i === ri ? { ...r, laps: r.laps.filter((_, j) => j !== li) } : r
      )
    );
  }

  function duplicateLap(ri: number, li: number) {
    setRivers((prev) =>
      prev.map((r, i) => {
        if (i !== ri) return r;
        const lap = { ...r.laps[li] };
        const newLaps = [...r.laps];
        newLaps.splice(li + 1, 0, lap);
        return { ...r, laps: newLaps };
      })
    );
  }

  const canSave = rivers.length > 0 && rivers.every((r) => r.name.trim().length > 0);

  async function handleSave() {
    if (!canSave) return;
    const dayData: Day = {
      id: existingDay?.id ?? Date.now(),
      date: isoFromDate(date),
      notes,
      rivers,
    };
    if (isEdit) {
      await updateDay(dayData);
    } else {
      await addDay(dayData);
    }
    await refreshNotificationSchedule(settings, [...days, dayData]);
    router.back();
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        {isEdit ? (
          <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Cancelar">
            <Text style={styles.cancelLink}>Cancelar</Text>
          </TouchableOpacity>
        ) : (
          <GearButton />
        )}
        <Text style={styles.title}>{isEdit ? 'Editar día' : 'Nuevo día'}</Text>
        <TouchableOpacity onPress={handleSave} disabled={!canSave} accessibilityLabel="Guardar">
          <Text style={[styles.saveLink, !canSave && styles.saveLinkDisabled]}>
            {isEdit ? 'Guardar cambios' : 'Guardar'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Date picker */}
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>Fecha</Text>
          <View style={styles.dateRow}>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDatePicker(true)}>
              <Ionicons name="calendar-outline" size={18} color={colors.primary} />
              <Text style={styles.dateBtnText}>{formatDisplayDate(isoFromDate(date))}</Text>
            </TouchableOpacity>
            {!isEdit && (
              <TouchableOpacity style={styles.todayBtn} onPress={() => setDate(new Date())}>
                <Text style={styles.todayBtnText}>Hoy</Text>
              </TouchableOpacity>
            )}
          </View>
          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              maximumDate={today}
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={(_, selected) => {
                setShowDatePicker(false);
                if (selected) setDate(selected);
              }}
            />
          )}
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>Notas del día</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="¿Cómo estuvo la jornada?"
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Rivers */}
        {rivers.map((river, ri) => (
          <View key={ri} style={styles.riverCard}>
            <View style={styles.riverCardHeader}>
              <Text style={styles.riverCardTitle}>Río {ri + 1}</Text>
              {rivers.length > 1 && (
                <TouchableOpacity onPress={() => removeRiver(ri)} accessibilityLabel="Eliminar río">
                  <Ionicons name="close-circle" size={20} color={colors.danger} />
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.fieldLabel}>Nombre</Text>
            <RiverAutocomplete
              value={river.name}
              onChange={(name) => updateRiver(ri, { name })}
              onSelect={(name, country, difficulty) => updateRiver(ri, { name, country, difficulty })}
              days={days}
              placeholder="Nombre del río"
            />

            <Text style={[styles.fieldLabel, { marginTop: 10 }]}>País</Text>
            <CountryPicker
              value={river.country}
              onChange={(country) => updateRiver(ri, { country })}
            />

            <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Clase</Text>
            <View style={styles.diffRow}>
              {DIFFICULTIES.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.diffBtn, river.difficulty === d && styles.diffBtnActive]}
                  onPress={() => updateRiver(ri, { difficulty: d })}
                  accessibilityLabel={`Clase ${d}`}
                >
                  <Text style={[styles.diffBtnText, river.difficulty === d && styles.diffBtnTextActive]}>
                    {d}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Laps */}
            {river.laps.map((lap, li) => (
              <View key={li} style={styles.lapCard}>
                <View style={styles.lapHeader}>
                  <Text style={styles.lapTitle}>Lap {li + 1}</Text>
                  <View style={styles.lapActions}>
                    <TouchableOpacity onPress={() => duplicateLap(ri, li)} accessibilityLabel="Duplicar lap">
                      <Ionicons name="copy-outline" size={18} color={colors.primary} />
                    </TouchableOpacity>
                    {river.laps.length > 1 && (
                      <TouchableOpacity onPress={() => removeLap(ri, li)} accessibilityLabel="Eliminar lap">
                        <Ionicons name="trash-outline" size={18} color={colors.danger} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                <View style={styles.lapRow}>
                  <View style={styles.lapField}>
                    <Text style={styles.fieldLabel}>Km</Text>
                    <TextInput
                      style={styles.input}
                      value={lap.km === 0 ? '' : String(lap.km)}
                      onChangeText={(v) => updateLap(ri, li, { km: Number(v) || 0 })}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={colors.textTertiary}
                    />
                  </View>
                  <View style={styles.lapField}>
                    <Text style={styles.fieldLabel}>Horas</Text>
                    <TextInput
                      style={styles.input}
                      value={lap.hours === 0 ? '' : String(lap.hours)}
                      onChangeText={(v) => updateLap(ri, li, { hours: Number(v) || 0 })}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor={colors.textTertiary}
                    />
                  </View>
                  <View style={styles.lapField}>
                    <Text style={styles.fieldLabel}>Minutos</Text>
                    <TextInput
                      style={styles.input}
                      value={lap.minutes === 0 ? '' : String(lap.minutes)}
                      onChangeText={(v) => updateLap(ri, li, { minutes: Number(v) || 0 })}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor={colors.textTertiary}
                    />
                  </View>
                </View>

                <Text style={styles.fieldLabel}>Rating</Text>
                <StarRating
                  value={lap.stars}
                  onChange={(stars) => updateLap(ri, li, { stars })}
                />

                <Text style={[styles.fieldLabel, { marginTop: 8 }]}>Comentario</Text>
                <TextInput
                  style={styles.input}
                  value={lap.note}
                  onChangeText={(note) => updateLap(ri, li, { note })}
                  placeholder="Opcional..."
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
            ))}

            <TouchableOpacity style={styles.addLapBtn} onPress={() => addLap(ri)}>
              <Ionicons name="add" size={16} color={colors.primary} />
              <Text style={styles.addLapText}>Añadir lap</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={styles.addRiverBtn} onPress={addRiver}>
          <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
          <Text style={styles.addRiverText}>Añadir río</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!canSave}
        >
          <Text style={styles.saveBtnText}>{isEdit ? 'Guardar cambios' : 'Guardar'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.cardBg,
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  cancelLink: { fontSize: 15, color: colors.danger },
  saveLink: { fontSize: 15, color: colors.primary, fontWeight: '700' },
  saveLinkDisabled: { color: colors.textTertiary },
  scroll: { padding: spacing.md, paddingBottom: 48 },
  section: { marginBottom: spacing.md },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textTertiary,
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
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  dateBtnText: { fontSize: 14, color: colors.textPrimary },
  todayBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  todayBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: '#fff',
  },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
  diffRow: {
    flexDirection: 'row',
    gap: 6,
  },
  diffBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: '#fff',
  },
  diffBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  diffBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  diffBtnTextActive: {
    color: '#fff',
  },
  riverCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  riverCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  riverCardTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  lapCard: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  lapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  lapTitle: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  lapActions: { flexDirection: 'row', gap: 10 },
  lapRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  lapField: { flex: 1 },
  addLapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  addLapText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  addRiverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    marginBottom: spacing.md,
  },
  addRiverText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnDisabled: { backgroundColor: colors.border },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
