import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Text, View } from 'react-native';

import { useAppTheme } from '@/hooks/use-app-theme';

import { PressableScale } from './pressable-scale';

export type IconName = ComponentProps<typeof Ionicons>['name'];

interface IconButtonProps {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  badge?: number;
}

export function IconButton({ icon, label, onPress, disabled, badge }: IconButtonProps) {
  const { palette } = useAppTheme();

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      className={`h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-ink-800 ${disabled ? 'opacity-40' : ''}`}>
      <Ionicons name={icon} size={20} color={palette.text} />
      {badge !== undefined && badge > 0 ? (
        <View className="absolute -right-1 -top-1 min-w-[18px] items-center rounded-full bg-brand-500 px-1 py-px">
          <Text className="text-[10px] font-bold text-white">{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
    </PressableScale>
  );
}
