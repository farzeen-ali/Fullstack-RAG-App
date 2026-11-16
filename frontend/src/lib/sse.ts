import type { ChatStreamEvent } from './types';

const KNOWN_EVENTS = new Set<ChatStreamEvent['event']>(['status', 'token', 'done', 'error']);

/**
 * Incremental Server-Sent Events parser. Feed it decoded text as it arrives;
 * it returns every complete event and buffers any partial one.
 */
export class SseParser {
  private buffer = '';

  push(text: string): ChatStreamEvent[] {
    this.buffer += text.replace(/\r\n?/g, '\n');
    const events: ChatStreamEvent[] = [];

    let boundary = this.buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const block = this.buffer.slice(0, boundary);
      this.buffer = this.buffer.slice(boundary + 2);
      const event = parseBlock(block);
      if (event) events.push(event);
      boundary = this.buffer.indexOf('\n\n');
    }
    return events;
  }
}

function parseBlock(block: string): ChatStreamEvent | null {
  let name = 'message';
  const dataLines: string[] = [];

  for (const line of block.split('\n')) {
    if (line.startsWith(':')) continue;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '');
    if (field === 'event') name = value;
    else if (field === 'data') dataLines.push(value);
  }

  if (!KNOWN_EVENTS.has(name as ChatStreamEvent['event']) || dataLines.length === 0) return null;

  try {
    return { event: name, data: JSON.parse(dataLines.join('\n')) } as ChatStreamEvent;
  } catch {
    return null;
  }
}
