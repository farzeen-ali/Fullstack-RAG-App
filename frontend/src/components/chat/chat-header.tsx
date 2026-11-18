import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VectorEnginePill } from '@/components/chat/vector-engine-pill';
import { IconButton } from '@/components/ui/icon-button';
import { useAppTheme } from '@/hooks/use-app-theme';

interface ChatHeaderProps {
  readyCount: number;
  totalChunks: number;
  indexingCount: number;
  offline: boolean;
  canReset: boolean;
  onReset: () => void;
  onOpenKnowledge: () => void;
}

export function ChatHeader({
  readyCount,
  totalChunks,
  indexingCount,
  offline,
  canReset,
  onReset,
  onOpenKnowledge,
}: ChatHeaderProps) {
  const insets = useSafeAreaInsets();
  const { isDark, palette, toggleTheme } = useAppTheme();

  return (
    <View
      className="border-b border-zinc-200/60 bg-zinc-50/90 dark:border-white/5 dark:bg-ink-950/95"
      style={{ paddingTop: insets.top }}>
      <LinearGradient
        colors={
          isDark
            ? ['rgba(99,102,241,0.18)', 'transparent']
            : ['rgba(99,102,241,0.12)', 'transparent']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
        <View className="flex-row items-center gap-3 pt-2">
          <LinearGradient
            colors={[palette.gradientStart, palette.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: 14, padding: 2 }}>
            <View className="h-9 w-9 items-center justify-center rounded-[12px] bg-ink-900/20 dark:bg-black/25">
              <Ionicons name="sparkles" size={18} color="#FFFFFF" />
            </View>
          </LinearGradient>
          <View className="flex-1">
            <Text className="text-[18px] font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              DocuMind AI
            </Text>
            <Text className="text-[12px] text-zinc-500 dark:text-zinc-400">
              Grounded answers · Pinecone retrieval
            </Text>
          </View>
          <IconButton
            icon={isDark ? 'sunny-outline' : 'moon-outline'}
            label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            onPress={toggleTheme}
          />
          <IconButton
            icon="create-outline"
            label="New chat"
            onPress={onReset}
            disabled={!canReset}
          />
          <IconButton
            icon="library-outline"
            label="Open knowledge base"
            onPress={onOpenKnowledge}
            badge={readyCount + indexingCount}
          />
        </View>
        <VectorEnginePill
          readyCount={readyCount}
          totalChunks={totalChunks}
          offline={offline}
          indexing={indexingCount > 0}
        />
      </LinearGradient>
    </View>
  );
}