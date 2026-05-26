import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../lib/themeContext';
import type { Colors } from '../constants/theme';
import { mondayOf, todayISO, parseDateISO } from '../lib/dates';
import WeekCalendar from './WeekCalendar';
import { Day } from '../lib/types';
import { computeStreaks } from '../lib/streak';

interface Props {
  days: Day[];
}

function streakColor(n: number): string {
  if (n >= 7) return '#ff3b30';
  if (n >= 3) return '#ff9500';
  return '#ffb800';
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    card: { borderRadius: 16, padding: 16, marginBottom: 16 },
    cardNeutral: { backgroundColor: c.cardBg, borderWidth: 1, borderColor: c.border },
    header: { marginBottom: 12 },
    streakRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    flame: { fontSize: 36 },
    streakNum: { color: '#fff', fontSize: 22, fontWeight: '800' },
    streakNumNeutral: { color: c.textPrimary },
    recordText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },
    recordTextNeutral: { color: c.textTertiary },
    calendarWrap: { marginBottom: 12 },
    msg: { color: 'rgba(255,255,255,0.9)', fontSize: 13, textAlign: 'center', fontStyle: 'italic' },
    msgNeutral: { color: c.textTertiary },
  });
}

export default function StreakWidget({ days }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { current, longest, remoHoy } = computeStreaks(days);
  const active = current > 1;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.15, duration: 600, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [active]);

  const activeDates = new Set(days.map((d) => d.date));
  const monday = mondayOf(parseDateISO(todayISO()));

  const cardStyle = active
    ? [styles.card, { backgroundColor: streakColor(current) }]
    : [styles.card, styles.cardNeutral];

  return (
    <View style={cardStyle}>
      <View style={styles.header}>
        <View style={styles.streakRow}>
          <Animated.Text style={[styles.flame, { transform: [{ scale }] }]}>🔥</Animated.Text>
          <View>
            <Text style={[styles.streakNum, !active && styles.streakNumNeutral]}>
              {t('streak.counter', { count: current })}
            </Text>
            <Text style={[styles.recordText, !active && styles.recordTextNeutral]}>
              {t('streak.record', { count: longest })}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.calendarWrap}>
        <WeekCalendar monday={monday} activeDates={activeDates} flame={active} />
      </View>
      <Text style={[styles.msg, !active && styles.msgNeutral]}>
        {remoHoy ? t('streak.paddledToday') : t('streak.keepStreak')}
      </Text>
    </View>
  );
}
