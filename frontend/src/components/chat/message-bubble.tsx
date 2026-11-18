import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInLeft, FadeInRight } from 'react-native-reanimated';

import { GlassSurface } from '@/components/ui/glass-surface';
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
  const { palette } = useAppTheme();
  // Only animate freshly created messages, not cells re-mounted by list virtualization.
  const [isNew] = useState(() => Date.now() - message.createdAt < ENTER_WINDOW_MS);

  if (message.role === 'user') {
    return (
      <Animated.View
        entering={isNew ? FadeInRight.springify().damping(18).mass(0.8) : undefined}
        style={{ alignSelf: 'flex-end', maxWidth: '86%' }}>
        <LinearGradient
          colors={[palette.gradientStart, palette.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 22, borderBottomRightRadius: 6, paddingHorizontal: 16, paddingVertical: 10 }}>
          <Text selectable className="text-[15px] leading-6 text-white">
            {message.text}
          </Text>
        </LinearGradient>
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
      <LinearGradient
        colors={[palette.gradientStart, palette.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ marginTop: 2, width: 32, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="sparkles" size={16} color="#FFFFFF" />
      </LinearGradient>

      <View className="flex-1 gap-2.5">
        {pending && message.text.length === 0 ? <StatusPill phase={phase} /> : null}

        {message.text.length > 0 ? (
          <GlassSurface
            intensity={footer?.mode === 'blocked' ? 20 : 45}
            className={`rounded-3xl rounded-tl-md px-4 py-3 ${
              footer?.mode === 'blocked'
                ? 'border-rose-300/60 dark:border-rose-400/25'
                : 'border-zinc-200/80 dark:border-white/10'
            }`}>
            <AnswerText
              text={message.text}
              streaming={streaming}
              sources={footer?.sources}
              onCitationPress={onSourcePress}
            />
          </GlassSurface>
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
