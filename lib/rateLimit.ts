/**
 * Rate limit em memória (por instância serverless).
 * Complementa TTL curto do código OTP; reduz brute force em verify.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function prune(key: string, bucket: Bucket, now: number) {
  if (now >= bucket.resetAt) {
    buckets.delete(key);
    return null;
  }
  return bucket;
}

export function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number,
): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const existing = buckets.get(key);
  const bucket = existing ? prune(key, existing, now) : null;

  if (!bucket) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (bucket.count >= maxAttempts) {
    const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000);
    return { allowed: false, retryAfterSec };
  }

  bucket.count += 1;
  return { allowed: true };
}

export function resetRateLimit(key: string) {
  buckets.delete(key);
}
