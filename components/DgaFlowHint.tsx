import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../lib/themeContext';
import type { Colors } from '../constants/theme';
import { radius } from '../constants/theme';
import { WaterLevel } from '../lib/types';
import { StationCurrent, classifyFlow, fetchDayFlow, matchStationForRiver } from '../lib/flows';
import { isoFromDate } from '../lib/dates';

// Lectura "actual" válida para un registro de hoy: más vieja que esto, mejor
// el promedio del día.
const FRESH_MS = 6 * 3600_000;

// Promedios diarios ya consultados (código|fecha): varios laps del mismo río
// y día no repiten la consulta. Solo quedan los que trajeron dato: un null
// puede ser "sesión aún no lista" (RLS filtra todo y PostgREST responde [])
// o un día de hoy todavía sin lecturas, y debe volver a consultarse.
const dayFlowCache = new Map<string, Promise<number | null>>();

function makeStyles(c: Colors) {
  return StyleSheet.create({
    chip: {
      flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6,
      paddingVertical: 6, paddingLeft: 10, paddingRight: 6,
      borderRadius: radius.sm, backgroundColor: `${c.primary}12`, borderWidth: 1, borderColor: `${c.primary}33`,
    },
    text: { flex: 1, fontSize: 12, color: c.textSecondary },
    strong: { fontWeight: '700', color: c.textPrimary },
    useBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: c.primary },
    useText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  });
}

// Sugerencia de caudal DGA para un lap: si el río (chileno) tiene estación,
// muestra su caudal de ese día y un botón para usarlo. No escribe solo: la
// estación puede quedar lejos del tramo remado, y el usuario decide.
export default function DgaFlowHint({ catalog, riverName, country, dateISO, currentFlow, onUse }: {
  catalog: StationCurrent[] | null;
  riverName: string;
  country: string;
  dateISO: string;
  currentFlow?: number;
  onUse: (flow: number, level: WaterLevel | null) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const match = useMemo(
    () => (catalog && country === 'CL' ? matchStationForRiver(catalog, riverName) : null),
    [catalog, country, riverName],
  );

  const isToday = dateISO === isoFromDate(new Date());
  const fresh = isToday && match?.latest && Date.now() - new Date(match.latest.ts).getTime() < FRESH_MS
    ? match.latest.flow
    : null;

  const [dayFlow, setDayFlow] = useState<number | null>(null);
  useEffect(() => {
    setDayFlow(null);
    if (!match || fresh !== null) return;
    let mounted = true;
    const key = `${match.station.code}|${dateISO}`;
    if (!dayFlowCache.has(key)) {
      dayFlowCache.set(key, fetchDayFlow(match.station.code, dateISO)
        .catch(() => null)
        .then((v) => {
          if (v === null) dayFlowCache.delete(key);
          return v;
        }));
    }
    dayFlowCache.get(key)!.then((v) => { if (mounted) setDayFlow(v); });
    return () => { mounted = false; };
  }, [match, dateISO, fresh]);

  const value = fresh ?? dayFlow;
  if (!match || value === null) return null;
  const rounded = Math.round(value);
  if (currentFlow === rounded) return null;

  return (
    <View style={styles.chip}>
      <Ionicons name="water-outline" size={14} color={colors.primary} />
      <Text style={styles.text} numberOfLines={2}>
        {t('add.dgaFlow', { river: match.station.riverName })}{' '}
        <Text style={styles.strong}>{rounded} m³/s</Text>
        {' · '}{fresh !== null ? t('add.dgaNow') : t('add.dgaDayAvg')}
      </Text>
      <TouchableOpacity style={styles.useBtn} onPress={() => onUse(rounded, classifyFlow(match.station, value))}>
        <Text style={styles.useText}>{t('add.dgaUse')}</Text>
      </TouchableOpacity>
    </View>
  );
}
