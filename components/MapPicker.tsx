import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Platform, Alert,
} from 'react-native';
import MapView, { Marker, Polyline, MapPressEvent, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { LatLng } from '../lib/types';
import { colors, spacing, radius } from '../constants/theme';

type PinMode = 'start' | 'end';

interface Props {
  visible: boolean;
  riverName?: string;
  initialStart?: LatLng;
  initialEnd?: LatLng;
  onConfirm: (start?: LatLng, end?: LatLng) => void;
  onCancel: () => void;
}

const DEFAULT_REGION: Region = {
  latitude: -33.45,
  longitude: -70.67,
  latitudeDelta: 1.5,
  longitudeDelta: 1.5,
};

export default function MapPicker({ visible, riverName, initialStart, initialEnd, onConfirm, onCancel }: Props) {
  const [mode, setMode] = useState<PinMode>('start');
  const [startPin, setStartPin] = useState<LatLng | undefined>(initialStart);
  const [endPin, setEndPin] = useState<LatLng | undefined>(initialEnd);
  const [locationGranted, setLocationGranted] = useState(false);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (!visible) return;
    setStartPin(initialStart);
    setEndPin(initialEnd);
    setMode('start');
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationGranted(status === 'granted');
    })();
  }, [visible]);

  function handleMapPress(e: MapPressEvent) {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    const pin: LatLng = { lat: latitude, lng: longitude };
    if (mode === 'start') {
      setStartPin(pin);
      setMode('end');
    } else {
      setEndPin(pin);
    }
  }

  async function centerOnMe() {
    if (!locationGranted) {
      Alert.alert('Sin permiso', 'Activa la ubicación en Ajustes del sistema.');
      return;
    }
    const loc = await Location.getCurrentPositionAsync({});
    mapRef.current?.animateToRegion({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    }, 600);
  }

  const startCoord = startPin ? { latitude: startPin.lat, longitude: startPin.lng } : null;
  const endCoord = endPin ? { latitude: endPin.lat, longitude: endPin.lng } : null;

  const initialRegion: Region = initialStart
    ? { latitude: initialStart.lat, longitude: initialStart.lng, latitudeDelta: 0.15, longitudeDelta: 0.15 }
    : DEFAULT_REGION;

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} style={styles.headerBtn}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.title}>Ubicación</Text>
            {riverName ? <Text style={styles.subtitle}>{riverName}</Text> : null}
          </View>
          <TouchableOpacity onPress={() => onConfirm(startPin, endPin)} style={styles.headerBtn}>
            <Text style={styles.doneText}>Listo</Text>
          </TouchableOpacity>
        </View>

        {/* Mode selector */}
        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'start' && styles.modeBtnActive]}
            onPress={() => setMode('start')}
          >
            <View style={[styles.pinDot, { backgroundColor: '#34c759' }]} />
            <Text style={[styles.modeBtnText, mode === 'start' && styles.modeBtnTextActive]}>
              Inicio {startPin ? '✓' : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'end' && styles.modeBtnActive]}
            onPress={() => setMode('end')}
          >
            <View style={[styles.pinDot, { backgroundColor: '#ff3b30' }]} />
            <Text style={[styles.modeBtnText, mode === 'end' && styles.modeBtnTextActive]}>
              Final {endPin ? '✓' : ''}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>
          Toca el mapa para colocar el pin de {mode === 'start' ? 'inicio' : 'final'} · Arrastra para ajustar
        </Text>

        {/* Map */}
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={initialRegion}
          showsUserLocation={locationGranted}
          showsMyLocationButton={false}
          onPress={handleMapPress}
        >
          {startCoord && (
            <Marker
              coordinate={startCoord}
              pinColor="#34c759"
              title="Inicio"
              draggable
              onDragEnd={(e) =>
                setStartPin({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })
              }
            />
          )}
          {endCoord && (
            <Marker
              coordinate={endCoord}
              pinColor="#ff3b30"
              title="Final"
              draggable
              onDragEnd={(e) =>
                setEndPin({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })
              }
            />
          )}
          {startCoord && endCoord && (
            <Polyline
              coordinates={[startCoord, endCoord]}
              strokeColor={colors.primary}
              strokeWidth={3}
              lineDashPattern={[8, 4]}
            />
          )}
        </MapView>

        {/* Locate button */}
        <TouchableOpacity style={styles.locateBtn} onPress={centerOnMe}>
          <Ionicons name="locate" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: 12,
    backgroundColor: colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBtn: { width: 80 },
  headerCenter: { alignItems: 'center' },
  title: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  subtitle: { fontSize: 12, color: colors.textTertiary, marginTop: 1 },
  cancelText: { color: colors.danger, fontSize: 15 },
  doneText: { color: colors.primary, fontSize: 15, fontWeight: '700', textAlign: 'right' },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: '#fff',
  },
  modeBtnActive: { borderColor: colors.primary, backgroundColor: `${colors.primary}14` },
  modeBtnText: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },
  modeBtnTextActive: { color: colors.primary },
  pinDot: { width: 10, height: 10, borderRadius: 5 },
  hint: {
    fontSize: 12,
    color: '#fff',
    textAlign: 'center',
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  map: { flex: 1 },
  locateBtn: {
    position: 'absolute',
    bottom: 40,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
});
