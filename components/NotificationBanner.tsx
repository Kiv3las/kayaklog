import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/theme';

interface Props {
  time: string;
}

export default function NotificationBanner({ time }: Props) {
  return (
    <View style={styles.banner}>
      <View style={styles.appIcon}>
        <Ionicons name="water" size={20} color="#fff" />
      </View>
      <View style={styles.content}>
        <View style={styles.row}>
          <Text style={styles.appName}>KayakLog</Text>
          <Text style={styles.time}>{time}</Text>
        </View>
        <Text style={styles.title}>Kayak</Text>
        <Text style={styles.body}>¿Remaste hoy? Añade un registro</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f5',
    borderRadius: 14,
    padding: 12,
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 8,
  },
  appIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  appName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  time: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  body: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});
