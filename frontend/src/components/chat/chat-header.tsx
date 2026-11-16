import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui/icon-button';
import { useAppTheme } from '@/hooks/use-app-theme';

interface ChatHeaderProps {
  readyCount: number;
  indexingCount: number;
  offline: boolean;
  canReset: boolean;
  onReset: () => void;
  onOpenKnowledge: () => void;
}

export function ChatHeader({
  readyCount,
  indexingCount,
  offline,
  canReset,
  onReset,
  onOpenKnowledge,
}: ChatHeaderProps) {
  const insets = useSafeAreaInsets();
  const { isDark, toggleTheme } = useAppTheme();

  const subtitle = offline
    ? 'Server unreachable'
    : indexingCount > 0
      ? `Indexing ${indexingCount} document${indexingCount === 1 ? '' : 's'}…`
      : readyCount > 0
        ? `${readyCount} document${readyCount === 1 ? '' : 's'} indexed`
        : 'No documents yet';
  const dotClass = offline ? 'bg-rose-500' : indexingCount > 0 ? 'bg-amber-400' : 'bg-emerald-500';

  return (
    <View
      className="border-b border-zinc-200/80 bg-zinc-50 dark:border-ink-800 dark:bg-ink-900"
      style={{ paddingTop: insets.top }}>
      <View className="h-14 flex-row items-center gap-3 px-4">
        <View className="h-9 w-9 items-center justify-center rounded-xl bg-brand-500">
          <Ionicons name="sparkles" size={18} color="#FFFFFF" />
        </View>
        <View className="flex-1">
          <Text className="text-[17px] font-bold tracking-tight text-zinc-900 dark:text-zinc-50">DocuMind AI</Text>
          <View className="flex-row items-center gap-1.5">
            <View className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
            <Text numberOfLines={1} className="text-xs text-zinc-500 dark:text-zinc-400">
              {subtitle}
            </Text>
          </View>
        </View>
        <IconButton
          icon={isDark ? 'sunny-outline' : 'moon-outline'}
          label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          onPress={toggleTheme}
        />
        <IconButton icon="create-outline" label="New chat" onPress={onReset} disabled={!canReset} />
        <IconButton
          icon="library-outline"
          label="Open knowledge base"
          onPress={onOpenKnowledge}
          badge={readyCount + indexingCount}
        />
      </View>
    </View>
  );
}
