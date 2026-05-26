import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Dimensions,
} from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../lib/AppContext';
import { computeStreaks } from '../../lib/streak';
import { statsForDays, formatTime } from '../../lib/stats';
import { formatDisplayDate, todayISO } from '../../lib/dates';
import { countryByCode } from '../../lib/countries';
import StreakWidget from '../../components/StreakWidget';
import GearButton from '../../components/GearButton';
import PaddleIcon from '../../components/PaddleIcon';
import { colors, spacing, radius } from '../../constants/theme';

const { width } = Dimensions.get('window');

export default function InicioScreen() {
  const { t } = useTranslation();
  const { days, isLoading, displayName } = useApp();
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const { current: streak } = useMemo(() => computeStreaks(days), [days]);
  const [confettiKey, setConfettiKey] = useState(0);
  const prevStreak = useRef<number | null>(null);

  useEffect(() => {
    const prev = prevStreak.current;
    prevStreak.current = streak;
    if (streak > 5 && prev !== streak) {
      setConfettiKey((k) => k + 1);
    }
  }, [streak]);

  const yearDays = useMemo(
    () => days.filter((d) => d.date.startsWith(`${currentYear}`)),
    [days, currentYear]
  );
  const yearStats = useMemo(() => statsForDays(yearDays), [yearDays]);
  const lastDay = days[0];

  if (isLoading) return <View style={styles.loading}><Text>{t('home.loading')}</Text></View>;

  return (
    <SafeAreaView style={styles.safe}>
      {confettiKey > 0 && (
        <ConfettiCannon
          key={confettiKey}
          count={220}
          origin={{ x: width / 2, y: -20 }}
          autoStart
          fadeOut
          fallSpeed={3200}
          explosionSpeed={380}
          colors={['#0a84ff', '#ffb800', '#ff9500', '#ff3b30', '#34c759', '#a855f7']}
        />
      )}
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <View style={styles.greetingRow}>
              <Text style={styles.greeting}>{t('home.hello', { name: displayName })}</Text>
              <PaddleIcon size={26} color={colors.primary} />
            </View>
            <Text style={styles.subtitle}>
              {yearStats.days > 0
                ? t('home.yearStats', { km: yearStats.km, days: yearStats.days })
                : t('home.yearSubtitle')}
            </Text>
          </View>
          <GearButton />
        </View>

        {/* Streak */}
        <StreakWidget days={days} />

        {/* Season card */}
        <View style={styles.seasonCard}>
          <Text style={styles.seasonTitle}>{t('home.season', { year: currentYear })}</Text>
          <View style={styles.statsGrid}>
            <StatItem label={t('home.km')} value={`${yearStats.km}`} icon="speedometer-outline" />
            <StatItem label={t('home.laps')} value={`${yearStats.laps}`} icon="repeat-outline" />
            <StatItem label={t('home.time')} value={formatTime(yearStats.timeMinutes)} icon="time-outline" />
            <StatItem label={t('home.rivers')} value={`${yearStats.rivers}`} icon="water-outline" />
            <StatItem label={t('home.countries')} value={`${yearStats.countries}`} icon="globe-outline" />
            <StatItem label={t('home.days')} value={`${yearStats.days}`} icon="calendar-outline" />
          </View>
        </View>

        {/* Last day */}
        {lastDay && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('home.lastTrip')}</Text>
            <Text style={styles.lastDate}>{formatDisplayDate(lastDay.date)}</Text>
            {lastDay.rivers.map((r, i) => {
              const c = countryByCode[r.country];
              return (
                <Text key={i} style={styles.lastRiver}>
                  {c?.flag} {r.name} · {t('rivers.class', { level: r.difficulty })}
                </Text>
              );
            })}
          </View>
        )}

        {/* Quick actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(tabs)/add')}
          >
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={styles.actionText}>{t('home.newDay')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border }]}
            onPress={() => router.push('/(tabs)/stats')}
          >
            <Ionicons name="bar-chart-outline" size={20} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.primary }]}>{t('home.stats')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border }]}
            onPress={() => router.push('/map' as any)}
          >
            <Ionicons name="map-outline" size={20} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.primary }]}>{t('home.myRoutes')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatItem({ label, value, icon }: { label: string; value: string; icon: React.ComponentProps<typeof Ionicons>['name'] }) {
  return (
    <View style={styles.statItem}>
      <Ionicons name={icon} size={18} color="#fff" style={{ marginBottom: 4 }} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.md, paddingBottom: 32 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  greeting: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  seasonCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  seasonTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statItem: {
    width: '30%',
    alignItems: 'center',
    paddingVertical: 10,
  },
  statValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  lastDate: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  lastRiver: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: radius.md,
  },
  actionText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
