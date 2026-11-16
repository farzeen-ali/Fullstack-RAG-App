import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui/icon-button';
import { ProgressBar } from '@/components/ui/progress-bar';
import { useAppTheme } from '@/hooks/use-app-theme';
import type { SourceCitation } from '@/lib/types';

const CLOSE_DURATION_MS = 220;

interface SourceSheetProps {
  source: SourceCitation | null;
  onClose: () => void;
}

/** Bottom sheet that shows the exact chunk text a citation came from. */
export function SourceSheet({ source, onClose }: SourceSheetProps) {
  const { palette } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [closing, setClosing] = useState(false);
  const translateY = useSharedValue(height);
  const backdrop = useSharedValue(0);
  const visible = source;

  useEffect(() => {
    if (!source) return;
    translateY.set(height);
    translateY.set(withSpring(0, { damping: 22, stiffness: 220, mass: 0.9 }));
    backdrop.set(withTiming(1, { duration: 220 }));
  }, [source, height, translateY, backdrop]);

  const close = () => {
    if (closing) return;
    setClosing(true);
    translateY.set(withTiming(height, { duration: CLOSE_DURATION_MS, easing: Easing.in(Easing.cubic) }));
    backdrop.set(withTiming(0, { duration: CLOSE_DURATION_MS }));
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, CLOSE_DURATION_MS);
  };

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.get() }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.get() }));

  return (
    <Modal
      visible={visible !== null}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={close}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
        <Pressable accessibilityLabel="Close source" style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>

      {visible ? (
        <Animated.View style={[styles.sheet, { maxHeight: height * 0.8 }, sheetStyle]}>
          <View
            className="rounded-t-[28px] border border-b-0 border-zinc-200 bg-white px-5 pt-3 dark:border-ink-700 dark:bg-ink-850"
            style={{ paddingBottom: insets.bottom + 20 }}>
            <View className="mb-4 h-1.5 w-10 self-center rounded-full bg-zinc-300 dark:bg-ink-600" />

            <View className="flex-row items-start gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-2xl bg-brand-500">
                <Text className="text-base font-bold text-white">{visible.index}</Text>
              </View>
              <View className="flex-1">
                <Text numberOfLines={2} className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                  {visible.documentName}
                </Text>
                <Text className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  Page {visible.pageNumber} · Chunk #{visible.chunkIndex + 1}
                </Text>
              </View>
              <IconButton icon="close" label="Close" onPress={close} />
            </View>

            <View className="mt-4 gap-1.5">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Semantic similarity</Text>
                <Text className="text-xs font-semibold text-brand-600 dark:text-brand-300">
                  {Math.round(visible.similarityScore * 100)}%
                </Text>
              </View>
              <ProgressBar progress={visible.similarityScore} />
            </View>

            <View className="mt-4 flex-row items-center gap-1.5">
              <Ionicons name="document-text-outline" size={14} color={palette.muted} />
              <Text className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Matched excerpt
              </Text>
            </View>
            <ScrollView className="mt-2" style={{ maxHeight: height * 0.42 }} showsVerticalScrollIndicator>
              <View className="rounded-2xl border-l-4 border-brand-500 bg-zinc-50 p-4 dark:bg-ink-800">
                <Text selectable className="text-[15px] leading-6 text-zinc-800 dark:text-zinc-100">
                  {visible.snippet}
                </Text>
              </View>
            </ScrollView>
          </View>
        </Animated.View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(5, 6, 10, 0.55)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
