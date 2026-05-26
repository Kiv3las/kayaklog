import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTranslation } from 'react-i18next';
import { mondayOf, todayISO, parseDateISO } from '../lib/dates';
import WeekCalendar from './WeekCalendar';
import { Day } from '../lib/types';
import { computeStreaks } from '../lib/streak';
import { colors } from '../constants/theme';

interface Props {
  days: Day[];
}

function streakColor(n: number): string {
  if (n >= 7) return colors.flame3;
  if (n >= 3) return colors.flame2;
  return colors.flame1;
}

export default function StreakWidget({ days }: Props) {
  const { t } = useTranslation();
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

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardNeutral: {
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    marginBottom: 12,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  flame: {
    fontSize: 36,
  },
  streakNum: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  streakNumNeutral: {
    color: colors.textPrimary,
  },
  recordText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '600',
  },
  recordTextNeutral: {
    color: colors.textTertiary,
  },
  calendarWrap: {
    marginBottom: 12,
  },
  msg: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  msgNeutral: {
    color: colors.textTertiary,
  },
});
