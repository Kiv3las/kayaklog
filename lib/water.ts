import { WaterLevel } from './types';

// Water level shared by the add form and the river detail. Ordinal so laps can
// be compared ("most/least water"); each level has a color and an i18n key.
export const WATER_LEVELS: WaterLevel[] = ['bajo', 'medio', 'alto', 'crecida'];

export const WATER_LEVEL_RANK: Record<WaterLevel, number> = {
  bajo: 1, medio: 2, alto: 3, crecida: 4,
};

export const WATER_LEVEL_COLOR: Record<WaterLevel, string> = {
  bajo: '#5ac8fa',    // light blue — low
  medio: '#0a84ff',   // blue — normal
  alto: '#0066cc',    // deep blue — high
  crecida: '#ff9500', // orange — flood
};

export const WATER_LEVEL_I18N: Record<WaterLevel, string> = {
  bajo: 'water.bajo', medio: 'water.medio', alto: 'water.alto', crecida: 'water.crecida',
};

export function waterRank(level?: WaterLevel): number {
  return level ? WATER_LEVEL_RANK[level] : 0;
}
