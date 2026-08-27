import { AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env');
}

// ─────────────────────────────────────────────────────────────────────────────
// Por qué todo lo de abajo tiene timeout
//
// Cada consulta a la base pasa primero por auth.getSession(), y getSession()
// corre dentro de un candado interno de supabase-js. Todo lo que ese candado
// espera —la petición de refresh del token, la escritura de la sesión en el
// llavero, los avisos a los suscriptores— no tiene ningún timeout propio: si
// una de esas promesas no vuelve, el candado no se libera nunca y TODAS las
// consultas posteriores quedan colgadas *antes* de salir a la red. La app no
// ve un error, ve una promesa eterna.
//
// Así se rompieron los caudales en el build 7 (agosto 2026): en los logs del
// servidor se ve el POST /auth/v1/token con 200 y después CERO peticiones REST
// del teléfono en 24 h — el cliente nunca salió a la red. Los días seguían
// viéndose porque salen de la caché local; el tablero de caudales, que consulta
// en vivo, se quedaba con el spinner puesto para siempre. Cuál de las promesas
// se colgó en el teléfono no se puede saber desde el servidor, así que se le
// pone plazo a todas.
//
// Con timeouts, el peor caso pasa de "la app queda inservible hasta que la
// cierras" a "una consulta falla, se reintenta y el candado se libera".
// ─────────────────────────────────────────────────────────────────────────────

const REQUEST_TIMEOUT_MS = 15_000;
const STORAGE_TIMEOUT_MS = 4_000;

// El plazo no se cancela al llegar las cabeceras, para que cubra también la
// lectura del cuerpo (en RN fetch va sobre XHR y el abort corta la petición
// completa). Todas las respuestas de esta app son JSON chico, así que un único
// plazo alcanza; abortar una respuesta ya consumida no hace nada.
const fetchWithTimeout: typeof fetch = (input, init) => {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  if (init?.signal) {
    if (init.signal.aborted) controller.abort();
    else init.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  return fetch(input, { ...init, signal: controller.signal });
};

// El llavero de iOS puede tardar o no responder nunca. Estrategia: la sesión
// vive también en memoria, así que
//   · leer     → memoria primero; si no está, llavero con plazo (falla si no
//                responde: nunca inventamos "no hay sesión", eso desconectaría
//                al usuario).
//   · escribir → memoria al instante y el llavero en segundo plano. La sesión
//                queda usable de inmediato aunque el llavero esté trabado, y
//                supabase-js libera su candado sin esperarlo.
// Sin la copia en memoria, un llavero trabado hacía que cada consulta releyera
// la sesión vencida y pidiera otro refresh: 10 s y cuatro tokens para una sola
// consulta (medido). Con ella, el llavero trabado ya casi no se nota.
const memorySession = new Map<string, string>();

function withStorageTimeout<T>(op: () => Promise<T>, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`SecureStore: ${what} sin respuesta en ${STORAGE_TIMEOUT_MS} ms`));
    }, STORAGE_TIMEOUT_MS);
    op().then(
      (v) => { if (!settled) { settled = true; clearTimeout(timer); resolve(v); } },
      (e) => { if (!settled) { settled = true; clearTimeout(timer); reject(e); } },
    );
  });
}

// Escritura en segundo plano: los errores solo se registran. Si el llavero
// falla, la sesión sigue en memoria durante esta ejecución; el costo máximo es
// tener que volver a entrar en el próximo arranque, no una app congelada.
function persistInBackground(what: string, op: () => Promise<void>): void {
  withStorageTimeout(op, what).catch((err) => {
    console.warn(`[supabase] no se pudo persistir la sesión (${what}):`, String(err));
  });
}

const SecureStoreAdapter = {
  getItem: async (key: string) => {
    const cached = memorySession.get(key);
    if (cached !== undefined) return cached;
    const stored = await withStorageTimeout(() => SecureStore.getItemAsync(key), `leer ${key}`);
    if (stored !== null) memorySession.set(key, stored);
    return stored;
  },
  setItem: async (key: string, value: string) => {
    memorySession.set(key, value);
    persistInBackground(`escribir ${key}`, () => SecureStore.setItemAsync(key, value));
  },
  removeItem: async (key: string) => {
    memorySession.delete(key);
    persistInBackground(`borrar ${key}`, () => SecureStore.deleteItemAsync(key));
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: { fetch: fetchWithTimeout },
});

// En React Native la librería no puede detectar si la app está en primer
// plano, así que el temporizador de refresh del token hay que manejarlo a
// mano (documentación oficial de Supabase para RN). Sin esto el token vence
// con la app abierta y, al abrir la app sin conexión, la sesión aparece
// muerta y el usuario cae al login — el bug offline de la v1.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
supabase.auth.startAutoRefresh();
