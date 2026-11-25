export type EmoteType = 'laugh' | 'wave' | 'dance' | 'clap' | 'cry';

export type ReportReason =
  | 'inappropriate_chat'
  | 'harassment'
  | 'spam'
  | 'cheating'
  | 'other';

export const MAX_CHAT_LENGTH = 140;
export const MAX_REPORT_DETAILS_LENGTH = 120;

export interface QuickChatOption {
  id: string;
  text: string;
}

export const QUICK_CHAT_MESSAGES: QuickChatOption[] = [
  { id: 'come_find_me', text: 'Come find me!' },
  { id: 'where_are_you', text: 'Where are you?' },
  { id: 'lets_play', text: "Let's play!" },
  { id: 'found_someone', text: 'I found someone!' },
  { id: 'wait_for_me', text: 'Wait for me!' },
  { id: 'good_spot', text: 'Nice hiding spot!' },
];

export interface EmoteDefinition {
  id: EmoteType;
  label: string;
  icon: string;
  bubbleText: string;
  chatAction: string;
}

export const EMOTE_DEFINITIONS: EmoteDefinition[] = [
  {
    id: 'laugh',
    label: 'Laugh',
    icon: '😂',
    bubbleText: '😂 Ha ha ha!',
    chatAction: 'is laughing 😂',
  },
  {
    id: 'wave',
    label: 'Wave',
    icon: '👋',
    bubbleText: '👋 Hello!',
    chatAction: 'waved 👋',
  },
  {
    id: 'dance',
    label: 'Dance',
    icon: '💃',
    bubbleText: '💃 Dancing!',
    chatAction: 'started dancing 💃',
  },
  {
    id: 'clap',
    label: 'Clap',
    icon: '👏',
    bubbleText: '👏 Wah wah!',
    chatAction: 'is clapping 👏',
  },
  {
    id: 'cry',
    label: 'Cry',
    icon: '😭',
    bubbleText: '😭 Oh no!',
    chatAction: 'is crying 😭',
  },
];

export const ALLOWED_EMOTES = new Set<EmoteType>(
  EMOTE_DEFINITIONS.map((e) => e.id),
);

export const REPORT_REASON_OPTIONS: Array<{ id: ReportReason; label: string }> =
  [
    { id: 'inappropriate_chat', label: 'Bad language / Inappropriate chat' },
    { id: 'harassment', label: 'Harassment or bullying' },
    { id: 'spam', label: 'Spamming messages or emotes' },
    { id: 'cheating', label: 'Unfair play / Glitching' },
    { id: 'other', label: 'Other issue' },
  ];

export const ALLOWED_REPORT_REASONS = new Set<ReportReason>(
  REPORT_REASON_OPTIONS.map((r) => r.id),
);

export function getEmoteDefinition(id: EmoteType): EmoteDefinition {
  return (
    EMOTE_DEFINITIONS.find((e) => e.id === id) ?? EMOTE_DEFINITIONS[0]
  );
}

// Basic family-friendly profanity & abusive-word filter list (English + common Hinglish)
const BLOCKED_TERMS: string[] = [
  'fuck',
  'shit',
  'bitch',
  'asshole',
  'bastard',
  'dick',
  'pussy',
  'cunt',
  'slut',
  'whore',
  'faggot',
  'nigger',
  'retard',
  'moron',
  'idiot',
  'stupid',
  'dumbass',
  'bullshit',
  'motherfucker',
  'madarchod',
  'behenchod',
  'bhenchod',
  'chutiya',
  'chutiye',
  'bhosdike',
  'bhosdi',
  'gandu',
  'harami',
  'kamina',
  'kamine',
  'kutta',
  'kutte',
  'kutti',
  'saala',
  'saale',
  'randi',
  'mc',
  'bc',
  'bkl',
  'mkc',
  'kill yourself',
  'kys',
];

function normalizeToken(word: string): string {
  return word
    .toLowerCase()
    .replace(/[@4]/g, 'a')
    .replace(/[3]/g, 'e')
    .replace(/[1!|]/g, 'i')
    .replace(/[0]/g, 'o')
    .replace(/[$5]/g, 's')
    .replace(/[7]/g, 't')
    .replace(/[^a-z]/g, '')
    .replace(/(.)\1{2,}/g, '$1$1');
}

const SINGLE_WORD_BLOCKSET = new Set(
  BLOCKED_TERMS.filter((t) => !t.includes(' ')),
);
const PHRASE_BLOCKLIST = BLOCKED_TERMS.filter((t) => t.includes(' '));

export interface FilteredChatResult {
  text: string;
  wasFiltered: boolean;
  empty: boolean;
}

export function filterChatMessage(raw: unknown): FilteredChatResult {
  if (typeof raw !== 'string') {
    return { text: '', wasFiltered: false, empty: true };
  }

  // Strip control characters, zero-width chars, and collapse whitespace
  let cleaned = raw
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\uFEFF]/g, '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_CHAT_LENGTH);

  if (!cleaned) {
    return { text: '', wasFiltered: false, empty: true };
  }

  let wasFiltered = false;

  // Mask external URLs to prevent link spam
  const urlRegex = /\b(?:https?:\/\/|www\.)\S+/gi;
  if (urlRegex.test(cleaned)) {
    cleaned = cleaned.replace(urlRegex, '[link removed]');
    wasFiltered = true;
  }

  // Filter multi-word abusive phrases
  for (const phrase of PHRASE_BLOCKLIST) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b${escaped}\\b`, 'gi');
    if (re.test(cleaned)) {
      cleaned = cleaned.replace(re, '***');
      wasFiltered = true;
    }
  }

  // Filter single-word profanity with basic leetspeak & repeated-char normalization
  const tokens = cleaned.split(' ');
  const sanitizedTokens = tokens.map((tok) => {
    const norm = normalizeToken(tok);
    if (!norm) return tok;
    const dedup = norm.replace(/(.)\1+/g, '$1');
    if (
      SINGLE_WORD_BLOCKSET.has(norm) ||
      (dedup.length >= 3 && SINGLE_WORD_BLOCKSET.has(dedup))
    ) {
      wasFiltered = true;
      return '***';
    }
    return tok;
  });

  return {
    text: sanitizedTokens.join(' ').slice(0, MAX_CHAT_LENGTH),
    wasFiltered,
    empty: false,
  };
}
