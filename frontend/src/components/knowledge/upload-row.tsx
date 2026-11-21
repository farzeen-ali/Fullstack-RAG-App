import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';

import { ProgressBar } from '@/components/ui/progress-bar';
import type { UploadTask } from '@/context/knowledge-base';
import { useAppTheme } from '@/hooks/use-app-theme';

export function UploadRow({ task, onDismiss }: { task: UploadTask; onDismiss: () => void }) {
  const { palette } = useAppTheme();
  const failed = task.error !== undefined;
  const onServer = task.phase === 'processing' || task.progress >= 1;
  const indeterminate = !failed && !onServer && task.progress < 0.01;

  return (
    <Animated.View entering={FadeInDown.springify().damping(18)} exiting={FadeOut.duration(150)}>
      <View
        className={`gap-2 rounded-2xl border p-4 ${
          failed
            ? 'border-rose-200 bg-rose-50 dark:border-rose-400/25 dark:bg-rose-400/10'
            : 'border-brand-200 bg-brand-50 dark:border-brand-400/25 dark:bg-brand-500/10'
        }`}>
        <View className="flex-row items-center gap-2">
          <Ionicons
            name={failed ? 'alert-circle' : 'cloud-upload'}
            size={16}
            color={failed ? palette.danger : palette.brand}
          />
          <Text numberOfLines={1} className="flex-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            {task.name}
          </Text>
          {failed ? (
            <Pressable onPress={onDismiss} hitSlop={8} accessibilityLabel="Dismiss upload error">
              <Ionicons name="close" size={18} color={palette.muted} />
            </Pressable>
          ) : null}
        </View>
        {failed ? (
          <Text className="text-xs leading-5 text-rose-700 dark:text-rose-200">{task.error}</Text>
        ) : (
          <>
            <ProgressBar progress={indeterminate ? 0 : task.progress} indeterminate={indeterminate} />
            <Text className="text-xs text-zinc-500 dark:text-zinc-400">
              {onServer
                ? 'Server is extracting text and chunking…'
                : indeterminate
                  ? 'Sending file to DocuMind… (stay on this screen)'
                  : `Uploading ${Math.round(task.progress * 100)}%`}
            </Text>
          </>
        )}
      </View>
    </Animated.View>
  );
}
