import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, Keyboard, View, type ScrollViewProps } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChatHeader } from '@/components/chat/chat-header';
import { ChatScrollView } from '@/components/chat/chat-scroll-view';
import { Composer } from '@/components/chat/composer';
import { EmptyState } from '@/components/chat/empty-state';
import { MessageBubble } from '@/components/chat/message-bubble';
import { SourceSheet } from '@/components/chat/source-sheet';
import { PressableScale } from '@/components/ui/pressable-scale';
import { useKnowledgeBase } from '@/context/knowledge-base';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useChat } from '@/hooks/use-chat';
import type { ChatMessage, SourceCitation } from '@/lib/types';

const KEYBOARD_GAP = 8;

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { palette } = useAppTheme();
  const kb = useKnowledgeBase();
  const chat = useChat();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const [activeSource, setActiveSource] = useState<SourceCitation | null>(null);
  const [showJump, setShowJump] = useState(false);

  // The composer's bottom padding covers the home indicator when the keyboard is
  // closed; when it opens, everything but KEYBOARD_GAP slides behind the keyboard.
  const bottomPadding = Math.max(insets.bottom, 12);
  const openedOffset = bottomPadding - KEYBOARD_GAP;

  const indexingCount = kb.documents.filter((d) => d.status === 'processing').length;
  const totalChunks = kb.readyDocuments.reduce((sum, d) => sum + d.chunkCount, 0);
  const scopeLabel =
    kb.selectedIds.length > 0
      ? `Searching ${kb.selectedIds.length} of ${kb.readyDocuments.length} documents`
      : kb.readyDocuments.length > 0
        ? `Searching all ${kb.readyDocuments.length} documents`
        : 'No documents indexed yet';

  const openKnowledge = () => {
    Keyboard.dismiss();
    router.push('/knowledge');
  };

  const openSource = (source: SourceCitation) => {
    Keyboard.dismiss();
    setActiveSource(source);
  };

  const send = (text: string) => {
    void chat.send(text, kb.scopeIds);
  };

  const renderScrollComponent = (props: ScrollViewProps) => (
    <ChatScrollView
      {...props}
      inverted
      offset={openedOffset}
      keyboardLiftBehavior="always"
      onEndVisible={(visible) => setShowJump(!visible)}
    />
  );

  return (
    <View className="flex-1 bg-zinc-50 dark:bg-ink-900">
      <ChatHeader
        readyCount={kb.readyDocuments.length}
        totalChunks={totalChunks}
        indexingCount={indexingCount}
        offline={kb.error !== null}
        canReset={chat.messages.length > 0}
        onReset={chat.reset}
        onOpenKnowledge={openKnowledge}
      />

      <View className="flex-1">
        {chat.messages.length === 0 ? (
          <ChatScrollView
            offset={openedOffset}
            contentContainerStyle={{ flexGrow: 1 }}
            showsVerticalScrollIndicator={false}>
            <EmptyState
              documents={kb.documents}
              hasDocuments={kb.readyDocuments.length > 0}
              onSuggestion={send}
              onUpload={openKnowledge}
            />
          </ChatScrollView>
        ) : (
          <FlatList
            ref={listRef}
            inverted
            data={[...chat.messages].reverse()}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <MessageBubble message={item} onSourcePress={openSource} />}
            renderScrollComponent={renderScrollComponent}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 20, gap: 20 }}
            showsVerticalScrollIndicator={false}
            windowSize={15}
          />
        )}

        {showJump && chat.messages.length > 0 ? (
          <Animated.View
            entering={FadeIn.duration(150)}
            exiting={FadeOut.duration(150)}
            style={{ position: 'absolute', bottom: 12, alignSelf: 'center' }}>
            <PressableScale
              accessibilityLabel="Jump to latest message"
              onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
              className="h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white shadow-sm dark:border-ink-700 dark:bg-ink-800">
              <Ionicons name="arrow-down" size={18} color={palette.text} />
            </PressableScale>
          </Animated.View>
        ) : null}
      </View>

      <Composer
        busy={chat.busy}
        openedOffset={openedOffset}
        bottomPadding={bottomPadding}
        scopeLabel={scopeLabel}
        onScopePress={openKnowledge}
        onSend={send}
        onStop={chat.stop}
      />

      <SourceSheet source={activeSource} onClose={() => setActiveSource(null)} />
    </View>
  );
}
