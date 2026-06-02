import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments, type Href } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import 'react-native-reanimated';
import { AppProvider } from '../lib/AppContext';
import { ThemeProvider, useTheme } from '../lib/themeContext';
import { supabase } from '../lib/supabase';
import { initLanguage } from '../lib/i18n';

WebBrowser.maybeCompleteAuthSession();

function AuthGate({ session }: { session: Session | null | undefined }) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (session === undefined) return;
    const inAuth = (segments[0] as string) === 'auth';
    // The password reset screen runs WITH a recovery session — don't bounce
    // the user out to /(tabs) when they're mid-reset just because they're
    // technically authenticated.
    const onReset = (segments[1] as string) === 'reset';
    if (!session && !inAuth) {
      router.replace('/auth/login' as Href);
    } else if (session && inAuth && !onReset) {
      router.replace('/(tabs)' as Href);
    }
  }, [session, segments]);

  return null;
}

// Watches for deep links from Supabase password recovery emails. Supabase v2
// emits two URL shapes depending on the configured flow type:
//   PKCE (default):  kayaklog://auth/reset?code=XXX&type=recovery
//   Implicit:        kayaklog://auth/reset#access_token=...&refresh_token=...&type=recovery
// We handle both — parse the token/code, install the recovery session, and
// navigate to the reset screen so the user can pick a new password.
function PasswordResetLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    async function handle(url: string | null) {
      if (!url) return;
      if (__DEV__) {
        // Redact query/fragment: they carry the recovery code and (in the
        // implicit flow) the access/refresh tokens. Never log them, even in dev.
        const safe = url.split('#')[0].split('?')[0];
        console.log('[reset-handler] incoming url:', safe, '(query/fragment redacted)');
      }

      // Split URL into query and fragment portions. React Native's URL
      // implementation chokes on custom schemes, so we parse by hand.
      const hashIndex = url.indexOf('#');
      const queryIndex = url.indexOf('?');
      const queryEnd = hashIndex === -1 ? url.length : hashIndex;
      const queryStr = queryIndex !== -1 ? url.slice(queryIndex + 1, queryEnd) : '';
      const fragmentStr = hashIndex !== -1 ? url.slice(hashIndex + 1) : '';

      // PKCE flow → exchange the one-time code for a session.
      if (queryStr) {
        const params = new URLSearchParams(queryStr);
        const code = params.get('code');
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (__DEV__) console.log('[reset-handler] exchangeCodeForSession error:', error?.message);
          if (error) return;
          router.replace('/auth/reset' as Href);
          return;
        }
      }

      // Implicit flow → install the access/refresh tokens directly.
      if (fragmentStr) {
        const params = new URLSearchParams(fragmentStr);
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        const type = params.get('type');
        if (type === 'recovery' && access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (__DEV__) console.log('[reset-handler] setSession error:', error?.message);
          if (error) return;
          router.replace('/auth/reset' as Href);
        }
      }
    }
    Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    return () => sub.remove();
  }, [router]);

  return null;
}

function RootContent() {
  const { colors } = useTheme();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    initLanguage().then(() => setI18nReady(true));
  }, []);

  useEffect(() => {
    let mounted = true;

    // Resolve the splash state from the locally cached session — never block
    // on the network so the app opens immediately when offline.
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      // Validate the cached JWT against the server in the background. Sign
      // out only if the server explicitly rejects it (401/403). Network
      // errors leave the session intact — offline use keeps the user signed in.
      if (data.session) {
        supabase.auth.getUser().then(({ error }) => {
          if (!mounted) return;
          if (error?.status === 401 || error?.status === 403) {
            supabase.auth.signOut();
          }
        });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      if (mounted) setSession(s);
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  if (session === undefined || !i18nReady) {
    return (
      <View style={[styles.splash, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <AppProvider>
      <AuthGate session={session} />
      <PasswordResetLinkHandler />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="map" options={{ headerShown: false }} />
        <Stack.Screen name="achievements" options={{ headerShown: false }} />
      </Stack>
    </AppProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider>
        <RootContent />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
