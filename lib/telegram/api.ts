import "server-only";
import { env } from "@/lib/env";

type SendResult =
  | { ok: true }
  | { ok: false; kind: "blocked"; description: string }
  | { ok: false; kind: "rate_limited"; retryAfterSeconds: number }
  | { ok: false; kind: "failed"; description: string };

type TelegramResponse = {
  ok: boolean;
  description?: string;
  error_code?: number;
  parameters?: { retry_after?: number };
  result?: unknown;
};

async function call(method: string, payload: unknown): Promise<TelegramResponse> {
  const res = await fetch(`https://api.telegram.org/bot${env.botToken}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  return (await res.json()) as TelegramResponse;
}

export type OutgoingMessage = {
  chatId: number;
  text: string;
  imageUrl?: string | null;
  button?: { text: string; url: string } | null;
};

/**
 * One broadcast message. Failures are classified so the queue can react:
 * `blocked` retires the customer, `rate_limited` pauses the batch.
 */
export async function sendMessage(message: OutgoingMessage): Promise<SendResult> {
  const markup = message.button
    ? { inline_keyboard: [[{ text: message.button.text, url: message.button.url }]] }
    : undefined;

  const response = message.imageUrl
    ? await call("sendPhoto", {
        chat_id: message.chatId,
        photo: message.imageUrl,
        caption: message.text,
        parse_mode: "HTML",
        reply_markup: markup,
      })
    : await call("sendMessage", {
        chat_id: message.chatId,
        text: message.text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: markup,
      });

  if (response.ok) return { ok: true };

  const description = response.description ?? "unknown error";
  if (response.error_code === 429) {
    return { ok: false, kind: "rate_limited", retryAfterSeconds: response.parameters?.retry_after ?? 5 };
  }
  // 403 = blocked or deactivated; 400 "chat not found" is the same dead end.
  if (response.error_code === 403 || /chat not found|user is deactivated/i.test(description)) {
    return { ok: false, kind: "blocked", description };
  }
  return { ok: false, kind: "failed", description };
}

export async function setWebhook(url: string): Promise<TelegramResponse> {
  return call("setWebhook", {
    url,
    secret_token: env.webhookSecret,
    allowed_updates: ["message", "my_chat_member"],
    drop_pending_updates: true,
  });
}

export async function answerStart(
  chatId: number,
  text: string,
  button: { text: string; webAppUrl: string },
) {
  return call("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [[{ text: button.text, web_app: { url: button.webAppUrl } }]],
    },
  });
}
