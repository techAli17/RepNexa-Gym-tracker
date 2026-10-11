/** Design tokens. Components read these through useTheme(); never hard-code colors. */

export interface ColorTokens {
  bg: string;
  surface: string;
  surface2: string;
  raise: string;
  ink: string;
  ink2: string;
  ink3: string;
  line: string;
  accent: string;
  amber: string;
  onAmber: string;
  amberSoft: string;
  good: string;
  goodSoft: string;
  danger: string;
  dropSet: string;
  scrim: string;
}

export const lightColors: ColorTokens = {
  bg: '#EDF1F5',
  surface: '#FFFFFF',
  surface2: '#F2F5F9',
  raise: '#E2E8F0',
  ink: '#0F1A2B',
  ink2: '#4A5A71',
  ink3: '#66758C',
  line: '#D6DDE7',
  accent: '#9A5A00',
  amber: '#F2A93B',
  onAmber: '#241600',
  amberSoft: 'rgba(242,169,59,0.18)',
  good: '#0E7A51',
  goodSoft: 'rgba(14,122,81,0.11)',
  danger: '#B3261E',
  dropSet: '#3D63C9',
  scrim: 'rgba(10,18,32,0.45)',
};

export const darkColors: ColorTokens = {
  bg: '#0C1422',
  surface: '#14203A',
  surface2: '#18263F',
  raise: '#22324F',
  ink: '#EAF0F8',
  ink2: '#9DABC1',
  ink3: '#8392AB',
  line: '#26375A',
  accent: '#F5B04A',
  amber: '#F2A93B',
  onAmber: '#241600',
  amberSoft: 'rgba(242,169,59,0.14)',
  good: '#41D69D',
  goodSoft: 'rgba(65,214,157,0.13)',
  danger: '#FF7B6F',
  dropSet: '#8FA9F5',
  scrim: 'rgba(0,0,0,0.55)',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;
export const radii = { sm: 10, md: 14, lg: 18, xl: 22, pill: 999 } as const;

/** Minimum touch target. Set-entry controls go well above it for sweaty, hurried thumbs. */
export const HIT = 44;

export const type = {
  display: { fontSize: 30, fontWeight: '800' as const, letterSpacing: -0.3 },
  title: { fontSize: 22, fontWeight: '800' as const },
  heading: { fontSize: 18, fontWeight: '700' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  label: { fontSize: 14, fontWeight: '600' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
  number: { fontSize: 21, fontWeight: '800' as const, fontVariant: ['tabular-nums' as const] },
};

export interface Theme {
  dark: boolean;
  colors: ColorTokens;
  spacing: typeof spacing;
  radii: typeof radii;
  type: typeof type;
}

export const makeTheme = (dark: boolean): Theme => ({
  dark,
  colors: dark ? darkColors : lightColors,
  spacing,
  radii,
  type,
});
