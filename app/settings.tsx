import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Switch, TextInput,
  SafeAreaView, ScrollView, Platform, Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useApp } from '../lib/AppContext';
import { useTheme } from '../lib/themeContext';
import type { AppearanceMode } from '../lib/themeContext';
import type { Colors } from '../constants/theme';
import { requestPermission, hasPermission, refreshNotificationSchedule } from '../lib/notifications';
import { loadSavedLanguage, changeAppLanguage, type AppLanguage } from '../lib/i18n';
import { spacing, radius } from '../constants/theme';
import NotificationBanner from '../components/NotificationBanner';

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
    backBtn: { flexDirection: 'row', alignItems: 'center', width: 70 },
    backText: { color: c.primary, fontSize: 15 },
    title: { fontSize: 17, fontWeight: '700', color: c.textPrimary },
    scroll: { padding: spacing.md, paddingBottom: 48 },
    sectionCard: {
      backgroundColor: c.cardBg,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: c.border,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: c.textTertiary,
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
    rowText: { fontSize: 15, color: c.textPrimary },
    timeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: c.border,
      marginTop: 8,
    },
    timeLabel: { flex: 1, fontSize: 14, color: c.textSecondary },
    timeValue: { fontSize: 14, fontWeight: '700', color: c.primary },
    previewBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    previewBtnText: { color: c.primary, fontSize: 14 },
    hint: { fontSize: 12, color: c.textTertiary, marginTop: 10, lineHeight: 17 },
    dataRow: { flexDirection: 'row', alignItems: 'center' },
    dataItem: { flex: 1, alignItems: 'center', paddingVertical: 8 },
    dataValue: { fontSize: 28, fontWeight: '800', color: c.primary },
    dataLabel: { fontSize: 12, color: c.textTertiary, marginTop: 2 },
    dataSep: { width: 1, height: 40, backgroundColor: c.border },
    nameRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
    nameInput: { flex: 1, fontSize: 15, color: c.textPrimary, paddingVertical: 6 },
    saveBtn: {
      backgroundColor: c.primary,
      borderRadius: radius.sm,
      paddingHorizontal: 12,
      paddingVertical: 6,
      marginLeft: 8,
    },
    saveBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
    signOutRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
    signOutText: { fontSize: 15, color: c.danger, fontWeight: '600' },
    deleteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: c.border,
      marginTop: 8,
    },
    version: { textAlign: 'center', color: c.textTertiary, fontSize: 12, marginTop: 8 },
    optionRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 4,
    },
    optionCard: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 6,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.bg,
      gap: 6,
    },
    optionCardActive: {
      borderColor: c.primary,
      backgroundColor: `${c.primary}18`,
    },
    optionFlag: { fontSize: 28 },
    optionLabel: { fontSize: 12, fontWeight: '600', color: c.textSecondary, textAlign: 'center' },
    optionLabelActive: { color: c.primary },
    optionCheck: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { colors, mode: appearanceMode, setMode: setAppearanceMode } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { settings, updateSettings, days, displayName, updateName, signOut, deleteAccount } = useApp();
  const router = useRouter();
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [nameInput, setNameInput] = useState(displayName === 'paddler' ? '' : displayName);
  const [savingName, setSavingName] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [language, setLanguage] = useState<AppLanguage>('auto');

  useEffect(() => { loadSavedLanguage().then(setLanguage); }, []);
  useEffect(() => { setNameInput(displayName === 'paddler' ? '' : displayName); }, [displayName]);

  // Whenever the user returns to Settings, reconcile the in-app notifEnabled
  // flag with whatever iOS currently grants. If they disabled notifications
  // from iOS Settings since the last visit, our toggle would otherwise still
  // appear ON while no notifications actually fire.
  useFocusEffect(
    useCallback(() => {
      if (!settings.notifEnabled) return;
      hasPermission().then((granted) => {
        if (!granted) updateSettings({ ...settings, notifEnabled: false });
      });
    }, [settings, updateSettings]),
  );

  const nameDirty = nameInput.trim() !== (displayName === 'paddler' ? '' : displayName);

  async function handleSaveName() {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    setSavingName(true);
    try {
      const ok = await updateName(trimmed);
      if (!ok) Alert.alert(t('settings.saveFailed'), t('settings.tryAgainLater'));
    } catch {
      Alert.alert(t('settings.saveFailed'), t('settings.tryAgainLater'));
    } finally {
      setSavingName(false);
    }
  }

  const [h, m] = settings.notifTime.split(':').map(Number);
  const timeDate = new Date();
  timeDate.setHours(h, m, 0, 0);

  const totalDays = days.length;
  const totalLaps = days.reduce((acc, d) => acc + d.rivers.reduce((a, r) => a + r.laps.length, 0), 0);

  async function handleLanguageChange(lang: AppLanguage) {
    setLanguage(lang);
    await changeAppLanguage(lang);
    if (settings.notifEnabled) await refreshNotificationSchedule(settings, days);
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

  function confirmDeleteAccount() {
    Alert.alert(
      t('settings.deleteAccountTitle'),
      t('settings.deleteAccountConfirm'),
      [
        { text: t('settings.cancelBtn'), style: 'cancel' },
        {
          text: t('settings.deleteAccountBtn'),
          style: 'destructive',
          onPress: async () => {
            setDeletingAccount(true);
            try {
              const ok = await deleteAccount();
              // On success, signOut inside deleteAccount triggers the redirect
              // to the login screen via AuthGate.
              if (!ok) Alert.alert(t('settings.deleteAccountFailed'), t('settings.tryAgainLater'));
            } finally {
              setDeletingAccount(false);
            }
          },
        },
      ],
    );
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)' as any)} style={styles.backBtn} accessibilityLabel={t('settings.back')}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
          <Text style={styles.backText}>{t('settings.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('settings.title')}</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Notifications */}
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
              <TouchableOpacity style={styles.timeRow} onPress={() => setShowTimePicker(true)}>
                <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
                <Text style={styles.timeLabel}>{t('settings.reminderTime')}</Text>
                <Text style={styles.timeValue}>{settings.notifTime}</Text>
              </TouchableOpacity>

              {showTimePicker && (
                <DateTimePicker
                  value={timeDate} mode="time" is24Hour
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onTimeChange}
                />
              )}

              <TouchableOpacity style={styles.previewBtn} onPress={() => setShowPreview((v) => !v)}>
                <Ionicons name="eye-outline" size={16} color={colors.primary} />
                <Text style={styles.previewBtnText}>{t('settings.previewBtn')}</Text>
              </TouchableOpacity>

              {showPreview && <NotificationBanner time={settings.notifTime} />}
              <Text style={styles.hint}>{t('settings.notifOnHint')}</Text>
            </>
          )}

          {!settings.notifEnabled && <Text style={styles.hint}>{t('settings.notifOffHint')}</Text>}
        </View>

        {/* Appearance */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{t('settings.appearance')}</Text>
          <View style={styles.optionRow}>
            {([
              { mode: 'auto' as AppearanceMode, icon: '📱', label: t('settings.appearanceAuto') },
              { mode: 'light' as AppearanceMode, icon: '☀️', label: t('settings.appearanceLight') },
              { mode: 'dark' as AppearanceMode, icon: '🌙', label: t('settings.appearanceDark') },
            ]).map(({ mode, icon, label }) => {
              const active = appearanceMode === mode;
              return (
                <TouchableOpacity
                  key={mode}
                  style={[styles.optionCard, active && styles.optionCardActive]}
                  onPress={() => setAppearanceMode(mode)}
                >
                  <Text style={styles.optionFlag}>{icon}</Text>
                  <Text style={[styles.optionLabel, active && styles.optionLabelActive]} numberOfLines={1}>{label}</Text>
                  {active && (
                    <View style={styles.optionCheck}>
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Language */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
          <View style={styles.optionRow}>
            {([
              { lang: 'auto' as AppLanguage, flag: '🌐', label: t('settings.langAuto') },
              { lang: 'es' as AppLanguage, flag: '🇪🇸', label: t('settings.langEs') },
              { lang: 'en' as AppLanguage, flag: '🇺🇸', label: t('settings.langEn') },
            ]).map(({ lang, flag, label }) => {
              const active = language === lang;
              return (
                <TouchableOpacity
                  key={lang}
                  style={[styles.optionCard, active && styles.optionCardActive]}
                  onPress={() => handleLanguageChange(lang)}
                >
                  <Text style={styles.optionFlag}>{flag}</Text>
                  <Text style={[styles.optionLabel, active && styles.optionLabelActive]} numberOfLines={1}>{label}</Text>
                  {active && (
                    <View style={styles.optionCheck}>
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Data */}
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

        {/* Profile */}
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
              <TouchableOpacity style={[styles.saveBtn, savingName && { opacity: 0.6 }]} onPress={handleSaveName} disabled={savingName}>
                <Text style={styles.saveBtnText}>{savingName ? '...' : t('add.save')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Account */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{t('settings.account')}</Text>
          <TouchableOpacity
            style={styles.signOutRow}
            onPress={() => Alert.alert(t('settings.signOutTitle'), t('settings.signOutConfirm'), [
              { text: t('settings.cancelBtn'), style: 'cancel' },
              { text: t('settings.signOutBtn'), style: 'destructive', onPress: signOut },
            ])}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.danger} style={{ marginRight: 8 }} />
            <Text style={styles.signOutText}>{t('settings.signOut')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteRow}
            onPress={confirmDeleteAccount}
            disabled={deletingAccount}
          >
            <Ionicons name="trash-outline" size={20} color={colors.danger} style={{ marginRight: 8 }} />
            <Text style={styles.signOutText}>
              {deletingAccount ? t('settings.deleting') : t('settings.deleteAccount')}
            </Text>
          </TouchableOpacity>
          <Text style={styles.hint}>{t('settings.deleteAccountHint')}</Text>
        </View>

        <Text style={styles.version}>KayakLog · v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
