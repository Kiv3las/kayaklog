import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useApp } from '../lib/AppContext';
import { useTheme } from '../lib/themeContext';
import type { Colors } from '../constants/theme';
import { spacing, radius } from '../constants/theme';
import { computeAchievements, Achievement, ROMAN } from '../lib/achievements';

type TFunc = ReturnType<typeof useTranslation>['t'];
type Styles = ReturnType<typeof makeStyles>;

function valueLabel(a: Achievement, t: TFunc): string {
  switch (a.category) {
    case 'distance': return `${a.target} km`;
    case 'days': return t('achievements.unit.days', { count: a.target });
    case 'rivers': return t('achievements.unit.rivers', { count: a.target });
    case 'countries': return t('achievements.unit.countries', { count: a.target });
    case 'streak': return t('achievements.unit.streak', { count: a.target });
    case 'class': return `${t('achievements.unit.classLabel')} ${ROMAN[a.target]}`;
    case 'river': return a.name ?? '';
  }
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      backgroundColor: c.cardBg,
    },
    backBtn: { flexDirection: 'row', alignItems: 'center', width: 70 },
    backText: { color: c.primary, fontSize: 15 },
    headerTitle: { fontSize: 17, fontWeight: '700', color: c.textPrimary },
    scroll: { padding: spacing.md, paddingBottom: 32 },

    summary: {
      backgroundColor: c.cardBg,
      borderRadius: radius.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: spacing.md,
    },
    summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    summaryCount: { fontSize: 22, fontWeight: '800', color: c.textPrimary },
    summaryLabel: { fontSize: 13, color: c.textTertiary, flex: 1 },
    track: { height: 8, borderRadius: 4, backgroundColor: c.border, overflow: 'hidden' },
    trackFill: { height: 8, borderRadius: 4, backgroundColor: c.primary },

    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: c.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: spacing.sm,
      marginTop: spacing.sm,
    },

    recordsCard: {
      backgroundColor: c.cardBg,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: spacing.md,
      overflow: 'hidden',
    },
    recordRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      gap: 12,
    },
    recordDivider: { borderTopWidth: 1, borderTopColor: c.border },
    recordLabel: { fontSize: 14, color: c.textSecondary, flex: 1 },
    recordValue: { fontSize: 15, fontWeight: '700', color: c.textPrimary },

    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    badge: {
      width: '31.8%',
      backgroundColor: c.cardBg,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.border,
      paddingVertical: spacing.md,
      paddingHorizontal: 6,
      alignItems: 'center',
    },
    badgeLocked: { opacity: 0.5 },
    circle: {
      width: 52, height: 52, borderRadius: 26,
      alignItems: 'center', justifyContent: 'center',
      marginBottom: 8,
    },
    badgeValue: { fontSize: 13, fontWeight: '800', color: c.textPrimary, textAlign: 'center' },
    badgeCaption: { fontSize: 11, color: c.textTertiary, marginTop: 1, textAlign: 'center' },
    badgeTrack: {
      height: 4, borderRadius: 2, backgroundColor: c.border,
      width: '80%', marginTop: 8, overflow: 'hidden',
    },
    badgeProgress: { fontSize: 10, color: c.textTertiary, marginTop: 3 },

    empty: { textAlign: 'center', color: c.textTertiary, paddingVertical: 40 },
  });
}

function AchievementBadge({ a, styles, t }: { a: Achievement; styles: Styles; t: TFunc }) {
  const isRiver = a.category === 'river';
  const progress = Math.min(a.current / a.target, 1);
  return (
    <View style={[styles.badge, !a.unlocked && styles.badgeLocked]}>
      <View style={[styles.circle, { backgroundColor: a.unlocked ? a.color : `${a.color}22` }]}>
        <Ionicons
          name={(a.unlocked ? a.icon : 'lock-closed') as React.ComponentProps<typeof Ionicons>['name']}
          size={24}
          color={a.unlocked ? '#fff' : a.color}
        />
      </View>
      <Text style={styles.badgeValue} numberOfLines={2}>{valueLabel(a, t)}</Text>
      <Text style={styles.badgeCaption}>{t(`achievements.cat.${a.category}`)}</Text>
      {!a.unlocked && !isRiver && (
        <>
          <View style={styles.badgeTrack}>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: a.color, width: `${Math.round(progress * 100)}%` }} />
          </View>
          <Text style={styles.badgeProgress}>
            {a.category === 'distance' ? Math.round(a.current) : a.current}/{a.target}
          </Text>
        </>
      )}
    </View>
  );
}

export default function AchievementsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { days } = useApp();
  const year = new Date().getFullYear();

  const { sections, unlockedCount, total, totals } = useMemo(
    () => computeAchievements(days),
    [days],
  );

  const pct = total > 0 ? unlockedCount / total : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)' as any)}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
          <Text style={styles.backText}>{t('settings.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('achievements.title')}</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {totals.days === 0 ? (
          <Text style={styles.empty}>{t('achievements.empty')}</Text>
        ) : (
          <>
            <View style={styles.summary}>
              <View style={styles.summaryRow}>
                <Ionicons name="trophy" size={26} color={colors.starGold} />
                <Text style={styles.summaryCount}>{unlockedCount}/{total}</Text>
                <Text style={styles.summaryLabel}>
                  {t('achievements.unlocked', { count: unlockedCount, total })}
                </Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.trackFill, { width: `${Math.round(pct * 100)}%` }]} />
              </View>
            </View>

            <Text style={styles.sectionTitle}>{t('achievements.records')}</Text>
            <View style={styles.recordsCard}>
              <RecordRow icon="speedometer-outline" label={t('achievements.record.totalKm')}
                value={`${totals.km} km`} styles={styles} colors={colors} first />
              <RecordRow icon="navigate-outline" label={t('achievements.record.longestDay')}
                value={`${totals.longestDayKm} km`} styles={styles} colors={colors} />
              <RecordRow icon="repeat-outline" label={t('achievements.record.longestLap')}
                value={`${totals.longestLapKm} km`} styles={styles} colors={colors} />
              <RecordRow icon="calendar-outline" label={t('achievements.record.bestMonth')}
                value={`${totals.bestMonthKm} km`} styles={styles} colors={colors} />
              <RecordRow icon="trophy-outline" label={t('achievements.record.hardestClass')}
                value={totals.hardestClass ? `${t('achievements.unit.classLabel')} ${totals.hardestClass}` : '—'}
                styles={styles} colors={colors} />
              <RecordRow icon="flame-outline" label={t('achievements.record.longestStreak')}
                value={t('achievements.unit.days', { count: totals.longestStreak })} styles={styles} colors={colors} />
            </View>

            <Text style={styles.sectionTitle}>{t('achievements.section.rivers')}</Text>
            <View style={styles.grid}>
              {sections.rivers.map((a) => <AchievementBadge key={a.id} a={a} styles={styles} t={t} />)}
            </View>

            <Text style={styles.sectionTitle}>{t('achievements.section.year', { year })}</Text>
            <View style={styles.grid}>
              {sections.yearly.map((a) => <AchievementBadge key={a.id} a={a} styles={styles} t={t} />)}
            </View>

            <Text style={styles.sectionTitle}>{t('achievements.section.allTime')}</Text>
            <View style={styles.grid}>
              {sections.allTime.map((a) => <AchievementBadge key={a.id} a={a} styles={styles} t={t} />)}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function RecordRow({ icon, label, value, styles, colors, first }: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string; value: string;
  styles: Styles;
  colors: Colors;
  first?: boolean;
}) {
  return (
    <View style={[styles.recordRow, !first && styles.recordDivider]}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={styles.recordLabel}>{label}</Text>
      <Text style={styles.recordValue}>{value}</Text>
    </View>
  );
}
