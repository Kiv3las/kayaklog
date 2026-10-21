import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LineChart } from 'react-native-gifted-charts';
import { useTheme } from '../lib/themeContext';
import { useApp } from '../lib/AppContext';
import type { Colors } from '../constants/theme';
import { spacing, radius } from '../constants/theme';
import { WATER_LEVEL_COLOR, WATER_LEVEL_I18N } from '../lib/water';
import { formatDisplayDate, parseDateISO, isoFromDate } from '../lib/dates';
import {
  StationDetail, StationCurrent, FlowForecastDay, FlowStation, Paddle,
  fetchStationDetail, loadCachedDetail, loadCachedStations, fetchStationsWithLatest,
  classifyFlow, flowTrend, paddlesForStation,
} from '../lib/flows';
import { useFlowFavorites } from '../lib/flowFavorites';
import { timeAgoLabel, changeLabel } from '../components/FlowsBoard';
import StarsDisplay from '../components/StarsDisplay';

type Range = '24h' | '7d' | '30d';
const RANGES: Range[] = ['24h', '7d', '30d'];
const PADDLES_SHOWN = 5;
// Ancho fijo de las etiquetas del eje X: la librería les da el ancho entre
// puntos (~5 px con 56 puntos) y las trunca a "1.".
const AXIS_LABEL_W = 34;

interface ChartPoint {
  value: number;
  label: string;
  hideDataPoint: boolean;
  dataPointColor?: string;
  dataPointRadius?: number;
}

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
    headerTitle: { fontSize: 17, fontWeight: '700', color: c.textPrimary, flexShrink: 1 },
    favBtn: { width: 70, alignItems: 'flex-end' },
    scroll: { padding: spacing.md, paddingBottom: 32 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    centerText: { fontSize: 15, color: c.textTertiary, textAlign: 'center' },

    currentCard: {
      backgroundColor: c.cardBg, borderRadius: radius.md, padding: spacing.lg,
      alignItems: 'center', borderWidth: 1, borderColor: c.border, marginBottom: spacing.md,
    },
    currentLabel: { fontSize: 12, color: c.textTertiary, marginBottom: 6 },
    currentRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
    currentValue: { fontSize: 44, fontWeight: '800', color: c.textPrimary },
    currentUnit: { fontSize: 16, color: c.textTertiary },
    levelChip: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, marginTop: 10,
    },
    levelText: { fontSize: 14, fontWeight: '700' },
    trendRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
    trendText: { fontSize: 14, fontWeight: '600', color: c.textSecondary },
    updated: { fontSize: 12, color: c.textTertiary, marginTop: 6 },

    sectionTitle: {
      fontSize: 13, fontWeight: '700', color: c.textTertiary,
      textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm, marginTop: spacing.sm,
    },
    segmented: {
      flexDirection: 'row', backgroundColor: c.cardBg, borderRadius: radius.sm,
      borderWidth: 1, borderColor: c.border, padding: 3, marginBottom: spacing.sm,
    },
    segment: { flex: 1, paddingVertical: 6, borderRadius: 6, alignItems: 'center' },
    segmentActive: { backgroundColor: c.primary },
    segmentText: { fontSize: 13, fontWeight: '600', color: c.textSecondary },
    segmentTextActive: { color: '#fff' },
    chartCard: {
      backgroundColor: c.cardBg, borderRadius: radius.md, borderWidth: 1, borderColor: c.border,
      padding: spacing.md, paddingBottom: spacing.sm, marginBottom: spacing.md, overflow: 'hidden',
    },
    noData: { textAlign: 'center', color: c.textTertiary, paddingVertical: 30 },
    legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendDash: { width: 16, height: 0, borderTopWidth: 2, borderStyle: 'dashed' },
    legendLine: { width: 16, height: 2 },
    legendText: { fontSize: 11, color: c.textTertiary },

    statsRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.sm },
    rangeStat: {
      flex: 1, backgroundColor: c.cardBg, borderRadius: radius.md, borderWidth: 1, borderColor: c.border,
      alignItems: 'center', paddingVertical: 10,
    },
    rangeStatValue: { fontSize: 16, fontWeight: '800', color: c.textPrimary },
    rangeStatLabel: { fontSize: 11, color: c.textTertiary, marginTop: 2 },

    forecastMeta: { fontSize: 11, color: c.textTertiary, marginTop: 4 },
    forecastNote: { fontSize: 12, color: c.textSecondary, lineHeight: 17 },
    dayStrip: { gap: 6, paddingTop: spacing.sm },
    dayCell: {
      width: 52, alignItems: 'center', paddingVertical: 8, gap: 3,
      borderRadius: radius.sm, backgroundColor: c.bg,
    },
    dayName: { fontSize: 11, fontWeight: '700', color: c.textSecondary },
    dayNum: { fontSize: 11, color: c.textTertiary },
    dayRain: { fontSize: 12, fontWeight: '700' },
    dayTemp: { fontSize: 11, color: c.textTertiary },
    dayFlow: { fontSize: 12, fontWeight: '800', color: c.textPrimary, marginTop: 2 },

    infoCard: {
      backgroundColor: c.cardBg, borderRadius: radius.md, borderWidth: 1, borderColor: c.border,
      padding: spacing.md, marginBottom: spacing.md,
    },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
    infoLabel: { fontSize: 13, color: c.textTertiary },
    infoValue: { fontSize: 13, color: c.textPrimary, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
    thrRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
    thrDot: { width: 10, height: 10, borderRadius: 5 },
    thrText: { fontSize: 13, color: c.textSecondary },

    paddleSummary: { fontSize: 15, fontWeight: '700', color: c.textPrimary, marginBottom: 6 },
    paddleRow: {
      flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border,
    },
    paddleInfo: { flex: 1 },
    paddleDate: { fontSize: 13, fontWeight: '600', color: c.textPrimary },
    paddleSection: { fontSize: 12, color: c.textTertiary },
    paddleFlow: { fontSize: 13, fontWeight: '700', color: c.textPrimary, textAlign: 'right' },
    paddleFlowSource: { fontSize: 10, color: c.textTertiary, textAlign: 'right' },
    paddleMore: { fontSize: 12, color: c.textTertiary, marginTop: 6 },

    source: { fontSize: 11, color: c.textTertiary, textAlign: 'center', marginTop: 4 },
    axisLabel: { width: AXIS_LABEL_W, textAlign: 'center', fontSize: 9, color: c.textTertiary },
  });
}

function RangeStat({ label, value, styles }: { label: string; value: number; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.rangeStat}>
      <Text style={styles.rangeStatValue}>{value}</Text>
      <Text style={styles.rangeStatLabel}>{label}</Text>
    </View>
  );
}

const round1 = (n: number) => Math.round(n * 10) / 10;

// Reemplaza las etiquetas de texto por un componente de ancho fijo centrado
// en su punto (el contenedor de la librería mide `spacing` y no recorta).
function withAxisLabels<T extends { label: string }>(
  data: T[], spacingPx: number, style: object,
): (T & { labelComponent?: () => React.ReactNode })[] {
  return data.map((p) => (p.label
    ? { ...p, label: '', labelComponent: () => <Text style={[style, { marginLeft: (spacingPx - AXIS_LABEL_W) / 2 }]}>{p.label}</Text> }
    : p));
}

// Un marcador por día remado: el punto más cercano a las 13:00 de ese día.
function markPaddledPoints(times: Date[], paddleDays: Set<string>): Set<number> {
  const best = new Map<string, { idx: number; dist: number }>();
  times.forEach((d, idx) => {
    const day = isoFromDate(d);
    if (!paddleDays.has(day)) return;
    const dist = Math.abs(d.getHours() + d.getMinutes() / 60 - 13);
    const cur = best.get(day);
    if (!cur || dist < cur.dist) best.set(day, { idx, dist });
  });
  return new Set(Array.from(best.values()).map((b) => b.idx));
}

export default function FlowStationScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { days } = useApp();
  const { isFavorite, toggle } = useFlowFavorites();
  // El param se llama "station" (no "code"): el handler de recuperación de
  // contraseña en _layout.tsx intercepta cualquier deep link con ?code=.
  const { station: code = '' } = useLocalSearchParams<{ station?: string }>();

  const [detail, setDetail] = useState<StationDetail | null | undefined>(undefined);
  const [catalog, setCatalog] = useState<StationCurrent[] | null>(null);
  const [range, setRange] = useState<Range>('7d');

  useEffect(() => {
    let mounted = true;
    // Stale-while-revalidate, como el tablero: el último detalle visto se
    // pinta al tiro y el fresco lo reemplaza al llegar.
    loadCachedDetail(code).then((cached) => {
      if (mounted && cached) setDetail((prev) => prev ?? cached);
    });
    fetchStationDetail(code)
      .then((d) => { if (mounted) setDetail(d); })
      .catch(() => { if (mounted) setDetail((prev) => prev ?? null); });
    // Catálogo para emparejar los ríos del registro con esta estación.
    loadCachedStations()
      .then((cached) => cached ?? fetchStationsWithLatest())
      .then((items) => { if (mounted) setCatalog(items); })
      .catch(() => {});
    return () => { mounted = false; };
  }, [code]);

  const station = detail?.station ?? null;
  const hourly = detail?.hourly ?? [];
  const daily = detail?.daily ?? [];
  const latest = hourly.length > 0 ? hourly[hourly.length - 1] : null;
  const level = station && latest ? classifyFlow(station, latest.flow) : null;
  const levelColor = level ? WATER_LEVEL_COLOR[level] : colors.primary;
  const hasThresholds = station != null && station.thrMedio !== null;

  // Lectura más cercana a 24 h antes de la última (si la serie alcanza).
  const dayAgo = useMemo(() => {
    if (!latest) return null;
    const target = new Date(latest.ts).getTime() - 24 * 3600_000;
    let best: { flow: number; dist: number } | null = null;
    for (const r of hourly) {
      const dist = Math.abs(new Date(r.ts).getTime() - target);
      if (!best || dist < best.dist) best = { flow: r.flow, dist };
    }
    return best && best.dist < 4 * 3600_000 ? best.flow : null;
  }, [hourly, latest]);

  const trend = latest && dayAgo !== null ? flowTrend(latest.flow, dayAgo) : null;
  const change = latest ? changeLabel(t, latest.flow, dayAgo) : null;

  // ── Tus bajadas ──
  const paddles = useMemo<Paddle[]>(
    () => (catalog ? paddlesForStation(days, catalog, code) : []),
    [days, catalog, code],
  );
  const dailyByDay = useMemo(() => new Map(daily.map((d) => [d.day, d])), [daily]);
  // Caudal de cada bajada: el anotado en el lap o, si no hay, el promedio DGA
  // de ese día.
  const paddleFlows = useMemo(() => paddles.map((p) => {
    if (p.flow != null) return { ...p, shownFlow: p.flow, fromDga: false };
    const dga = dailyByDay.get(p.date)?.avg;
    return { ...p, shownFlow: dga ?? null, fromDga: dga != null };
  }), [paddles, dailyByDay]);
  const paddleRange = useMemo(() => {
    const flows = paddleFlows.map((p) => p.shownFlow).filter((f): f is number => f !== null);
    if (flows.length === 0) return null;
    return { min: Math.round(Math.min(...flows)), max: Math.round(Math.max(...flows)) };
  }, [paddleFlows]);
  const paddleDays = useMemo(() => new Set(paddles.map((p) => p.date)), [paddles]);

  // ── Serie del rango elegido ──
  const series = useMemo(() => {
    if (range === '30d') {
      const since = isoFromDate(new Date(Date.now() - 29 * 86400_000));
      const rows = daily.filter((d) => d.day >= since);
      return {
        times: rows.map((d) => parseDateISO(d.day)),
        values: rows.map((d) => d.avg),
        min: rows.length ? Math.min(...rows.map((d) => d.min)) : 0,
        max: rows.length ? Math.max(...rows.map((d) => d.max)) : 0,
      };
    }
    const hours = range === '24h' ? 24 : 7 * 24;
    const since = latest ? new Date(latest.ts).getTime() - hours * 3600_000 : 0;
    const rows = hourly.filter((r) => new Date(r.ts).getTime() >= since);
    const values = rows.map((r) => r.flow);
    return {
      times: rows.map((r) => new Date(r.ts)),
      values,
      min: values.length ? Math.min(...values) : 0,
      max: values.length ? Math.max(...values) : 0,
    };
  }, [range, daily, hourly, latest]);

  const rangeStats = useMemo(() => {
    if (series.values.length === 0) return null;
    const avg = series.values.reduce((a, b) => a + b, 0) / series.values.length;
    return { min: round1(series.min), avg: round1(avg), max: round1(series.max) };
  }, [series]);

  // Umbrales dibujables como líneas de referencia: solo los que no aplastan
  // la escala del gráfico (hasta ~1.6× el máximo de la serie).
  const refLines = useMemo(() => {
    if (!station || station.thrMedio === null || series.values.length === 0) return [];
    const cap = Math.max(...series.values) * 1.6;
    const candidates: { value: number; color: string }[] = [
      { value: station.thrMedio, color: WATER_LEVEL_COLOR.medio },
      { value: station.thrAlto as number, color: WATER_LEVEL_COLOR.alto },
      { value: station.thrCrecida as number, color: WATER_LEVEL_COLOR.crecida },
    ];
    return candidates.filter((c) => c.value <= cap);
  }, [station, series]);

  const chartMax = useMemo(() => {
    if (series.values.length === 0) return undefined;
    const refMax = refLines.length > 0 ? Math.max(...refLines.map((r) => r.value)) : 0;
    return Math.ceil(Math.max(...series.values, refMax) * 1.1);
  }, [series, refLines]);

  // Puntos del gráfico. 168 puntos horarios apretarían el eje: en 7 días va
  // 1 de cada 3 h. Etiquetas: hora en 24 h, día del mes en 7 y 30 días.
  const chartData = useMemo<ChartPoint[]>(() => {
    const step = range === '7d' ? 3 : 1;
    const keep = series.times
      .map((d, i) => ({ d, v: series.values[i], i }))
      .filter(({ i }) => i % step === 0 || i === series.times.length - 1);
    const marked = markPaddledPoints(keep.map((k) => k.d), paddleDays);
    let prevLabel = '';
    const points: ChartPoint[] = keep.map(({ d, v }, idx) => {
      let label = '';
      if (range === '24h') {
        if (d.getHours() % 6 === 0) label = `${d.getHours()}h`;
      } else {
        const day = `${d.getDate()}`;
        if (day !== prevLabel && (range === '7d' || d.getDate() % 5 === 0)) label = day;
        prevLabel = day;
      }
      const isPaddle = marked.has(idx);
      return {
        value: v,
        label,
        hideDataPoint: !isPaddle,
        ...(isPaddle ? { dataPointColor: colors.starGold, dataPointRadius: 5 } : {}),
      };
    });
    // Dos etiquetas demasiado juntas se enciman ("13" de un día parcial con
    // un solo punto + "14"): se borra la anterior.
    const minGap = Math.ceil(points.length / 9);
    let last = -1;
    points.forEach((p, i) => {
      if (!p.label) return;
      if (last >= 0 && i - last < minGap) points[last].label = '';
      last = i;
    });
    return points;
  }, [series, range, paddleDays, colors.starGold]);
  const hasPaddleMarks = chartData.some((p) => !p.hideDataPoint);

  // ── Pronóstico ──
  const forecast = useMemo(() => detail?.forecast ?? [], [detail]);
  // Últimos 7 días medidos (promedio diario) + pronóstico desde hoy, que el
  // colector ancla a la medición de hoy: la curva continúa sin salto. El
  // tramo pronosticado se corta en el primer día sin caudal: las etiquetas se
  // ubican por posición y un hueco las correría a fechas equivocadas.
  const forecastChart = useMemo(() => {
    const run: { value: number; day: string }[] = [];
    for (const f of forecast) {
      if (f.flow === null) break;
      run.push({ value: f.flow, day: f.day });
    }
    if (run.length < 2) return null;
    const today = isoFromDate(new Date());
    const observed = daily.filter((d) => d.day < run[0].day).slice(-7);
    const points = [...observed.map((d) => ({ value: d.avg, day: d.day })), ...run];
    // Etiquetas cada 4 días contados desde hoy, para que "Hoy" no choque con
    // un número vecino.
    return {
      data: points.map((p, i) => {
        const offset = i - observed.length;
        return {
          value: p.value,
          label: offset === 0 && p.day === today
            ? t('flows.detail.today')
            : offset % 4 === 0 ? `${parseDateISO(p.day).getDate()}` : '',
          hideDataPoint: true,
        };
      }),
      splitIndex: Math.max(observed.length - 1, 0),
      max: Math.ceil(Math.max(...points.map((p) => p.value)) * 1.15),
    };
  }, [forecast, daily, t]);

  const isFav = isFavorite(code);
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/rivers' as any));
  const chartWidth = width - spacing.md * 4 - 40;
  const chartSpacing = (chartWidth - 20) / Math.max(chartData.length - 1, 1);
  const forecastSpacing = forecastChart ? (chartWidth - 20) / Math.max(forecastChart.data.length - 1, 1) : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={goBack}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
          <Text style={styles.backText}>{t('settings.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{station?.riverName ?? ''}</Text>
        <TouchableOpacity
          style={styles.favBtn}
          onPress={() => toggle(code)}
          disabled={!station}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={isFav ? t('flows.removeFavorite') : t('flows.addFavorite')}
        >
          {station && <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={23} color={isFav ? colors.danger : colors.primary} />}
        </TouchableOpacity>
      </View>

      {detail === undefined ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : detail === null || station === null ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={44} color={colors.textTertiary} />
          <Text style={styles.centerText}>{t('flows.error')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.duration(350)} style={styles.currentCard}>
            <Text style={styles.currentLabel}>{t('flows.detail.current')}</Text>
            {latest ? (
              <>
                <View style={styles.currentRow}>
                  <Text style={styles.currentValue}>{Math.round(latest.flow)}</Text>
                  <Text style={styles.currentUnit}>m³/s</Text>
                </View>
                {level && (
                  <View style={[styles.levelChip, { backgroundColor: `${levelColor}22` }]}>
                    <Ionicons name="water" size={14} color={levelColor} />
                    <Text style={[styles.levelText, { color: levelColor }]}>{t(WATER_LEVEL_I18N[level])}</Text>
                  </View>
                )}
                {trend && (
                  <View style={styles.trendRow}>
                    <Ionicons
                      name={trend === 'up' ? 'trending-up' : trend === 'down' ? 'trending-down' : 'remove'}
                      size={16}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.trendText}>
                      {trend === 'flat' ? t('flows.trendFlat') : `${t(trend === 'up' ? 'flows.trendUp' : 'flows.trendDown')} · ${change}`}
                    </Text>
                  </View>
                )}
                <Text style={styles.updated}>{timeAgoLabel(t, latest.ts)}</Text>
              </>
            ) : (
              <Text style={styles.noData}>{t('flows.detail.empty')}</Text>
            )}
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(350).delay(60)}>
            <Text style={styles.sectionTitle}>{t('flows.detail.history')}</Text>
            <View style={styles.segmented}>
              {RANGES.map((r) => (
                <TouchableOpacity key={r} style={[styles.segment, range === r && styles.segmentActive]} onPress={() => setRange(r)}>
                  <Text style={[styles.segmentText, range === r && styles.segmentTextActive]}>
                    {t(`flows.detail.range${r}` as any)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {rangeStats && (
              <View style={styles.statsRow}>
                <RangeStat label={t('flows.detail.min')} value={rangeStats.min} styles={styles} />
                <RangeStat label={t('flows.detail.avg')} value={rangeStats.avg} styles={styles} />
                <RangeStat label={t('flows.detail.max')} value={rangeStats.max} styles={styles} />
              </View>
            )}
            <View style={styles.chartCard}>
              {chartData.length < 2 ? (
                <Text style={styles.noData}>{t('flows.detail.emptyRange')}</Text>
              ) : (
                <>
                  <LineChart
                    key={range}
                    data={withAxisLabels(chartData, chartSpacing, styles.axisLabel)}
                    width={chartWidth}
                    height={160}
                    thickness={2}
                    color={levelColor}
                    startFillColor={levelColor}
                    endFillColor={levelColor}
                    startOpacity={0.25}
                    endOpacity={0.03}
                    areaChart
                    hideDataPoints={false}
                    maxValue={chartMax}
                    yAxisTextStyle={{ color: colors.textTertiary, fontSize: 10 }}
                    xAxisLabelTextStyle={{ color: colors.textTertiary, fontSize: 9 }}
                    yAxisThickness={0}
                    xAxisThickness={1}
                    xAxisColor={colors.border}
                    noOfSections={4}
                    rulesColor={colors.border}
                    rulesType="dashed"
                    initialSpacing={4}
                    spacing={chartSpacing}
                    showReferenceLine1={refLines.length > 0}
                    referenceLine1Position={refLines[0]?.value ?? 0}
                    referenceLine1Config={{ color: refLines[0]?.color, dashWidth: 4, dashGap: 6, thickness: 1 }}
                    showReferenceLine2={refLines.length > 1}
                    referenceLine2Position={refLines[1]?.value ?? 0}
                    referenceLine2Config={{ color: refLines[1]?.color, dashWidth: 4, dashGap: 6, thickness: 1 }}
                    showReferenceLine3={refLines.length > 2}
                    referenceLine3Position={refLines[2]?.value ?? 0}
                    referenceLine3Config={{ color: refLines[2]?.color, dashWidth: 4, dashGap: 6, thickness: 1 }}
                  />
                  {hasPaddleMarks && (
                    <View style={styles.legendRow}>
                      <View style={[styles.legendDot, { backgroundColor: colors.starGold }]} />
                      <Text style={styles.legendText}>{t('flows.detail.paddleLegend')}</Text>
                    </View>
                  )}
                </>
              )}
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(350).delay(120)}>
            <Text style={styles.sectionTitle}>{t('flows.detail.forecast')}</Text>
            <View style={styles.chartCard}>
              {forecast.length === 0 ? (
                <Text style={styles.noData}>{t('flows.detail.forecastEmpty')}</Text>
              ) : (
                <>
                  {forecastChart ? (
                    <>
                      <LineChart
                        data={withAxisLabels(forecastChart.data, forecastSpacing, styles.axisLabel)}
                        width={chartWidth}
                        height={140}
                        thickness={2}
                        color={levelColor}
                        hideDataPoints
                        maxValue={forecastChart.max}
                        lineSegments={[{
                          startIndex: forecastChart.splitIndex,
                          endIndex: forecastChart.data.length - 1,
                          color: levelColor,
                          strokeDashArray: [6, 4],
                        }]}
                        yAxisTextStyle={{ color: colors.textTertiary, fontSize: 10 }}
                        xAxisLabelTextStyle={{ color: colors.textTertiary, fontSize: 9 }}
                        yAxisThickness={0}
                        xAxisThickness={1}
                        xAxisColor={colors.border}
                        noOfSections={3}
                        rulesColor={colors.border}
                        rulesType="dashed"
                        initialSpacing={4}
                        spacing={forecastSpacing}
                      />
                      <View style={styles.legendRow}>
                        <View style={[styles.legendLine, { backgroundColor: levelColor }]} />
                        <Text style={styles.legendText}>{t('flows.detail.observed')}</Text>
                        <View style={[styles.legendDash, { borderColor: levelColor, marginLeft: 8 }]} />
                        <Text style={styles.legendText}>{t('flows.detail.estimated')}</Text>
                      </View>
                    </>
                  ) : (
                    // Río calibrado sin caudal hoy = faltan lecturas DGA
                    // recientes, no es que el modelo no lo capte.
                    <Text style={styles.forecastNote}>
                      {t(detail.hasFlowForecast ? 'flows.detail.forecastFlowUnavailable' : 'flows.detail.forecastNoFlow')}
                    </Text>
                  )}
                  <ForecastStrip forecast={forecast} styles={styles} colors={colors} t={t} />
                  {detail.forecastIssuedAt && (
                    <Text style={styles.forecastMeta}>
                      {t('flows.detail.forecastIssued', { ago: timeAgoLabel(t, detail.forecastIssuedAt) })}
                    </Text>
                  )}
                </>
              )}
            </View>
          </Animated.View>

          {paddles.length > 0 && (
            <Animated.View entering={FadeInDown.duration(350).delay(180)}>
              <Text style={styles.sectionTitle}>{t('flows.detail.yourPaddles')}</Text>
              <View style={styles.infoCard}>
                {paddleRange && (
                  <Text style={styles.paddleSummary}>
                    {paddleRange.min === paddleRange.max
                      ? t('flows.detail.paddlesAt', { value: paddleRange.min })
                      : t('flows.detail.paddlesBetween', { min: paddleRange.min, max: paddleRange.max })}
                  </Text>
                )}
                {paddleFlows.slice(0, PADDLES_SHOWN).map((p, i) => (
                  <View key={`${p.date}-${i}`} style={styles.paddleRow}>
                    <View style={styles.paddleInfo}>
                      <Text style={styles.paddleDate}>{formatDisplayDate(p.date)}</Text>
                      {p.section && <Text style={styles.paddleSection}>{p.section}</Text>}
                    </View>
                    <StarsDisplay value={p.stars} size={11} />
                    <View>
                      <Text style={styles.paddleFlow}>
                        {p.shownFlow !== null ? `${Math.round(p.shownFlow)} m³/s` : '–'}
                      </Text>
                      {p.fromDga && <Text style={styles.paddleFlowSource}>{t('flows.detail.paddleDga')}</Text>}
                    </View>
                  </View>
                ))}
                {paddleFlows.length > PADDLES_SHOWN && (
                  <Text style={styles.paddleMore}>{t('flows.detail.paddlesMore', { count: paddleFlows.length - PADDLES_SHOWN })}</Text>
                )}
              </View>
            </Animated.View>
          )}

          {hasThresholds && <Thresholds station={station} styles={styles} t={t} />}

          <Text style={styles.sectionTitle}>{t('flows.detail.station')}</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('flows.detail.stationName')}</Text>
              <Text style={styles.infoValue} numberOfLines={2}>{station.name}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('flows.detail.code')}</Text>
              <Text style={styles.infoValue}>{station.code}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('flows.detail.region')}</Text>
              <Text style={styles.infoValue}>{station.region}</Text>
            </View>
          </View>

          <Text style={styles.source}>{t('flows.detail.source')}</Text>
          {forecastChart && <Text style={styles.source}>{t('flows.detail.forecastNote')}</Text>}
          {forecast.length > 0 && <Text style={styles.source}>{t('flows.detail.forecastSource')}</Text>}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// Tira horizontal de 16 días: lluvia, máxima y caudal estimado.
function ForecastStrip({ forecast, styles, colors, t }: {
  forecast: FlowForecastDay[];
  styles: ReturnType<typeof makeStyles>;
  colors: Colors;
  t: (k: any, o?: any) => any;
}) {
  const weekdays = t('days.short', { returnObjects: true }) as string[];
  const today = isoFromDate(new Date());
  // Intensidad del azul según los mm: a simple vista se ven los días de lluvia.
  const rainColor = (mm: number) =>
    mm >= 20 ? colors.primaryDark : mm >= 5 ? colors.primary : WATER_LEVEL_COLOR.bajo;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayStrip}>
      {forecast.map((f) => {
        const d = parseDateISO(f.day);
        const rain = f.precipMm ?? 0;
        return (
          <View key={f.day} style={styles.dayCell}>
            <Text style={styles.dayName}>{f.day === today ? t('flows.detail.today') : weekdays[(d.getDay() + 6) % 7]}</Text>
            <Text style={styles.dayNum}>{d.getDate()}</Text>
            <Ionicons name={rain >= 0.5 ? 'rainy' : 'sunny-outline'} size={16} color={rain >= 0.5 ? rainColor(rain) : colors.textTertiary} />
            <Text style={[styles.dayRain, { color: rain >= 0.5 ? rainColor(rain) : colors.textTertiary }]}>
              {rain >= 0.5 ? `${Math.round(rain)} mm` : '–'}
            </Text>
            {f.tempMax !== null && <Text style={styles.dayTemp}>{Math.round(f.tempMax)}°</Text>}
            {f.flow !== null && <Text style={styles.dayFlow}>{Math.round(f.flow)}</Text>}
          </View>
        );
      })}
    </ScrollView>
  );
}

function Thresholds({ station, styles, t }: {
  station: FlowStation;
  styles: ReturnType<typeof makeStyles>;
  t: (k: any, o?: any) => string;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(350).delay(240)}>
      <Text style={styles.sectionTitle}>{t('flows.detail.thresholds')}</Text>
      <View style={styles.infoCard}>
        <View style={styles.thrRow}>
          <View style={[styles.thrDot, { backgroundColor: WATER_LEVEL_COLOR.bajo }]} />
          <Text style={styles.thrText}>{t('flows.detail.thresholdBajo', { value: station.thrMedio })}</Text>
        </View>
        <View style={styles.thrRow}>
          <View style={[styles.thrDot, { backgroundColor: WATER_LEVEL_COLOR.medio }]} />
          <Text style={styles.thrText}>{t('flows.detail.thresholdMedio', { from: station.thrMedio, to: station.thrAlto })}</Text>
        </View>
        <View style={styles.thrRow}>
          <View style={[styles.thrDot, { backgroundColor: WATER_LEVEL_COLOR.alto }]} />
          <Text style={styles.thrText}>{t('flows.detail.thresholdAlto', { from: station.thrAlto, to: station.thrCrecida })}</Text>
        </View>
        <View style={styles.thrRow}>
          <View style={[styles.thrDot, { backgroundColor: WATER_LEVEL_COLOR.crecida }]} />
          <Text style={styles.thrText}>{t('flows.detail.thresholdCrecida', { value: station.thrCrecida })}</Text>
        </View>
      </View>
    </Animated.View>
  );
}
