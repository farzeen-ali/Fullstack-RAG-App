import { forwardRef } from 'react';
import {
  KeyboardChatScrollView,
  type KeyboardChatScrollViewProps,
  type KeyboardChatScrollViewRef,
} from 'react-native-keyboard-controller';

/**
 * Scroll component for the chat FlatList. Instead of resizing the list when the
 * keyboard opens, it extends the content inset and shifts the scroll position
 * on the UI thread, so messages glide up in sync with the keyboard.
 */
export const ChatScrollView = forwardRef<KeyboardChatScrollViewRef, KeyboardChatScrollViewProps>(
  function ChatScrollView(props, ref) {
    return (
      <KeyboardChatScrollView
        ref={ref}
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        {...props}
      />
    );
  },
);
