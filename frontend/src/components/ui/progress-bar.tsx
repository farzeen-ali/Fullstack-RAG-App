import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

interface ProgressBarProps {
  /** 0..1 */
  progress: number;
  tone?: 'brand' | 'danger';
}

export function ProgressBar({ progress, tone = 'brand' }: ProgressBarProps) {
  const value = useSharedValue(0);

  useEffect(() => {
    value.set(
      withTiming(Math.min(1, Math.max(0.03, progress)), {
        duration: 450,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [progress, value]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${value.get() * 100}%` }));

  return (
    <View className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-ink-700">
      <Animated.View style={[fillStyle, { height: '100%', borderRadius: 999, overflow: 'hidden' }]}>
        <View className={`h-full w-full ${tone === 'danger' ? 'bg-rose-500' : 'bg-brand-500'}`} />
      </Animated.View>
    </View>
  );
}
