import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Switch, TextInput,
  SafeAreaView, ScrollView, Platform, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useApp } from '../lib/AppContext';
import { requestPermission, refreshNotificationSchedule } from '../lib/notifications';
import { loadSavedLanguage, changeAppLanguage, type AppLanguage } from '../lib/i18n';
import NotificationBanner from '../components/NotificationBanner';
import { colors, spacing, radius } from '../constants/theme';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { settings, updateSettings, days, displayName, updateName, signOut } = useApp();
  const router = useRouter();
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [nameInput, setNameInput] = useState(displayName === 'paddler' ? '' : displayName);
  const [savingName, setSavingName] = useState(false);
  const [language, setLanguage] = useState<AppLanguage>('auto');

  useEffect(() => {
    loadSavedLanguage().then(setLanguage);
  }, []);

  useEffect(() => {
    setNameInput(displayName === 'paddler' ? '' : displayName);
  }, [displayName]);

  const nameDirty = nameInput.trim() !== (displayName === 'paddler' ? '' : displayName);

  async function handleSaveName() {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    setSavingName(true);
    await updateName(trimmed);
    setSavingName(false);
  }

  const [h, m] = settings.notifTime.split(':').map(Number);
  const timeDate = new Date();
  timeDate.setHours(h, m, 0, 0);

  const totalDays = days.length;
  const totalLaps = days.reduce(
    (acc, d) => acc + d.rivers.reduce((a, r) => a + r.laps.length, 0),
    0
  );

  async function handleLanguageChange(lang: AppLanguage) {
    setLanguage(lang);
    await changeAppLanguage(lang);
    if (settings.notifEnabled) {
      await refreshNotificationSchedule(settings, days);
    }
  }

  async function toggleNotif(value: boolean) {
    if (value) {
      const granted = await requestPermission();
      if (!granted) {
        Alert.alert(t('settings.permissionDenied'), t('settings.enableInSystem'));
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel={t('settings.back')}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
          <Text style={styles.backText}>{t('settings.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('settings.title')}</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Notifications section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{t('settings.notifications')}</Text>

          <View style={styles.row}>
            <View style={styles.rowLabel}>
              <Ionicons name="notifications-outline" size={20} color={colors.primary} style={{ marginRight: 8 }} />
              <Text style={styles.rowText}>{t('settings.dailyReminder')}</Text>
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
                <Text style={styles.timeLabel}>{t('settings.reminderTime')}</Text>
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
                <Text style={styles.previewBtnText}>{t('settings.previewBtn')}</Text>
              </TouchableOpacity>

              {showPreview && <NotificationBanner time={settings.notifTime} />}

              <Text style={styles.hint}>{t('settings.notifOnHint')}</Text>
            </>
          )}

          {!settings.notifEnabled && (
            <Text style={styles.hint}>{t('settings.notifOffHint')}</Text>
          )}
        </View>

        {/* Language section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
          <View style={styles.langRow}>
            {([
              { lang: 'auto', flag: '🌐', label: t('settings.langAuto') },
              { lang: 'es',   flag: '🇪🇸', label: t('settings.langEs') },
              { lang: 'en',   flag: '🇺🇸', label: t('settings.langEn') },
            ] as { lang: AppLanguage; flag: string; label: string }[]).map(({ lang, flag, label }) => {
              const active = language === lang;
              return (
                <TouchableOpacity
                  key={lang}
                  style={[styles.langCard, active && styles.langCardActive]}
                  onPress={() => handleLanguageChange(lang)}
                >
                  <Text style={styles.langFlag}>{flag}</Text>
                  <Text style={[styles.langLabel, active && styles.langLabelActive]} numberOfLines={1}>
                    {label}
                  </Text>
                  {active && (
                    <View style={styles.langCheck}>
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Data section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{t('settings.data')}</Text>
          <View style={styles.dataRow}>
            <View style={styles.dataItem}>
              <Text style={styles.dataValue}>{totalDays}</Text>
              <Text style={styles.dataLabel}>{t('settings.daysLogged')}</Text>
            </View>
            <View style={styles.dataSep} />
            <View style={styles.dataItem}>
              <Text style={styles.dataValue}>{totalLaps}</Text>
              <Text style={styles.dataLabel}>{t('settings.totalLaps')}</Text>
            </View>
          </View>
        </View>

        {/* Profile section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{t('settings.profile')}</Text>
          <View style={styles.nameRow}>
            <Ionicons name="person-outline" size={20} color={colors.primary} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.nameInput}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder={t('settings.yourName')}
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleSaveName}
            />
            {nameDirty && (
              <TouchableOpacity
                style={[styles.saveBtn, savingName && { opacity: 0.6 }]}
                onPress={handleSaveName}
                disabled={savingName}
              >
                <Text style={styles.saveBtnText}>{savingName ? '...' : t('add.save')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Account section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{t('settings.account')}</Text>
          <TouchableOpacity
            style={styles.signOutRow}
            onPress={() =>
              Alert.alert(t('settings.signOutTitle'), t('settings.signOutConfirm'), [
                { text: t('settings.cancelBtn'), style: 'cancel' },
                { text: t('settings.signOutBtn'), style: 'destructive', onPress: signOut },
              ])
            }
          >
            <Ionicons name="log-out-outline" size={20} color={colors.danger} style={{ marginRight: 8 }} />
            <Text style={styles.signOutText}>{t('settings.signOut')}</Text>
          </TouchableOpacity>
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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  nameInput: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    paddingVertical: 6,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 8,
  },
  saveBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  signOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  signOutText: { fontSize: 15, color: colors.danger, fontWeight: '600' },
  version: {
    textAlign: 'center',
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 8,
  },
  langRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  langCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    gap: 6,
  },
  langCardActive: {
    borderColor: colors.primary,
    backgroundColor: '#e8f2ff',
  },
  langFlag: {
    fontSize: 28,
  },
  langLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  langLabelActive: {
    color: colors.primary,
  },
  langCheck: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
