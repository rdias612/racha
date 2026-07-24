/**
 * lib/theme.ts
 * Task: T1.5 - Mirror TS dos design tokens (tailwind.config.js).
 *
 * Por que existir (YAGNI-aware):
 *   - NativeWind cobre 95% dos casos via classes.
 *   - Porem, algumas APIs do RN (StatusBar, estilo dinamico runtime,
 *     gradientes) precisam de valores literais.
 *   - Manter este espelho evita magic numbers e garante source-of-truth
 *     unica para cores usadas fora do className.
 *
 * Mantenha sincronizado com tailwind.config.js > theme.extend.
 * Qualquer token novo aqui = token novo la.
 */

export const colors = {
  field: {
    DEFAULT: '#16a34a',
    dark: '#15803d',
    light: '#86efac',
  },
  pitch: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },
  goalkeeper: {
    DEFAULT: '#ea580c',
  },
  warning: {
    DEFAULT: '#eab308',
  },
  success: {
    DEFAULT: '#22c55e',
  },
  danger: {
    DEFAULT: '#dc2626',
  },
} as const;

/**
 * Tipografia PT-BR friendly.
 * Font family fallback (sem webfonts no MVP - YAGNI).
 */
export const typography = {
  fontFamily: {
    sans: 'System',
  },
  sizes: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
  },
  weights: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

/**
 * Espacamentos base (escala default Tailwind em px).
 * Uso tipico: StyleSheet inline quando NativeWind nao cobrir.
 */
export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
} as const;

/**
 * Radii (arredondamento de cantos).
 */
export const radii = {
  md: 6,
  lg: 8,
  xl: 12,
  '2xl': 16,
  full: 9999,
} as const;

/**
 * Shadows (elevation RN).
 * RN nao suporta box-shadow CSS; usar a prop `style={{ elevation }}`.
 */
export const shadows = {
  card: { elevation: 2 },
  floating: { elevation: 4 },
} as const;

export type AppColor = (typeof colors)[keyof typeof colors];
export type ThemeColor = typeof colors;
