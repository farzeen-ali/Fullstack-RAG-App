import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutLeft, LinearTransition } from 'react-native-reanimated';

import { ProgressBar } from '@/components/ui/progress-bar';
import { useAppTheme } from '@/hooks/use-app-theme';
import { formatBytes, pluralize, timeAgo } from '@/lib/format';
import type { KnowledgeDocument } from '@/lib/types';

interface DocumentCardProps {
  document: KnowledgeDocument;
  selected: boolean;
  onToggle: () => void;
  onDelete: () => void;
}

export function DocumentCard({ document, selected, onToggle, onDelete }: DocumentCardProps) {
  const { palette } = useAppTheme();
  const isPdf = document.mimeType === 'application/pdf';
  const ready = document.status === 'ready';
  const progress = document.chunkCount > 0 ? document.indexedChunks / document.chunkCount : 0;

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(18)}
      exiting={FadeOutLeft.duration(200)}
      layout={LinearTransition.springify().damping(20)}>
      <Pressable
        onPress={ready ? onToggle : undefined}
        accessibilityRole={ready ? 'checkbox' : undefined}
        accessibilityState={ready ? { checked: selected } : undefined}
        accessibilityLabel={document.name}
        className={`rounded-2xl border bg-white p-4 dark:bg-ink-850 ${
          selected ? 'border-brand-500' : 'border-zinc-200 dark:border-ink-700'
        }`}>
        <View className="flex-row items-start gap-3">
          <View
            className={`h-11 w-11 items-center justify-center rounded-xl ${
              isPdf ? 'bg-rose-50 dark:bg-rose-400/10' : 'bg-sky-50 dark:bg-sky-400/10'
            }`}>
            <Ionicons
              name={isPdf ? 'document-text' : 'reader'}
              size={22}
              color={isPdf ? '#F43F5E' : '#0EA5E9'}
            />
          </View>

          <View className="flex-1">
            <Text numberOfLines={2} className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">
              {document.name}
            </Text>
            <Text className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {pluralize(document.pageCount, 'page')} · {pluralize(document.chunkCount, 'chunk')} ·{' '}
              {formatBytes(document.sizeBytes)} · {timeAgo(document.createdAt)}
            </Text>
          </View>

          {ready ? (
            <View
              className={`mt-0.5 h-6 w-6 items-center justify-center rounded-full border-2 ${
                selected ? 'border-brand-500 bg-brand-500' : 'border-zinc-300 dark:border-ink-600'
              }`}>
              {selected ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
            </View>
          ) : null}
        </View>

        <View className="mt-3 flex-row items-center gap-3">
          <View className="flex-1">
            {document.status === 'processing' ? (
              <View className="gap-1.5">
                <Text className="text-xs font-medium text-brand-600 dark:text-brand-300">
                  Indexing chunks… {document.indexedChunks}/{document.chunkCount}
                </Text>
                <ProgressBar progress={progress} />
              </View>
            ) : document.status === 'failed' ? (
              <View className="flex-row items-center gap-1.5">
                <Ionicons name="alert-circle" size={14} color={palette.danger} />
                <Text numberOfLines={2} className="flex-1 text-xs text-rose-600 dark:text-rose-300">
                  {document.errorMessage ?? 'Indexing failed.'}
                </Text>
              </View>
            ) : (
              <View className="flex-row items-center gap-1.5">
                <Ionicons name="checkmark-circle" size={14} color={palette.success} />
                <Text className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  Ready · searchable
                </Text>
              </View>
            )}
          </View>

          <Pressable
            onPress={onDelete}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${document.name}`}
            className="h-8 w-8 items-center justify-center rounded-full bg-zinc-100 dark:bg-ink-800">
            <Ionicons name="trash-outline" size={15} color={palette.muted} />
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );
}
