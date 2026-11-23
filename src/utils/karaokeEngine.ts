// FastArt Kinetic Karaoke Engine
// Word-by-word active timing, CapCut-style kinetic animations & contextual auto-emoji badges

export interface KaraokeWordTiming {
  word: string;
  start: number; // in seconds relative to clip start
  end: number;   // in seconds relative to clip start
  emoji?: string;
}

const EMOJI_KEYWORD_MAP: Record<string, string> = {
  money: '💰',
  cash: '💰',
  dollar: '💵',
  rich: '🤑',
  profit: '📈',
  wealth: '💰',
  fire: '🔥',
  flame: '🔥',
  lit: '🔥',
  hot: '🔥',
  love: '❤️',
  heart: '❤️',
  like: '👍',
  funny: '😂',
  haha: '😂',
  lol: '😂',
  laugh: '🤣',
  king: '👑',
  queen: '👑',
  boss: '👑',
  winner: '🏆',
  star: '⭐',
  super: '🌟',
  best: '🥇',
  wow: '🤯',
  omg: '😱',
  crazy: '🤪',
  insane: '🤯',
  target: '🎯',
  goal: '🎯',
  focus: '🎯',
  time: '⏰',
  clock: '⏱️',
  wait: '⏳',
  fast: '⚡',
  speed: '⚡',
  strong: '💪',
  muscle: '💪',
  power: '⚡',
  gym: '🏋️',
  car: '🏎️',
  party: '🎉',
  celebrate: '🥳',
  skull: '💀',
  dead: '💀',
  rocket: '🚀',
  moon: '🚀',
  perfect: '💯',
  eyes: '👀',
  look: '👀',
  watch: '👀',
  idea: '💡',
  think: '🧠',
  check: '✅',
  done: '✅',
  yes: '🙌',
  music: '🎵',
  song: '🎶',
};

/**
 * Returns an emoji matching the word or null if no contextual match.
 */
export function getContextualEmoji(rawWord: string): string | null {
  if (!rawWord) return null;
  const clean = rawWord.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (EMOJI_KEYWORD_MAP[clean]) {
    return EMOJI_KEYWORD_MAP[clean];
  }
  return null;
}

/**
 * Generates uniform or timestamped word intervals for kinetic karaoke captions.
 */
export function buildKaraokeWordTimings(
  text: string,
  duration: number,
  existingWords?: { word: string; start: number; end: number }[],
  autoEmoji: boolean = true
): KaraokeWordTiming[] {
  if (!text || duration <= 0) return [];

  if (existingWords && existingWords.length > 0) {
    return existingWords.map((w) => {
      const emoji = autoEmoji ? (getContextualEmoji(w.word) || undefined) : undefined;
      return {
        word: w.word,
        start: w.start,
        end: w.end,
        emoji,
      };
    });
  }

  // Tokenize text into words
  const rawWords = text.trim().split(/\s+/).filter(Boolean);
  if (rawWords.length === 0) return [];

  const timePerWord = duration / rawWords.length;
  return rawWords.map((word, idx) => {
    const start = Number((idx * timePerWord).toFixed(2));
    const end = Number(((idx + 1) * timePerWord).toFixed(2));
    const emoji = autoEmoji ? (getContextualEmoji(word) || undefined) : undefined;
    return { word, start, end, emoji };
  });
}

/**
 * Evaluates active word index for a given elapsed time.
 */
export function getActiveKaraokeIndex(
  timings: KaraokeWordTiming[],
  elapsed: number
): number {
  if (!timings || timings.length === 0) return -1;
  for (let i = 0; i < timings.length; i++) {
    if (elapsed >= timings[i].start && elapsed < timings[i].end) {
      return i;
    }
  }
  // If slightly past the last word end, keep last word active
  if (elapsed >= timings[timings.length - 1].end) {
    return timings.length - 1;
  }
  return 0;
}

