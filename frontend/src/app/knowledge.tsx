import Ionicons from '@expo/vector-icons/Ionicons';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { Alert, FlatList, Platform, Pressable, RefreshControl, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DocumentCard } from '@/components/knowledge/document-card';
import { UploadRow } from '@/components/knowledge/upload-row';
import { IconButton } from '@/components/ui/icon-button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { useKnowledgeBase } from '@/context/knowledge-base';
import { useAppTheme } from '@/hooks/use-app-theme';
import { BACKEND_URL, MAX_UPLOAD_BYTES } from '@/lib/config';
import { formatBytes, pluralize } from '@/lib/format';
import { warningHaptic } from '@/lib/haptics';
import type { KnowledgeDocument } from '@/lib/types';

const ACCEPTED_TYPES = ['application/pdf', 'text/plain', 'text/markdown', 'text/x-markdown'];
const ACCEPTED_EXTENSIONS = /\.(pdf|txt|md|markdown)$/i;

function confirm(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: onConfirm },
  ]);
}

function notify(title: string, message: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

export default function KnowledgeScreen() {
  const insets = useSafeAreaInsets();
  const { palette } = useAppTheme();
  const kb = useKnowledgeBase();

  const totalChunks = kb.readyDocuments.reduce((sum, doc) => sum + doc.chunkCount, 0);

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: Platform.OS === 'web' ? '.pdf,.txt,.md,.markdown' : ACCEPTED_TYPES,
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    if (!ACCEPTED_EXTENSIONS.test(asset.name)) {
      warningHaptic();
      notify('Unsupported file', 'Choose a PDF, .txt or .md file.');
      return;
    }
    if (asset.size !== undefined && asset.size > MAX_UPLOAD_BYTES) {
      warningHaptic();
      notify('File too large', `${formatBytes(asset.size)} exceeds the ${formatBytes(MAX_UPLOAD_BYTES)} limit.`);
      return;
    }

    void kb.upload({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType, file: asset.file });
  };

  const deleteDocument = (document: KnowledgeDocument) => {
    confirm('Delete document?', `"${document.name}" and all of its indexed chunks will be removed.`, () => {
      kb.remove(document.id).catch((error: unknown) =>
        notify('Delete failed', error instanceof Error ? error.message : 'Please try again.'),
      );
    });
  };

  const header = (
    <View className="gap-4 pb-4">
      <PressableScale
        scaleTo={0.98}
        onPress={pickDocument}
        accessibilityRole="button"
        accessibilityLabel="Upload a document"
        className="items-center gap-2 rounded-3xl border-2 border-dashed border-brand-300 bg-brand-50/60 px-6 py-7 dark:border-brand-500/40 dark:bg-brand-500/5">
        <View className="h-12 w-12 items-center justify-center rounded-2xl bg-brand-500">
          <Ionicons name="cloud-upload-outline" size={24} color="#FFFFFF" />
        </View>
        <Text className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Upload PDF, TXT or Markdown</Text>
        <Text className="text-center text-xs leading-5 text-zinc-500 dark:text-zinc-400">
          Up to {formatBytes(MAX_UPLOAD_BYTES)} · split into ~600-character chunks and embedded for semantic search
        </Text>
      </PressableScale>

      {kb.uploads.map((task) => (
        <UploadRow key={task.id} task={task} onDismiss={() => kb.dismissUpload(task.id)} />
      ))}

      {kb.error ? (
        <View className="flex-row items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-400/25 dark:bg-rose-400/10">
          <Ionicons name="cloud-offline-outline" size={18} color={palette.danger} />
          <View className="flex-1 gap-1">
            <Text className="text-sm font-semibold text-rose-700 dark:text-rose-200">
              Can&apos;t reach the server
            </Text>
            <Text className="text-xs leading-5 text-rose-700/90 dark:text-rose-200/90">{kb.error}</Text>
            <Text selectable className="text-xs font-medium text-rose-700 dark:text-rose-200">
              {BACKEND_URL}
            </Text>
          </View>
        </View>
      ) : null}

      {kb.readyDocuments.length > 0 ? (
        <View className="flex-row items-center justify-between px-1 pt-2">
          <Text className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {kb.selectedIds.length > 0
              ? `Search scope · ${kb.selectedIds.length} selected`
              : 'Search scope · All documents'}
          </Text>
          {kb.selectedIds.length > 0 ? (
            <Pressable onPress={kb.clearSelection} hitSlop={8}>
              <Text className="text-xs font-semibold text-brand-600 dark:text-brand-300">Use all</Text>
            </Pressable>
          ) : (
            <Text className="text-xs text-zinc-400 dark:text-zinc-500">Tap to narrow</Text>
          )}
        </View>
      ) : null}
    </View>
  );

  return (
    <View className="flex-1 bg-zinc-50 dark:bg-ink-900">
      <View
        className="border-b border-zinc-200/80 px-5 pb-3 dark:border-ink-800"
        style={{ paddingTop: Platform.OS === 'ios' ? 12 : insets.top + 8 }}>
        {Platform.OS === 'ios' ? (
          <View className="mb-3 h-1.5 w-10 self-center rounded-full bg-zinc-300 dark:bg-ink-600" />
        ) : null}
        <View className="flex-row items-center gap-3">
          <View className="flex-1">
            <Text className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Knowledge Base</Text>
            <Text className="text-xs text-zinc-500 dark:text-zinc-400">
              {pluralize(kb.readyDocuments.length, 'document')} · {pluralize(totalChunks, 'chunk')} indexed
            </Text>
          </View>
          <IconButton icon="close" label="Close knowledge base" onPress={() => router.back()} />
        </View>
      </View>

      <FlatList
        data={kb.documents}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <DocumentCard
            document={item}
            selected={kb.selectedIds.includes(item.id)}
            onToggle={() => kb.toggleSelected(item.id)}
            onDelete={() => deleteDocument(item)}
          />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          kb.loading ? undefined : (
            <View className="items-center gap-2 py-10">
              <Ionicons name="folder-open-outline" size={36} color={palette.subtle} />
              <Text className="text-sm text-zinc-500 dark:text-zinc-400">Your knowledge base is empty.</Text>
            </View>
          )
        }
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 12 }}
        refreshControl={
          <RefreshControl refreshing={kb.refreshing} onRefresh={kb.refresh} tintColor={palette.brand} />
        }
      />
    </View>
  );
}
