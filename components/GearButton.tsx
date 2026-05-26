import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../lib/themeContext';

export default function GearButton() {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <TouchableOpacity
      onPress={() => router.push('/settings')}
      style={styles.btn}
      accessibilityLabel="Ajustes"
    >
      <Ionicons name="settings-outline" size={22} color={colors.primary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { padding: 4 },
});
