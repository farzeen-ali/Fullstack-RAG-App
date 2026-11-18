import type { KnowledgeDocument } from './types';

export interface SuggestedPrompt {
  label: string;
  prompt: string;
  hint: string;
}

const ZERO_TOKEN: SuggestedPrompt = {
  label: 'Say hello 👋',
  prompt: 'Hello!',
  hint: '0 tokens',
};

export function buildSuggestedPrompts(documents: KnowledgeDocument[]): SuggestedPrompt[] {
  const ready = documents.filter((d) => d.status === 'ready');
  if (ready.length === 0) return [ZERO_TOKEN];

  const primary = ready[0];
  const shortName = primary.name.replace(/\.(pdf|txt|md|markdown)$/i, '');

  const fromDocs: SuggestedPrompt[] = [
    {
      label: `Summarize "${shortName}"`,
      prompt: `Summarize the key points in "${primary.name}".`,
      hint: 'RAG',
    },
    {
      label: 'Main policies & rules',
      prompt: 'What are the main rules, policies, or requirements described in my documents?',
      hint: 'RAG',
    },
  ];

  if (ready.length > 1) {
    const second = ready[1].name.replace(/\.(pdf|txt|md|markdown)$/i, '');
    fromDocs.push({
      label: `Compare with "${second}"`,
      prompt: `What topics does "${second}" cover compared to "${shortName}"?`,
      hint: 'RAG',
    });
  } else if (primary.pageCount > 1) {
    fromDocs.push({
      label: 'Key facts by section',
      prompt: `List the most important facts from "${primary.name}" with page references.`,
      hint: 'RAG',
    });
  }

  return [...fromDocs.slice(0, 3), ZERO_TOKEN];
}