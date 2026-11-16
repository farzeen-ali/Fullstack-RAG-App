import Ionicons from '@expo/vector-icons/Ionicons';
import { memo, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInLeft, FadeInRight } from 'react-native-reanimated';

import { useAppTheme } from '@/hooks/use-app-theme';
import type { ChatMessage, SourceCitation } from '@/lib/types';

import { AnswerText } from './answer-text';
import { ModeBadge } from './mode-badge';
import { SourceChips } from './source-chips';
import { StatusPill } from './status-pill';

const ENTER_WINDOW_MS = 1500;

interface MessageBubbleProps {
  message: ChatMessage;
  onSourcePress: (source: SourceCitation) => void;
}

/**
 * Horizontal slide-ins are used deliberately: the chat list is inverted
 * (scaleY: -1), which would flip any vertical entering animation.
 */
function MessageBubbleImpl({ message, onSourcePress }: MessageBubbleProps) {
  // Only animate freshly created messages, not cells re-mounted by list virtualization.
  const [isNew] = useState(() => Date.now() - message.createdAt < ENTER_WINDOW_MS);

  if (message.role === 'user') {
    return (
      <Animated.View
        entering={isNew ? FadeInRight.springify().damping(18).mass(0.8) : undefined}
        style={{ alignSelf: 'flex-end', maxWidth: '86%' }}>
        <View className="rounded-3xl rounded-br-md bg-brand-500 px-4 py-2.5">
          <Text selectable className="text-[15px] leading-6 text-white">
            {message.text}
          </Text>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={isNew ? FadeInLeft.springify().damping(18).mass(0.8) : undefined}
      style={{ alignSelf: 'stretch' }}>
      <AssistantBody message={message} onSourcePress={onSourcePress} />
    </Animated.View>
  );
}

function AssistantBody({ message, onSourcePress }: MessageBubbleProps) {
  const { palette } = useAppTheme();
  const { phase, footer } = message;
  const pending = phase === 'thinking' || phase === 'searching' || phase === 'generating';
  const streaming = phase === 'streaming' || (pending && message.text.length > 0);

  return (
    <View className="flex-row gap-3">
      <View className="mt-0.5 h-8 w-8 items-center justify-center rounded-xl bg-brand-500">
        <Ionicons name="sparkles" size={16} color="#FFFFFF" />
      </View>

      <View className="flex-1 gap-2.5">
        {pending && message.text.length === 0 ? <StatusPill phase={phase} /> : null}

        {message.text.length > 0 ? (
          <View
            className={`rounded-3xl rounded-tl-md border px-4 py-3 ${
              footer?.mode === 'blocked'
                ? 'border-rose-200 bg-rose-50 dark:border-rose-400/25 dark:bg-rose-400/10'
                : 'border-zinc-200 bg-white dark:border-ink-700 dark:bg-ink-850'
            }`}>
            <AnswerText
              text={message.text}
              streaming={streaming}
              sources={footer?.sources}
              onCitationPress={onSourcePress}
            />
          </View>
        ) : null}

        {phase === 'error' ? (
          <View className="flex-row items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 dark:border-rose-400/25 dark:bg-rose-400/10">
            <Ionicons name="alert-circle" size={16} color={palette.danger} />
            <Text className="flex-1 text-[13px] leading-5 text-rose-700 dark:text-rose-200">
              {message.error ?? 'Something went wrong.'}
            </Text>
          </View>
        ) : null}

        {phase === 'stopped' ? (
          <Text className="text-xs italic text-zinc-500 dark:text-zinc-400">Generation stopped.</Text>
        ) : null}

        {footer ? (
          <>
            <SourceChips sources={footer.sources} onSelect={onSourcePress} />
            <ModeBadge footer={footer} />
          </>
        ) : null}
      </View>
    </View>
  );
}

export const MessageBubble = memo(MessageBubbleImpl);
