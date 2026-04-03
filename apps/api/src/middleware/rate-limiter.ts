// Simple in-memory rate limiter for auth endpoints
// Tracks attempts per IP address. No external dependencies needed.

interface RateEntry {
  count: number;
  firstAttempt: number;
}

const attempts = new Map<string, RateEntry>();

const RATE_LIMIT = 5; // max attempts
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export function rateLimitMiddleware(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = attempts.get(ip);

  if (!entry) {
    attempts.set(ip, { count: 1, firstAttempt: now });
    return { allowed: true };
  }

  // Window expired, reset
  if (now - entry.firstAttempt > WINDOW_MS) {
    attempts.set(ip, { count: 1, firstAttempt: now });
    return { allowed: true };
  }

  entry.count++;
  if (entry.count > RATE_LIMIT) {
    const retryAfter = Math.ceil((entry.firstAttempt + WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfter };
  }

  return { allowed: true };
}

// Cleanup old entries (call periodically in production)
export function cleanupRateLimiter() {
  const now = Date.now();
  for (const [ip, entry] of attempts) {
    if (now - entry.firstAttempt > WINDOW_MS) {
      attempts.delete(ip);
    }
  }
}
