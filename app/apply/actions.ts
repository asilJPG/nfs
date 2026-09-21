"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendMessage } from "@/lib/telegram/api";
import { env } from "@/lib/env";
import { clientIp, rateLimit } from "@/lib/rateLimit";

export type ApplyResult = { ok: true } | { ok: false; message: string };

const schema = z.object({
  cafe_name: z.string().trim().min(2).max(80),
  city: z.string().trim().max(60).optional(),
  contact_name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(5).max(30),
  telegram: z.string().trim().max(60).optional(),
  message: z.string().trim().max(500).optional(),
});

const PER_PHONE_PER_DAY = 3;

export async function submitApplication(input: unknown): Promise<ApplyResult> {
  try {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Проверьте поля." };
    }

    // Спам по IP: даже если бот меняет телефоны, лимит на источник срабатывает.
    // 10 заявок в час на IP — с запасом на честные повторы через VPN.
    let ip = "unknown";
    try {
      ip = clientIp(await headers());
    } catch {
      // headers() fallback
    }

    const gate = rateLimit(`apply:${ip}`, 10, 3600);
    if (!gate.ok) {
      return { ok: false, message: "Слишком много заявок. Попробуйте позже." };
    }

    const db = supabaseAdmin();
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { count } = await db
      .from("stampy_applications")
      .select("id", { count: "exact", head: true })
      .eq("phone", parsed.data.phone)
      .gte("created_at", dayAgo);

    if ((count ?? 0) >= PER_PHONE_PER_DAY) {
      return { ok: false, message: "Слишком много заявок с этого номера. Мы свяжемся с вами." };
    }

    const { error } = await db.from("stampy_applications").insert({
      cafe_name: parsed.data.cafe_name,
      city: parsed.data.city || null,
      contact_name: parsed.data.contact_name,
      phone: parsed.data.phone,
      telegram: parsed.data.telegram || null,
      message: parsed.data.message || null,
    });

    if (error) {
      console.error("submitApplication db error", error);
      return { ok: false, message: "Не удалось сохранить заявку. Попробуйте ещё раз." };
    }

    // уведомление в Telegram (в группу/канал или админу, не роняет заявку при ошибке бота)
    try {
      const notifyChatId = (process.env.ADMIN_TELEGRAM_ID || "-1003931689619").trim();
      if (notifyChatId && process.env.TELEGRAM_BOT_TOKEN) {
        const tgContact = parsed.data.telegram
          ? parsed.data.telegram.startsWith("@")
            ? parsed.data.telegram
            : `@${parsed.data.telegram.replace(/^https?:\/\/t\.me\//, "")}`
          : "";

        const text =
          `⚡️ <b>Новая заявка на подключение</b>\n` +
          `#заявка #новая_кофейня #лид\n\n` +
          `📍 <b>Источник:</b> Сайт (форма подключения)\n` +
          `☕ <b>Кофейня:</b> ${escapeHtml(parsed.data.cafe_name)}${parsed.data.city ? ` (${escapeHtml(parsed.data.city)})` : ""}\n` +
          `👤 <b>Контактное лицо:</b> ${escapeHtml(parsed.data.contact_name)}\n` +
          `📞 <b>Телефон:</b> ${escapeHtml(parsed.data.phone)}\n` +
          (tgContact ? `💬 <b>Telegram:</b> ${escapeHtml(tgContact)}\n` : "") +
          (parsed.data.message ? `\n📝 <b>Комментарий:</b>\n<i>${escapeHtml(parsed.data.message)}</i>` : "");

        const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
        const buttons = [];
        if (tgContact && tgContact.startsWith("@")) {
          buttons.push({ text: "Написать в Telegram", url: `https://t.me/${tgContact.replace(/^@/, "")}` });
        }
        if (appUrl) {
          buttons.push({ text: "Открыть заявки в админке", url: `${appUrl}/admin/applications` });
        }

        void sendMessage({
          chatId: notifyChatId,
          text,
          buttons: buttons.length > 0 ? [buttons] : undefined,
        }).catch((err) => console.warn("Telegram notify error", err));
      }
    } catch (notifyErr) {
      console.warn("Telegram notification skipped", notifyErr);
    }

    return { ok: true };
  } catch (err) {
    console.error("submitApplication fatal error", err);
    return { ok: false, message: "Произошла ошибка при отправке заявки. Пожалуйста, попробуйте позже." };
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
