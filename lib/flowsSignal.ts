// Señal a nivel de módulo para abrir la pestaña Ríos directo en el segmento
// "Caudales" (p. ej. desde el carrusel del home). Mismo patrón que
// addFormSignal: los params de URL no son confiables entre cambios de tab.
export const flowsSignal: { openFlows: boolean } = { openFlows: false };
