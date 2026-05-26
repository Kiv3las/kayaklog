import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { BarChart } from 'react-native-gifted-charts';
import { addDays, addMonths, addYears, startOfWeek, getMonth, getYear } from 'date-fns';
import { useApp } from '../../lib/AppContext';
import { StatsPeriodType } from '../../lib/types';
import {
  statsForDays, weekBarData, monthBarData, yearBarData, formatTime,
  BarDataItem,
} from '../../lib/stats';
import { isoFromDate, mondayOf, weekRangeLabel, formatMonthYear } from '../../lib/dates';
import { colors, spacing, radius } from '../../constants/theme';

type PeriodState = {
  type: StatsPeriodType;
  date: Date;
};

function periodLabel(state: PeriodState): string {
  const { type, date } = state;
  if (type === 'week') return weekRangeLabel(mondayOf(date));
  if (type === 'month') return formatMonthYear(getYear(date), getMonth(date) + 1);
  return `${getYear(date)}`;
}

function isCurrentPeriod(state: PeriodState): boolean {
  const now = new Date();
  if (state.type === 'week') {
    return isoFromDate(mondayOf(state.date)) === isoFromDate(mondayOf(now));
  }
  if (state.type === 'month') {
    return getYear(state.date) === getYear(now) && getMonth(state.date) === getMonth(now);
  }
  return getYear(state.date) === getYear(now);
}

function navigate(state: PeriodState, dir: 1 | -1): PeriodState {
  const { type, date } = state;
  if (type === 'week') return { type, date: addDays(date, dir * 7) };
  if (type === 'month') return { type, date: addMonths(date, dir) };
  return { type, date: addYears(date, dir) };
}

export default function StatsScreen() {
  const { t } = useTranslation();
  const { days } = useApp();
  const [period, setPeriod] = useState<PeriodState>({ type: 'week', date: new Date() });

  const current = isCurrentPeriod(period);

  function setType(type: StatsPeriodType) {
    setPeriod({ type, date: new Date() });
  }

  const filteredDays = useMemo(() => {
    const { type, date } = period;
    if (type === 'week') {
      const monday = isoFromDate(mondayOf(date));
      const sunday = isoFromDate(addDays(mondayOf(date), 6));
      return days.filter((d) => d.date >= monday && d.date <= sunday);
    }
    if (type === 'month') {
      const prefix = `${getYear(date)}-${String(getMonth(date) + 1).padStart(2, '0')}`;
      return days.filter((d) => d.date.startsWith(prefix));
    }
    return days.filter((d) => d.date.startsWith(`${getYear(date)}`));
  }, [days, period]);

  const stats = useMemo(() => statsForDays(filteredDays), [filteredDays]);

  const barData: BarDataItem[] = useMemo(() => {
    const { type, date } = period;
    if (type === 'week') return weekBarData(days, mondayOf(date));
    if (type === 'month') return monthBarData(days, getYear(date), getMonth(date) + 1);
    return yearBarData(days, getYear(date));
  }, [days, period]);

  const chartData = barData.map((item) => ({
    value: item.value,
    label: item.label,
    frontColor: colors.primary,
  }));

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t('stats.title')}</Text>

        {/* Period type selector */}
        <View style={styles.segmented}>
          {(['week', 'month', 'year'] as StatsPeriodType[]).map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.segment, period.type === type && styles.segmentActive]}
              onPress={() => setType(type)}
            >
              <Text style={[styles.segmentText, period.type === type && styles.segmentTextActive]}>
                {type === 'week' ? t('stats.week') : type === 'month' ? t('stats.month') : t('stats.year')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Navigator */}
        <View style={styles.navigator}>
          <TouchableOpacity onPress={() => setPeriod((p) => navigate(p, -1))} accessibilityLabel="Período anterior">
            <Ionicons name="chevron-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <View style={styles.navCenter}>
            <Text style={styles.navLabel}>{periodLabel(period)}</Text>
            {current ? (
              <View style={styles.currentBadge}>
                <Text style={styles.currentBadgeText}>{t('stats.current')}</Text>
              </View>
            ) : (
              <TouchableOpacity onPress={() => setPeriod((p) => ({ ...p, date: new Date() }))}>
                <Text style={styles.backLink}>
                  {period.type === 'week' ? t('stats.backToWeek') : period.type === 'month' ? t('stats.backToMonth') : t('stats.backToYear')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            onPress={() => !current && setPeriod((p) => navigate(p, 1))}
            disabled={current}
            accessibilityLabel="Período siguiente"
          >
            <Ionicons name="chevron-forward" size={24} color={current ? colors.border : colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Stats cards */}
        <View style={styles.grid}>
          <StatCard label={t('stats.km')} value={`${stats.km}`} icon="speedometer-outline" />
          <StatCard label={t('stats.time')} value={formatTime(stats.timeMinutes)} icon="time-outline" />
          <StatCard label={t('stats.laps')} value={`${stats.laps}`} icon="repeat-outline" />
          <StatCard label={t('stats.days')} value={`${stats.days}`} icon="calendar-outline" />
          <StatCard
            label={t('stats.riversCountries')}
            value={`${stats.rivers} / ${stats.countries}`}
            icon="water-outline"
          />
          <StatCard
            label={t('stats.avgRating')}
            value={stats.avgRating > 0 ? `${stats.avgRating} ⭐` : '—'}
            icon="star-outline"
          />
        </View>

        {/* Bar chart */}
        <View style={styles.chartCard}>
          <Text style={styles.chartLabel}>
            {period.type === 'week' ? t('stats.kmPerDay') : period.type === 'month' ? t('stats.kmPerWeek') : t('stats.kmPerMonth')}
          </Text>
          {chartData.every((d) => d.value === 0) ? (
            <Text style={styles.noData}>{t('stats.noData')}</Text>
          ) : (
            <BarChart
              data={chartData}
              barWidth={period.type === 'year' ? 20 : 30}
              spacing={period.type === 'year' ? 6 : 14}
              roundedTop
              hideRules
              xAxisThickness={1}
              yAxisThickness={0}
              yAxisTextStyle={{ color: colors.textTertiary, fontSize: 10 }}
              xAxisLabelTextStyle={{ color: colors.textTertiary, fontSize: 10 }}
              noOfSections={4}
              maxValue={Math.max(...chartData.map((d) => d.value), 1)}
              isAnimated
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ComponentProps<typeof Ionicons>['name'] }) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={20} color={colors.primary} style={{ marginBottom: 4 }} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.md, paddingBottom: 32 },
  title: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.md },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.border,
    borderRadius: radius.sm,
    padding: 2,
    marginBottom: spacing.md,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  segmentActive: { backgroundColor: '#fff' },
  segmentText: { fontSize: 14, color: colors.textTertiary, fontWeight: '600' },
  segmentTextActive: { color: colors.primary },
  navigator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  navCenter: { alignItems: 'center', flex: 1 },
  navLabel: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  currentBadge: {
    marginTop: 4,
    backgroundColor: '#e6f9ec',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  currentBadgeText: { color: colors.success, fontSize: 12, fontWeight: '700' },
  backLink: { color: colors.primary, fontSize: 12, marginTop: 4 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.md,
  },
  statCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    width: '48%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  statLabel: { fontSize: 12, color: colors.textTertiary, marginTop: 2, textAlign: 'center' },
  chartCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chartLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  noData: { textAlign: 'center', color: colors.textTertiary, paddingVertical: 24 },
});
