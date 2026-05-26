export const lightColors = {
  primary: '#0a84ff',
  primaryDark: '#0066cc',
  danger: '#ff3b30',
  success: '#34c759',
  warning: '#ff9500',
  starGold: '#ffb800',
  starBorder: '#e09e00',
  bg: '#f7f7f7',
  cardBg: '#ffffff',
  border: '#e5e5e5',
  textPrimary: '#000000',
  textSecondary: '#666666',
  textTertiary: '#888888',
  flame1: '#ffb800',
  flame2: '#ff9500',
  flame3: '#ff3b30',
};

export const darkColors: typeof lightColors = {
  primary: '#0a84ff',
  primaryDark: '#0066cc',
  danger: '#ff453a',
  success: '#30d158',
  warning: '#ff9f0a',
  starGold: '#ffb800',
  starBorder: '#e09e00',
  bg: '#000000',
  cardBg: '#1c1c1e',
  border: '#38383a',
  textPrimary: '#ffffff',
  textSecondary: '#aeaeb2',
  textTertiary: '#636366',
  flame1: '#ffb800',
  flame2: '#ff9500',
  flame3: '#ff453a',
};

export type Colors = typeof lightColors;
export const colors = lightColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};
