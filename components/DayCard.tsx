import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../lib/themeContext';
import type { Colors } from '../constants/theme';
import { Day } from '../lib/types';
import { formatDisplayDate } from '../lib/dates';
import { countryByCode } from '../lib/countries';
import StarsDisplay from './StarsDisplay';

interface Props {
  day: Day;
  onEdit: () => void;
  onDelete: () => void;
}

function avgStars(day: Day): number {
  let total = 0;
  let count = 0;
  for (const river of day.rivers) {
    for (const lap of river.laps) {
      if (lap.stars > 0) { total += lap.stars; count++; }
    }
  }
  return count > 0 ? Math.round(total / count) : 0;
}

function formatTime(h: number, m: number): string {
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.cardBg,
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: c.border,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 10,
    },
    date: { fontSize: 15, fontWeight: '700', color: c.textPrimary, marginBottom: 4 },
    actions: { flexDirection: 'row', gap: 8 },
    iconBtn: { padding: 6 },
    riverBlock: {
      marginTop: 6,
      paddingTop: 6,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    riverHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
    flag: { fontSize: 16 },
    riverName: { flex: 1, fontSize: 14, fontWeight: '600', color: c.textPrimary },
    diffBadge: {
      backgroundColor: c.bg,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: c.border,
    },
    diffText: { fontSize: 11, fontWeight: '600', color: c.textSecondary },
    lapRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 4,
      paddingLeft: 22,
    },
    lapStats: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    lapStat: { fontSize: 13, color: c.textSecondary },
    lapDot: { color: c.textTertiary },
    lapNote: { fontSize: 12, color: c.textTertiary, fontStyle: 'italic', flex: 1 },
  });
}

export default function DayCard({ day, onEdit, onDelete }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const avg = avgStars(day);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.date}>{formatDisplayDate(day.date)}</Text>
          {avg > 0 && <StarsDisplay value={avg} />}
        </View>
        <View style={styles.actions}>
          <TouchableOpacity onPress={onEdit} style={styles.iconBtn} accessibilityLabel={t('dayCard.editDay')}>
            <Ionicons name="pencil" size={18} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={styles.iconBtn} accessibilityLabel={t('dayCard.deleteDay')}>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
          </TouchableOpacity>
        </View>
      </View>

      {day.rivers.map((river, ri) => {
        const country = countryByCode[river.country];
        return (
          <View key={ri} style={styles.riverBlock}>
            <View style={styles.riverHeader}>
              <Text style={styles.flag}>{country?.flag ?? '🏳️'}</Text>
              <Text style={styles.riverName}>{river.name}</Text>
              <View style={styles.diffBadge}>
                <Text style={styles.diffText}>{t('dayCard.class', { level: river.difficulty })}</Text>
              </View>
            </View>
            {river.laps.map((lap, li) => (
              <View key={li} style={styles.lapRow}>
                <View style={styles.lapStats}>
                  <Text style={styles.lapStat}>{lap.km} km</Text>
                  <Text style={styles.lapDot}>·</Text>
                  <Text style={styles.lapStat}>{formatTime(lap.hours, lap.minutes)}</Text>
                </View>
                {lap.stars > 0 && <StarsDisplay value={lap.stars} size={11} />}
                {lap.note ? <Text style={styles.lapNote} numberOfLines={1}>{lap.note}</Text> : null}
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}
