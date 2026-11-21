import { fetch as expoFetch } from 'expo/fetch';
import { Platform } from 'react-native';

import { BACKEND_URL } from './config';
import { SseParser } from './sse';
import type { ChatStreamEvent, KnowledgeDocument } from './types';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function errorFromResponse(response: { status: number; text(): Promise<string> }) {
  const fallback =
    response.status === 429
      ? 'Too many requests. Please wait a minute and try again.'
      : `Request failed (${response.status}).`;
  try {
    const body = JSON.parse(await response.text()) as { message?: string | string[] };
    const message = Array.isArray(body.message) ? body.message[0] : body.message;
    return new ApiError(message || fallback, response.status);
  } catch {
    return new ApiError(fallback, response.status);
  }
}

function networkError(): ApiError {
  return new ApiError(
    `Can't reach the DocuMind server at ${BACKEND_URL}. Make sure the backend is running and your phone is on the same Wi-Fi.`,
    0,
  );
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}${path}`, init);
  } catch {
    throw networkError();
  }
  if (!response.ok) throw await errorFromResponse(response);
  return response;
}

export async function listDocuments(): Promise<KnowledgeDocument[]> {
  const response = await request('/rag/documents');
  return (await response.json()) as KnowledgeDocument[];
}

export async function deleteDocument(id: string): Promise<void> {
  await request(`/rag/documents/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export interface UploadFile {
  uri: string;
  name: string;
  mimeType?: string;
  /** Present on web, where the picker returns a real File. */
  file?: File;
}

export interface UploadHandle {
  promise: Promise<KnowledgeDocument>;
  abort: () => void;
}

export interface UploadCallbacks {
  onProgress: (fraction: number) => void;
  onPhase: (phase: 'sending' | 'processing') => void;
}

/**
 * Uses XMLHttpRequest (works on Expo Go). Upload byte progress is often missing on
 * iOS/Android, so we also signal when the server is parsing the file.
 */
export function uploadDocument(file: UploadFile, callbacks: UploadCallbacks): UploadHandle {
  const xhr = new XMLHttpRequest();
  let sent = false;

  const promise = new Promise<KnowledgeDocument>((resolve, reject) => {
    const form = new FormData();
    if (Platform.OS === 'web' && file.file) {
      form.append('file', file.file, file.name);
    } else {
      form.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType ?? 'application/octet-stream',
      } as unknown as Blob);
    }

    xhr.open('POST', `${BACKEND_URL}/rag/upload`);
    xhr.timeout = 180_000;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        callbacks.onProgress(event.loaded / event.total);
      }
    };
    xhr.upload.onload = () => {
      sent = true;
      callbacks.onProgress(1);
      callbacks.onPhase('processing');
    };
    xhr.onreadystatechange = () => {
      if (xhr.readyState === XMLHttpRequest.HEADERS_RECEIVED && sent) {
        callbacks.onPhase('processing');
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as KnowledgeDocument);
        } catch {
          reject(new ApiError('Unexpected response from server.', xhr.status));
        }
        return;
      }
      errorFromResponse({ status: xhr.status, text: async () => xhr.responseText }).then(reject);
    };
    xhr.onerror = () => reject(networkError());
    xhr.ontimeout = () => reject(new ApiError('Upload timed out.', 0));
    xhr.onabort = () => reject(new ApiError('Upload cancelled.', 0));
    xhr.send(form);
  });

  return { promise, abort: () => xhr.abort() };
}

/**
 * POSTs a question and yields SSE events as they stream in. `expo/fetch`
 * exposes a real ReadableStream body on iOS and Android, unlike RN's fetch.
 */
export async function* streamChat(
  question: string,
  documentIds: string[] | undefined,
  signal: AbortSignal,
): AsyncGenerator<ChatStreamEvent> {
  let response: Awaited<ReturnType<typeof expoFetch>>;
  try {
    response = await expoFetch(`${BACKEND_URL}/rag/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(documentIds?.length ? { question, documentIds } : { question }),
      signal,
    });
  } catch (error) {
    if (signal.aborted) return;
    throw error instanceof ApiError ? error : networkError();
  }

  if (!response.ok) throw await errorFromResponse(response);
  if (!response.body) throw new ApiError('Streaming is not supported on this device.', 0);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parser = new SseParser();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const event of parser.push(decoder.decode(value, { stream: true }))) {
        yield event;
      }
    }
    for (const event of parser.push(decoder.decode() + '\n\n')) yield event;
  } finally {
    reader.releaseLock();
  }
}
