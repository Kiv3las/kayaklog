import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { mondayOf, todayISO, parseDateISO } from '../lib/dates';
import WeekCalendar from './WeekCalendar';
import { Day } from '../lib/types';
import { computeStreaks } from '../lib/streak';
import { colors } from '../constants/theme';

interface Props {
  days: Day[];
}

function streakColor(n: number): [string, string] {
  if (n >= 7) return [colors.flame3, '#cc2020'];
  if (n >= 3) return [colors.flame2, '#cc6600'];
  return [colors.flame1, '#cc8800'];
}

export default function StreakWidget({ days }: Props) {
  const { current, longest, remoHoy } = computeStreaks(days);
  const [colorTop, colorBottom] = streakColor(current);
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.15, duration: 600, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const activeDates = new Set(days.map((d) => d.date));
  const monday = mondayOf(parseDateISO(todayISO()));

  return (
    <View style={[styles.card, { backgroundColor: colorTop }]}>
      <View style={styles.header}>
        <View style={styles.streakRow}>
          <Animated.Text style={[styles.flame, { transform: [{ scale }] }]}>🔥</Animated.Text>
          <View>
            <Text style={styles.streakNum}>{current} días seguidos</Text>
            <Text style={styles.recordText}>Récord: {longest}</Text>
          </View>
        </View>
      </View>
      <View style={styles.calendarWrap}>
        <WeekCalendar monday={monday} activeDates={activeDates} />
      </View>
      <Text style={styles.msg}>
        {remoHoy ? '¡Ya remaste hoy!' : 'Rema hoy para mantener la racha'}
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
  recordText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '600',
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
});
