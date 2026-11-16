import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import Animated, { ZoomIn, ZoomOut } from 'react-native-reanimated';

import { PressableScale } from '@/components/ui/pressable-scale';
import { useAppTheme } from '@/hooks/use-app-theme';
import { MAX_QUESTION_LENGTH } from '@/lib/config';
import { tapHaptic } from '@/lib/haptics';

const COUNTER_THRESHOLD = 800;

interface ComposerProps {
  busy: boolean;
  /** Space between the composer and the keyboard top when the keyboard is open. */
  openedOffset: number;
  bottomPadding: number;
  scopeLabel: string;
  onScopePress: () => void;
  onSend: (text: string) => void;
  onStop: () => void;
}

/**
 * Rides on top of the keyboard via KeyboardStickyView. The chat list uses the
 * same `openedOffset`, so messages shift by exactly the distance the composer
 * moves and are never covered.
 */
export function Composer({
  busy,
  openedOffset,
  bottomPadding,
  scopeLabel,
  onScopePress,
  onSend,
  onStop,
}: ComposerProps) {
  const { palette } = useAppTheme();
  const [text, setText] = useState('');
  const canSend = text.trim().length > 0 && !busy;

  const submit = () => {
    if (!canSend) return;
    tapHaptic();
    onSend(text);
    setText('');
  };

  return (
    <KeyboardStickyView offset={{ closed: 0, opened: openedOffset }}>
      <View
        className="border-t border-zinc-200/80 bg-zinc-50 px-3 pt-2 dark:border-ink-800 dark:bg-ink-900"
        style={{ paddingBottom: bottomPadding }}>
        <Pressable
          onPress={onScopePress}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Search scope: ${scopeLabel}. Open knowledge base`}
          className="mb-2 ml-1 flex-row items-center gap-1.5 self-start">
          <Ionicons name="funnel-outline" size={12} color={palette.subtle} />
          <Text className="text-xs text-zinc-500 dark:text-zinc-400">{scopeLabel}</Text>
          <Ionicons name="chevron-forward" size={12} color={palette.subtle} />
        </Pressable>

        <View className="flex-row items-end rounded-[26px] border border-zinc-200 bg-white py-1.5 pl-4 pr-1.5 dark:border-ink-700 dark:bg-ink-800">
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Ask about your documents…"
            placeholderTextColor={palette.subtle}
            multiline
            maxLength={MAX_QUESTION_LENGTH}
            accessibilityLabel="Message"
            className="max-h-32 flex-1 py-2 text-[15px] leading-5 text-zinc-900 dark:text-zinc-50"
            style={{ textAlignVertical: 'center' }}
          />

          {busy ? (
            <Animated.View key="stop" entering={ZoomIn.springify().damping(16)} exiting={ZoomOut.duration(120)}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Stop generating"
                onPress={() => {
                  tapHaptic();
                  onStop();
                }}
                className="h-10 w-10 items-center justify-center rounded-full bg-zinc-900 dark:bg-zinc-100">
                <View className="h-3.5 w-3.5 rounded-[3px] bg-white dark:bg-ink-900" />
              </PressableScale>
            </Animated.View>
          ) : (
            <Animated.View key="send" entering={ZoomIn.springify().damping(16)} exiting={ZoomOut.duration(120)}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Send message"
                disabled={!canSend}
                onPress={submit}
                className={`h-10 w-10 items-center justify-center rounded-full ${
                  canSend ? 'bg-brand-500' : 'bg-zinc-200 dark:bg-ink-700'
                }`}>
                <Ionicons name="arrow-up" size={20} color={canSend ? '#FFFFFF' : palette.subtle} />
              </PressableScale>
            </Animated.View>
          )}
        </View>

        {text.length >= COUNTER_THRESHOLD ? (
          <Text className="mr-3 mt-1 self-end text-[11px] text-zinc-500 dark:text-zinc-400">
            {text.length}/{MAX_QUESTION_LENGTH}
          </Text>
        ) : null}
      </View>
    </KeyboardStickyView>
  );
}
