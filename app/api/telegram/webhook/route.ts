import { NextResponse, type NextRequest } from "next/server";
import { env, miniAppLink } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { answerStart } from "@/lib/telegram/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Update = {
  message?: {
    chat: { id: number };
    from?: { id: number };
    text?: string;
  };
  my_chat_member?: {
    from: { id: number };
    new_chat_member: { status: string };
  };
};

const WELCOME =
  "Здравствуйте! Здесь живут ваши карты лояльности — штампы за покупки и бесплатные напитки.\n\n" +
  "Чтобы завести карту, отсканируйте QR-код на стойке кофейни или приложите телефон к подставке.";

/**
 * Bot updates. Two things matter to us: greeting someone who found the bot on
 * their own, and noticing when a customer blocks it so broadcasts stop trying.
 */
export async function POST(request: NextRequest) {
  if (request.headers.get("x-telegram-bot-api-secret-token") !== env.webhookSecret) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const update = (await request.json().catch(() => null)) as Update | null;
  if (!update) return NextResponse.json({ ok: true });

  if (update.my_chat_member) {
    const blocked = ["kicked", "left"].includes(update.my_chat_member.new_chat_member.status);
    await supabaseAdmin()
      .from("stampy_customers")
      .update({
        can_message: !blocked,
        blocked_at: blocked ? new Date().toISOString() : null,
      })
      .eq("telegram_id", update.my_chat_member.from.id);
    return NextResponse.json({ ok: true });
  }

  const message = update.message;
  if (message?.text?.startsWith("/start")) {
    const payload = message.text.slice("/start".length).trim();
    const target = payload.startsWith("t_") ? payload : await lastCardOf(message.from?.id);

    await answerStart(message.chat.id, WELCOME, {
      text: target ? "Открыть карту" : "Открыть Stampy",
      url: miniAppLink(target ?? ""),
    });
  }

  return NextResponse.json({ ok: true });
}

/** So a returning customer's button opens the shop they actually visit. */
async function lastCardOf(telegramId: number | undefined): Promise<string | null> {
  if (!telegramId) return null;

  const db = supabaseAdmin();
  const { data: customer } = await db
    .from("stampy_customers")
    .select("id")
    .eq("telegram_id", telegramId)
    .maybeSingle();
  if (!customer) return null;

  const { data } = await db
    .from("stampy_memberships")
    .select("stampy_tenants(slug)")
    .eq("customer_id", customer.id)
    .order("last_stamp_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .returns<{ stampy_tenants: { slug: string } | null }[]>();

  const slug = data?.[0]?.stampy_tenants?.slug;
  return slug ? `t_${slug}` : null;
}
