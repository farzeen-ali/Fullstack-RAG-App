import { useColorScheme } from 'nativewind';

const palettes = {
  light: {
    background: '#F7F8FA',
    surface: '#FFFFFF',
    border: '#E4E7EE',
    text: '#0F1222',
    muted: '#5B6475',
    subtle: '#8A93A6',
    brand: '#5148E5',
    onBrand: '#FFFFFF',
    danger: '#E11D48',
    success: '#059669',
  },
  dark: {
    background: '#0C0E14',
    surface: '#11141C',
    border: '#232837',
    text: '#F4F5F8',
    muted: '#9AA3B5',
    subtle: '#6B7385',
    brand: '#9DA6FF',
    onBrand: '#FFFFFF',
    danger: '#FB7185',
    success: '#34D399',
  },
} as const;

export type Palette = (typeof palettes)[keyof typeof palettes];

/** Hex colors for places className can't reach (icons, placeholders, navigation theme). */
export function useAppTheme() {
  const { colorScheme, setColorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return {
    isDark,
    palette: isDark ? palettes.dark : palettes.light,
    toggleTheme: () => setColorScheme(isDark ? 'light' : 'dark'),
  };
}
