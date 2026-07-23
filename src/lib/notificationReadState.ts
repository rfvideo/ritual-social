const KEY_PREFIX = 'ritual-social:notifications-last-seen:';

export function getNotificationsLastSeenAt(address: string | undefined): number {
  if (!address) return 0;
  try {
    const raw = localStorage.getItem(KEY_PREFIX + address.toLowerCase());
    return raw ? Number(raw) : 0;
  } catch {
    return 0;
  }
}

export function markNotificationsSeenNow(address: string | undefined): void {
  if (!address) return;
  try {
    localStorage.setItem(KEY_PREFIX + address.toLowerCase(), String(Date.now()));
  } catch {
    // localStorage unavailable (e.g. private browsing) — the red badge just
    // won't persist across reloads, which is a harmless degradation.
  }
}
