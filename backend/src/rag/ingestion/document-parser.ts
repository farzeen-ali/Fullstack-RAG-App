import {
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import { ExtractedPage } from '../rag.types';

export type SupportedKind = 'pdf' | 'text';

const TEXT_EXTENSIONS = new Set(['txt', 'md', 'markdown']);
const TEXT_MIME_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'text/x-markdown',
]);

export function detectKind(
  fileName: string,
  mimeType: string,
  buffer: Buffer,
): SupportedKind {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
  const isPdfMagic = buffer.subarray(0, 5).toString('latin1') === '%PDF-';

  if (extension === 'pdf' || mimeType === 'application/pdf') {
    if (!isPdfMagic) {
      throw new BadRequestException(
        'File claims to be a PDF but its contents are not a valid PDF.',
      );
    }
    return 'pdf';
  }

  if (TEXT_EXTENSIONS.has(extension) || TEXT_MIME_TYPES.has(mimeType)) {
    if (isPdfMagic || buffer.includes(0)) {
      throw new BadRequestException(
        'Text files must contain plain UTF-8 text.',
      );
    }
    return 'text';
  }

  throw new BadRequestException(
    'Unsupported file type. Upload a PDF, .txt or .md file.',
  );
}

export async function extractPages(
  buffer: Buffer,
  kind: SupportedKind,
): Promise<ExtractedPage[]> {
  if (kind === 'text') {
    const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
    // Form feeds are the conventional page separator in plain-text exports.
    return text
      .split('\f')
      .map((pageText, i) => ({ pageNumber: i + 1, text: pageText }));
  }

  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return result.pages.map((page) => ({
      pageNumber: page.num,
      text: page.text,
    }));
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    if (name === 'PasswordException') {
      throw new UnprocessableEntityException(
        'Password-protected PDFs are not supported.',
      );
    }
    throw new UnprocessableEntityException(
      'Could not read this PDF. It may be corrupted.',
    );
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

/** Multer decodes multipart file names as latin1; restore UTF-8 and strip anything path-like. */
export function sanitizeFileName(originalName: string): string {
  const decoded = Buffer.from(originalName, 'latin1').toString('utf8');
  const cleaned = decoded
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return (cleaned || 'Untitled document').slice(0, 160);
}
