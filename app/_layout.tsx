import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments, type Href } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
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
    const inAuth = (segments[0] as string) === '(auth)';
    if (!session && !inAuth) {
      router.replace('/(auth)/login' as Href);
    } else if (session && inAuth) {
      router.replace('/(tabs)' as Href);
    }
  }, [session, segments]);

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
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="map" options={{ headerShown: false }} />
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
