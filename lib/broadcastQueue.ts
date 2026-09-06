import "server-only";
import { after } from "next/server";
import { env } from "@/lib/env";

// пинок очереди после каждого батча, ответ не ждём
// after() гарантирует что fetch доиграет после ответа — на Vercel void fetch убивается вместе с request context
export function triggerBroadcastQueue(): void {
  const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : env.appUrl;

  after(async () => {
    try {
      await fetch(`${base}/api/cron/broadcast`, {
        method: "POST",
        headers: { authorization: `Bearer ${env.cronSecret}` },
        cache: "no-store",
      });
    } catch (error) {
      // Не критично: суточный cron всё равно доотправит остаток.
      console.error("broadcast queue trigger failed", error);
    }
  });
}
