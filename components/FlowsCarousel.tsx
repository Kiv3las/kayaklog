import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../lib/themeContext';
import type { Colors } from '../constants/theme';
import { spacing, radius } from '../constants/theme';
import { WATER_LEVEL_COLOR, WATER_LEVEL_I18N } from '../lib/water';
import { StationCurrent, fetchStationsWithLatest, classifyFlow, flowTrend } from '../lib/flows';
import { flowsSignal } from '../lib/flowsSignal';
import { timeAgoLabel } from './FlowsBoard';
import PressableScale from './PressableScale';

const CARD_WIDTH = 148;
const SPARK_W = CARD_WIDTH - 24;
const SPARK_H = 30;

// Sparkline de una sola serie: línea de 2px con relleno degradado suave,
// sin ejes ni grilla (el número grande de la tarjeta es el dato; esto solo
// muestra la forma de las últimas 24 h).
function Sparkline({ values, color, id }: { values: number[]; color: string; id: string }) {
  if (values.length < 2) return <View style={{ height: SPARK_H }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const flat = max - min === 0; // serie constante → línea centrada, no al borde
  const range = max - min || 1;
  const pad = 2;
  const pts = values.map((v, i) => ({
    x: (i / (values.length - 1)) * SPARK_W,
    y: flat ? SPARK_H / 2 : pad + (1 - (v - min) / range) * (SPARK_H - pad * 2),
  }));
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L${SPARK_W},${SPARK_H} L0,${SPARK_H} Z`;
  return (
    <Svg width={SPARK_W} height={SPARK_H}>
      <Defs>
        <LinearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.28} />
          <Stop offset="1" stopColor={color} stopOpacity={0.02} />
        </LinearGradient>
      </Defs>
      <Path d={area} fill={`url(#grad-${id})`} />
      <Path d={line} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    headerRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    title: {
      fontSize: 13, fontWeight: '700', color: c.textTertiary,
      textTransform: 'uppercase', letterSpacing: 0.5,
    },
    seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    seeAllText: { fontSize: 13, fontWeight: '600', color: c.primary },
    scroll: { marginHorizontal: -spacing.md },
    scrollContent: { paddingHorizontal: spacing.md, gap: 10 },
    card: {
      width: CARD_WIDTH,
      backgroundColor: c.cardBg,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.border,
      padding: 12,
      overflow: 'hidden',
    },
    accent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
    river: { fontSize: 13, fontWeight: '700', color: c.textPrimary, marginBottom: 6 },
    flowRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
    flowValue: { fontSize: 24, fontWeight: '800', color: c.textPrimary },
    flowUnit: { fontSize: 11, color: c.textTertiary },
    levelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3, marginBottom: 8 },
    levelText: { fontSize: 11, fontWeight: '700' },
    trendIcon: { marginLeft: 2 },
    updated: { fontSize: 10, color: c.textTertiary, marginTop: 6 },
    loadingBox: { height: 120, alignItems: 'center', justifyContent: 'center' },
    section: { marginBottom: spacing.md },
  });
}

export default function FlowsCarousel({ refreshToken = 0, onLoaded }: {
  // Incrementar para forzar recarga (pull-to-refresh del home).
  refreshToken?: number;
  onLoaded?: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const [items, setItems] = useState<StationCurrent[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await fetchStationsWithLatest());
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      onLoaded?.();
    }
  }, [onLoaded]);

  useEffect(() => { load(); }, [load, refreshToken]);

  const openBoard = () => {
    flowsSignal.openFlows = true;
    router.navigate('/(tabs)/rivers');
  };

  // Sin datos no hay sección: el home no muestra un bloque de error.
  if (failed && items === null) return null;

  const withData = (items ?? []).filter((i) => i.latest);

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{t('flows.homeTitle')}</Text>
        <TouchableOpacity style={styles.seeAll} onPress={openBoard} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.seeAllText}>{t('flows.seeAll')}</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {items === null ? (
        <View style={styles.loadingBox}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          snapToInterval={CARD_WIDTH + 10}
          decelerationRate="fast"
        >
          {withData.map((item, i) => (
            <Animated.View key={item.station.code} entering={FadeInDown.duration(350).delay(Math.min(i, 6) * 60)}>
              <FlowCard
                item={item}
                styles={styles}
                colors={colors}
                t={t}
                onPress={() => router.push({ pathname: '/flow-station', params: { station: item.station.code } } as any)}
              />
            </Animated.View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function FlowCard({ item, styles, colors, t, onPress }: {
  item: StationCurrent;
  styles: ReturnType<typeof makeStyles>;
  colors: Colors;
  t: (k: any, o?: any) => string;
  onPress: () => void;
}) {
  const { station, latest, dayAgo, series } = item;
  if (!latest) return null;
  const level = classifyFlow(station, latest.flow);
  // Sin umbrales calibrados no se clasifica: acento y sparkline en el color
  // primario, sin chip de nivel.
  const levelColor = level ? WATER_LEVEL_COLOR[level] : colors.primary;
  const trend = dayAgo ? flowTrend(latest.flow, dayAgo.flow) : null;

  return (
    <PressableScale style={styles.card} onPress={onPress}>
      <View style={[styles.accent, { backgroundColor: levelColor }]} />
      <Text style={styles.river} numberOfLines={1}>{station.riverName}</Text>
      <View style={styles.flowRow}>
        <Text style={styles.flowValue}>{Math.round(latest.flow)}</Text>
        <Text style={styles.flowUnit}>m³/s</Text>
        {trend && trend !== 'flat' && (
          <Ionicons
            name={trend === 'up' ? 'trending-up' : 'trending-down'}
            size={14}
            color={colors.textSecondary}
            style={styles.trendIcon}
          />
        )}
      </View>
      <View style={styles.levelRow}>
        {level ? (
          <>
            <Ionicons name="water" size={11} color={levelColor} />
            <Text style={[styles.levelText, { color: levelColor }]}>{t(WATER_LEVEL_I18N[level])}</Text>
          </>
        ) : (
          <Text style={[styles.levelText, { color: colors.textTertiary }]}> </Text>
        )}
      </View>
      <Sparkline values={series.map((r) => r.flow)} color={levelColor} id={station.code} />
      <Text style={styles.updated}>{timeAgoLabel(t, latest.ts)}</Text>
    </PressableScale>
  );
}
