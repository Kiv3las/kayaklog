import React, { useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Share, Alert,
} from 'react-native';
import MapView, { Marker, Polyline, Callout, Region } from 'react-native-maps';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useApp } from '../lib/AppContext';
import { useTheme } from '../lib/themeContext';
import type { Colors } from '../constants/theme';
import { spacing, radius } from '../constants/theme';
import { sectionParts } from '../lib/sections';

const DIFFICULTY_COLOR: Record<string, string> = {
  'I': '#30d158', 'II': '#34c759', 'III': '#ffd60a',
  'IV': '#ff9f0a', 'V': '#ff453a', 'VI': '#bf5af2',
};

const THRESHOLD = 0.001;
function nearCoord(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  return Math.abs(a.latitude - b.latitude) < THRESHOLD && Math.abs(a.longitude - b.longitude) < THRESHOLD;
}

interface PinEntry { name: string; difficulty: string; date: string; section?: string }
interface Pin {
  id: string;
  coord: { latitude: number; longitude: number };
  type: 'start' | 'end';
  entries: PinEntry[];
  polylines: { latitude: number; longitude: number }[][];
}

interface RouteItem {
  id: string;
  name: string;
  difficulty: string;
  date: string;
  section?: string;
  start: { latitude: number; longitude: number };
  end?: { latitude: number; longitude: number };
  polyline: { latitude: number; longitude: number }[];
}

function fmtCoord(v: number, isLat: boolean) {
  const dir = isLat ? (v >= 0 ? 'N' : 'S') : (v >= 0 ? 'E' : 'O');
  return `${Math.abs(v).toFixed(5)}° ${dir}`;
}

function coordString(coord: { latitude: number; longitude: number }) {
  return `${coord.latitude.toFixed(6)}, ${coord.longitude.toFixed(6)}`;
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
    title: { fontSize: 17, fontWeight: '700', color: c.textPrimary },
    filterRow: {
      flexDirection: 'row',
      gap: 8,
      padding: spacing.sm,
      backgroundColor: c.cardBg,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    filterBtn: {
      paddingHorizontal: 16, paddingVertical: 6,
      borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, backgroundColor: c.cardBg,
    },
    filterBtnActive: { borderColor: c.primary, backgroundColor: c.primary },
    filterText: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
    filterTextActive: { color: '#fff' },
    mapContainer: { flex: 1 },
    map: { flex: 1 },
    callout: { width: 240 },
    legend: {
      position: 'absolute', top: 10, right: 10,
      backgroundColor: c.cardBg,
      borderRadius: radius.sm, padding: 8, gap: 4,
      borderWidth: 1, borderColor: c.border,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    legendText: { fontSize: 12, fontWeight: '600', color: c.textPrimary },
    emptyOverlay: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: `${c.bg}d9`, gap: 8,
    },
    emptyText: { fontSize: 17, fontWeight: '700', color: c.textPrimary },
    emptySubtext: { fontSize: 14, color: c.textTertiary, textAlign: 'center', paddingHorizontal: 32 },
    countBar: {
      paddingVertical: 10, paddingHorizontal: spacing.md,
      backgroundColor: c.cardBg, borderTopWidth: 1, borderTopColor: c.border,
    },
    countText: { fontSize: 13, color: c.textTertiary, textAlign: 'center' },
  });
}

function makeCalloutStyles(c: Colors) {
  return StyleSheet.create({
    container: { padding: 12, gap: 4, backgroundColor: '#ffffff' },
    header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    typeDot: { width: 10, height: 10, borderRadius: 5 },
    typeLabel: { fontSize: 13, fontWeight: '700', color: '#1c1c1e' },
    badge: { marginLeft: 'auto', backgroundColor: c.primary, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
    badgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
    entry: { marginBottom: 2 },
    riverName: { fontSize: 13, fontWeight: '600', color: '#1c1c1e' },
    entryMeta: { fontSize: 11, color: '#666666' },
    divider: { height: 1, backgroundColor: '#e0e0e0', marginVertical: 8 },
    coordLabel: { fontSize: 10, fontWeight: '700', color: '#888888', textTransform: 'uppercase', letterSpacing: 0.4 },
    coordValue: { fontSize: 12, fontWeight: '600', color: '#1c1c1e', marginBottom: 8 },
    actions: { flexDirection: 'row', gap: 8 },
    actionBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 4, paddingVertical: 6,
      borderRadius: radius.sm, borderWidth: 1, borderColor: c.primary,
    },
    actionText: { fontSize: 12, fontWeight: '600', color: c.primary },
  });
}

export default function MapScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { days } = useApp();
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const [filter, setFilter] = useState<'year' | 'all'>('year');

  const filteredDays = useMemo(() => {
    if (filter === 'year') return days.filter((d) => d.date.startsWith(`${currentYear}`));
    return days;
  }, [days, filter, currentYear]);

  const routes = useMemo<RouteItem[]>(() => {
    const result: RouteItem[] = [];
    for (const day of filteredDays) {
      for (const river of day.rivers) {
        river.laps.forEach((lap, li) => {
          const base = { name: river.name, difficulty: lap.difficulty ?? 'III', date: day.date };
          // Per-section routes (new model): one route per selected section that
          // has a put-in. Falls back to the legacy single location otherwise.
          const sectioned = sectionParts(lap.section)
            .map((part) => ({ part, loc: lap.sectionLocations?.[part] }))
            .filter((x) => x.loc?.start);
          if (sectioned.length > 0) {
            for (const { part, loc } of sectioned) {
              const start = loc!.start!;
              const end = loc!.end;
              result.push({
                id: `${day.id}-${river.name}-${li}-${part}`,
                ...base, section: part,
                start: { latitude: start.lat, longitude: start.lng },
                end: end ? { latitude: end.lat, longitude: end.lng } : undefined,
                polyline: end
                  ? [{ latitude: start.lat, longitude: start.lng }, { latitude: end.lat, longitude: end.lng }]
                  : [],
              });
            }
          } else if (lap.startLocation) {
            const poly = lap.endLocation
              ? [{ latitude: lap.startLocation.lat, longitude: lap.startLocation.lng }, { latitude: lap.endLocation.lat, longitude: lap.endLocation.lng }]
              : [];
            result.push({
              id: `${day.id}-${river.name}-${li}`,
              ...base, section: lap.section,
              start: { latitude: lap.startLocation.lat, longitude: lap.startLocation.lng },
              end: lap.endLocation ? { latitude: lap.endLocation.lat, longitude: lap.endLocation.lng } : undefined,
              polyline: poly,
            });
          }
        });
      }
    }
    return result;
  }, [filteredDays]);

  const { startPins, endPins } = useMemo(() => {
    const starts: Pin[] = [];
    const ends: Pin[] = [];
    for (const route of routes) {
      const existingStart = starts.find((p) => nearCoord(p.coord, route.start));
      const entry: PinEntry = { name: route.name, difficulty: route.difficulty, date: route.date, section: route.section };
      if (existingStart) {
        existingStart.entries.push(entry);
        if (route.polyline.length >= 2) existingStart.polylines.push(route.polyline);
      } else {
        starts.push({ id: `start-${route.id}`, coord: route.start, type: 'start', entries: [entry], polylines: route.polyline.length >= 2 ? [route.polyline] : [] });
      }
      if (!route.end) continue;
      const existingEnd = ends.find((p) => nearCoord(p.coord, route.end!));
      if (existingEnd) {
        existingEnd.entries.push({ ...entry });
      } else {
        ends.push({ id: `end-${route.id}`, coord: route.end, type: 'end', entries: [{ ...entry }], polylines: [] });
      }
    }
    return { startPins: starts, endPins: ends };
  }, [routes]);

  const copyCoord = useCallback(async (coord: { latitude: number; longitude: number }) => {
    await Clipboard.setStringAsync(coordString(coord));
    Alert.alert(t('map.copied'), coordString(coord));
  }, [t]);

  const shareCoord = useCallback(async (coord: { latitude: number; longitude: number }, label: string) => {
    await Share.share({ message: `${label}\n${coordString(coord)}` });
  }, []);

  const initialRegion: Region = routes.length > 0
    ? { latitude: routes[0].start.latitude, longitude: routes[0].start.longitude, latitudeDelta: 3, longitudeDelta: 3 }
    : { latitude: -33.45, longitude: -70.67, latitudeDelta: 4, longitudeDelta: 4 };

  const allPins = [...startPins, ...endPins];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)' as any)} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
          <Text style={styles.backText}>{t('map.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('map.title')}</Text>
        <View style={{ width: 70 }} />
      </View>

      <View style={styles.filterRow}>
        {(['year', 'all'] as const).map((f) => (
          <TouchableOpacity key={f} style={[styles.filterBtn, filter === f && styles.filterBtnActive]} onPress={() => setFilter(f)}>
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'year' ? currentYear : t('map.all')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.mapContainer}>
        <MapView style={styles.map} initialRegion={initialRegion}>
          {startPins.flatMap((pin) =>
            pin.polylines.map((poly, i) => (
              <Polyline key={`${pin.id}-poly-${i}`} coordinates={poly} strokeColor={DIFFICULTY_COLOR[pin.entries[i]?.difficulty ?? 'III'] ?? colors.primary} strokeWidth={3} />
            ))
          )}
          {startPins.map((pin) => (
            <Marker key={pin.id} coordinate={pin.coord} pinColor="#34c759">
              <Callout style={styles.callout}>
                <PinCallout pin={pin} label={[t('map.putIn'), pin.entries[0]?.section].filter(Boolean).join(' ')} dotColor="#34c759"
                  onCopy={() => copyCoord(pin.coord)}
                  onShare={() => shareCoord(pin.coord, t('map.startLabel', { names: pin.entries.map(e => e.name).join(', ') }))} />
              </Callout>
            </Marker>
          ))}
          {endPins.map((pin) => (
            <Marker key={pin.id} coordinate={pin.coord} pinColor="#ff3b30">
              <Callout style={styles.callout}>
                <PinCallout pin={pin} label={[t('map.takeOut'), pin.entries[0]?.section].filter(Boolean).join(' ')} dotColor="#ff3b30"
                  onCopy={() => copyCoord(pin.coord)}
                  onShare={() => shareCoord(pin.coord, t('map.endLabel', { names: pin.entries.map(e => e.name).join(', ') }))} />
              </Callout>
            </Marker>
          ))}
        </MapView>

        <View style={styles.legend}>
          {Object.entries(DIFFICULTY_COLOR).map(([diff, color]) => (
            <View key={diff} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: color }]} />
              <Text style={styles.legendText}>{diff}</Text>
            </View>
          ))}
        </View>

        {routes.length === 0 && (
          <View style={styles.emptyOverlay}>
            <Text style={styles.emptyText}>{t('map.noRoutes')}</Text>
            <Text style={styles.emptySubtext}>{t('map.noRoutesHint')}</Text>
          </View>
        )}
      </View>

      <View style={styles.countBar}>
        <Text style={styles.countText}>
          {t('map.routes', { count: routes.length })} · {t('map.pins', { count: allPins.length })} {filter === 'year' ? t('map.inYear', { year: currentYear }) : t('map.inHistory')}
        </Text>
      </View>
    </SafeAreaView>
  );
}

function PinCallout({ pin, label, dotColor, onCopy, onShare }: {
  pin: Pin; label: string; dotColor: string; onCopy: () => void; onShare: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const cs = useMemo(() => makeCalloutStyles(colors), [colors]);

  return (
    <View style={cs.container}>
      <View style={cs.header}>
        <View style={[cs.typeDot, { backgroundColor: dotColor }]} />
        <Text style={cs.typeLabel}>{label}</Text>
        {pin.entries.length > 1 && (
          <View style={cs.badge}>
            <Text style={cs.badgeText}>{t('map.routes', { count: pin.entries.length })}</Text>
          </View>
        )}
      </View>
      {pin.entries.map((entry, i) => (
        <View key={i} style={cs.entry}>
          <Text style={cs.riverName} numberOfLines={1}>{entry.name}</Text>
          <Text style={cs.entryMeta}>{t('rivers.class', { level: entry.difficulty })} · {entry.date}</Text>
        </View>
      ))}
      <View style={cs.divider} />
      <Text style={cs.coordLabel}>{t('map.coordinates')}</Text>
      <Text style={cs.coordValue}>{fmtCoord(pin.coord.latitude, true)}{'  '}{fmtCoord(pin.coord.longitude, false)}</Text>
      <View style={cs.actions}>
        <TouchableOpacity style={cs.actionBtn} onPress={onCopy}>
          <Ionicons name="copy-outline" size={14} color={colors.primary} />
          <Text style={cs.actionText}>{t('map.copy')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={cs.actionBtn} onPress={onShare}>
          <Ionicons name="share-outline" size={14} color={colors.primary} />
          <Text style={cs.actionText}>{t('map.share')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
