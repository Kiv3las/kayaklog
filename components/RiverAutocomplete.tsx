import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../lib/themeContext';
import type { Colors } from '../constants/theme';
import { Day, Difficulty } from '../lib/types';
import { countryByCode } from '../lib/countries';

interface RiverSuggestion {
  name: string;
  country: string;
  difficulty: Difficulty;
  section?: string;
  count: number;
}

interface Props {
  value: string;
  onChange: (name: string) => void;
  onSelect: (name: string, country: string, difficulty: Difficulty, section?: string) => void;
  days: Day[];
  placeholder?: string;
}

function buildDict(days: Day[]): RiverSuggestion[] {
  const map = new Map<string, RiverSuggestion>();
  // `days` arrives sorted newest → oldest. The first time we encounter a
  // river is therefore the most recent trip on it; only then do we capture
  // its section/difficulty so the suggestion reflects the latest setup, not
  // the oldest one. Subsequent encounters just increment the count.
  for (const day of days) {
    for (const river of day.rivers) {
      const key = river.name.toLowerCase();
      const existing = map.get(key);
      if (existing) {
        existing.count++;
      } else {
        const firstLap = river.laps[0];
        map.set(key, {
          name: river.name,
          country: river.country,
          difficulty: firstLap?.difficulty ?? 'III',
          section: firstLap?.section,
          count: 1,
        });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    input: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 10,
      fontSize: 14,
      color: c.textPrimary,
      backgroundColor: c.cardBg,
    },
    dropdown: {
      backgroundColor: c.cardBg,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      marginTop: 2,
      overflow: 'hidden',
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      zIndex: 100,
    },
    suggestion: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 10,
      gap: 8,
    },
    suggestionBorder: { borderBottomWidth: 1, borderBottomColor: c.border },
    flag: { fontSize: 18 },
    suggestionInfo: { flex: 1 },
    suggestionName: { fontSize: 14, fontWeight: '600', color: c.textPrimary },
    suggestionDetail: { fontSize: 12, color: c.textTertiary },
    sectionChip: {
      backgroundColor: `${c.primary}18`,
      borderRadius: 4,
      paddingHorizontal: 5,
      paddingVertical: 1,
      alignSelf: 'flex-start',
      marginTop: 2,
    },
    sectionChipText: { fontSize: 11, fontWeight: '600', color: c.primary },
  });
}

export default function RiverAutocomplete({ value, onChange, onSelect, days, placeholder }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [focused, setFocused] = useState(false);
  const suggestions = useMemo(() => buildDict(days), [days]);

  const filtered = focused && value.length > 0
    ? suggestions.filter((s) => s.name.toLowerCase().includes(value.toLowerCase())).slice(0, 5)
    : [];

  return (
    <View>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder={placeholder ?? t('autocomplete.placeholder')}
        placeholderTextColor={colors.textTertiary}
        returnKeyType="done"
      />
      {filtered.length > 0 && (
        <View style={styles.dropdown}>
          {filtered.map((s, i) => {
            const country = countryByCode[s.country];
            return (
              <TouchableOpacity
                key={i}
                style={[styles.suggestion, i < filtered.length - 1 && styles.suggestionBorder]}
                onPress={() => { onSelect(s.name, s.country, s.difficulty, s.section); setFocused(false); }}
              >
                <Text style={styles.flag}>{country?.flag ?? '🏳️'}</Text>
                <View style={styles.suggestionInfo}>
                  <Text style={styles.suggestionName}>{s.name}</Text>
                  <Text style={styles.suggestionDetail}>
                    {t('autocomplete.trips', { count: s.count })} · {t('autocomplete.detail', { level: s.difficulty })}
                  </Text>
                  {s.section && s.section !== '' && s.section !== 'todo' && (
                    <View style={styles.sectionChip}>
                      <Text style={styles.sectionChipText}>{s.section}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}
