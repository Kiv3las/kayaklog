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
import type { Colors } from '../constants/theme';
import { spacing, radius } from '../constants/theme';
import { WATER_LEVEL_COLOR, WATER_LEVEL_I18N } from '../lib/water';
import {
  FlowStation, FlowReading, fetchStation, fetchStationHistory, classifyFlow,
} from '../lib/flows';
import { timeAgoLabel } from '../components/FlowsBoard';

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
    scroll: { padding: spacing.md, paddingBottom: 32 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    centerText: { fontSize: 15, color: c.textTertiary, textAlign: 'center' },

    sampleBanner: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: `${c.warning}18`, borderColor: `${c.warning}55`, borderWidth: 1,
      borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 8,
      marginBottom: spacing.md,
    },
    sampleText: { flex: 1, fontSize: 12, color: c.textSecondary },

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
    updated: { fontSize: 12, color: c.textTertiary, marginTop: 8 },

    sectionTitle: {
      fontSize: 13, fontWeight: '700', color: c.textTertiary,
      textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm, marginTop: spacing.sm,
    },
    chartCard: {
      backgroundColor: c.cardBg, borderRadius: radius.md, borderWidth: 1, borderColor: c.border,
      padding: spacing.md, paddingBottom: spacing.sm, marginBottom: spacing.md, overflow: 'hidden',
    },
    noData: { textAlign: 'center', color: c.textTertiary, paddingVertical: 30 },

    thrRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
    thrDot: { width: 10, height: 10, borderRadius: 5 },
    thrText: { fontSize: 13, color: c.textSecondary },

    infoCard: {
      backgroundColor: c.cardBg, borderRadius: radius.md, borderWidth: 1, borderColor: c.border,
      padding: spacing.md, marginBottom: spacing.md,
    },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
    infoLabel: { fontSize: 13, color: c.textTertiary },
    infoValue: { fontSize: 13, color: c.textPrimary, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
    source: { fontSize: 11, color: c.textTertiary, textAlign: 'center', marginTop: 4 },

    statsRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
    weekStat: {
      flex: 1, backgroundColor: c.cardBg, borderRadius: radius.md, borderWidth: 1, borderColor: c.border,
      alignItems: 'center', paddingVertical: 10,
    },
    weekStatValue: { fontSize: 16, fontWeight: '800', color: c.textPrimary },
    weekStatLabel: { fontSize: 11, color: c.textTertiary, marginTop: 2 },
  });
}

function WeekStat({ label, value, styles }: { label: string; value: number; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.weekStat}>
      <Text style={styles.weekStatValue}>{value}</Text>
      <Text style={styles.weekStatLabel}>{label}</Text>
    </View>
  );
}

export default function FlowStationScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { width } = useWindowDimensions();
  // El param se llama "station" (no "code"): el handler de recuperación de
  // contraseña en _layout.tsx intercepta cualquier deep link con ?code=.
  const { station: code = '' } = useLocalSearchParams<{ station?: string }>();

  const [station, setStation] = useState<FlowStation | null | undefined>(undefined);
  const [history, setHistory] = useState<FlowReading[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [st, hist] = await Promise.all([fetchStation(code), fetchStationHistory(code, 7)]);
        if (!mounted) return;
        setStation(st);
        setHistory(hist);
      } catch {
        if (mounted) setStation(null);
      }
    })();
    return () => { mounted = false; };
  }, [code]);

  const latest = history.length > 0 ? history[history.length - 1] : null;
  const level = station && latest ? classifyFlow(station, latest.flow) : null;
  const levelColor = level ? WATER_LEVEL_COLOR[level] : colors.primary;
  const hasThresholds = station != null && station.thrMedio !== null;

  // Resumen de los últimos 7 días
  const weekStats = useMemo(() => {
    if (history.length === 0) return null;
    const flows = history.map((r) => r.flow);
    const min = Math.min(...flows);
    const max = Math.max(...flows);
    const avg = flows.reduce((a, b) => a + b, 0) / flows.length;
    return { min: Math.round(min * 10) / 10, max: Math.round(max * 10) / 10, avg: Math.round(avg * 10) / 10 };
  }, [history]);

  // Umbrales dibujables como líneas de referencia: solo los que no aplastan
  // la escala del gráfico (hasta ~1.6× el máximo de la serie).
  const refLines = useMemo(() => {
    if (!station || station.thrMedio === null || history.length === 0) return [];
    const dataMax = Math.max(...history.map((r) => r.flow));
    const cap = dataMax * 1.6;
    const candidates: { value: number; color: string }[] = [
      { value: station.thrMedio, color: WATER_LEVEL_COLOR.medio },
      { value: station.thrAlto as number, color: WATER_LEVEL_COLOR.alto },
      { value: station.thrCrecida as number, color: WATER_LEVEL_COLOR.crecida },
    ];
    return candidates.filter((c) => c.value <= cap);
  }, [station, history]);

  const chartMax = useMemo(() => {
    if (history.length === 0) return undefined;
    const dataMax = Math.max(...history.map((r) => r.flow));
    const refMax = refLines.length > 0 ? Math.max(...refLines.map((r) => r.value)) : 0;
    return Math.ceil(Math.max(dataMax, refMax) * 1.1);
  }, [history, refLines]);

  // 168 puntos horarios apretarían demasiado el eje: 1 de cada 3 h basta.
  // Etiqueta en el primer punto de cada día calendario.
  const chartData = useMemo(() => {
    const sampled = history.filter((_, i) => i % 3 === 0 || i === history.length - 1);
    let prevDay = '';
    return sampled.map((r) => {
      const d = new Date(r.ts);
      const day = `${d.getDate()}`;
      const isNewDay = day !== prevDay;
      prevDay = day;
      return { value: r.flow, label: isNewDay ? day : '' };
    });
  }, [history]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/rivers' as any));

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={goBack}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
          <Text style={styles.backText}>{t('settings.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{station?.riverName ?? ''}</Text>
        <View style={{ width: 70 }} />
      </View>

      {station === undefined ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : station === null ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={44} color={colors.textTertiary} />
          <Text style={styles.centerText}>{t('flows.error')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {latest?.isSample && (
            <View style={styles.sampleBanner}>
              <Ionicons name="flask-outline" size={16} color={colors.warning} />
              <Text style={styles.sampleText}>{t('flows.sampleBanner')}</Text>
            </View>
          )}

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
                <Text style={styles.updated}>{timeAgoLabel(t, latest.ts)}</Text>
              </>
            ) : (
              <Text style={styles.noData}>{t('flows.detail.empty')}</Text>
            )}
          </Animated.View>

          {weekStats && (
            <Animated.View entering={FadeInDown.duration(350).delay(60)} style={styles.statsRow}>
              <WeekStat label={t('flows.detail.min')} value={weekStats.min} styles={styles} />
              <WeekStat label={t('flows.detail.avg')} value={weekStats.avg} styles={styles} />
              <WeekStat label={t('flows.detail.max')} value={weekStats.max} styles={styles} />
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.duration(350).delay(120)}>
            <Text style={styles.sectionTitle}>{t('flows.detail.chart')}</Text>
            <View style={styles.chartCard}>
              {chartData.length < 2 ? (
                <Text style={styles.noData}>{t('flows.detail.empty')}</Text>
              ) : (
                <LineChart
                  data={chartData}
                  width={width - spacing.md * 4 - 40}
                  height={160}
                  thickness={2}
                  color={levelColor}
                  startFillColor={levelColor}
                  endFillColor={levelColor}
                  startOpacity={0.25}
                  endOpacity={0.03}
                  areaChart
                  hideDataPoints
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
                  spacing={(width - spacing.md * 4 - 60) / Math.max(chartData.length - 1, 1)}
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
              )}
            </View>
          </Animated.View>

          {hasThresholds && (
            <Animated.View entering={FadeInDown.duration(350).delay(180)}>
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
          )}

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
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
