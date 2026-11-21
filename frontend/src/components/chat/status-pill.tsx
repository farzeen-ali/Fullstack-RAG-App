import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useAppTheme } from '@/hooks/use-app-theme';
import type { MessagePhase } from '@/lib/types';

const LABELS: Partial<Record<MessagePhase, { text: string; icon: 'sparkles' | 'search' | 'create' }>> = {
  thinking: { text: 'Thinking…', icon: 'sparkles' },
  searching: { text: 'Querying ChromaDB…', icon: 'search' },
  generating: { text: 'Composing grounded answer…', icon: 'create' },
};

export function StatusPill({ phase }: { phase: MessagePhase }) {
  const { palette } = useAppTheme();
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.set(
      withRepeat(withTiming(1, { duration: 850, easing: Easing.inOut(Easing.quad) }), -1, true),
    );
    return () => cancelAnimation(pulse);
  }, [pulse]);

  const emerald = phase === 'searching';
  const pulseColor = emerald ? '#10B981' : palette.brand;

  const pillStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.get(), [0, 1], emerald ? [0.7, 1] : [0.65, 1]),
    transform: [{ scale: interpolate(pulse.get(), [0, 1], [0.98, 1.04]) }],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.get(), [0, 1], [0.65, 0]),
    transform: [{ scale: interpolate(pulse.get(), [0, 1], [1, 2.6]) }],
  }));

  const label = LABELS[phase];
  if (!label) return null;

  return (
    <Animated.View entering={FadeIn.duration(200)} style={[pillStyle, { alignSelf: 'flex-start' }]}>
      <View
        className={`flex-row items-center gap-2 rounded-full border px-3 py-1.5 ${
          emerald
            ? 'border-emerald-200/80 bg-emerald-50 dark:border-emerald-500/35 dark:bg-emerald-500/10'
            : 'border-brand-200 bg-brand-50 dark:border-brand-500/30 dark:bg-brand-500/10'
        }`}>
        <View className="h-2.5 w-2.5 items-center justify-center">
          <Animated.View
            style={[
              haloStyle,
              { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: pulseColor },
            ]}
          />
          <View
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: pulseColor }}
          />
        </View>
        <Ionicons name={label.icon} size={13} color={pulseColor} />
        <Text
          className={`text-[13px] font-medium ${
            emerald ? 'text-emerald-800 dark:text-emerald-200' : 'text-brand-700 dark:text-brand-200'
          }`}>
          {label.text}
        </Text>
      </View>
    </Animated.View>
  );
}
