const fonts = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
};

export const theme = {
  fonts,
  colors: {
    // Core palette — Qarmo Design Philosophy
    primary: '#E8A400', // Deep Amber
    primaryPressed: '#C78D00', // Burnt Amber
    ink: '#1A1A1A', // Rickshaw Black
    success: '#1B7A3D', // Kerala Green
    danger: '#C62828', // Brick Red
    info: '#1565C0', // Sky Blue
    background: '#FFFFFF', // White
    surface: '#F4F5F7', // Mist
    border: '#D9DCE1', // Line Grey
    mutedText: '#5F6570', // Grey
    hint: '#9AA0AB', // Light Grey — softer than mutedText, for hint/placeholder text
    textOnColored: '#FFFFFF', // White text for use on amber/dark backgrounds
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  radius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    full: 9999,
  },
  typography: {
    heroNumber: {
      fontFamily: fonts.medium,
      fontSize: 40,
      fontWeight: '500' as const,
      lineHeight: 48,
    },
    title: {
      fontFamily: fonts.medium,
      fontSize: 24,
      fontWeight: '500' as const,
      lineHeight: 30,
    },
    button: {
      fontFamily: fonts.medium,
      fontSize: 18,
      fontWeight: '500' as const,
      lineHeight: 24,
    },
    body: {
      fontFamily: fonts.regular,
      fontSize: 18,
      fontWeight: '400' as const,
      lineHeight: 26,
    },
    caption: {
      fontFamily: fonts.regular,
      fontSize: 14,
      fontWeight: '400' as const,
      lineHeight: 18,
    },
  },
  // Flat design — no drop shadows on boxes. Kept as a no-op map (rather than deleting
  // the shadow prop/API) so existing `shadow="md"` call sites don't need to be touched.
  shadows: {
    sm: {},
    md: {},
    lg: {},
  },
};

export type Theme = typeof theme;
