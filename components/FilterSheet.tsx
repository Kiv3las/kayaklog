import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../lib/themeContext';
import type { Colors } from '../constants/theme';
import { Day, FilterType } from '../lib/types';
import { getAvailableYears, getAvailableMonthsForYear } from '../lib/filters';

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

function makeStyles(c: Colors) {
  return StyleSheet.create({
    sheetBg: { backgroundColor: c.cardBg, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
    indicator: { backgroundColor: c.border },
    content: { paddingHorizontal: 16, paddingBottom: 32 },
    sheetTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: c.textPrimary,
      textAlign: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      marginBottom: 8,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: c.textTertiary,
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
      borderBottomColor: c.border,
    },
    subRow: { paddingLeft: 16 },
    rowText: { fontSize: 15, color: c.textPrimary },
    right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    count: { fontSize: 13, color: c.textTertiary },
  });
}

export default function FilterSheet({ days, filter, onSelect, sheetRef }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const snapPoints = useMemo(() => ['50%', '80%'], []);
  const years = getAvailableYears(days);
  const monthNames = t('months.long', { returnObjects: true }) as string[];

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
        <Text style={styles.sheetTitle}>{t('filter.title')}</Text>

        <Text style={styles.sectionLabel}>{t('filter.general')}</Text>
        <TouchableOpacity style={styles.row} onPress={() => select({ kind: 'all' })}>
          <Text style={styles.rowText}>{t('filter.allEntries')}</Text>
          <View style={styles.right}>
            <Text style={styles.count}>{t('filter.days', { count: days.length })}</Text>
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
                <Text style={styles.rowText}>{t('filter.allYear', { year })}</Text>
                <View style={styles.right}>
                  <Text style={styles.count}>{t('filter.days', { count: countForYear(days, year) })}</Text>
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
                    <Text style={styles.rowText}>{monthNames[month - 1]}</Text>
                    <View style={styles.right}>
                      <Text style={styles.count}>{t('filter.days', { count: countForMonth(days, year, month) })}</Text>
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
