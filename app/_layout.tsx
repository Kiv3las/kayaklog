import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments, type Href } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import 'react-native-reanimated';
import { AppProvider } from '../lib/AppContext';
import { supabase } from '../lib/supabase';
import { colors } from '../constants/theme';

function AuthGate({ session }: { session: Session | null | undefined }) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (session === undefined) return; // still resolving

    const inAuth = (segments[0] as string) === '(auth)';
    if (!session && !inAuth) {
      router.replace('/(auth)/login' as Href);
    } else if (session && inAuth) {
      router.replace('/(tabs)' as Href);
    }
  }, [session, segments]);

  return null;
}

export default function RootLayout() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <AppProvider>
        <AuthGate session={session} />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="settings" options={{ presentation: 'modal', headerShown: false }} />
        </Stack>
      </AppProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
