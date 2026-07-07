import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, SectionList, TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../lib/themeContext';
import type { Colors } from '../constants/theme';
import { spacing, radius } from '../constants/theme';
import { WATER_LEVEL_COLOR, WATER_LEVEL_I18N } from '../lib/water';
import {
  StationCurrent, fetchStationsWithLatest, loadCachedStations, classifyFlow, flowTrend, FlowTrend,
} from '../lib/flows';
import PressableScale from './PressableScale';

interface RegionSection {
  title: string;
  data: StationCurrent[];
}

// "hace 35 min" / "hace 2 horas" a partir de un ISO timestamp.
export function timeAgoLabel(t: (k: any, o?: any) => string, iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return t('flows.justNow');
  const time =
    mins < 60 ? t('flows.minutes', { count: mins })
    : mins < 48 * 60 ? t('flows.hours', { count: Math.round(mins / 60) })
    : t('flows.days', { count: Math.round(mins / 1440) });
  return t('flows.updatedAgo', { time });
}

const TREND_ICON: Record<FlowTrend, React.ComponentProps<typeof Ionicons>['name']> = {
  up: 'trending-up',
  down: 'trending-down',
  flat: 'remove',
};

function makeStyles(c: Colors) {
  return StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: spacing.lg },
    centerText: { fontSize: 15, color: c.textTertiary, textAlign: 'center' },
    list: { padding: spacing.md, paddingTop: 0, paddingBottom: 32 },
    sampleBanner: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: `${c.warning}18`, borderColor: `${c.warning}55`, borderWidth: 1,
      borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 8,
      marginBottom: spacing.sm,
    },
    sampleText: { flex: 1, fontSize: 12, color: c.textSecondary },
    regionHeader: {
      paddingVertical: 8, marginTop: 10, marginBottom: 4,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    regionName: { fontSize: 13, fontWeight: '700', color: c.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
    card: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: c.cardBg, borderRadius: radius.sm, padding: 12,
      marginBottom: 8, borderWidth: 1, borderColor: c.border,
    },
    cardInfo: { flex: 1 },
    riverName: { fontSize: 15, fontWeight: '700', color: c.textPrimary },
    stationName: { fontSize: 12, color: c.textTertiary, marginTop: 1 },
    updated: { fontSize: 11, color: c.textTertiary, marginTop: 3 },
    flowCol: { alignItems: 'flex-end', gap: 4 },
    flowRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
    flowValue: { fontSize: 20, fontWeight: '800', color: c.textPrimary },
    flowUnit: { fontSize: 11, color: c.textTertiary },
    levelChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    levelText: { fontSize: 11, fontWeight: '700' },
    noData: { fontSize: 13, color: c.textTertiary, fontStyle: 'italic' },
  });
}

export default function FlowsBoard() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();

  const [items, setItems] = useState<StationCurrent[] | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(false);
      setItems(await fetchStationsWithLatest());
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Stale-while-revalidate: pintar al tiro el último tablero conocido
  // mientras llega el fresco.
  useEffect(() => {
    loadCachedStations().then((cached) => {
      if (cached) setItems((prev) => prev ?? cached);
    });
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const sections = useMemo<RegionSection[]>(() => {
    if (!items) return [];
    const byRegion = new Map<string, StationCurrent[]>();
    for (const it of items) {
      const list = byRegion.get(it.station.region) ?? [];
      list.push(it);
      byRegion.set(it.station.region, list);
    }
    // El orden de inserción ya viene norte→sur por sort_order.
    return Array.from(byRegion.entries()).map(([title, data]) => ({ title, data }));
  }, [items]);

  const hasSample = useMemo(() => (items ?? []).some((i) => i.latest?.isSample), [items]);

  if (items === null && !error) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.centerText}>{t('flows.loading')}</Text>
      </View>
    );
  }

  if (error && items === null) {
    return (
      <View style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={44} color={colors.textTertiary} />
        <Text style={styles.centerText}>{t('flows.error')}</Text>
        <TouchableOpacity onPress={load}>
          <Ionicons name="refresh" size={26} color={colors.primary} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.station.code}
      contentContainerStyle={styles.list}
      stickySectionHeadersEnabled={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      ListHeaderComponent={hasSample ? (
        <View style={styles.sampleBanner}>
          <Ionicons name="flask-outline" size={16} color={colors.warning} />
          <Text style={styles.sampleText}>{t('flows.sampleBanner')}</Text>
        </View>
      ) : null}
      ListEmptyComponent={(
        <View style={styles.center}>
          <Ionicons name="water-outline" size={44} color={colors.textTertiary} />
          <Text style={styles.centerText}>{t('flows.empty')}</Text>
        </View>
      )}
      renderSectionHeader={({ section }) => (
        <View style={styles.regionHeader}>
          <Text style={styles.regionName}>{section.title}</Text>
        </View>
      )}
      renderItem={({ item, index }) => (
        <Animated.View entering={FadeInDown.duration(300).delay(Math.min(index, 5) * 50)}>
          <StationRow
            item={item}
            styles={styles}
            colors={colors}
            t={t}
            onPress={() => router.push({ pathname: '/flow-station', params: { station: item.station.code } } as any)}
          />
        </Animated.View>
      )}
    />
  );
}

function StationRow({ item, styles, colors, t, onPress }: {
  item: StationCurrent;
  styles: ReturnType<typeof makeStyles>;
  colors: Colors;
  t: (k: any, o?: any) => string;
  onPress: () => void;
}) {
  const { station, latest, dayAgo } = item;
  const level = latest ? classifyFlow(station, latest.flow) : null;
  const levelColor = level ? WATER_LEVEL_COLOR[level] : colors.textTertiary;
  const trend = latest && dayAgo ? flowTrend(latest.flow, dayAgo.flow) : null;

  return (
    <PressableScale style={styles.card} onPress={onPress}>
      <View style={styles.cardInfo}>
        <Text style={styles.riverName}>{station.riverName}</Text>
        <Text style={styles.stationName} numberOfLines={1}>{station.name}</Text>
        {latest && <Text style={styles.updated}>{timeAgoLabel(t, latest.ts)}</Text>}
      </View>
      <View style={styles.flowCol}>
        {latest ? (
          <>
            <View style={styles.flowRow}>
              {trend && <Ionicons name={TREND_ICON[trend]} size={15} color={colors.textSecondary} />}
              <Text style={styles.flowValue}>{Math.round(latest.flow)}</Text>
              <Text style={styles.flowUnit}>m³/s</Text>
            </View>
            {level && (
              <View style={[styles.levelChip, { backgroundColor: `${levelColor}22` }]}>
                <Ionicons name="water" size={11} color={levelColor} />
                <Text style={[styles.levelText, { color: levelColor }]}>{t(WATER_LEVEL_I18N[level])}</Text>
              </View>
            )}
          </>
        ) : (
          <Text style={styles.noData}>{t('flows.noData')}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
    </PressableScale>
  );
}
