import "server-only";
import { env } from "@/lib/env";

// пинок очереди после каждого батча, ответ не ждём
export function triggerBroadcastQueue(): void {
  const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : env.appUrl;

  void fetch(`${base}/api/cron/broadcast`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.cronSecret}` },
    cache: "no-store",
  }).catch((error) => {
    // Не критично: суточный cron всё равно доотправит остаток.
    console.error("broadcast queue trigger failed", error);
  });
}
