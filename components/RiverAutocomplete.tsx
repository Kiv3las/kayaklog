import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList } from 'react-native';
import { Day, Difficulty } from '../lib/types';
import { countryByCode } from '../lib/countries';
import { colors } from '../constants/theme';

interface RiverSuggestion {
  name: string;
  country: string;
  difficulty: Difficulty;
  count: number;
}

interface Props {
  value: string;
  onChange: (name: string) => void;
  onSelect: (name: string, country: string, difficulty: Difficulty) => void;
  days: Day[];
  placeholder?: string;
}

function buildDict(days: Day[]): RiverSuggestion[] {
  const map = new Map<string, RiverSuggestion>();
  for (const day of days) {
    for (const river of day.rivers) {
      const key = river.name.toLowerCase();
      const existing = map.get(key);
      if (existing) {
        existing.count++;
      } else {
        map.set(key, { name: river.name, country: river.country, difficulty: river.difficulty, count: 1 });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

export default function RiverAutocomplete({ value, onChange, onSelect, days, placeholder }: Props) {
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
        placeholder={placeholder ?? 'Nombre del río'}
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
                onPress={() => { onSelect(s.name, s.country, s.difficulty); setFocused(false); }}
              >
                <Text style={styles.flag}>{country?.flag ?? '🏳️'}</Text>
                <View style={styles.suggestionInfo}>
                  <Text style={styles.suggestionName}>{s.name}</Text>
                  <Text style={styles.suggestionDetail}>{s.count} salida{s.count !== 1 ? 's' : ''} · Clase {s.difficulty}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: '#fff',
  },
  dropdown: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
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
  suggestionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  flag: {
    fontSize: 18,
  },
  suggestionInfo: {
    flex: 1,
  },
  suggestionName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  suggestionDetail: {
    fontSize: 12,
    color: colors.textTertiary,
  },
});
