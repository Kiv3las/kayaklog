import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../lib/themeContext';
import type { Colors } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { spacing, radius } from '../../constants/theme';

function makeStyles(c: Colors) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: c.bg },
    container: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: 48,
    },
    emoji: { fontSize: 56, marginBottom: 8 },
    title: { fontSize: 28, fontWeight: '900', color: c.textPrimary, letterSpacing: -0.5, textAlign: 'center' },
    subtitle: { fontSize: 15, color: c.textTertiary, marginBottom: 32, marginTop: 8, textAlign: 'center' },
    form: { width: '100%', gap: 12 },
    input: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.sm,
      paddingHorizontal: 14,
      paddingVertical: 13,
      fontSize: 15,
      color: c.textPrimary,
      backgroundColor: c.cardBg,
    },
    msgBox: { borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: `${c.danger}18` },
    msgText: { fontSize: 13, color: c.danger },
    btn: {
      backgroundColor: c.primary,
      borderRadius: radius.sm,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 4,
    },
    btnDisabled: { backgroundColor: c.border },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  });
}

export default function ResetScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = password.length >= 6 && confirm.length >= 6 && !loading;

  async function handleSubmit() {
    if (password.length < 6) { setError(t('auth.passwordTooShort')); return; }
    if (password !== confirm) { setError(t('auth.passwordsDontMatch')); return; }
    setError('');
    setLoading(true);
    const t0 = Date.now();
    try {
      // Bypass supabase-js for the actual update. The client's wrapper does
      // a session-check + sometimes a token-refresh roundtrip first, which
      // on recovery sessions over flaky networks easily piles up to >15s.
      // A raw PUT against /auth/v1/user with the existing access token is
      // a single request and lets us use AbortController for a hard timeout.
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        setError(t('auth.resetExpired'));
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      let response: Response;
      try {
        response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
          method: 'PUT',
          headers: {
            'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ password }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }
      if (__DEV__) console.log(`[reset] PUT /auth/v1/user → ${response.status} in ${Date.now() - t0}ms`);

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        setError(errBody.msg || errBody.message || `HTTP ${response.status}`);
        return;
      }

      // Sign out the recovery session — best effort, the password is
      // already updated server-side so don't block the success path on it.
      try { await supabase.auth.signOut(); } catch { /* ignore */ }
      Alert.alert(t('auth.resetSuccess'), t('auth.resetSuccessDetail'), [
        { text: 'OK', onPress: () => router.replace('/auth/login' as any) },
      ]);
    } catch (err: any) {
      if (err?.name === 'AbortError') setError(t('auth.timeoutError'));
      else setError(err?.message ?? t('auth.timeoutError'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.emoji}>🔑</Text>
        <Text style={styles.title}>{t('auth.resetTitle')}</Text>
        <Text style={styles.subtitle}>{t('auth.resetSubtitle')}</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder={t('auth.newPassword')}
            placeholderTextColor={colors.textTertiary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />
          <TextInput
            style={styles.input}
            placeholder={t('auth.confirmPassword')}
            placeholderTextColor={colors.textTertiary}
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />

          {error ? (
            <View style={styles.msgBox}>
              <Text style={styles.msgText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.btn, !canSubmit && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator color="#fff" /> : (
              <Text style={styles.btnText}>{t('auth.updatePassword')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
