import { Injectable } from '@nestjs/common';

export type ConversationalIntent =
  'greeting' | 'wellbeing' | 'gratitude' | 'acknowledgement' | 'farewell';

export interface RoutedIntent {
  intent: ConversationalIntent;
  reply: string;
}

const GREETING = new Set([
  'hi',
  'hello',
  'hey',
  'heya',
  'hiya',
  'howdy',
  'yo',
  'sup',
  'hola',
  'greetings',
  'morning',
  'afternoon',
  'evening',
  'gm',
  'salam',
  'salaam',
]);
const WELLBEING = new Set(['how', 'hows', 'whats', 'wassup', 'doing', 'going']);
const GRATITUDE = new Set([
  'thanks',
  'thank',
  'thx',
  'ty',
  'tysm',
  'thankyou',
  'thanku',
  'appreciate',
  'appreciated',
  'cheers',
  'grateful',
]);
const ACKNOWLEDGEMENT = new Set([
  'ok',
  'okay',
  'k',
  'kk',
  'okey',
  'alright',
  'allright',
  'sure',
  'cool',
  'great',
  'nice',
  'awesome',
  'perfect',
  'got',
  'understood',
  'noted',
  'yes',
  'yep',
  'yeah',
  'yup',
  'fine',
  'sounds',
  'makes',
  'sense',
  'wow',
  'amazing',
  'excellent',
  'brilliant',
  'lovely',
  'neat',
  'good',
]);
const FAREWELL_WORDS = new Set([
  'bye',
  'goodbye',
  'byebye',
  'cya',
  'gn',
  'farewell',
]);
const FAREWELL = new Set([
  ...FAREWELL_WORDS,
  'later',
  'night',
  'take',
  'care',
  'see',
  'ya',
]);
const FAREWELL_PHRASES = [
  'good night',
  'see you',
  'see ya',
  'take care',
  'later',
];
/** Words that may pad a pleasantry but carry no question on their own. */
const FILLER = new Set([
  'there',
  'all',
  'everyone',
  'folks',
  'team',
  'friend',
  'buddy',
  'bot',
  'documind',
  'docu',
  'mind',
  'ai',
  'so',
  'very',
  'much',
  'a',
  'lot',
  'again',
  'for',
  'the',
  'help',
  'your',
  'that',
  'this',
  'is',
  'it',
  'me',
  'you',
  'u',
  'are',
  'up',
  'day',
  'to',
  'and',
  'oh',
  'ah',
  'well',
  'just',
  'too',
  'now',
  'really',
  'dear',
  'sir',
  'maam',
  'guys',
]);

const REPLIES: Record<ConversationalIntent, readonly string[]> = {
  greeting: [
    "Hi there! I'm DocuMind AI. Ask me anything about your uploaded documents and I'll answer with exact source citations.",
    "Hello! Ready when you are — ask a question about your knowledge base and I'll cite the exact pages I used.",
  ],
  wellbeing: [
    "I'm running smoothly, thanks for asking! What would you like to find in your documents today?",
  ],
  gratitude: [
    "You're welcome! Let me know if there's anything else you'd like to look up in your documents.",
    "Happy to help! Ask another question whenever you're ready.",
  ],
  acknowledgement: [
    'Got it! Ask a follow-up question whenever you like.',
    "Sounds good. I'm here whenever you need to search your documents.",
  ],
  farewell: [
    'Goodbye! Your knowledge base will be right here when you come back.',
    'See you soon! Good luck with your work.',
  ],
};

const MAX_LENGTH = 60;
const MAX_WORDS = 7;

/**
 * Deterministic, zero-token classifier for pure small-talk messages. It only
 * fires when *every* word belongs to the pleasantry vocabulary, so a message
 * such as "hi, what is the refund policy?" still goes to retrieval.
 */
@Injectable()
export class IntentRouterService {
  route(message: string): RoutedIntent | null {
    const raw = message.trim();
    if (!raw || raw.length > MAX_LENGTH * 2) return null;

    const normalized = raw
      .normalize('NFKC')
      .toLowerCase()
      .replace(/['’`]/g, '')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!normalized) {
      // Emoji/punctuation-only messages such as "👍" or "🙏".
      return raw.length <= 8 ? this.reply('acknowledgement') : null;
    }
    if (normalized.length > MAX_LENGTH) return null;

    const words = normalized.split(' ').map(collapseElongation);
    if (words.length > MAX_WORDS) return null;

    const isKnown = (w: string) =>
      GREETING.has(w) ||
      WELLBEING.has(w) ||
      GRATITUDE.has(w) ||
      ACKNOWLEDGEMENT.has(w) ||
      FAREWELL.has(w) ||
      FILLER.has(w);
    if (!words.every(isKnown)) return null;

    const has = (set: Set<string>) => words.some((w) => set.has(w));
    const hasPhrase = (phrase: string) =>
      ` ${words.join(' ')} `.includes(` ${phrase} `);

    if (
      FAREWELL_PHRASES.some(hasPhrase) ||
      words.some((w) => FAREWELL_WORDS.has(w))
    ) {
      return this.reply('farewell');
    }
    if (has(GRATITUDE)) return this.reply('gratitude');
    if (
      hasPhrase('how are you') ||
      hasPhrase('hows it going') ||
      hasPhrase('whats up') ||
      hasPhrase('how are you doing') ||
      words.includes('wassup')
    ) {
      return this.reply('wellbeing');
    }
    if (has(GREETING)) return this.reply('greeting');
    if (has(ACKNOWLEDGEMENT)) return this.reply('acknowledgement');
    return null;
  }

  private reply(intent: ConversationalIntent): RoutedIntent {
    const options = REPLIES[intent];
    return {
      intent,
      reply: options[Math.floor(Math.random() * options.length)],
    };
  }
}

/** "hiii" -> "hi", "thanksss" -> "thanks", "okkk" -> "ok". */
function collapseElongation(word: string): string {
  return word.replace(/(\p{L})\1{2,}/gu, '$1');
}
