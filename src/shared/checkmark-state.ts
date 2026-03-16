/**
 * Tracks recently-added card positions so that checkmark state
 * persists even when the host site re-renders card elements.
 */

const recentlyAdded = new Map<string, number>();

export const CHECKMARK_DURATION = 1200;

export function markAdded(key: string, now = Date.now()): void {
  recentlyAdded.set(key, now);
}

export function clearMark(key: string): void {
  recentlyAdded.delete(key);
}

export function isRecentlyAdded(key: string, now = Date.now()): boolean {
  const timestamp = recentlyAdded.get(key);
  if (timestamp == null) return false;
  return now - timestamp < CHECKMARK_DURATION;
}

export function resetAll(): void {
  recentlyAdded.clear();
}
