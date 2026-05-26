import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { addDays, format } from 'date-fns';
import { isoFromDate, todayISO } from '../lib/dates';

interface Props {
  monday: Date;
  activeDates: Set<string>;
}

const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export default function WeekCalendar({ monday, activeDates }: Props) {
  const today = todayISO();

  return (
    <View style={styles.row}>
      {DAY_LABELS.map((label, i) => {
        const date = addDays(monday, i);
        const iso = isoFromDate(date);
        const isActive = activeDates.has(iso);
        const isToday = iso === today;

        return (
          <View key={i} style={styles.col}>
            <View style={[styles.bubble, isToday && styles.todayRing, isActive && styles.activeBubble]}>
              <Text style={[styles.dayNum, isActive ? styles.activeDayNum : styles.inactiveDayNum]}>
                {format(date, 'd')}
              </Text>
            </View>
            <Text style={styles.label}>{label}</Text>
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
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 4,
  },
  todayRing: {
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  activeBubble: {
    backgroundColor: '#ffffff',
  },
  dayNum: {
    fontSize: 13,
    fontWeight: '700',
  },
  activeDayNum: {
    color: '#ff9500',
  },
  inactiveDayNum: {
    color: 'rgba(255,255,255,0.7)',
  },
  label: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
});
