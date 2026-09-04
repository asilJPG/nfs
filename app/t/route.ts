import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { env, miniAppLink } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { SunError, verifyTap } from "@/lib/nfc/sun";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN_TTL_MINUTES = 3;

type TapProblem =
  | "unreadable"
  | "unknown_tag"
  | "tag_disabled"
  | "tag_unassigned"
  | "replay"
  | "server";

const MESSAGES: Record<TapProblem, { title: string; body: string }> = {
  unreadable: {
    title: "Не удалось прочитать метку",
    body: "Попробуйте приложить телефон ещё раз, ровно к центру подставки.",
  },
  unknown_tag: {
    title: "Метка не зарегистрирована",
    body: "Покажите этот экран бариста — метку нужно привязать к заведению.",
  },
  tag_disabled: {
    title: "Метка отключена",
    body: "Эта подставка больше не используется. Обратитесь к бариста.",
  },
  tag_unassigned: {
    title: "Метка ещё не настроена",
    body: "Заведение не завершило подключение. Попробуйте позже.",
  },
  replay: {
    title: "Эта отметка уже использована",
    body: "Приложите телефон к подставке заново — каждое касание работает один раз.",
  },
  server: {
    title: "Что-то пошло не так",
    body: "Повторите попытку через минуту.",
  },
};

function problemPage(problem: TapProblem, status: number): Response {
  const { title, body } = MESSAGES[problem];
  const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; min-height:100dvh; display:grid; place-items:center;
         font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
         background:#FFF8F0; color:#2A1E17; padding:24px; }
  @media (prefers-color-scheme: dark) { body { background:#17110D; color:#F2E8E0; } }
  main { max-width:22rem; text-align:center; }
  h1 { font-size:1.25rem; margin:0 0 .5rem; }
  p { margin:0; opacity:.75; }
  .mark { font-size:2.5rem; margin-bottom:1rem; }
</style></head>
<body><main><div class="mark">☕</div><h1>${title}</h1><p>${body}</p></main></body></html>`;
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

// сюда прошита ссылка каждой метки: проверяем подпись, выдаём одноразовый токен, кидаем в мини-апп
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const picc = params.get("picc_data") ?? params.get("e");
  const cmac = params.get("cmac") ?? params.get("c");

  if (!picc || !cmac) return problemPage("unreadable", 400);

  let tap;
  try {
    tap = verifyTap(env.nfcMasterKey, picc, cmac);
  } catch (error) {
    if (error instanceof SunError) return problemPage("unreadable", 400);
    console.error("tap verification failed", error);
    return problemPage("server", 500);
  }

  const db = supabaseAdmin();
  const { data: tag, error: tagError } = await db
    .from("stampy_nfc_tags")
    .select("id, tenant_id, venue_id, active, last_counter")
    .eq("uid", tap.uid)
    .maybeSingle();

  if (tagError) {
    console.error("tag lookup failed", tagError);
    return problemPage("server", 500);
  }
  if (!tag) return problemPage("unknown_tag", 404);
  if (!tag.active) return problemPage("tag_disabled", 410);
  if (!tag.tenant_id) return problemPage("tag_unassigned", 409);

  // счётчик метки только растёт — условный апдейт отсекает и повтор ссылки, и одновременный тап с двух устройств
  const { data: advanced, error: counterError } = await db
    .from("stampy_nfc_tags")
    .update({ last_counter: tap.counter, last_seen_at: new Date().toISOString() })
    .eq("id", tag.id)
    .lt("last_counter", tap.counter)
    .select("id");

  if (counterError) {
    console.error("counter update failed", counterError);
    return problemPage("server", 500);
  }
  if (!advanced?.length) return problemPage("replay", 409);

  const token = randomBytes(18).toString("base64url");
  const { error: tokenError } = await db.from("stampy_stamp_tokens").insert({
    token,
    tenant_id: tag.tenant_id,
    tag_id: tag.id,
    venue_id: tag.venue_id,
    tap_counter: tap.counter,
    expires_at: new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000).toISOString(),
  });

  if (tokenError) {
    console.error("token insert failed", tokenError);
    return problemPage("server", 500);
  }

  return NextResponse.redirect(miniAppLink(token), {
    status: 302,
    headers: { "cache-control": "no-store" },
  });
}
