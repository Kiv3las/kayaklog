import React from 'react';
import { View, TouchableOpacity, StyleSheet, GestureResponderEvent } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function tabIcon(name: IoniconsName, focused: boolean, outlineName: IoniconsName) {
  return <Ionicons name={focused ? name : outlineName} size={24} color={focused ? colors.primary : colors.textTertiary} />;
}

function AddTabButton({ onPress }: { onPress?: ((e: GestureResponderEvent) => void) | null }) {
  return (
    <TouchableOpacity style={styles.addBtn} onPress={onPress ?? undefined} activeOpacity={0.85} accessibilityLabel="Nuevo día">
      <View style={styles.addBtnCircle}>
        <Ionicons name="add" size={32} color="#fff" />
      </View>
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: { borderTopColor: colors.border, overflow: 'visible' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio', tabBarIcon: ({ focused }) => tabIcon('home', focused, 'home-outline') }} />
      <Tabs.Screen name="log" options={{ title: 'Registro', tabBarIcon: ({ focused }) => tabIcon('list', focused, 'list-outline') }} />
      <Tabs.Screen
        name="add"
        options={{
          title: '',
          tabBarButton: (props) => <AddTabButton onPress={props.onPress as ((e: GestureResponderEvent) => void) | null} />,
        }}
      />
      <Tabs.Screen name="stats" options={{ title: 'Stats', tabBarIcon: ({ focused }) => tabIcon('bar-chart', focused, 'bar-chart-outline') }} />
      <Tabs.Screen name="rivers" options={{ title: 'Mis ríos', tabBarIcon: ({ focused }) => tabIcon('water', focused, 'water-outline') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  addBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    top: -16,
  },
  addBtnCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 10,
  },
});
