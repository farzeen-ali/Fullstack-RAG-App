import { useEffect, useState } from 'react';
import { Text } from 'react-native';

import type { SourceCitation } from '@/lib/types';

const CITATION = /(\[\d{1,2}\])/g;

function useBlink(active: boolean): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setVisible((v) => !v), 520);
    return () => clearInterval(timer);
  }, [active]);
  return active && visible;
}

interface AnswerTextProps {
  text: string;
  streaming: boolean;
  sources?: SourceCitation[];
  onCitationPress?: (source: SourceCitation) => void;
}

/**
 * Renders model output strictly as plain text (no HTML/markdown evaluation, OWASP LLM02).
 * Inline [n] markers become tappable citations once the sources footer arrives.
 */
export function AnswerText({ text, streaming, sources, onCitationPress }: AnswerTextProps) {
  const cursorVisible = useBlink(streaming);
  const parts = text.split(CITATION);

  return (
    <Text selectable={!streaming} className="text-[15px] leading-6 text-zinc-800 dark:text-zinc-100">
      {parts.map((part, i) => {
        const match = /^\[(\d{1,2})\]$/.exec(part);
        if (!match) return part;
        const source = sources?.find((s) => s.index === Number(match[1]));
        return (
          <Text
            key={i}
            suppressHighlighting
            onPress={source && onCitationPress ? () => onCitationPress(source) : undefined}
            className="text-[13px] font-bold text-brand-600 dark:text-brand-300">
            {`[${match[1]}]`}
          </Text>
        );
      })}
      {streaming ? (
        <Text className="text-brand-500" style={{ opacity: cursorVisible ? 1 : 0 }}>
          {' ▍'}
        </Text>
      ) : null}
    </Text>
  );
}
