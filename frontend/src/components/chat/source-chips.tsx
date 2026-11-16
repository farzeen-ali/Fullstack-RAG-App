import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  FadeInDown,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { PressableScale } from '@/components/ui/pressable-scale';
import { useAppTheme } from '@/hooks/use-app-theme';
import { selectionHaptic } from '@/lib/haptics';
import type { SourceCitation } from '@/lib/types';

interface SourceChipsProps {
  sources: SourceCitation[];
  onSelect: (source: SourceCitation) => void;
}

export function SourceChips({ sources, onSelect }: SourceChipsProps) {
  const { palette } = useAppTheme();
  const [expanded, setExpanded] = useState(true);
  const rotation = useSharedValue(180);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.get()}deg` }],
  }));

  if (sources.length === 0) return null;

  return (
    <Animated.View layout={LinearTransition.springify().damping(20)}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Hide sources' : 'Show sources'}
        onPress={() => {
          selectionHaptic();
          rotation.set(withSpring(expanded ? 0 : 180, { damping: 16 }));
          setExpanded(!expanded);
        }}
        hitSlop={8}
        className="flex-row items-center gap-1.5 self-start py-1">
        <Ionicons name="documents-outline" size={14} color={palette.muted} />
        <Text className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {sources.length} {sources.length === 1 ? 'Source' : 'Sources'}
        </Text>
        <Animated.View style={chevronStyle}>
          <Ionicons name="chevron-down" size={14} color={palette.muted} />
        </Animated.View>
      </Pressable>

      {expanded ? (
        <Animated.View exiting={FadeOut.duration(120)}>
          <View className="mt-1.5 flex-row flex-wrap gap-2">
            {sources.map((source, i) => (
              <Animated.View key={`${source.documentId}-${source.chunkIndex}`} entering={FadeInDown.delay(i * 60).springify().damping(18)}>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={`Source ${source.index}: ${source.documentName}, page ${source.pageNumber}`}
                  onPress={() => {
                    selectionHaptic();
                    onSelect(source);
                  }}
                  className="max-w-[260px] flex-row items-center gap-2 rounded-full border border-zinc-200 bg-white py-1.5 pl-1.5 pr-3 dark:border-ink-700 dark:bg-ink-800">
                  <View className="h-5 w-5 items-center justify-center rounded-full bg-brand-500">
                    <Text className="text-[10px] font-bold text-white">{source.index}</Text>
                  </View>
                  <Text numberOfLines={1} className="shrink text-xs font-medium text-zinc-800 dark:text-zinc-100">
                    {source.documentName}
                  </Text>
                  <Text className="text-[11px] text-zinc-500 dark:text-zinc-400">p.{source.pageNumber}</Text>
                </PressableScale>
              </Animated.View>
            ))}
          </View>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}
