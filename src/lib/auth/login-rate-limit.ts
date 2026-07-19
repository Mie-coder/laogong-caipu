const FAILURE_LIMIT = 5;
const BLOCK_DURATION_MS = 15 * 60_000;
const MAX_ENTRIES = 1_000;

type LoginAttempt = {
  failures: number;
  blockedUntil: number;
  touchedAt: number;
};

export function createLoginRateLimiter(options: { now?: () => number } = {}) {
  const now = options.now ?? Date.now;
  const attempts = new Map<string, LoginAttempt>();

  function pruneExpired(currentTime: number) {
    for (const [key, attempt] of attempts) {
      const expiresAt = attempt.blockedUntil || attempt.touchedAt + BLOCK_DURATION_MS;
      if (expiresAt <= currentTime) attempts.delete(key);
    }
  }

  function removeOldestEntry() {
    let oldestKey: string | undefined;
    let oldestTouchedAt = Number.POSITIVE_INFINITY;
    for (const [key, attempt] of attempts) {
      if (attempt.touchedAt < oldestTouchedAt) {
        oldestKey = key;
        oldestTouchedAt = attempt.touchedAt;
      }
    }
    if (oldestKey !== undefined) attempts.delete(oldestKey);
  }

  return {
    isBlocked(key: string) {
      const currentTime = now();
      pruneExpired(currentTime);
      const attempt = attempts.get(key);
      if (!attempt) return false;
      attempt.touchedAt = currentTime;
      return attempt.blockedUntil > currentTime;
    },

    recordFailure(key: string) {
      const currentTime = now();
      pruneExpired(currentTime);
      const previous = attempts.get(key);
      const failures = (previous?.failures ?? 0) + 1;
      attempts.set(key, {
        failures,
        blockedUntil:
          previous?.blockedUntil || (failures >= FAILURE_LIMIT ? currentTime + BLOCK_DURATION_MS : 0),
        touchedAt: currentTime,
      });
      if (attempts.size > MAX_ENTRIES) removeOldestEntry();
    },

    reset(key: string) {
      attempts.delete(key);
    },
  };
}
