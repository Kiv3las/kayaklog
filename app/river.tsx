import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useApp } from '../lib/AppContext';
import { useTheme } from '../lib/themeContext';
import type { Colors } from '../constants/theme';
import { spacing, radius } from '../constants/theme';
import { Difficulty, Lap, WaterLevel } from '../lib/types';
import { formatTime } from '../lib/stats';
import { formatDisplayDate } from '../lib/dates';
import { countryByCode } from '../lib/countries';
import { WATER_LEVEL_COLOR, WATER_LEVEL_I18N, waterRank } from '../lib/water';
import StarsDisplay from '../components/StarsDisplay';

const DIFFICULTY_COLOR: Record<Difficulty, string> = {
  I: '#30d158', II: '#34c759', III: '#ffd60a', IV: '#ff9f0a', V: '#ff453a', VI: '#bf5af2',
};
const DIFF_ORDER: Difficulty[] = ['I', 'II', 'III', 'IV', 'V', 'VI'];

interface Entry { id: string; date: string; lap: Lap }

function makeStyles(c: Colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing.md, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.cardBg,
    },
    backBtn: { flexDirection: 'row', alignItems: 'center', width: 70 },
    backText: { color: c.primary, fontSize: 15 },
    headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'center' },
    headerFlag: { fontSize: 18 },
    headerTitle: { fontSize: 17, fontWeight: '700', color: c.textPrimary, flexShrink: 1 },
    scroll: { padding: spacing.md, paddingBottom: 32 },

    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
    statCard: {
      backgroundColor: c.cardBg, borderRadius: radius.md, padding: spacing.md,
      alignItems: 'center', width: '31.5%', borderWidth: 1, borderColor: c.border,
    },
    statValue: { fontSize: 18, fontWeight: '800', color: c.textPrimary },
    statLabel: { fontSize: 11, color: c.textTertiary, marginTop: 2, textAlign: 'center' },

    sectionTitle: {
      fontSize: 13, fontWeight: '700', color: c.textTertiary,
      textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm, marginTop: spacing.sm,
    },
    highlightRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
    highlightCard: {
      flex: 1, backgroundColor: c.cardBg, borderRadius: radius.md, padding: spacing.md,
      borderWidth: 1, borderColor: c.border,
    },
    highlightLabel: { fontSize: 11, color: c.textTertiary, marginBottom: 4 },
    highlightValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    highlightValue: { fontSize: 15, fontWeight: '800', color: c.textPrimary },
    highlightDate: { fontSize: 12, color: c.textSecondary, marginTop: 2 },

    sortRow: { flexDirection: 'row', gap: 6, marginBottom: spacing.sm },
    sortBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.sm,
      borderWidth: 1, borderColor: c.border, backgroundColor: c.cardBg,
    },
    sortBtnActive: { borderColor: c.primary, backgroundColor: `${c.primary}18` },
    sortBtnText: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
    sortBtnTextActive: { color: c.primary },

    lapCard: {
      backgroundColor: c.cardBg, borderRadius: radius.md, padding: spacing.md,
      marginBottom: 8, borderWidth: 1, borderColor: c.border,
    },
    lapTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    lapDate: { fontSize: 14, fontWeight: '700', color: c.textPrimary },
    badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    badgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
    chip: {
      flexDirection: 'row', alignItems: 'center', gap: 3,
      backgroundColor: c.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    },
    chipText: { fontSize: 12, color: c.textSecondary },
    waterChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    waterChipText: { fontSize: 11, fontWeight: '700' },
    note: { fontSize: 13, color: c.textSecondary, marginTop: 8, fontStyle: 'italic' },
    empty: { textAlign: 'center', color: c.textTertiary, paddingVertical: 40 },
  });
}

export default function RiverDetailScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { days } = useApp();
  const { name = '', country = '' } = useLocalSearchParams<{ name?: string; country?: string }>();
  const [sort, setSort] = useState<'date' | 'water'>('date');

  const flag = countryByCode[country]?.flag ?? '🏞️';

  const entries = useMemo<Entry[]>(() => {
    const target = name.trim().toLowerCase();
    const list: Entry[] = [];
    for (const day of days) {
      for (const river of day.rivers) {
        if (river.name.trim().toLowerCase() !== target || river.country !== country) continue;
        river.laps.forEach((lap, i) => list.push({ id: `${day.id}-${i}`, date: day.date, lap }));
      }
    }
    return list;
  }, [days, name, country]);

  const stats = useMemo(() => {
    let km = 0, minutes = 0, totalStars = 0, rated = 0, hardest = 0;
    const sections = new Set<string>();
    let first = '', last = '';
    for (const { date, lap } of entries) {
      km += lap.km;
      minutes += lap.hours * 60 + lap.minutes;
      if (lap.stars > 0) { totalStars += lap.stars; rated++; }
      const di = lap.difficulty ? DIFF_ORDER.indexOf(lap.difficulty) + 1 : 0;
      if (di > hardest) hardest = di;
      if (lap.section) for (const s of lap.section.split('-').filter(Boolean)) sections.add(s);
      if (!first || date < first) first = date;
      if (!last || date > last) last = date;
    }
    return {
      km: Math.round(km * 10) / 10, laps: entries.length, minutes,
      avgRating: rated > 0 ? Math.round((totalStars / rated) * 10) / 10 : 0,
      hardestClass: hardest > 0 ? DIFF_ORDER[hardest - 1] : null,
      sections: Array.from(sections), first, last,
    };
  }, [entries]);

  const highlights = useMemo(() => {
    const withWater = entries.filter((e) => e.lap.waterLevel);
    if (withWater.length === 0) return null;
    const key = (e: Entry) => waterRank(e.lap.waterLevel) * 100000 + (e.lap.flow ?? 0);
    const most = withWater.reduce((a, b) => (key(b) > key(a) ? b : a));
    const least = withWater.reduce((a, b) => (key(b) < key(a) ? b : a));
    return { most, least };
  }, [entries]);

  const sorted = useMemo(() => {
    const copy = [...entries];
    if (sort === 'water') {
      copy.sort((a, b) => (waterRank(b.lap.waterLevel) * 100000 + (b.lap.flow ?? 0)) - (waterRank(a.lap.waterLevel) * 100000 + (a.lap.flow ?? 0)));
    } else {
      copy.sort((a, b) => b.date.localeCompare(a.date));
    }
    return copy;
  }, [entries, sort]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/rivers' as any)}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
          <Text style={styles.backText}>{t('settings.back')}</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerFlag}>{flag}</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>{name}</Text>
        </View>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {entries.length === 0 ? (
          <Text style={styles.empty}>{t('riverDetail.empty')}</Text>
        ) : (
          <>
            <View style={styles.grid}>
              <Stat value={`${stats.km}`} label={t('riverDetail.km')} styles={styles} />
              <Stat value={`${stats.laps}`} label={t('riverDetail.laps')} styles={styles} />
              <Stat value={formatTime(stats.minutes)} label={t('riverDetail.time')} styles={styles} />
              <Stat value={stats.hardestClass ?? '—'} label={t('riverDetail.hardestClass')} styles={styles}
                valueColor={stats.hardestClass ? DIFFICULTY_COLOR[stats.hardestClass] : undefined} />
              <Stat value={stats.avgRating > 0 ? `${stats.avgRating}★` : '—'} label={t('riverDetail.rating')} styles={styles} />
              <Stat value={`${stats.sections.length || '—'}`} label={t('riverDetail.sections')} styles={styles} />
            </View>

            {highlights && (
              <>
                <Text style={styles.sectionTitle}>{t('riverDetail.waterHighlights')}</Text>
                <View style={styles.highlightRow}>
                  <WaterHighlight label={t('riverDetail.mostWater')} entry={highlights.most} styles={styles} t={t} />
                  <WaterHighlight label={t('riverDetail.leastWater')} entry={highlights.least} styles={styles} t={t} />
                </View>
              </>
            )}

            <Text style={styles.sectionTitle}>{t('riverDetail.history')}</Text>
            <View style={styles.sortRow}>
              {(['date', 'water'] as const).map((s) => (
                <TouchableOpacity key={s} style={[styles.sortBtn, sort === s && styles.sortBtnActive]} onPress={() => setSort(s)}>
                  <Ionicons name={s === 'date' ? 'calendar-outline' : 'water-outline'} size={14} color={sort === s ? colors.primary : colors.textTertiary} />
                  <Text style={[styles.sortBtnText, sort === s && styles.sortBtnTextActive]}>
                    {s === 'date' ? t('riverDetail.sortDate') : t('riverDetail.sortWater')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {sorted.map((e) => <LapEntry key={e.id} entry={e} styles={styles} colors={colors} t={t} />)}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ value, label, styles, valueColor }: { value: string; label: string; styles: ReturnType<typeof makeStyles>; valueColor?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function WaterHighlight({ label, entry, styles, t }: { label: string; entry: Entry; styles: ReturnType<typeof makeStyles>; t: (k: any, o?: any) => string }) {
  const level = entry.lap.waterLevel as WaterLevel;
  const color = WATER_LEVEL_COLOR[level];
  return (
    <View style={styles.highlightCard}>
      <Text style={styles.highlightLabel}>{label}</Text>
      <View style={styles.highlightValueRow}>
        <Ionicons name="water" size={16} color={color} />
        <Text style={[styles.highlightValue, { color }]}>{t(WATER_LEVEL_I18N[level])}</Text>
      </View>
      <Text style={styles.highlightDate}>{formatDisplayDate(entry.date)}{entry.lap.flow ? ` · ${entry.lap.flow} m³/s` : ''}</Text>
    </View>
  );
}

function LapEntry({ entry, styles, colors, t }: { entry: Entry; styles: ReturnType<typeof makeStyles>; colors: Colors; t: (k: any, o?: any) => string }) {
  const { date, lap } = entry;
  const diff = lap.difficulty ?? 'III';
  return (
    <View style={styles.lapCard}>
      <View style={styles.lapTop}>
        <Text style={styles.lapDate}>{formatDisplayDate(date)}</Text>
        <View style={[styles.badge, { backgroundColor: DIFFICULTY_COLOR[diff] }]}>
          <Text style={styles.badgeText}>{t('rivers.class', { level: diff })}</Text>
        </View>
      </View>
      <View style={styles.chipRow}>
        {lap.waterLevel && (
          <View style={[styles.waterChip, { backgroundColor: `${WATER_LEVEL_COLOR[lap.waterLevel]}22` }]}>
            <Text style={[styles.waterChipText, { color: WATER_LEVEL_COLOR[lap.waterLevel] }]}>
              💧 {t(WATER_LEVEL_I18N[lap.waterLevel])}{lap.flow ? ` · ${lap.flow} m³/s` : ''}
            </Text>
          </View>
        )}
        {lap.section ? <View style={styles.chip}><Text style={styles.chipText}>{lap.section.replace(/-/g, ' · ')}</Text></View> : null}
        <View style={styles.chip}><Ionicons name="speedometer-outline" size={12} color={colors.textSecondary} /><Text style={styles.chipText}>{lap.km} km</Text></View>
        <View style={styles.chip}><Ionicons name="time-outline" size={12} color={colors.textSecondary} /><Text style={styles.chipText}>{formatTime(lap.hours * 60 + lap.minutes)}</Text></View>
        {lap.stars > 0 && <StarsDisplay value={lap.stars} />}
      </View>
      {lap.note ? <Text style={styles.note}>{lap.note}</Text> : null}
    </View>
  );
}
