import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import type { IconName } from '@/components/ui/icon-button';
import { useAppTheme } from '@/hooks/use-app-theme';
import { formatLatency } from '@/lib/format';
import type { ChatFooter } from '@/lib/types';

const MODE_META: Record<
  ChatFooter['mode'],
  { label: string; icon: IconName; container: string; text: string; light: string; dark: string }
> = {
  'zero-token': {
    label: 'Instant · Zero-Token Mode',
    icon: 'flash',
    container: 'border-amber-300 bg-amber-50 dark:border-amber-400/30 dark:bg-amber-400/10',
    text: 'text-amber-800 dark:text-amber-200',
    light: '#B45309',
    dark: '#FCD34D',
  },
  cache: {
    label: 'Cached · Zero-Token',
    icon: 'albums',
    container: 'border-emerald-300 bg-emerald-50 dark:border-emerald-400/30 dark:bg-emerald-400/10',
    text: 'text-emerald-800 dark:text-emerald-200',
    light: '#047857',
    dark: '#6EE7B7',
  },
  rag: {
    label: 'RAG Knowledge Retrieval',
    icon: 'library',
    container: 'border-brand-200 bg-brand-50 dark:border-brand-400/30 dark:bg-brand-500/10',
    text: 'text-brand-700 dark:text-brand-200',
    light: '#4338CA',
    dark: '#C2C9FF',
  },
  'no-context': {
    label: 'No matching sources',
    icon: 'search',
    container: 'border-zinc-300 bg-zinc-100 dark:border-ink-600 dark:bg-ink-800',
    text: 'text-zinc-700 dark:text-zinc-300',
    light: '#52525B',
    dark: '#D4D4D8',
  },
  blocked: {
    label: 'Blocked by Guardrail',
    icon: 'shield-checkmark',
    container: 'border-rose-300 bg-rose-50 dark:border-rose-400/30 dark:bg-rose-400/10',
    text: 'text-rose-700 dark:text-rose-200',
    light: '#BE123C',
    dark: '#FDA4AF',
  },
};

export function ModeBadge({ footer }: { footer: ChatFooter }) {
  const { isDark } = useAppTheme();
  const meta = MODE_META[footer.mode];
  const { usage } = footer;
  const tokens = usage.embeddingTokens + usage.promptTokens + usage.completionTokens;

  return (
    <Animated.View entering={FadeIn.duration(260)}>
      <View className="flex-row flex-wrap items-center gap-2">
        <View className={`flex-row items-center gap-1.5 rounded-full border px-2.5 py-1 ${meta.container}`}>
          <Ionicons name={meta.icon} size={12} color={isDark ? meta.dark : meta.light} />
          <Text className={`text-[11px] font-semibold ${meta.text}`}>{meta.label}</Text>
        </View>
        <Text className="text-[11px] text-zinc-500 dark:text-zinc-400">
          {tokens === 0 ? '0 tokens' : `${tokens.toLocaleString()} tokens`} · {formatLatency(footer.latencyMs)}
        </Text>
      </View>
    </Animated.View>
  );
}
