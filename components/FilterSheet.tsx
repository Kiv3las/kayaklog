import React, { useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { Day, FilterType } from '../lib/types';
import { getAvailableYears, getAvailableMonthsForYear } from '../lib/filters';
import { colors } from '../constants/theme';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

interface Props {
  days: Day[];
  filter: FilterType;
  onSelect: (f: FilterType) => void;
  sheetRef: React.RefObject<BottomSheet | null>;
}

function isEqual(a: FilterType, b: FilterType): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'year' && b.kind === 'year') return a.year === b.year;
  if (a.kind === 'month' && b.kind === 'month') return a.year === b.year && a.month === b.month;
  return true;
}

function countForYear(days: Day[], year: number): number {
  return days.filter((d) => d.date.startsWith(`${year}`)).length;
}

function countForMonth(days: Day[], year: number, month: number): number {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  return days.filter((d) => d.date.startsWith(prefix)).length;
}

export default function FilterSheet({ days, filter, onSelect, sheetRef }: Props) {
  const snapPoints = useMemo(() => ['50%', '80%'], []);
  const years = getAvailableYears(days);

  function select(f: FilterType) {
    onSelect(f);
    sheetRef.current?.close();
  }

  function CheckMark({ active }: { active: boolean }) {
    if (!active) return null;
    return <Ionicons name="checkmark" size={18} color={colors.primary} />;
  }

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.indicator}
    >
      <BottomSheetScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sheetTitle}>Filtrar registros</Text>

        <Text style={styles.sectionLabel}>General</Text>
        <TouchableOpacity style={styles.row} onPress={() => select({ kind: 'all' })}>
          <Text style={styles.rowText}>Todos los registros</Text>
          <View style={styles.right}>
            <Text style={styles.count}>{days.length} días</Text>
            <CheckMark active={filter.kind === 'all'} />
          </View>
        </TouchableOpacity>

        {years.map((year) => {
          const months = getAvailableMonthsForYear(days, year);
          const yearActive = filter.kind === 'year' && filter.year === year;
          return (
            <View key={year}>
              <Text style={styles.sectionLabel}>{year}</Text>
              <TouchableOpacity style={styles.row} onPress={() => select({ kind: 'year', year })}>
                <Text style={styles.rowText}>Todo {year}</Text>
                <View style={styles.right}>
                  <Text style={styles.count}>{countForYear(days, year)} días</Text>
                  <CheckMark active={yearActive} />
                </View>
              </TouchableOpacity>
              {months.map((month) => {
                const monthActive = filter.kind === 'month' && filter.year === year && filter.month === month;
                return (
                  <TouchableOpacity
                    key={month}
                    style={[styles.row, styles.subRow]}
                    onPress={() => select({ kind: 'month', year, month })}
                  >
                    <Text style={styles.rowText}>{MONTH_NAMES[month - 1]}</Text>
                    <View style={styles.right}>
                      <Text style={styles.count}>{countForMonth(days, year, month)} días</Text>
                      <CheckMark active={monthActive} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetBg: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  indicator: {
    backgroundColor: '#ccc',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  subRow: {
    paddingLeft: 16,
  },
  rowText: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  count: {
    fontSize: 13,
    color: colors.textTertiary,
  },
});
