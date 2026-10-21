import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../lib/themeContext';
import type { Colors } from '../constants/theme';
import { WATER_LEVEL_COLOR, WATER_LEVEL_I18N } from '../lib/water';
import { StationCurrent, classifyFlow } from '../lib/flows';

function makeStyles(c: Colors) {
  return StyleSheet.create({
    map: { flex: 1 },
    pin: {
      minWidth: 34, paddingHorizontal: 6, paddingVertical: 3,
      borderRadius: 12, alignItems: 'center',
      borderWidth: 2, borderColor: '#ffffff',
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.25, shadowRadius: 2,
    },
    pinFavorite: { borderColor: c.danger },
    pinText: { fontSize: 12, fontWeight: '800', color: '#ffffff' },
  });
}

// Mapa del tablero: una píldora por estación con el caudal actual, del color
// de su nivel. Tocar la píldora abre el globo nativo (río + caudal + estación)
// y tocar el globo abre el detalle.
export default function FlowsMap({ items, favorites, onOpen }: {
  items: StationCurrent[];
  favorites: string[];
  onOpen: (code: string) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const mapRef = useRef<MapView>(null);
  const [ready, setReady] = useState(false);

  const located = useMemo(
    () => items.filter((i) => i.station.lat !== null && i.station.lng !== null),
    [items],
  );

  // Encuadrar todas las estaciones visibles (Chile es largo: un zoom fijo
  // deja medio país fuera). Se re-encuadra cuando el buscador filtra.
  const fit = useCallback(() => {
    if (located.length === 0) return;
    mapRef.current?.fitToCoordinates(
      located.map((i) => ({ latitude: i.station.lat as number, longitude: i.station.lng as number })),
      { edgePadding: { top: 60, right: 50, bottom: 60, left: 50 }, animated: true },
    );
  }, [located]);

  useEffect(() => { if (ready) fit(); }, [ready, fit]);

  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      onMapReady={() => setReady(true)}
      initialRegion={{ latitude: -40, longitude: -71.8, latitudeDelta: 18, longitudeDelta: 10 }}
    >
      {located.map((item) => {
        const { station, latest } = item;
        const level = latest ? classifyFlow(station, latest.flow) : null;
        const color = level ? WATER_LEVEL_COLOR[level] : latest ? colors.primary : colors.textTertiary;
        const flowText = latest ? `${Math.round(latest.flow)} m³/s` : t('flows.noData');
        const levelText = level ? ` · ${t(WATER_LEVEL_I18N[level] as any)}` : '';
        return (
          <Marker
            key={station.code}
            coordinate={{ latitude: station.lat as number, longitude: station.lng as number }}
            title={station.riverName}
            description={`${flowText}${levelText} — ${station.name}`}
            onCalloutPress={() => onOpen(station.code)}
          >
            <View style={[styles.pin, { backgroundColor: color }, favorites.includes(station.code) && styles.pinFavorite]}>
              <Text style={styles.pinText}>{latest ? Math.round(latest.flow) : '–'}</Text>
            </View>
          </Marker>
        );
      })}
    </MapView>
  );
}
