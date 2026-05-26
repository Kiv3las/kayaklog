import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { colors, spacing, radius } from '../../constants/theme';

type Mode = 'login' | 'register';

export default function LoginScreen() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  function switchMode(m: Mode) {
    setMode(m);
    setMessage('');
    setName('');
  }

  async function handleForgotPassword() {
    if (!email) {
      setIsError(true);
      setMessage(t('auth.enterEmailFirst'));
      return;
    }
    setMessage('');
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) {
        setIsError(true);
        setMessage(error.message);
      } else {
        setIsError(false);
        setMessage(t('auth.resetSent'));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (!email || !password) return;
    setMessage('');
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) { setIsError(true); setMessage(error.message); }
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name: name.trim() } },
        });
        if (error) {
          setIsError(true);
          setMessage(error.message);
        } else {
          setIsError(false);
          setMessage(t('auth.confirmEmail'));
        }
      }
    } finally {
      setLoading(false);
    }
  }

  const canSubmit =
    email.length > 0 &&
    password.length >= 6 &&
    !loading &&
    (mode === 'login' || name.trim().length > 0);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <Text style={styles.emoji}>🚣</Text>
        <Text style={styles.appName}>KayakLog</Text>
        <Text style={styles.tagline}>{t('auth.tagline')}</Text>

        {/* Mode switcher */}
        <View style={styles.tabs}>
          {(['login', 'register'] as Mode[]).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.tab, mode === m && styles.tabActive]}
              onPress={() => switchMode(m)}
            >
              <Text style={[styles.tabText, mode === m && styles.tabTextActive]}>
                {m === 'login' ? t('auth.signIn') : t('auth.register')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Form */}
        <View style={styles.form}>
          {mode === 'register' && (
            <TextInput
              style={styles.input}
              placeholder={t('auth.name')}
              placeholderTextColor={colors.textTertiary}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="next"
            />
          )}
          <TextInput
            style={styles.input}
            placeholder={t('auth.email')}
            placeholderTextColor={colors.textTertiary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />
          <TextInput
            style={styles.input}
            placeholder={t('auth.password')}
            placeholderTextColor={colors.textTertiary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />

          {message ? (
            <View style={[styles.msgBox, isError ? styles.msgError : styles.msgSuccess]}>
              <Text style={[styles.msgText, isError ? styles.msgTextError : styles.msgTextSuccess]}>
                {message}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.btn, !canSubmit && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>
                {mode === 'login' ? t('auth.enterBtn') : t('auth.createBtn')}
              </Text>
            )}
          </TouchableOpacity>

          {mode === 'login' && (
            <TouchableOpacity onPress={handleForgotPassword} disabled={loading} style={styles.forgotBtn}>
              <Text style={styles.forgotText}>{t('auth.forgotPassword')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 48,
  },
  emoji: { fontSize: 56, marginBottom: 8 },
  appName: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 15,
    color: colors.textTertiary,
    marginBottom: 40,
    marginTop: 4,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.border,
    borderRadius: radius.sm,
    padding: 2,
    width: '100%',
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabActive: { backgroundColor: '#fff' },
  tabText: { fontSize: 14, color: colors.textTertiary, fontWeight: '600' },
  tabTextActive: { color: colors.primary },
  form: { width: '100%', gap: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: '#fff',
  },
  msgBox: {
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  msgError: { backgroundColor: '#fff0f0' },
  msgSuccess: { backgroundColor: '#f0fff4' },
  msgText: { fontSize: 13 },
  msgTextError: { color: colors.danger },
  msgTextSuccess: { color: colors.success },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  btnDisabled: { backgroundColor: colors.border },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  forgotBtn: { alignItems: 'center', paddingVertical: 4, marginTop: 4 },
  forgotText: { color: colors.textTertiary, fontSize: 13 },
});
