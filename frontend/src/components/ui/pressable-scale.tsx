import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const SPRING = { damping: 18, stiffness: 320, mass: 0.6 };

type PressableScaleProps = Omit<PressableProps, 'children' | 'style'> & {
  children: ReactNode;
  className?: string;
  /** Style for the animated wrapper (use for flex/margins). */
  containerStyle?: StyleProp<ViewStyle>;
  scaleTo?: number;
};

export function PressableScale({
  children,
  className,
  containerStyle,
  scaleTo = 0.95,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <Animated.View style={[containerStyle, animatedStyle]}>
      <Pressable
        {...rest}
        className={className}
        onPressIn={(event) => {
          scale.set(withSpring(scaleTo, SPRING));
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          scale.set(withSpring(1, SPRING));
          onPressOut?.(event);
        }}>
        {children}
      </Pressable>
    </Animated.View>
  );
}
