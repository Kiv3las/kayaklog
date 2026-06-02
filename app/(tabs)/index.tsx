import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Dimensions,
} from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../lib/AppContext';
import { useTheme } from '../../lib/themeContext';
import type { Colors } from '../../constants/theme';
import { computeStreaks } from '../../lib/streak';
import { computeAchievements, computeTotals } from '../../lib/achievements';
import { statsForDays, formatTime } from '../../lib/stats';
import { formatDisplayDate, todayISO } from '../../lib/dates';
import { countryByCode } from '../../lib/countries';
import { spacing, radius } from '../../constants/theme';
import { shareViewAsImage } from '../../lib/share';
import StreakWidget from '../../components/StreakWidget';
import GearButton from '../../components/GearButton';
import PaddleIcon from '../../components/PaddleIcon';
import ShareCard from '../../components/ShareCard';

const { width } = Dimensions.get('window');

function makeStyles(c: Colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scroll: { padding: spacing.md, paddingBottom: 32 },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.md,
    },
    greetingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    greeting: { fontSize: 22, fontWeight: '800', color: c.textPrimary },
    subtitle: { fontSize: 14, color: c.textSecondary, marginTop: 2 },
    seasonCard: {
      backgroundColor: c.primary,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    seasonHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
    seasonTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
    shareBtn: {
      width: 32, height: 32, borderRadius: 16,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.2)',
    },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    statItem: { width: '30%', alignItems: 'center', paddingVertical: 10 },
    statValue: { color: '#fff', fontSize: 18, fontWeight: '800' },
    statLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 11, textAlign: 'center' },
    card: {
      backgroundColor: c.cardBg,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: c.border,
    },
    cardTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: c.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 6,
    },
    achCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.cardBg,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: c.border,
    },
    achIcon: {
      width: 40, height: 40, borderRadius: 20,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: `${c.starGold}22`,
    },
    achTitle: { fontSize: 15, fontWeight: '700', color: c.textPrimary },
    achSub: { fontSize: 12, color: c.textTertiary, marginTop: 1 },
    achCount: { fontSize: 15, fontWeight: '800', color: c.primary },
    lastDate: { fontSize: 16, fontWeight: '700', color: c.textPrimary, marginBottom: 6 },
    lastRiver: { fontSize: 14, color: c.textSecondary, marginBottom: 2 },
    actionsRow: { flexDirection: 'row', gap: 12 },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 14,
      borderRadius: radius.md,
    },
    actionText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  });
}

function StatItem({ label, value, icon }: { label: string; value: string; icon: React.ComponentProps<typeof Ionicons>['name'] }) {
  return (
    <View style={{ width: '30%', alignItems: 'center', paddingVertical: 10 }}>
      <Ionicons name={icon} size={18} color="#fff" style={{ marginBottom: 4 }} />
      <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

export default function InicioScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { days, isLoading, displayName } = useApp();
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const { current: streak } = useMemo(() => computeStreaks(days), [days]);
  const [confettiKey, setConfettiKey] = useState(0);
  const prevStreak = useRef<number | null>(null);

  useEffect(() => {
    const prev = prevStreak.current;
    prevStreak.current = streak;
    if (streak > 5 && prev !== streak) setConfettiKey((k) => k + 1);
  }, [streak]);

  const yearDays = useMemo(() => days.filter((d) => d.date.startsWith(`${currentYear}`)), [days, currentYear]);
  const yearStats = useMemo(() => statsForDays(yearDays), [yearDays]);
  const seasonTotals = useMemo(() => computeTotals(yearDays), [yearDays]);
  const ach = useMemo(() => computeAchievements(days), [days]);
  const lastDay = days[0];
  const shareRef = useRef<View>(null);

  if (isLoading) return <View style={styles.loading}><Text>{t('home.loading')}</Text></View>;

  return (
    <SafeAreaView style={styles.safe}>
      {confettiKey > 0 && (
        <ConfettiCannon
          key={confettiKey}
          count={220}
          origin={{ x: width / 2, y: -20 }}
          autoStart fadeOut fallSpeed={3200} explosionSpeed={380}
          colors={['#0a84ff', '#ffb800', '#ff9500', '#ff3b30', '#34c759', '#a855f7']}
        />
      )}
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
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

        <StreakWidget days={days} />

        <View style={styles.seasonCard}>
          <View style={styles.seasonHeader}>
            <Text style={styles.seasonTitle}>{t('home.season', { year: currentYear })}</Text>
            {yearStats.days > 0 && (
              <TouchableOpacity
                style={styles.shareBtn}
                onPress={() => shareViewAsImage(shareRef)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="share-outline" size={20} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.statsGrid}>
            <StatItem label={t('home.km')} value={`${yearStats.km}`} icon="speedometer-outline" />
            <StatItem label={t('home.laps')} value={`${yearStats.laps}`} icon="repeat-outline" />
            <StatItem label={t('home.time')} value={formatTime(yearStats.timeMinutes)} icon="time-outline" />
            <StatItem label={t('home.rivers')} value={`${yearStats.rivers}`} icon="water-outline" />
            <StatItem label={t('home.countries')} value={`${yearStats.countries}`} icon="globe-outline" />
            <StatItem label={t('home.days')} value={`${yearStats.days}`} icon="calendar-outline" />
          </View>
        </View>

        <TouchableOpacity style={styles.achCard} onPress={() => router.push('/achievements' as any)} activeOpacity={0.85}>
          <View style={styles.achIcon}>
            <Ionicons name="trophy" size={20} color={colors.starGold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.achTitle}>{t('achievements.homeCard')}</Text>
            <Text style={styles.achSub}>{t('achievements.unlocked', { count: ach.unlockedCount, total: ach.total })}</Text>
          </View>
          <Text style={styles.achCount}>{ach.unlockedCount}/{ach.total}</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
        </TouchableOpacity>

        {lastDay && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('home.lastTrip')}</Text>
            <Text style={styles.lastDate}>{formatDisplayDate(lastDay.date)}</Text>
            {lastDay.rivers.map((r, i) => {
              const c = countryByCode[r.country];
              return (
                <Text key={i} style={styles.lastRiver}>
                  {c?.flag} {r.name} · {t('rivers.class', { level: r.laps[0]?.difficulty ?? 'III' })}
                </Text>
              );
            })}
          </View>
        )}

        <View style={styles.actionsRow}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={() => router.push('/(tabs)/add')}>
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={styles.actionText}>{t('home.newDay')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border }]} onPress={() => router.push('/(tabs)/stats')}>
            <Ionicons name="bar-chart-outline" size={20} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.primary }]}>{t('home.stats')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border }]} onPress={() => router.push('/map' as any)}>
            <Ionicons name="map-outline" size={20} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.primary }]}>{t('home.myRoutes')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <ShareCard
        ref={shareRef}
        data={{
          name: displayName,
          year: currentYear,
          km: seasonTotals.km,
          days: seasonTotals.days,
          rivers: seasonTotals.rivers,
          streak: seasonTotals.longestStreak,
          hardestClass: seasonTotals.hardestClass,
        }}
      />
    </SafeAreaView>
  );
}
