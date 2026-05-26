import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { addDays, format } from 'date-fns';
import { isoFromDate, todayISO } from '../lib/dates';

interface Props {
  monday: Date;
  activeDates: Set<string>;
  flame?: boolean;
}

const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export default function WeekCalendar({ monday, activeDates, flame = true }: Props) {
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
            <View style={[
              styles.bubble,
              flame ? styles.bubbleFlame : styles.bubbleNeutral,
              isToday && (flame ? styles.todayRingFlame : styles.todayRingNeutral),
              isActive && (flame ? styles.activeBubbleFlame : styles.activeBubbleNeutral),
            ]}>
              <Text style={[
                styles.dayNum,
                isActive
                  ? (flame ? styles.activeDayNumFlame : styles.activeDayNumNeutral)
                  : (flame ? styles.inactiveDayNumFlame : styles.inactiveDayNumNeutral),
              ]}>
                {format(date, 'd')}
              </Text>
            </View>
            <Text style={flame ? styles.labelFlame : styles.labelNeutral}>{label}</Text>
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
  bubbleNeutral: {
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  todayRingFlame: {
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  todayRingNeutral: {
    borderWidth: 2,
    borderColor: '#0a84ff',
  },
  activeBubbleFlame: {
    backgroundColor: '#ffffff',
  },
  activeBubbleNeutral: {
    backgroundColor: '#ff9500',
  },
  dayNum: {
    fontSize: 13,
    fontWeight: '700',
  },
  activeDayNumFlame: {
    color: '#ff9500',
  },
  activeDayNumNeutral: {
    color: '#ffffff',
  },
  inactiveDayNumFlame: {
    color: 'rgba(255,255,255,0.7)',
  },
  inactiveDayNumNeutral: {
    color: '#666666',
  },
  labelFlame: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  labelNeutral: {
    fontSize: 10,
    color: '#888888',
    fontWeight: '600',
  },
});
