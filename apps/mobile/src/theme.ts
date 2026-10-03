/**
 * "Soft & romantic": warm cream canvas, rose accent, plum-brown ink.
 * All text/background pairs below meet WCAG AA (≥ 4.5:1).
 */
export const colors = {
  bg: '#FFF8F5',
  surface: '#FFFFFF',
  surfaceMuted: '#FBEDEA',
  hairline: 'rgba(46, 30, 36, 0.08)',
  ink: '#2E1E24',
  inkMuted: '#7A5F67',
  rose: '#C2385E',
  roseSoft: '#F7D6DE',
  roseTint: '#FDEEF1',
  onRose: '#FFFFFF',
  onRoseMuted: '#FFF0F3',
  gold: '#8A6238',
  goldTint: '#FFF3E6',
  danger: '#B3261E',
} as const;

export const fonts = {
  regular: 'Nunito_400Regular',
  medium: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  heavy: 'Nunito_800ExtraBold',
} as const;

export const radius = { sm: 12, md: 20, lg: 28, pill: 999 } as const;

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;

/** Very soft, diffused shadow — never a hard drop shadow. */
export const shadow = {
  shadowColor: '#7A2D45',
  shadowOpacity: 0.08,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: 8 },
  elevation: 3,
} as const;

/** Spring-like easing; no linear or default ease-in-out. */
export const motion = {
  spring: { damping: 18, stiffness: 220, mass: 0.9 },
  durationFast: 180,
  durationBase: 280,
} as const;
