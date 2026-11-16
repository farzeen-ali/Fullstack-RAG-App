import { Injectable } from '@nestjs/common';

export interface GuardResult {
  /** The question with control characters, spoofed delimiters and jailbreak phrases removed. */
  sanitized: string;
  blocked: boolean;
  findings: string[];
}

interface GuardRule {
  id: string;
  pattern: RegExp;
  /** `block` refuses the whole request; `strip` removes the phrase and keeps going. */
  action: 'block' | 'strip';
}

const INVISIBLE_AND_CONTROL =
  // eslint-disable-next-line no-control-regex
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g;

const RULES: GuardRule[] = [
  {
    id: 'delimiter-spoofing',
    pattern:
      /<\s*\/?\s*(?:retrieved_context|user_question|document|system|assistant|developer|instructions?)\b[^>]*>/gi,
    action: 'strip',
  },
  {
    id: 'special-tokens',
    pattern:
      /<\|[^|>]{1,40}\|>|\[\/?INST\]|<<\/?SYS>>|###\s*(?:system|instruction)s?\b/gi,
    action: 'block',
  },
  {
    id: 'instruction-override',
    pattern:
      /\b(?:ignore|disregard|forget|override|skip|discard)\s+(?:(?:all|any|every|the|your|my|of|these|those)\s+)*(?:previous|prior|above|earlier|preceding|initial|original|system|existing)\s+(?:instructions?|rules|prompts?|directions?|guidelines|context|commands?|messages?)\b/gi,
    action: 'strip',
  },
  {
    id: 'new-instructions',
    pattern: /\b(?:new|updated|real|actual|secret)\s+instructions?\s*:/gi,
    action: 'strip',
  },
  {
    id: 'system-prompt-exfiltration',
    pattern:
      /\b(?:reveal|show|print|repeat|display|output|leak|dump|expose|tell\s+me|give\s+me|what\s+(?:is|are|was|were))\s+(?:me\s+)?(?:your|the)\s+(?:system|hidden|initial|original|secret|internal|developer)\s+(?:prompt|instructions?|message|rules|configuration)\b/gi,
    action: 'block',
  },
  {
    id: 'system-prompt-reference',
    pattern: /\bsystem\s+prompt\b/gi,
    action: 'block',
  },
  {
    id: 'role-override',
    pattern:
      /(?:^\s*(?:please\s+)?(?:act|behave)\s+as\b|\b(?:act|behave)\s+as\s+(?:an?\s+|if\s+(?:you\s+(?:are|were)\s+)?|my\s+|the\s+)?(?:unrestricted|unfiltered|uncensored|jailbroken|evil|different|new|developer|admin|administrator|root|dan|hacker|god)\b|\byou\s+are\s+now\b|\bpretend\s+(?:to\s+be|you\s+are|that\s+you)\b|\brole\s*-?\s*play\s+as\b|\bfrom\s+now\s+on\b)/gi,
    action: 'block',
  },
  {
    id: 'jailbreak',
    pattern:
      /\b(?:jailbreak|jail\s*broken|dan\s+mode|do\s+anything\s+now|developer\s+mode|god\s+mode|no\s+restrictions)\b/gi,
    action: 'block',
  },
  {
    id: 'guardrail-bypass',
    pattern:
      /\b(?:bypass|circumvent|disable|override|turn\s+off|get\s+around|break)\s+(?:(?:all|any|the|your|these|those|of)\s+)*(?:rules|restrictions|filters?|safety|guardrails?|guidelines|polic(?:y|ies)|security|content\s+polic(?:y|ies)|limitations)\b/gi,
    action: 'block',
  },
];

const MIN_WORDS_AFTER_STRIP = 3;

/**
 * OWASP LLM01 input guard. Runs before any embedding or completion call, so a
 * blocked request costs zero tokens. The model-side defenses (XML-delimited
 * untrusted context + grounding rules) remain in place for anything that slips
 * past these patterns.
 */
@Injectable()
export class PromptGuardService {
  inspect(input: string): GuardResult {
    const findings = new Set<string>();
    let text = input.normalize('NFKC').replace(INVISIBLE_AND_CONTROL, '');
    let blocked = false;
    let stripped = false;

    for (const rule of RULES) {
      rule.pattern.lastIndex = 0;
      if (!rule.pattern.test(text)) continue;
      findings.add(rule.id);
      if (rule.action === 'block') {
        blocked = true;
      } else {
        rule.pattern.lastIndex = 0;
        text = text.replace(rule.pattern, ' ');
        stripped = true;
      }
    }

    const sanitized = text
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^[\s,.;:!-]+/, '')
      .trim();

    if (stripped && countWords(sanitized) < MIN_WORDS_AFTER_STRIP) {
      blocked = true;
    }

    return { sanitized, blocked, findings: [...findings] };
  }
}

function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}
