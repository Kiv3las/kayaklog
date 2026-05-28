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
    try {
      // The deep-link handler in app/_layout.tsx will have already called
      // supabase.auth.setSession() with the recovery tokens, so the user is
      // authenticated at this point and updateUser will succeed.
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) {
        // Most common cause: the recovery session expired or was never set.
        setError(err.message);
        return;
      }
      // Sign out the recovery session so the user has to log in normally with
      // their new password — avoids leaving a privileged session lingering
      // and gives a clear confirmation that the change took effect.
      await supabase.auth.signOut();
      Alert.alert(t('auth.resetSuccess'), t('auth.resetSuccessDetail'), [
        { text: 'OK', onPress: () => router.replace('/auth/login' as any) },
      ]);
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
