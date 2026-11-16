import { ExtractedPage, TextChunk } from '../rag.types';

export interface ChunkOptions {
  chunkSize: number;
  overlap: number;
  minChunkLength: number;
}

export const DEFAULT_CHUNK_OPTIONS: ChunkOptions = {
  chunkSize: 600,
  overlap: 100,
  minChunkLength: 20,
};

const BREAK_SEPARATORS = ['\n\n', '. ', '? ', '! ', '.\n', '; ', '\n', ', '];

export function cleanExtractedText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\u00AD/g, '')
    .replace(/(\p{L})-\n(\p{Ll})/gu, '$1$2')
    .replace(/[ \t\u00A0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Splits each page into ~600 character windows with 100 characters of overlap,
 * preferring paragraph/sentence boundaries so chunks stay semantically whole.
 * Chunks never span pages, which keeps page citations exact.
 */
export function chunkPages(
  pages: ExtractedPage[],
  options: ChunkOptions = DEFAULT_CHUNK_OPTIONS,
): TextChunk[] {
  const { chunkSize, overlap, minChunkLength } = options;
  const minBreak = Math.floor(chunkSize * 0.6);
  const chunks: TextChunk[] = [];

  for (const page of pages) {
    const text = cleanExtractedText(page.text);
    if (!text) continue;

    let start = 0;
    while (start < text.length) {
      let end = Math.min(start + chunkSize, text.length);

      if (end < text.length) {
        const window = text.slice(start, end);
        const breakAt = findBreak(window, minBreak);
        if (breakAt > 0) end = start + breakAt;
      }

      const content = text.slice(start, end).trim();
      if (
        content.length >= minChunkLength ||
        (chunks.length === 0 && content)
      ) {
        chunks.push({
          chunkIndex: chunks.length,
          pageNumber: page.pageNumber,
          content,
        });
      }

      if (end >= text.length) break;

      let next = end - overlap;
      const wordStart = text.indexOf(' ', next);
      if (wordStart !== -1 && wordStart < end) next = wordStart + 1;
      start = Math.max(next, start + 1);
    }
  }

  return chunks;
}

function findBreak(window: string, minBreak: number): number {
  for (const separator of BREAK_SEPARATORS) {
    const idx = window.lastIndexOf(separator);
    if (idx >= minBreak) return idx + separator.trimEnd().length;
  }
  const space = window.lastIndexOf(' ');
  return space >= minBreak ? space : -1;
}
