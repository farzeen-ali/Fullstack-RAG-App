import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { PressableScale } from '@/components/ui/pressable-scale';
import { GlassSurface } from '@/components/ui/glass-surface';
import { useAppTheme } from '@/hooks/use-app-theme';
import { buildSuggestedPrompts } from '@/lib/suggested-prompts';
import type { KnowledgeDocument } from '@/lib/types';

interface EmptyStateProps {
  documents: KnowledgeDocument[];
  hasDocuments: boolean;
  onSuggestion: (prompt: string) => void;
  onUpload: () => void;
}

export function EmptyState({ documents, hasDocuments, onSuggestion, onUpload }: EmptyStateProps) {
  const { palette, isDark } = useAppTheme();
  const suggestions = buildSuggestedPrompts(documents);

  return (
    <View className="flex-1 items-center justify-center px-6 py-10">
      <Animated.View entering={FadeInDown.springify().damping(16)} style={{ alignItems: 'center' }}>
        <LinearGradient
          colors={[palette.gradientStart, palette.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 24, marginBottom: 20 }}>
          <View className="h-16 w-16 items-center justify-center rounded-3xl">
            <Ionicons name="sparkles" size={30} color="#FFFFFF" />
          </View>
        </LinearGradient>
        <Text className="text-center text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Ask your documents anything
        </Text>
        <Text className="mt-2 max-w-[320px] text-center text-[15px] leading-6 text-zinc-500 dark:text-zinc-400">
          Local ChromaDB semantic search, streamed answers with page citations and match scores.
        </Text>
      </Animated.View>

      {hasDocuments ? (
        <View className="mt-8 w-full max-w-[420px] gap-2.5">
          {suggestions.map((suggestion, i) => (
            <Animated.View
              key={`${suggestion.label}-${i}`}
              entering={FadeInDown.delay(120 + i * 70).springify().damping(18)}>
              <PressableScale
                scaleTo={0.97}
                onPress={() => onSuggestion(suggestion.prompt)}
                className="overflow-hidden rounded-2xl">
                <GlassSurface className="flex-row items-center justify-between px-4 py-3.5" intensity={35}>
                  <Text className="shrink text-[15px] font-medium text-zinc-800 dark:text-zinc-100">
                    {suggestion.label}
                  </Text>
                  <View className="ml-2 flex-row items-center gap-2">
                    <View
                      className={`rounded-full px-2 py-0.5 ${
                        suggestion.hint === '0 tokens'
                          ? 'bg-amber-100 dark:bg-amber-400/15'
                          : 'bg-brand-100 dark:bg-brand-500/15'
                      }`}>
                      <Text
                        className={`text-[10px] font-bold uppercase tracking-wide ${
                          suggestion.hint === '0 tokens'
                            ? 'text-amber-700 dark:text-amber-200'
                            : 'text-brand-700 dark:text-brand-200'
                        }`}>
                        {suggestion.hint}
                      </Text>
                    </View>
                    <Ionicons name="arrow-forward" size={16} color={palette.subtle} />
                  </View>
                </GlassSurface>
              </PressableScale>
            </Animated.View>
          ))}
        </View>
      ) : (
        <Animated.View entering={FadeInDown.delay(150).springify().damping(18)} style={{ marginTop: 32 }}>
          <PressableScale onPress={onUpload} className="overflow-hidden rounded-full">
            <LinearGradient
              colors={[palette.gradientStart, palette.gradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 14 }}>
              <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />
              <Text className="text-[15px] font-semibold text-white">Upload your first document</Text>
            </LinearGradient>
          </PressableScale>
        </Animated.View>
      )}
    </View>
  );
}