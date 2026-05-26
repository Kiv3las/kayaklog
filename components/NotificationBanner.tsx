import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../lib/themeContext';
import type { Colors } from '../constants/theme';

interface Props {
  time: string;
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    banner: {
      flexDirection: 'row',
      backgroundColor: c.bg,
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
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: { flex: 1 },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 2,
    },
    appName: { fontSize: 12, fontWeight: '600', color: c.textTertiary },
    time: { fontSize: 12, color: c.textTertiary },
    title: { fontSize: 14, fontWeight: '700', color: c.textPrimary },
    body: { fontSize: 13, color: c.textSecondary },
  });
}

export default function NotificationBanner({ time }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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
        <Text style={styles.title}>{t('notif.title')}</Text>
        <Text style={styles.body}>{t('notif.body')}</Text>
      </View>
    </View>
  );
}
