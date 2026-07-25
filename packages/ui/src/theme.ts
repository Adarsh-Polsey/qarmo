export const theme = {
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
      fontSize: 40,
      fontWeight: '700' as const,
      lineHeight: 48,
    },
    title: {
      fontSize: 24,
      fontWeight: '700' as const,
      lineHeight: 30,
    },
    button: {
      fontSize: 18,
      fontWeight: '600' as const,
      lineHeight: 24,
    },
    body: {
      fontSize: 18,
      fontWeight: '400' as const,
      lineHeight: 26,
    },
    caption: {
      fontSize: 14,
      fontWeight: '400' as const,
      lineHeight: 18,
    },
  },
  shadows: {
    sm: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    md: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 8,
    },
  },
};

export type Theme = typeof theme;
