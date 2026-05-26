import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  FlatList, TextInput, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COUNTRIES_BY_CONTINENT, Country, countryByCode } from '../lib/countries';
import { colors } from '../constants/theme';

interface Props {
  value: string;
  onChange: (code: string) => void;
}

interface Section {
  continent: string;
  countries: Country[];
}

type Item = { type: 'header'; title: string } | { type: 'country'; data: Country };

export default function CountryPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const country = countryByCode[value];

  const allItems: Item[] = [];
  Object.entries(COUNTRIES_BY_CONTINENT).forEach(([continent, countries]) => {
    const filtered = search
      ? countries.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
      : countries;
    if (filtered.length > 0) {
      allItems.push({ type: 'header', title: continent });
      filtered.forEach((c) => allItems.push({ type: 'country', data: c }));
    }
  });

  function select(code: string) {
    onChange(code);
    setOpen(false);
    setSearch('');
  }

  return (
    <>
      <TouchableOpacity style={styles.trigger} onPress={() => setOpen(true)} accessibilityLabel="Seleccionar país">
        <Text style={styles.flag}>{country?.flag ?? '🏳️'}</Text>
        <Text style={styles.name}>{country?.name ?? 'Seleccionar país'}</Text>
        <Ionicons name="chevron-down" size={16} color={colors.textTertiary} />
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Seleccionar país</Text>
            <TouchableOpacity onPress={() => { setOpen(false); setSearch(''); }} accessibilityLabel="Cerrar">
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={16} color={colors.textTertiary} style={{ marginRight: 6 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar país..."
              value={search}
              onChangeText={setSearch}
              autoFocus
              placeholderTextColor={colors.textTertiary}
            />
          </View>
          <FlatList
            data={allItems}
            keyExtractor={(item, i) => i.toString()}
            renderItem={({ item }) => {
              if (item.type === 'header') {
                return <Text style={styles.continentHeader}>{item.title}</Text>;
              }
              const selected = item.data.code === value;
              return (
                <TouchableOpacity
                  style={[styles.countryRow, selected && styles.selectedRow]}
                  onPress={() => select(item.data.code)}
                >
                  <Text style={styles.flag}>{item.data.flag}</Text>
                  <Text style={[styles.countryName, selected && styles.selectedText]}>
                    {item.data.name}
                  </Text>
                  {selected && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                </TouchableOpacity>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#fff',
    gap: 8,
  },
  flag: {
    fontSize: 20,
  },
  name: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
  },
  modal: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    backgroundColor: colors.bg,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
  },
  continentHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.bg,
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  selectedRow: {
    backgroundColor: '#e8f0ff',
  },
  countryName: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
  },
  selectedText: {
    color: colors.primary,
    fontWeight: '600',
  },
});
