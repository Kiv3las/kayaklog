import React, { forwardRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import KayakLogo from './KayakLogo';

export interface ShareCardData {
  name: string;
  year: number;
  km: number;
  days: number;
  rivers: number;
  streak: number;
  hardestClass: string | null;
}

// Fixed-size branded card rendered off-screen and rasterized by
// react-native-view-shot. Self-contained (its own colors/fonts) so the
// exported image looks the same regardless of the app's current theme.
const ShareCard = forwardRef<View, { data: ShareCardData }>(({ data }, ref) => {
  const { t } = useTranslation();
  return (
    <View ref={ref} collapsable={false} style={styles.root}>
      <LinearGradient
        colors={['#3eb1ff', '#0a5dd1']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.header}>
          <KayakLogo size={44} />
          <View style={{ marginLeft: 12 }}>
            <Text style={styles.wordmark}>KayakLog</Text>
            <Text style={styles.tagline}>{t('share.tagline')}</Text>
          </View>
        </View>

        <Text style={styles.season}>{t('share.seasonLabel', { year: data.year })}</Text>
        <Text style={styles.name}>{data.name}</Text>

        <View style={styles.kmRow}>
          <Text style={styles.kmValue}>{data.km}</Text>
          <Text style={styles.kmUnit}>{t('share.statKm')}</Text>
        </View>

        <View style={styles.statsRow}>
          <Stat value={`${data.days}`} label={t('share.statDays')} />
          <View style={styles.sep} />
          <Stat value={`${data.rivers}`} label={t('share.statRivers')} />
          <View style={styles.sep} />
          <Stat value={`${data.streak}`} label={t('share.statStreak')} />
          {data.hardestClass ? (
            <>
              <View style={styles.sep} />
              <Stat value={data.hardestClass} label={t('achievements.unit.classLabel')} />
            </>
          ) : null}
        </View>
      </LinearGradient>
    </View>
  );
});

ShareCard.displayName = 'ShareCard';
export default ShareCard;

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Off-screen host. Captured by ref.
  root: { position: 'absolute', left: -9999, top: 0, width: 360 },
  card: {
    width: 360,
    borderRadius: 28,
    padding: 28,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 28 },
  wordmark: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  tagline: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 1 },
  season: { color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  name: { color: '#fff', fontSize: 30, fontWeight: '900', letterSpacing: -0.5, marginTop: 2, marginBottom: 20 },
  kmRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 24 },
  kmValue: { color: '#fff', fontSize: 72, fontWeight: '900', letterSpacing: -2, lineHeight: 76 },
  kmUnit: { color: 'rgba(255,255,255,0.85)', fontSize: 24, fontWeight: '800', marginLeft: 8, marginBottom: 12 },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { color: '#fff', fontSize: 22, fontWeight: '900' },
  statLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 },
  sep: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.25)' },
});
