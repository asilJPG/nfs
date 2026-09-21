"use server";

import { currentStaff } from "@/lib/auth";
import { sendMessage } from "@/lib/telegram/api";

const SUPPORT_CHAT_ID = process.env.ADMIN_TELEGRAM_ID || "-1003931689619";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export type SupportTicketResult =
  | { ok: true }
  | { ok: false; message: string };

export async function sendCafeSupportTicket(formData: {
  topic?: string;
  message: string;
  contact?: string;
}): Promise<SupportTicketResult> {
  try {
    const text = formData.message?.trim();
    if (!text) {
      return { ok: false, message: "Пожалуйста, напишите текст обращения." };
    }

    const context = await currentStaff();
    if (!context) {
      return { ok: false, message: "Не удалось определить пользователя. Пожалуйста, авторизуйтесь." };
    }

    const { staff, tenant } = context;
    const roleLabel =
      staff.role === "owner" ? "Владелец" : staff.role === "manager" ? "Менеджер" : "Бариста";
    const roleTag = staff.role === "owner" ? "#владелец" : staff.role === "manager" ? "#менеджер" : "#бариста";

    const notifyText =
      `☕ <b>Обращение от кофейни</b>\n` +
      `#кофейня #поддержка_b2b ${roleTag}\n\n` +
      `📍 <b>Источник:</b> Личный кабинет заведения (web)\n` +
      `🏢 <b>Кофейня:</b> ${escapeHtml(tenant.name)} (<code>${escapeHtml(tenant.slug)}</code>)\n` +
      `👤 <b>Сотрудник:</b> ${escapeHtml(staff.name || "Сотрудник")} · ${roleLabel}\n` +
      (formData.contact ? `📞 <b>Контакты:</b> ${escapeHtml(formData.contact.trim())}\n` : "") +
      (formData.topic ? `📌 <b>Тема:</b> ${escapeHtml(formData.topic.trim())}\n` : "") +
      `\n📝 <b>Сообщение:</b>\n<i>${escapeHtml(text)}</i>`;

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
    const buttons = [];
    if (appUrl) {
      buttons.push([
        { text: `Открыть ${tenant.name}`, url: `${appUrl}/admin/tenants/${tenant.id}` },
      ]);
    }

    if (process.env.TELEGRAM_BOT_TOKEN) {
      await sendMessage({
        chatId: SUPPORT_CHAT_ID,
        text: notifyText,
        buttons: buttons.length > 0 ? buttons : undefined,
      });
    }

    return { ok: true };
  } catch (err) {
    console.error("sendCafeSupportTicket error", err);
    return { ok: false, message: "Не удалось отправить сообщение. Попробуйте ещё раз позже." };
  }
}
