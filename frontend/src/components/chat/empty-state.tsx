import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { PressableScale } from '@/components/ui/pressable-scale';
import { useAppTheme } from '@/hooks/use-app-theme';

const SUGGESTIONS: { label: string; prompt: string; hint: string }[] = [
  { label: 'Summarize my documents', prompt: 'Summarize the key points of my documents.', hint: 'RAG' },
  { label: 'What are the main policies?', prompt: 'What are the main rules or policies described?', hint: 'RAG' },
  { label: 'Say hello 👋', prompt: 'Hello!', hint: '0 tokens' },
];

interface EmptyStateProps {
  hasDocuments: boolean;
  onSuggestion: (prompt: string) => void;
  onUpload: () => void;
}

export function EmptyState({ hasDocuments, onSuggestion, onUpload }: EmptyStateProps) {
  const { palette } = useAppTheme();

  return (
    <View className="flex-1 items-center justify-center px-6 py-10">
      <Animated.View entering={FadeInDown.springify().damping(16)} style={{ alignItems: 'center' }}>
        <View className="mb-5 h-16 w-16 items-center justify-center rounded-3xl bg-brand-500">
          <Ionicons name="sparkles" size={30} color="#FFFFFF" />
        </View>
        <Text className="text-center text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Ask your documents anything
        </Text>
        <Text className="mt-2 max-w-[320px] text-center text-[15px] leading-6 text-zinc-500 dark:text-zinc-400">
          Answers are grounded in your uploaded PDFs and notes, with exact page citations for every claim.
        </Text>
      </Animated.View>

      {hasDocuments ? (
        <View className="mt-8 w-full max-w-[420px] gap-2.5">
          {SUGGESTIONS.map((suggestion, i) => (
            <Animated.View key={suggestion.label} entering={FadeInDown.delay(120 + i * 70).springify().damping(18)}>
              <PressableScale
                scaleTo={0.97}
                onPress={() => onSuggestion(suggestion.prompt)}
                className="flex-row items-center justify-between rounded-2xl border border-zinc-200 bg-white px-4 py-3.5 dark:border-ink-700 dark:bg-ink-850">
                <Text className="text-[15px] font-medium text-zinc-800 dark:text-zinc-100">{suggestion.label}</Text>
                <View className="flex-row items-center gap-2">
                  <Text className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500">{suggestion.hint}</Text>
                  <Ionicons name="arrow-forward" size={16} color={palette.subtle} />
                </View>
              </PressableScale>
            </Animated.View>
          ))}
        </View>
      ) : (
        <Animated.View entering={FadeInDown.delay(150).springify().damping(18)} style={{ marginTop: 32 }}>
          <PressableScale
            onPress={onUpload}
            className="flex-row items-center gap-2 rounded-full bg-brand-500 px-5 py-3.5">
            <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />
            <Text className="text-[15px] font-semibold text-white">Upload your first document</Text>
          </PressableScale>
        </Animated.View>
      )}
    </View>
  );
}
