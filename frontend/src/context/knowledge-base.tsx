import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { ApiError, deleteDocument, listDocuments, uploadDocument, type UploadFile } from '@/lib/api';
import type { KnowledgeDocument } from '@/lib/types';

const POLL_INTERVAL_MS = 2000;

export type UploadPhase = 'sending' | 'processing';

export interface UploadTask {
  id: string;
  name: string;
  /** 0..1 when the platform reports bytes sent; stays 0 on many phones until the response returns. */
  progress: number;
  phase: UploadPhase;
  error?: string;
}

interface KnowledgeBaseValue {
  documents: KnowledgeDocument[];
  readyDocuments: KnowledgeDocument[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  uploads: UploadTask[];
  /** Explicitly selected documents. Empty means "search everything". */
  selectedIds: string[];
  /** IDs to send with a chat request, or undefined to search all documents. */
  scopeIds: string[] | undefined;
  refresh: () => Promise<void>;
  upload: (file: UploadFile) => Promise<void>;
  dismissUpload: (id: string) => void;
  remove: (id: string) => Promise<void>;
  toggleSelected: (id: string) => void;
  clearSelection: () => void;
}

const KnowledgeBaseContext = createContext<KnowledgeBaseValue | null>(null);

export function KnowledgeBaseProvider({ children }: { children: ReactNode }) {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploads, setUploads] = useState<UploadTask[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const inFlight = useRef(false);

  const applyDocuments = useCallback((next: KnowledgeDocument[]) => {
    setDocuments(next);
    setError(null);
    setLoading(false);
    setSelectedIds((current) =>
      current.filter((id) => next.some((doc) => doc.id === id && doc.status === 'ready')),
    );
  }, []);

  const applyError = useCallback((err: unknown) => {
    setError(err instanceof Error ? err.message : 'Failed to load documents.');
    setLoading(false);
  }, []);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    await listDocuments()
      .then(applyDocuments, applyError)
      .finally(() => {
        inFlight.current = false;
      });
  }, [applyDocuments, applyError]);

  useEffect(() => {
    listDocuments().then(applyDocuments, applyError);
  }, [applyDocuments, applyError]);

  const isIndexing = documents.some((doc) => doc.status === 'processing');
  useEffect(() => {
    if (!isIndexing) return;
    const timer = setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isIndexing, load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const upload = useCallback(
    async (file: UploadFile) => {
      const taskId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setUploads((current) => [
        ...current,
        { id: taskId, name: file.name, progress: 0, phase: 'sending' },
      ]);

      const handle = uploadDocument(file, {
        onProgress: (progress) =>
          setUploads((current) =>
            current.map((t) => (t.id === taskId ? { ...t, progress } : t)),
          ),
        onPhase: (phase) =>
          setUploads((current) =>
            current.map((t) => (t.id === taskId ? { ...t, phase } : t)),
          ),
      });

      try {
        const document = await handle.promise;
        setUploads((current) => current.filter((t) => t.id !== taskId));
        setDocuments((current) => [document, ...current.filter((d) => d.id !== document.id)]);
        void load();
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Upload failed.';
        setUploads((current) =>
          current.map((t) => (t.id === taskId ? { ...t, error: message } : t)),
        );
      }
    },
    [load],
  );

  const dismissUpload = useCallback((id: string) => {
    setUploads((current) => current.filter((t) => t.id !== id));
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteDocument(id);
    setDocuments((current) => current.filter((doc) => doc.id !== id));
    setSelectedIds((current) => current.filter((selected) => selected !== id));
  }, []);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((s) => s !== id) : [...current, id],
    );
  }, []);

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  const readyDocuments = documents.filter((doc) => doc.status === 'ready');

  const value: KnowledgeBaseValue = {
    documents,
    readyDocuments,
    loading,
    refreshing,
    error,
    uploads,
    selectedIds,
    scopeIds: selectedIds.length > 0 ? selectedIds : undefined,
    refresh,
    upload,
    dismissUpload,
    remove,
    toggleSelected,
    clearSelection,
  };

  return <KnowledgeBaseContext.Provider value={value}>{children}</KnowledgeBaseContext.Provider>;
}

export function useKnowledgeBase(): KnowledgeBaseValue {
  const value = useContext(KnowledgeBaseContext);
  if (!value) throw new Error('useKnowledgeBase must be used inside <KnowledgeBaseProvider>');
  return value;
}
