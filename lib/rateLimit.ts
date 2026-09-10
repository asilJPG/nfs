import "server-only";

// Простой in-memory скользящий лимит на инстанс функции Vercel.
// Не идеален при масштабировании (n лимитов на n инстансов), но снимает
// самый лобовой брутфорс/спам. Для полноценного лимита — Upstash/KV.

type Window = { count: number; resetAt: number };
const buckets = new Map<string, Window>();

// Автоочистка каждые 5 минут чтобы Map не пух — раз в 5 минут дропаем
// все просроченные ключи одним проходом.
let lastSweep = 0;
const SWEEP_MS = 5 * 60_000;

function sweep(now: number) {
  if (now - lastSweep < SWEEP_MS) return;
  lastSweep = now;
  for (const [key, window] of buckets) {
    if (window.resetAt < now) buckets.delete(key);
  }
}

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

/** N запросов на key за windowSeconds. Возвращает ok или сколько ждать. */
export function rateLimit(key: string, limit: number, windowSeconds: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const window = buckets.get(key);
  if (!window || window.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { ok: true };
  }

  if (window.count >= limit) {
    return { ok: false, retryAfterSeconds: Math.ceil((window.resetAt - now) / 1000) };
  }

  window.count += 1;
  return { ok: true };
}

/** Достаёт IP из заголовков Vercel. */
export function clientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    "unknown"
  );
}
