import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Ríos favoritos (♥) de los caudales: códigos BNA guardados en el dispositivo
// (como en caudalapp, no se sincronizan). Son los que muestra "Ríos ahora" en
// el home y los que encabezan el tablero. Solo entran los que el usuario marca:
// Kilian pidió explícitamente que no se llenen solos.
//
// Store a nivel de módulo para que el tablero, el carrusel del home y el
// detalle se enteren al tiro cuando se marca un corazón en cualquiera de ellos.

const KEY = 'kayak_flow_favorites_v1';

let favorites: string[] = [];
let loaded = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function ensureLoaded(): Promise<void> {
  if (loaded) return Promise.resolve();
  loading ??= AsyncStorage.getItem(KEY)
    .then((raw) => {
      const parsed = raw ? JSON.parse(raw) : [];
      favorites = Array.isArray(parsed) ? parsed : [];
    })
    .catch(() => { favorites = []; })
    .finally(() => { loaded = true; emit(); });
  return loading;
}

export async function toggleFavorite(code: string): Promise<void> {
  await ensureLoaded();
  favorites = favorites.includes(code) ? favorites.filter((c) => c !== code) : [...favorites, code];
  emit();
  void AsyncStorage.setItem(KEY, JSON.stringify(favorites)).catch(() => {});
}

export function useFlowFavorites() {
  const [state, setState] = useState({ favorites, loaded });
  useEffect(() => {
    const l = () => setState({ favorites, loaded });
    listeners.add(l);
    void ensureLoaded();
    l();
    return () => { listeners.delete(l); };
  }, []);
  const isFavorite = useCallback((code: string) => state.favorites.includes(code), [state.favorites]);
  return {
    favorites: state.favorites,
    loaded: state.loaded,
    isFavorite,
    toggle: toggleFavorite,
  };
}
