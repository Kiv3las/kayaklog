import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { addDays, format } from 'date-fns';
import { isoFromDate, todayISO } from '../lib/dates';
import { useTheme } from '../lib/themeContext';
import type { Colors } from '../constants/theme';

interface Props {
  monday: Date;
  activeDates: Set<string>;
  flame?: boolean;
}

const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function makeNeutralStyles(c: Colors) {
  return {
    bubble: { backgroundColor: `${c.textTertiary}22` },
    todayRing: { borderWidth: 2, borderColor: c.primary },
    activeBubble: { backgroundColor: '#ff9500' },
    activeDayNum: { color: '#ffffff' },
    inactiveDayNum: { color: c.textSecondary },
    label: { color: c.textTertiary },
  };
}

export default function WeekCalendar({ monday, activeDates, flame = true }: Props) {
  const { colors } = useTheme();
  const neutral = useMemo(() => makeNeutralStyles(colors), [colors]);
  const today = todayISO();

  return (
    <View style={styles.row}>
      {DAY_LABELS.map((label, i) => {
        const date = addDays(monday, i);
        const iso = isoFromDate(date);
        const isActive = activeDates.has(iso);
        const isToday = iso === today;

        const bubbleStyle = flame
          ? [styles.bubble, styles.bubbleFlame, isToday && styles.todayRingFlame, isActive && styles.activeBubbleFlame]
          : [styles.bubble, neutral.bubble, isToday && neutral.todayRing, isActive && neutral.activeBubble];

        const numStyle = flame
          ? [styles.dayNum, isActive ? styles.activeDayNumFlame : styles.inactiveDayNumFlame]
          : [styles.dayNum, isActive ? neutral.activeDayNum : neutral.inactiveDayNum];

        return (
          <View key={i} style={styles.col}>
            <View style={bubbleStyle as any}>
              <Text style={numStyle as any}>{format(date, 'd')}</Text>
            </View>
            <Text style={[styles.labelBase, flame ? styles.labelFlame : neutral.label]}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  col: {
    alignItems: 'center',
    flex: 1,
  },
  bubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  bubbleFlame: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  todayRingFlame: {
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  activeBubbleFlame: {
    backgroundColor: '#ffffff',
  },
  dayNum: {
    fontSize: 13,
    fontWeight: '700',
  },
  activeDayNumFlame: {
    color: '#ff9500',
  },
  inactiveDayNumFlame: {
    color: 'rgba(255,255,255,0.7)',
  },
  labelBase: {
    fontSize: 10,
    fontWeight: '600',
  },
  labelFlame: {
    color: 'rgba(255,255,255,0.8)',
  },
});
