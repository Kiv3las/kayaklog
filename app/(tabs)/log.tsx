import React, { useRef, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, SectionList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import BottomSheet from '@gorhom/bottom-sheet';
import { useApp } from '../../lib/AppContext';
import { useTheme } from '../../lib/themeContext';
import type { Colors } from '../../constants/theme';
import { FilterType, Day } from '../../lib/types';
import { applyFilter, filterLabel, getAvailableYears } from '../../lib/filters';
import { formatDisplayDate } from '../../lib/dates';
import { spacing, radius } from '../../constants/theme';
import i18n from '../../lib/i18n';
import DayCard from '../../components/DayCard';
import ConfirmDialog from '../../components/ConfirmDialog';
import FilterSheet from '../../components/FilterSheet';
import GearButton from '../../components/GearButton';

interface Section { title: string; data: Day[] }

function buildSections(days: Day[], filter: FilterType): Section[] {
  if (days.length === 0) return [];
  if (filter.kind === 'month') return [{ title: '', data: days }];

  if (filter.kind === 'year') {
    const months: Record<string, Day[]> = {};
    for (const day of days) {
      const key = day.date.slice(0, 7);
      if (!months[key]) months[key] = [];
      months[key].push(day);
    }
    const monthNames = i18n.t('months.long', { returnObjects: true }) as string[];
    return Object.keys(months)
      .sort((a, b) => b.localeCompare(a))
      .map((k) => ({ title: monthNames[Number(k.slice(5, 7)) - 1], data: months[k] }));
  }

  const years: Record<string, Day[]> = {};
  for (const day of days) {
    const key = day.date.slice(0, 4);
    if (!years[key]) years[key] = [];
    years[key].push(day);
  }
  return Object.keys(years)
    .sort((a, b) => b.localeCompare(a))
    .map((k) => ({ title: k, data: years[k] }));
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    title: { fontSize: 22, fontWeight: '800', color: c.textPrimary },
    filterBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginHorizontal: spacing.md,
      marginBottom: spacing.sm,
      backgroundColor: c.cardBg,
      borderRadius: radius.sm,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: c.border,
      alignSelf: 'flex-start',
    },
    filterText: { fontSize: 14, color: c.primary, fontWeight: '600' },
    list: { padding: spacing.md, paddingTop: 0, paddingBottom: 32 },
    sectionHeader: { marginBottom: 6, marginTop: 12 },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: c.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    emptyText: { fontSize: 16, color: c.textTertiary },
  });
}

export default function LogScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { days, deleteDay } = useApp();
  const router = useRouter();
  const sheetRef = useRef<BottomSheet>(null);
  const [filter, setFilter] = useState<FilterType>({ kind: 'all' });
  const [deleteTarget, setDeleteTarget] = useState<Day | null>(null);

  const filtered = useMemo(() => applyFilter(days, filter), [days, filter]);
  const sections = useMemo(() => buildSections(filtered, filter), [filtered, filter]);

  function handleDelete() {
    if (!deleteTarget) return;
    deleteDay(deleteTarget.id);
    setDeleteTarget(null);
  }

  function deleteInfo(day: Day): string {
    let km = 0, laps = 0;
    for (const r of day.rivers) { for (const l of r.laps) { km += l.km; laps++; } }
    return `${formatDisplayDate(day.date)} · ${km}km · ${laps} lap${laps !== 1 ? 's' : ''}`;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('log.title')}</Text>
        <GearButton />
      </View>

      <TouchableOpacity style={styles.filterBtn} onPress={() => sheetRef.current?.expand()}>
        <Ionicons name="filter-outline" size={16} color={colors.primary} />
        <Text style={styles.filterText}>{filterLabel(filter)}</Text>
        <Ionicons name="chevron-down" size={14} color={colors.textTertiary} />
      </TouchableOpacity>

      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="water-outline" size={48} color={colors.textTertiary} />
          <Text style={styles.emptyText}>{t('log.empty')}</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section: { title } }) =>
            title ? (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{title}</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <DayCard
              day={item}
              onEdit={() => router.push({ pathname: '/(tabs)/add', params: { editId: item.id } })}
              onDelete={() => setDeleteTarget(item)}
            />
          )}
        />
      )}

      <FilterSheet days={days} filter={filter} onSelect={setFilter} sheetRef={sheetRef} />

      <ConfirmDialog
        visible={deleteTarget !== null}
        title={t('log.deleteTitle')}
        message={deleteTarget ? deleteInfo(deleteTarget) : ''}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </SafeAreaView>
  );
}
