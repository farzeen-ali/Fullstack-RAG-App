import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { Platform, View, type ViewProps } from 'react-native';

import { useAppTheme } from '@/hooks/use-app-theme';

interface GlassSurfaceProps extends ViewProps {
  children: ReactNode;
  className?: string;
  intensity?: number;
}

/** Frosted panel: real blur on iOS, translucent surface elsewhere. */
export function GlassSurface({
  children,
  className = '',
  intensity = 55,
  style,
  ...rest
}: GlassSurfaceProps) {
  const { isDark } = useAppTheme();

  if (Platform.OS === 'ios') {
    return (
      <BlurView
        intensity={intensity}
        tint={isDark ? 'dark' : 'light'}
        className={`overflow-hidden border border-white/10 ${className}`}
        style={style}
        {...rest}>
        {children}
      </BlurView>
    );
  }

  return (
    <View
      className={`border border-zinc-200/70 bg-white/85 dark:border-white/10 dark:bg-ink-850/90 ${className}`}
      style={style}
      {...rest}>
      {children}
    </View>
  );
}