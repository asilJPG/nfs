import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Демо-путь для дешёвых меток без крипты. Любой с этой ссылкой может ставить штампы —
// нужно только чтобы у кофейни была хотя бы одна активная метка в базе.
// Используется чтобы показать кофейне, зачем нужен NTAG 424 DNA.
const TOKEN_TTL_MINUTES = 3;

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");
  if (!slug) return problemPage("no_slug", 400);

  const db = supabaseAdmin();

  const { data: tenant } = await db
    .from("stampy_tenants")
    .select("id, slug")
    .eq("slug", slug.toLowerCase())
    .maybeSingle();
  if (!tenant) return problemPage("unknown_tenant", 404);

  const { data: tag } = await db
    .from("stampy_nfc_tags")
    .select("id, venue_id")
    .eq("tenant_id", tenant.id)
    .eq("active", true)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!tag) return problemPage("no_tag", 409);

  const token = randomBytes(18).toString("base64url");
  const { error } = await db.from("stampy_stamp_tokens").insert({
    token,
    tenant_id: tenant.id,
    tag_id: tag.id,
    venue_id: tag.venue_id,
    tap_counter: 0,
    expires_at: new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000).toISOString(),
  });

  if (error) {
    console.error("demo token insert failed", error);
    return problemPage("server", 500);
  }

  return telegramRedirect(token);
}

function telegramRedirect(startParam: string): Response {
  const httpsUrl = `https://t.me/${env.botUsername}/${env.miniAppShortName}?startapp=${encodeURIComponent(startParam)}`;
  const tgUrl = `tg://resolve?domain=${env.botUsername}&appname=${env.miniAppShortName}&startapp=${encodeURIComponent(startParam)}`;

  // iOS Safari упорно открывает t.me как веб-страницу. Через tg://-схему клиент прыгает
  // сразу в приложение, https-адрес — резервный путь если Telegram не установлен.
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Открываем Telegram…</title>
<meta http-equiv="refresh" content="0;url=${tgUrl}">
<style>body{margin:0;min-height:100dvh;display:grid;place-items:center;font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#FFF8F0;color:#2A1E17}</style>
</head><body><p>Открываем Telegram…</p>
<script>
location.replace(${JSON.stringify(tgUrl)});
setTimeout(function(){ location.replace(${JSON.stringify(httpsUrl)}); }, 800);
</script></body></html>`;

  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

const MESSAGES: Record<string, { title: string; body: string }> = {
  no_slug: { title: "Не хватает данных", body: "Ссылка неполная." },
  unknown_tenant: { title: "Кофейня не найдена", body: "Проверьте ссылку с бариста." },
  no_tag: { title: "Метка не настроена", body: "Кофейня не завершила подключение." },
  server: { title: "Что-то пошло не так", body: "Повторите через минуту." },
};

function problemPage(problem: keyof typeof MESSAGES, status: number): Response {
  const { title, body } = MESSAGES[problem];
  const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>body{margin:0;min-height:100dvh;display:grid;place-items:center;font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#FFF8F0;color:#2A1E17;padding:24px;text-align:center}main{max-width:22rem}h1{font-size:1.25rem;margin:0 0 .5rem}p{margin:0;opacity:.75}</style>
</head><body><main><div style="font-size:2.5rem;margin-bottom:1rem">☕</div><h1>${title}</h1><p>${body}</p></main></body></html>`;
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
