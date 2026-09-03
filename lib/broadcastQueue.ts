import "server-only";
import { env } from "@/lib/env";

/**
 * Пинает очередь рассылки.
 *
 * Планировщик Vercel на Hobby запускается раз в сутки, поэтому очередь не ждёт
 * его: после постановки рассылки и после каждого отправленного батча вызывается
 * этот запрос, и цепочка тянет сама себя, пока остаются адресаты. Ответ не
 * дожидаемся — иначе действие в кабинете висело бы всё время отправки.
 */
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
