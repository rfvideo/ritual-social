import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function truncateAddress(address?: string, chars = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`;
}

export function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}d`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}j`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}h`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}mg`;
  const date = new Date(timestamp);
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatJoinDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
}

export function formatCount(count: number): string {
  if (count < 1000) return String(count);
  if (count < 1_000_000) return `${(count / 1000).toFixed(count % 1000 === 0 ? 0 : 1)}rb`;
  return `${(count / 1_000_000).toFixed(1)}jt`;
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
