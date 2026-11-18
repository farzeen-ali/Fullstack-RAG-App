import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';

import { GlassSurface } from '@/components/ui/glass-surface';
import { useAppTheme } from '@/hooks/use-app-theme';

interface VectorEnginePillProps {
  readyCount: number;
  totalChunks: number;
  offline: boolean;
  indexing: boolean;
}

export function VectorEnginePill({
  readyCount,
  totalChunks,
  offline,
  indexing,
}: VectorEnginePillProps) {
  const { palette, isDark } = useAppTheme();
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (offline || (!indexing && readyCount === 0)) return;
    pulse.set(
      withRepeat(
        withSequence(
          withTiming(1.35, { duration: 900, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      ),
    );
    return () => {
      pulse.set(1);
    };
  }, [indexing, offline, readyCount, pulse]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.get() }],
    opacity: offline ? 0.5 : 1,
  }));

  const status = offline
    ? 'Offline'
    : indexing
      ? 'Indexing…'
      : readyCount > 0
        ? 'Active'
        : 'Standby';
  const dotColor = offline
    ? palette.danger
    : indexing
      ? '#FBBF24'
      : readyCount > 0
        ? palette.success
        : palette.subtle;

  return (
    <GlassSurface className="mt-2 self-start rounded-full px-3 py-1.5" intensity={40}>
      <View className="flex-row items-center gap-2">
        <Animated.View
          style={[
            dotStyle,
            { width: 8, height: 8, borderRadius: 4, backgroundColor: dotColor },
          ]}
        />
        <Ionicons name="server-outline" size={12} color={isDark ? palette.brand : palette.brand} />
        <Text className="text-[11px] font-semibold tracking-wide text-zinc-700 dark:text-zinc-200">
          Pinecone Vector DB
        </Text>
        <Text className="text-[11px] text-zinc-500 dark:text-zinc-400">·</Text>
        <Text className="text-[11px] font-medium text-brand-600 dark:text-brand-300">{status}</Text>
        {readyCount > 0 ? (
          <Text className="text-[11px] text-zinc-500 dark:text-zinc-400">
            · {readyCount} doc{readyCount === 1 ? '' : 's'}
            {totalChunks > 0 ? ` · ${totalChunks} chunks` : ''}
          </Text>
        ) : null}
      </View>
    </GlassSurface>
  );
}