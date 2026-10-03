/**
 * "Soft & romantic": warm cream canvas, rose accent, plum-brown ink.
 * All text/background pairs below meet WCAG AA (≥ 4.5:1).
 */
export type Scheme = 'light' | 'dark';

const light = {
  bg: '#FFF8F5',
  surface: '#FFFFFF',
  surfaceMuted: '#FBEDEA',
  hairline: 'rgba(46, 30, 36, 0.08)',
  ink: '#2E1E24',
  inkMuted: '#7A5F67',
  /** Accent for text and icons. */
  rose: '#C2385E',
  /** Accent for filled surfaces (buttons, my bubbles) that carry `onRose` text. */
  roseFill: '#C2385E',
  roseSoft: '#F7D6DE',
  roseTint: '#FDEEF1',
  onRose: '#FFFFFF',
  onRoseMuted: '#FFF0F3',
  gold: '#8A6238',
  goldTint: '#FFF3E6',
  danger: '#B3261E',
  scrim: 'rgba(46,30,36,0.3)',
};

/** Deep plum night palette. Every text/background pair is AA in this mode too. */
const dark: typeof light = {
  bg: '#151016',
  surface: '#211A23',
  surfaceMuted: '#2B232E',
  hairline: 'rgba(255, 255, 255, 0.08)',
  ink: '#F6EDF1',
  inkMuted: '#BBA9B1',
  rose: '#FF8FB0',
  roseFill: '#B8325A',
  roseSoft: '#5A2A3A',
  roseTint: '#3A2230',
  onRose: '#FFFFFF',
  onRoseMuted: '#FFE6EE',
  gold: '#E8BC85',
  goldTint: '#2F2519',
  danger: '#FF8A80',
  scrim: 'rgba(0,0,0,0.55)',
};

let current: Scheme = 'light';

/** Set before rendering; the root remounts the tree when it changes. */
export function setScheme(scheme: Scheme) {
  current = scheme;
}

export function currentScheme(): Scheme {
  return current;
}

/** Always reads the active palette, so `colors.ink` is right in both modes. */
export const colors: typeof light = new Proxy({} as typeof light, {
  get: (_, key: string) => (current === 'dark' ? dark : light)[key as keyof typeof light],
});

/**
 * Wrap a StyleSheet so it is built once per scheme and always read for the
 * active one: `const styles = themed(() => StyleSheet.create({ ... }))`.
 */
export function themed<T extends object>(make: () => T): T {
  const cache: Partial<Record<Scheme, T>> = {};
  return new Proxy({} as T, {
    get: (_, key) => {
      const sheet = (cache[current] ??= make());
      return sheet[key as keyof T];
    },
  });
}

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

/** Spread into TextInput styles: hides the browser focus ring in the web preview. */
export const noWebOutline = { outlineStyle: 'none' } as object;
