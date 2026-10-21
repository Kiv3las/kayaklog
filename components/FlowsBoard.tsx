import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, SectionList, TouchableOpacity, RefreshControl, ActivityIndicator, TextInput,
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
  StationCurrent, fetchStationsWithLatest, loadCachedStations, classifyFlow, flowTrend, flowChangePct, FlowTrend,
  normalizeRiverName,
} from '../lib/flows';
import { useFlowFavorites } from '../lib/flowFavorites';
import PressableScale from './PressableScale';
import FlowsMap from './FlowsMap';

interface BoardSection {
  key: string;
  title: string;
  isFavorites: boolean;
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

// "+12% en 24 h" / "Estable"; null si no hay lectura de hace un día.
export function changeLabel(t: (k: any, o?: any) => string, latest: number, dayAgo: number | null | undefined): string | null {
  if (dayAgo == null) return null;
  const pct = flowChangePct(latest, dayAgo);
  if (pct === null) return null;
  if (flowTrend(latest, dayAgo) === 'flat') return t('flows.trendFlat');
  return t('flows.change24h', { pct: pct > 0 ? `+${pct}` : `${pct}` });
}

const TREND_ICON: Record<FlowTrend, React.ComponentProps<typeof Ionicons>['name']> = {
  up: 'trending-up',
  down: 'trending-down',
  flat: 'remove',
};

function makeStyles(c: Colors) {
  return StyleSheet.create({
    root: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: spacing.lg },
    centerText: { fontSize: 15, color: c.textTertiary, textAlign: 'center' },
    toolbar: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: spacing.md, paddingBottom: spacing.sm,
    },
    searchBox: {
      flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: c.cardBg, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border,
      paddingHorizontal: 10, height: 38,
    },
    searchInput: { flex: 1, fontSize: 15, color: c.textPrimary, paddingVertical: 0 },
    modeBtn: {
      width: 38, height: 38, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center',
      backgroundColor: c.cardBg, borderWidth: 1, borderColor: c.border,
    },
    list: { padding: spacing.md, paddingTop: 0, paddingBottom: 32 },
    sampleBanner: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: `${c.warning}18`, borderColor: `${c.warning}55`, borderWidth: 1,
      borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 8,
      marginBottom: spacing.sm,
    },
    sampleText: { flex: 1, fontSize: 12, color: c.textSecondary },
    regionHeader: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
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
  const { favorites, isFavorite, toggle } = useFlowFavorites();

  const [items, setItems] = useState<StationCurrent[] | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'list' | 'map'>('list');
  // Guardia de generación: un load antiguo no debe pisar el resultado de uno
  // más nuevo (p. ej. pull-to-refresh mientras el de montaje sigue en vuelo).
  const loadGen = useRef(0);

  const load = useCallback(async () => {
    const gen = ++loadGen.current;
    try {
      const result = await fetchStationsWithLatest();
      if (gen !== loadGen.current) return;
      setError(false);
      setItems(result);
    } catch {
      if (gen === loadGen.current) setError(true);
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

  const searching = query.trim().length > 0;

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = normalizeRiverName(query);
    if (!q) return items;
    return items.filter((it) =>
      [it.station.riverName, it.station.name, it.station.region].some((s) => normalizeRiverName(s).includes(q)),
    );
  }, [items, query]);

  // Favoritos arriba (en orden de catálogo, norte→sur) y el resto por región.
  // Buscando no hay sección de favoritos: los resultados van en su región.
  const sections = useMemo<BoardSection[]>(() => {
    const favSet = new Set(searching ? [] : favorites);
    const byRegion = new Map<string, StationCurrent[]>();
    const favItems: StationCurrent[] = [];
    for (const it of filtered) {
      if (favSet.has(it.station.code)) { favItems.push(it); continue; }
      const list = byRegion.get(it.station.region) ?? [];
      list.push(it);
      byRegion.set(it.station.region, list);
    }
    const regions = Array.from(byRegion.entries())
      .map(([title, data]) => ({ key: title, title, isFavorites: false, data }));
    return favItems.length > 0
      ? [{ key: '__favorites', title: t('flows.favorites'), isFavorites: true, data: favItems }, ...regions]
      : regions;
  }, [filtered, favorites, searching, t]);

  const hasSample = useMemo(() => (items ?? []).some((i) => i.latest?.isSample), [items]);

  const openStation = useCallback(
    (code: string) => router.push({ pathname: '/flow-station', params: { station: code } } as any),
    [router],
  );

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
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder={t('flows.searchPlaceholder')}
            placeholderTextColor={colors.textTertiary}
            autoCorrect={false}
            clearButtonMode="while-editing"
            returnKeyType="search"
          />
        </View>
        <TouchableOpacity
          style={styles.modeBtn}
          onPress={() => setMode((m) => (m === 'list' ? 'map' : 'list'))}
          accessibilityLabel={mode === 'list' ? t('flows.viewMap') : t('flows.viewList')}
        >
          <Ionicons name={mode === 'list' ? 'map-outline' : 'list'} size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {mode === 'map' ? (
        <FlowsMap items={filtered} favorites={favorites} onOpen={openStation} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.station.code}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListHeaderComponent={hasSample ? (
            <View style={styles.sampleBanner}>
              <Ionicons name="flask-outline" size={16} color={colors.warning} />
              <Text style={styles.sampleText}>{t('flows.sampleBanner')}</Text>
            </View>
          ) : null}
          ListEmptyComponent={(
            <View style={styles.center}>
              <Ionicons name={searching ? 'search' : 'water-outline'} size={44} color={colors.textTertiary} />
              <Text style={styles.centerText}>
                {searching ? t('flows.noResults', { query: query.trim() }) : t('flows.empty')}
              </Text>
            </View>
          )}
          renderSectionHeader={({ section }) => (
            <View style={styles.regionHeader}>
              {section.isFavorites && <Ionicons name="heart" size={12} color={colors.danger} />}
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
                favorite={isFavorite(item.station.code)}
                onToggleFavorite={() => toggle(item.station.code)}
                onPress={() => openStation(item.station.code)}
              />
            </Animated.View>
          )}
        />
      )}
    </View>
  );
}

function StationRow({ item, styles, colors, t, favorite, onToggleFavorite, onPress }: {
  item: StationCurrent;
  styles: ReturnType<typeof makeStyles>;
  colors: Colors;
  t: (k: any, o?: any) => string;
  favorite: boolean;
  onToggleFavorite: () => void;
  onPress: () => void;
}) {
  const { station, latest, dayAgo } = item;
  const level = latest ? classifyFlow(station, latest.flow) : null;
  const levelColor = level ? WATER_LEVEL_COLOR[level] : colors.textTertiary;
  const trend = latest && dayAgo ? flowTrend(latest.flow, dayAgo.flow) : null;
  const change = latest ? changeLabel(t, latest.flow, dayAgo?.flow) : null;

  return (
    <PressableScale style={styles.card} onPress={onPress}>
      <View style={styles.cardInfo}>
        <Text style={styles.riverName}>{station.riverName}</Text>
        <Text style={styles.stationName} numberOfLines={1}>{station.name}</Text>
        {latest && (
          <Text style={styles.updated}>
            {timeAgoLabel(t, latest.ts)}{change ? ` · ${change}` : ''}
          </Text>
        )}
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
      <TouchableOpacity
        onPress={onToggleFavorite}
        hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
        accessibilityLabel={favorite ? t('flows.removeFavorite') : t('flows.addFavorite')}
      >
        <Ionicons name={favorite ? 'heart' : 'heart-outline'} size={19} color={favorite ? colors.danger : colors.textTertiary} />
      </TouchableOpacity>
    </PressableScale>
  );
}
