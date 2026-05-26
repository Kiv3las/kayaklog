import React, { useRef, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, SectionList, TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../lib/AppContext';
import { FilterType } from '../../lib/types';
import { applyFilter, filterLabel } from '../../lib/filters';
import { aggregateRivers, formatTime, RiverStat } from '../../lib/stats';
import { countryByCode, COUNTRIES } from '../../lib/countries';
import StarsDisplay from '../../components/StarsDisplay';
import FilterSheet from '../../components/FilterSheet';
import GearButton from '../../components/GearButton';
import { colors, spacing, radius } from '../../constants/theme';

interface CountrySection {
  title: string;
  country: string;
  flag: string;
  totalKm: number;
  totalRivers: number;
  data: RiverStat[];
}

function buildSections(rivers: RiverStat[]): CountrySection[] {
  const byCountry = new Map<string, RiverStat[]>();
  for (const r of rivers) {
    const list = byCountry.get(r.country) ?? [];
    list.push(r);
    byCountry.set(r.country, list);
  }

  return Array.from(byCountry.entries())
    .map(([code, list]) => {
      const country = countryByCode[code];
      const totalKm = list.reduce((acc, r) => acc + r.km, 0);
      return {
        title: country?.name ?? code,
        country: code,
        flag: country?.flag ?? '🏳️',
        totalKm: Math.round(totalKm * 10) / 10,
        totalRivers: list.length,
        data: list.sort((a, b) => b.km - a.km),
      };
    })
    .sort((a, b) => b.totalKm - a.totalKm);
}

export default function RiversScreen() {
  const { t } = useTranslation();
  const { days } = useApp();
  const sheetRef = useRef<BottomSheet>(null);
  const [filter, setFilter] = useState<FilterType>({ kind: 'all' });

  const filtered = useMemo(() => applyFilter(days, filter), [days, filter]);
  const rivers = useMemo(() => aggregateRivers(filtered), [filtered]);
  const sections = useMemo(() => buildSections(rivers), [rivers]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('rivers.title')}</Text>
        <GearButton />
      </View>

      <TouchableOpacity style={styles.filterBtn} onPress={() => sheetRef.current?.expand()}>
        <Ionicons name="filter-outline" size={16} color={colors.primary} />
        <Text style={styles.filterText}>{filterLabel(filter)}</Text>
        <Ionicons name="chevron-down" size={14} color={colors.textTertiary} />
      </TouchableOpacity>

      {sections.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="water-outline" size={48} color={colors.textTertiary} />
          <Text style={styles.emptyText}>{t('rivers.empty')}</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, i) => `${item.name}-${item.country}-${i}`}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <RiversSectionHeader section={section} />
          )}
          renderItem={({ item }) => <RiverRow river={item} />}
        />
      )}

      <FilterSheet
        days={days}
        filter={filter}
        onSelect={setFilter}
        sheetRef={sheetRef}
      />
    </SafeAreaView>
  );
}

function RiversSectionHeader({ section }: { section: CountrySection }) {
  const { t } = useTranslation();
  return (
    <View style={styles.countryHeader}>
      <Text style={styles.countryFlag}>{section.flag}</Text>
      <View style={styles.countryInfo}>
        <Text style={styles.countryName}>{section.title}</Text>
        <Text style={styles.countryMeta}>
          {t('rivers.count', { count: section.totalRivers })} · {section.totalKm} {t('rivers.km')}
        </Text>
      </View>
    </View>
  );
}

function RiverRow({ river }: { river: RiverStat }) {
  const { t } = useTranslation();
  return (
    <View style={styles.riverCard}>
      <View style={styles.riverTop}>
        <Text style={styles.riverName}>{river.name}</Text>
        <View style={styles.diffBadge}>
          <Text style={styles.diffText}>{t('rivers.class', { level: river.difficulty })}</Text>
        </View>
      </View>
      {river.avgRating > 0 && (
        <View style={{ marginBottom: 6 }}>
          <StarsDisplay value={Math.round(river.avgRating)} />
        </View>
      )}
      <View style={styles.riverStats}>
        <StatPill icon="speedometer-outline" label={`${river.km} km`} />
        <StatPill icon="repeat-outline" label={`${river.laps} lap${river.laps !== 1 ? 's' : ''}`} />
        <StatPill icon="time-outline" label={formatTime(river.timeMinutes)} />
      </View>
    </View>
  );
}

function StatPill({ icon, label }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string }) {
  return (
    <View style={styles.pill}>
      <Ionicons name={icon} size={12} color={colors.textSecondary} />
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.cardBg,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'flex-start',
  },
  filterText: { fontSize: 14, color: colors.primary, fontWeight: '600' },
  list: { padding: spacing.md, paddingTop: 0, paddingBottom: 32 },
  countryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 6,
    marginTop: 12,
  },
  countryFlag: { fontSize: 28 },
  countryInfo: { flex: 1 },
  countryName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  countryMeta: { fontSize: 12, color: colors.textTertiary },
  riverCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.sm,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  riverTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  riverName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, flex: 1 },
  diffBadge: {
    backgroundColor: colors.bg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    marginLeft: 8,
  },
  diffText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  riverStats: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.bg,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pillText: { fontSize: 12, color: colors.textSecondary },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyText: { fontSize: 16, color: colors.textTertiary },
});
