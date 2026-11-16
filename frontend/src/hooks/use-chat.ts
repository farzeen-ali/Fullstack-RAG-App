import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, streamChat } from '@/lib/api';
import { MAX_QUESTION_LENGTH } from '@/lib/config';
import type { ChatMessage } from '@/lib/types';

/** Token text is buffered and flushed at most every frame to keep re-renders cheap. */
const FLUSH_INTERVAL_MS = 32;

function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const update = useCallback((id: string, patch: (message: ChatMessage) => Partial<ChatMessage>) => {
    setMessages((current) => current.map((m) => (m.id === id ? { ...m, ...patch(m) } : m)));
  }, []);

  const send = useCallback(
    async (rawQuestion: string, documentIds?: string[]) => {
      const question = rawQuestion.trim().slice(0, MAX_QUESTION_LENGTH);
      if (!question || abortRef.current) return;

      const controller = new AbortController();
      abortRef.current = controller;
      setBusy(true);

      const assistantId = createId();
      const now = Date.now();
      setMessages((current) => [
        ...current,
        { id: createId(), role: 'user', text: question, createdAt: now, phase: 'done' },
        { id: assistantId, role: 'assistant', text: '', createdAt: now + 1, phase: 'thinking' },
      ]);

      let pending = '';
      let flushTimer: ReturnType<typeof setTimeout> | null = null;
      const flush = () => {
        flushTimer = null;
        if (!pending) return;
        const chunk = pending;
        pending = '';
        update(assistantId, (m) => ({ text: m.text + chunk, phase: 'streaming' }));
      };

      try {
        for await (const event of streamChat(question, documentIds, controller.signal)) {
          switch (event.event) {
            case 'status':
              update(assistantId, () => ({ phase: event.data.stage }));
              break;
            case 'token':
              pending += event.data.text;
              flushTimer ??= setTimeout(flush, FLUSH_INTERVAL_MS);
              break;
            case 'done':
              if (flushTimer) clearTimeout(flushTimer);
              flush();
              update(assistantId, () => ({ phase: 'done', footer: event.data }));
              break;
            case 'error':
              if (flushTimer) clearTimeout(flushTimer);
              flush();
              update(assistantId, () => ({ phase: 'error', error: event.data.message }));
              break;
          }
        }
        if (flushTimer) clearTimeout(flushTimer);
        flush();
        update(assistantId, (m) =>
          m.phase === 'done' || m.phase === 'error'
            ? {}
            : controller.signal.aborted
              ? { phase: 'stopped' }
              : { phase: 'error', error: 'The connection closed before the answer finished.' },
        );
      } catch (error) {
        if (flushTimer) clearTimeout(flushTimer);
        flush();
        if (controller.signal.aborted) {
          update(assistantId, () => ({ phase: 'stopped' }));
        } else {
          const message =
            error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
          update(assistantId, () => ({ phase: 'error', error: message }));
        }
      } finally {
        abortRef.current = null;
        setBusy(false);
      }
    },
    [update],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
  }, []);

  return { messages, busy, send, stop, reset };
}
