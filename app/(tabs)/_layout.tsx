import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../lib/themeContext';
import { addFormSignal } from '../../lib/addFormSignal';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, focused, outlineName }: { name: IoniconsName; focused: boolean; outlineName: IoniconsName }) {
  const { colors } = useTheme();
  return <Ionicons name={focused ? name : outlineName} size={24} color={focused ? colors.primary : colors.textTertiary} />;
}

function AddTabButton() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  // Raise a reset flag the Add screen reads via useFocusEffect, then
  // navigate. URL-param clearing is unreliable across tab switches, so this
  // out-of-band signal is what guarantees a blank form after tapping "+".
  return (
    <TouchableOpacity
      style={styles.addBtn}
      onPress={() => {
        addFormSignal.resetPending = true;
        router.navigate('/(tabs)/add');
      }}
      activeOpacity={0.85}
      accessibilityLabel={t('newDay')}
    >
      <View style={[styles.addBtnCircle, { backgroundColor: colors.primary, shadowColor: colors.primary }]}>
        <Ionicons name="add" size={32} color="#fff" />
      </View>
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          borderTopColor: colors.border,
          backgroundColor: colors.cardBg,
          overflow: 'visible',
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.home'), tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} outlineName="home-outline" /> }} />
      <Tabs.Screen name="log" options={{ title: t('tabs.log'), tabBarIcon: ({ focused }) => <TabIcon name="list" focused={focused} outlineName="list-outline" /> }} />
      <Tabs.Screen
        name="add"
        options={{
          title: '',
          tabBarButton: () => <AddTabButton />,
        }}
      />
      <Tabs.Screen name="stats" options={{ title: t('tabs.stats'), tabBarIcon: ({ focused }) => <TabIcon name="bar-chart" focused={focused} outlineName="bar-chart-outline" /> }} />
      <Tabs.Screen name="rivers" options={{ title: t('tabs.rivers'), tabBarIcon: ({ focused }) => <TabIcon name="water" focused={focused} outlineName="water-outline" /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  addBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', top: -16 },
  addBtnCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 10,
  },
});
