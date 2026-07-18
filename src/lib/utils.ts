import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function truncateAddress(address?: string, chars = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`;
}

/**
 * Converts an on-chain timestamp to JS milliseconds. Standard EVM chains
 * report `block.timestamp` in seconds, but this chain appears to report it
 * already in milliseconds — multiplying by 1000 in that case lands ~1000x
 * in the future (e.g. year 58514). This detects which convention produced
 * a plausible "now-ish" result and uses that one instead of assuming.
 */
export function chainTimestampToMs(raw: bigint | number): number {
  const n = Number(raw);
  const asSeconds = n * 1000;
  const YEAR_2100_MS = 4_102_444_800_000;
  return asSeconds > YEAR_2100_MS ? n : asSeconds;
}

export function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w`;
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatJoinDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function formatCount(count: number): string {
  if (count < 1000) return String(count);
  if (count < 1_000_000) return `${(count / 1000).toFixed(count % 1000 === 0 ? 0 : 1)}K`;
  return `${(count / 1_000_000).toFixed(1)}M`;
}

const HASHTAG_RE = /#(\w+)/g;
const MENTION_RE = /@(0x[a-fA-F0-9]{4,40}|\w+)/g;

export function extractHashtags(text: string): string[] {
  return [...text.matchAll(HASHTAG_RE)].map((m) => m[1]);
}

export function extractMentions(text: string): string[] {
  return [...text.matchAll(MENTION_RE)].map((m) => m[1]);
}

/** Renders caption text with hashtags/mentions styled — returns React-friendly segments. */
export function tokenizeCaption(text: string): Array<{ type: 'text' | 'hashtag' | 'mention'; value: string }> {
  const combined = new RegExp(`${HASHTAG_RE.source}|${MENTION_RE.source}`, 'g');
  const segments: Array<{ type: 'text' | 'hashtag' | 'mention'; value: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = combined.exec(text))) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    if (match[0].startsWith('#')) segments.push({ type: 'hashtag', value: match[0] });
    else segments.push({ type: 'mention', value: match[0] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) segments.push({ type: 'text', value: text.slice(lastIndex) });
  return segments;
}
