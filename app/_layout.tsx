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
    supabase.auth.getSession().then(async ({ data }) => {
      const s = data.session;
      if (s) {
        const { error } = await supabase.auth.getUser();
        if (error?.status === 401 || error?.status === 403) {
          await supabase.auth.signOut();
          setSession(null);
          return;
        }
      }
      setSession(s ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    return () => subscription.unsubscribe();
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
