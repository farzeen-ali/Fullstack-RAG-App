import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

interface ProgressBarProps {
  /** 0..1 */
  progress: number;
  tone?: 'brand' | 'danger';
  /** Pulses when true (e.g. RN upload with no byte progress). */
  indeterminate?: boolean;
}

export function ProgressBar({ progress, tone = 'brand', indeterminate = false }: ProgressBarProps) {
  const value = useSharedValue(0);
  const pulse = useSharedValue(0.25);

  useEffect(() => {
    if (indeterminate) {
      pulse.set(withRepeat(withTiming(0.75, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true));
      return;
    }
    value.set(
      withTiming(Math.min(1, Math.max(0.03, progress)), {
        duration: 450,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [progress, value, indeterminate, pulse]);

  const fillStyle = useAnimatedStyle(() => ({
    width: indeterminate ? `${25 + pulse.get() * 50}%` : `${value.get() * 100}%`,
  }));

  return (
    <View className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-ink-700">
      <Animated.View style={[fillStyle, { height: '100%', borderRadius: 999, overflow: 'hidden' }]}>
        <View className={`h-full w-full ${tone === 'danger' ? 'bg-rose-500' : 'bg-brand-500'}`} />
      </Animated.View>
    </View>
  );
}
