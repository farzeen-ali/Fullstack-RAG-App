import { useColorScheme } from 'nativewind';

const palettes = {
  light: {
    background: '#F3F5FA',
    surface: '#FFFFFF',
    surfaceGlass: 'rgba(255,255,255,0.82)',
    border: '#E4E8F2',
    text: '#0B1020',
    muted: '#5A6378',
    subtle: '#8B94A8',
    brand: '#5B4FF5',
    brandMuted: '#7C83FD',
    onBrand: '#FFFFFF',
    danger: '#E11D48',
    success: '#0D9488',
    gradientStart: '#6366F1',
    gradientEnd: '#A78BFA',
  },
  dark: {
    background: '#07090F',
    surface: '#11141D',
    surfaceGlass: 'rgba(17,20,29,0.86)',
    border: '#242A38',
    text: '#F3F5FA',
    muted: '#9CA6BB',
    subtle: '#6E7890',
    brand: '#A5B4FF',
    brandMuted: '#C4CAFF',
    onBrand: '#0B1020',
    danger: '#FB7185',
    success: '#2DD4BF',
    gradientStart: '#6366F1',
    gradientEnd: '#818CF8',
  },
} as const;

export type Palette = (typeof palettes)[keyof typeof palettes];

export function useAppTheme() {
  const { colorScheme, setColorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return {
    isDark,
    palette: isDark ? palettes.dark : palettes.light,
    toggleTheme: () => setColorScheme(isDark ? 'light' : 'dark'),
  };
}