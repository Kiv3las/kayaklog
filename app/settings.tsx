import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Switch,
  SafeAreaView, ScrollView, Platform, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useApp } from '../lib/AppContext';
import { requestPermission } from '../lib/notifications';
import NotificationBanner from '../components/NotificationBanner';
import { colors, spacing, radius } from '../constants/theme';

export default function SettingsScreen() {
  const { settings, updateSettings, days } = useApp();
  const router = useRouter();
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const [h, m] = settings.notifTime.split(':').map(Number);
  const timeDate = new Date();
  timeDate.setHours(h, m, 0, 0);

  const totalDays = days.length;
  const totalLaps = days.reduce(
    (acc, d) => acc + d.rivers.reduce((a, r) => a + r.laps.length, 0),
    0
  );

  async function toggleNotif(value: boolean) {
    if (value) {
      const granted = await requestPermission();
      if (!granted) {
        Alert.alert('Permiso denegado', 'Activa las notificaciones en Ajustes del sistema.');
        return;
      }
    }
    await updateSettings({ ...settings, notifEnabled: value });
  }

  async function onTimeChange(_: unknown, selected?: Date) {
    setShowTimePicker(Platform.OS === 'ios');
    if (!selected) return;
    const hh = selected.getHours();
    const mm = selected.getMinutes();
    const notifTime = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    await updateSettings({ ...settings, notifTime });
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Atrás">
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
          <Text style={styles.backText}>Atrás</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Ajustes</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Notifications section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Notificaciones</Text>

          <View style={styles.row}>
            <View style={styles.rowLabel}>
              <Ionicons name="notifications-outline" size={20} color={colors.primary} style={{ marginRight: 8 }} />
              <Text style={styles.rowText}>Recordatorio diario</Text>
            </View>
            <Switch
              value={settings.notifEnabled}
              onValueChange={toggleNotif}
              trackColor={{ false: colors.border, true: colors.success }}
              thumbColor="#fff"
              ios_backgroundColor={colors.border}
            />
          </View>

          {settings.notifEnabled && (
            <>
              <TouchableOpacity
                style={styles.timeRow}
                onPress={() => setShowTimePicker(true)}
              >
                <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
                <Text style={styles.timeLabel}>Hora del recordatorio</Text>
                <Text style={styles.timeValue}>{settings.notifTime}</Text>
              </TouchableOpacity>

              {showTimePicker && (
                <DateTimePicker
                  value={timeDate}
                  mode="time"
                  is24Hour
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onTimeChange}
                />
              )}

              <TouchableOpacity
                style={styles.previewBtn}
                onPress={() => setShowPreview((v) => !v)}
              >
                <Ionicons name="eye-outline" size={16} color={colors.primary} />
                <Text style={styles.previewBtnText}>Vista previa de la notificación</Text>
              </TouchableOpacity>

              {showPreview && <NotificationBanner time={settings.notifTime} />}

              <Text style={styles.hint}>
                Solo recibirás el recordatorio los días que no hayas registrado una salida.
              </Text>
            </>
          )}

          {!settings.notifEnabled && (
            <Text style={styles.hint}>
              Activa el recordatorio para recibir una notificación diaria si no has registrado una salida.
            </Text>
          )}
        </View>

        {/* Data section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Datos</Text>
          <View style={styles.dataRow}>
            <View style={styles.dataItem}>
              <Text style={styles.dataValue}>{totalDays}</Text>
              <Text style={styles.dataLabel}>Días registrados</Text>
            </View>
            <View style={styles.dataSep} />
            <View style={styles.dataItem}>
              <Text style={styles.dataValue}>{totalLaps}</Text>
              <Text style={styles.dataLabel}>Laps totales</Text>
            </View>
          </View>
        </View>

        <Text style={styles.version}>KayakLog · v1.0.0</Text>
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
  backBtn: { flexDirection: 'row', alignItems: 'center', width: 70 },
  backText: { color: colors.primary, fontSize: 15 },
  title: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  scroll: { padding: spacing.md, paddingBottom: 48 },
  sectionCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  rowLabel: { flexDirection: 'row', alignItems: 'center' },
  rowText: { fontSize: 15, color: colors.textPrimary },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 8,
  },
  timeLabel: { flex: 1, fontSize: 14, color: colors.textSecondary },
  timeValue: { fontSize: 14, fontWeight: '700', color: colors.primary },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  previewBtnText: { color: colors.primary, fontSize: 14 },
  hint: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 10,
    lineHeight: 17,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dataItem: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  dataValue: { fontSize: 28, fontWeight: '800', color: colors.primary },
  dataLabel: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  dataSep: { width: 1, height: 40, backgroundColor: colors.border },
  version: {
    textAlign: 'center',
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 8,
  },
});
