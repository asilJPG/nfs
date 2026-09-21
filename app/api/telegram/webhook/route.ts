import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { answerStart, sendMessage } from "@/lib/telegram/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPPORT_CHAT_ID = process.env.ADMIN_TELEGRAM_ID || "-1003931689619";

type Update = {
  message?: {
    chat: { id: number; type?: string };
    from?: {
      id: number;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
    text?: string;
  };
  my_chat_member?: {
    chat: { id: number; type: string };
    from: { id: number };
    new_chat_member: { status: string };
  };
};

const WELCOME_WITH_CARD = "Ваша карта готова — нажмите, чтобы открыть.";
const WELCOME_EMPTY =
  "Здесь живут ваши карты лояльности — штампы за покупки и бесплатные напитки.\n\n" +
  "Приложите телефон к NFC-подставке на стойке кофейни, чтобы начать.";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// апдейты бота: приветствие на /start, помощь на /help, поддержка на /support и любые вопросы
export async function POST(request: NextRequest) {
  if (request.headers.get("x-telegram-bot-api-secret-token") !== env.webhookSecret) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const update = (await request.json().catch(() => null)) as Update | null;
  if (!update) return NextResponse.json({ ok: true });

  if (update.my_chat_member) {
    // важно: в private chat_id === telegram_id гостя, from.id — актёр (может отличаться в группах)
    if (update.my_chat_member.chat.type === "private") {
      const blocked = ["kicked", "left"].includes(update.my_chat_member.new_chat_member.status);
      await supabaseAdmin()
        .from("stampy_customers")
        .update({
          can_message: !blocked,
          blocked_at: blocked ? new Date().toISOString() : null,
        })
        .eq("telegram_id", update.my_chat_member.chat.id);
    }
    return NextResponse.json({ ok: true });
  }

  const message = update.message;
  if (!message || !message.text) return NextResponse.json({ ok: true });

  const text = message.text.trim();
  const chatId = message.chat.id;
  const from = message.from;
  const base = env.appUrl.replace(/\/$/, "");

  if (text.startsWith("/start")) {
    const payload = text.slice("/start".length).trim();
    const target = payload.startsWith("t_") ? payload : await lastCardOf(from?.id);

    if (target) {
      await answerStart(chatId, WELCOME_WITH_CARD, {
        text: "Открыть карту",
        webAppUrl: `${base}/card?startapp=${encodeURIComponent(target)}`,
      });
    } else {
      await answerStart(chatId, WELCOME_EMPTY, {
        text: "Открыть Stampy",
        webAppUrl: `${base}/card`,
      });
    }
  } else if (text.startsWith("/help")) {
    await answerStart(
      chatId,
      "<b>Как пользоваться Stampy:</b>\n\n" +
        "1. Приложите телефон к NFC-подставке на стойке кофейни — штамп начисляется сразу.\n" +
        "2. Когда карта заполнена — покажите QR-код бариста для получения награды.\n" +
        "3. Все ваши карты и награды доступны по кнопке «Мои карты» ниже.\n\n" +
        "💬 <i>Нужна помощь или возник вопрос? Напишите <code>/support ваш вопрос</code> или просто отправьте сообщение в этот чат — поддержка ответит вам!</i>",
      {
        text: "Мои карты",
        webAppUrl: `${base}/card`,
      },
    );
  } else if (text.startsWith("/support") || !text.startsWith("/")) {
    // Пользователь обратился в поддержку через /support <вопрос> или обычным текстом
    const userQuery = text.startsWith("/support") ? text.slice("/support".length).trim() : text;

    if (!userQuery) {
      await answerStart(
        chatId,
        "<b>Служба поддержки Stampy</b>\n\nНапишите ваш вопрос прямо в ответном сообщении или командой:\n<code>/support ваш вопрос</code>\n\nМы сразу получим обращение и ответим вам.",
        {
          text: "Мои карты",
          webAppUrl: `${base}/card`,
        },
      );
      return NextResponse.json({ ok: true });
    }

    // Собираем данные пользователя и отправляем в чат поддержки
    const userDetails = await getUserSupportContext(from?.id);
    const fullName = [from?.first_name, from?.last_name].filter(Boolean).join(" ") || "Пользователь";
    const username = from?.username ? `@${from.username}` : "нет username";

    const notifyText =
      `💬 <b>Вопрос в поддержку из Telegram-бота</b>\n\n` +
      `👤 <b>От:</b> ${escapeHtml(fullName)} (${escapeHtml(username)})\n` +
      `🆔 <b>Telegram ID:</b> <code>${from?.id ?? chatId}</code>\n` +
      (userDetails.cafeInfo ? `☕ <b>Кофейня:</b> ${escapeHtml(userDetails.cafeInfo)}\n` : "") +
      `\n📝 <b>Сообщение:</b>\n<i>${escapeHtml(userQuery)}</i>`;

    const buttons: { text: string; url?: string }[][] = [];
    if (from?.username) {
      buttons.push([{ text: `Ответить ${username}`, url: `https://t.me/${from.username}` }]);
    } else if (from?.id) {
      buttons.push([{ text: "Открыть профиль", url: `tg://user?id=${from.id}` }]);
    }

    // Отправляем в рабочий чат поддержки
    void sendMessage({
      chatId: SUPPORT_CHAT_ID,
      text: notifyText,
      buttons: buttons.length > 0 ? buttons : undefined,
    }).catch((err) => console.warn("Support notify error", err));

    // Отвечаем пользователю в боте
    await answerStart(
      chatId,
      "✅ <b>Ваше обращение принято!</b>\n\nМы передали ваш вопрос в службу поддержки Stampy. Мы свяжемся с вами в Telegram в ближайшее время.",
      {
        text: "Открыть мои карты",
        webAppUrl: `${base}/card`,
      },
    );
  }

  return NextResponse.json({ ok: true });
}

// возвращающийся гость получает кнопку на последнюю кофейню, где ставил штамп
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

// Получаем контекст пользователя: в каких кофейнях зарегистрирован или является ли сотрудником
async function getUserSupportContext(telegramId: number | undefined): Promise<{ cafeInfo: string | null }> {
  if (!telegramId) return { cafeInfo: null };

  try {
    const db = supabaseAdmin();
    const { data: customer } = await db
      .from("stampy_customers")
      .select("id")
      .eq("telegram_id", telegramId)
      .maybeSingle();

    if (!customer) return { cafeInfo: null };

    const { data: memberships } = await db
      .from("stampy_memberships")
      .select("stampy_tenants(name, slug)")
      .eq("customer_id", customer.id)
      .order("last_stamp_at", { ascending: false, nullsFirst: false })
      .limit(3)
      .returns<{ stampy_tenants: { name: string; slug: string } | null }[]>();

    const names = (memberships || [])
      .map((m) => m.stampy_tenants?.name)
      .filter(Boolean)
      .join(", ");

    return { cafeInfo: names || null };
  } catch {
    return { cafeInfo: null };
  }
}
