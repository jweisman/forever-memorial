const hits = new Map<string, number[]>();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of hits) {
    const recent = timestamps.filter((t) => now - t < 120_000);
    if (recent.length === 0) hits.delete(key);
    else hits.set(key, recent);
  }
}, 300_000);

/**
 * Simple in-memory sliding-window rate limiter.
 * Returns { success, remaining } — caller should return 429 when success is false.
 */
export function rateLimit({
  key,
  limit,
  windowMs,
}: {
  key: string;
  limit: number;
  windowMs: number;
}): { success: boolean; remaining: number } {
  const now = Date.now();
  const timestamps = hits.get(key) ?? [];
  const recent = timestamps.filter((t) => now - t < windowMs);

  if (recent.length >= limit) {
    hits.set(key, recent);
    return { success: false, remaining: 0 };
  }

  recent.push(now);
  hits.set(key, recent);
  return { success: true, remaining: limit - recent.length };
}

/**
 * Extract client IP from request headers (works on Vercel and behind proxies).
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
