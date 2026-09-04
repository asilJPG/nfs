import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

export type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
  is_premium?: boolean;
};

export type InitData = {
  user: TelegramUser;
  startParam?: string;
  authDate: Date;
  queryId?: string;
};

export class InitDataError extends Error {
  constructor(readonly code: "missing" | "malformed" | "bad_signature" | "stale") {
    super(code);
  }
}

const MAX_AGE_SECONDS = 24 * 60 * 60;

// dev-режим: карта в обычном браузере, без Telegram. В prod-сборке молча возвращает null
export function devUser(): TelegramUser | null {
  if (process.env.NODE_ENV === "production") return null;

  const id = Number(process.env.DEV_TELEGRAM_ID);
  if (!Number.isInteger(id) || id <= 0) return null;

  return {
    id,
    first_name: process.env.DEV_TELEGRAM_NAME ?? "Тестовый гость",
    username: "dev_tester",
    language_code: "ru",
  };
}

export function resolveUser(raw: string | null | undefined): TelegramUser {
  if (!raw || raw === "dev") {
    const fallback = devUser();
    if (fallback) return fallback;
  }
  return verifyInitData(raw).user;
}

// единственный источник идентичности гостя — брать что-то из тела запроса вместо этого нельзя
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
export function verifyInitData(raw: string | null | undefined): InitData {
  if (!raw) throw new InitDataError("missing");

  const params = new URLSearchParams(raw);
  const hash = params.get("hash");
  if (!hash) throw new InitDataError("malformed");

  params.delete("hash");

  const checkString = [...params.entries()]
    .map(([key, value]) => [key, value] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secret = createHmac("sha256", "WebAppData").update(env.botToken).digest();
  const expected = createHmac("sha256", secret).update(checkString).digest();
  const given = Buffer.from(hash, "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw new InitDataError("bad_signature");
  }

  const authDateRaw = Number(params.get("auth_date"));
  if (!Number.isFinite(authDateRaw)) throw new InitDataError("malformed");
  if (Date.now() / 1000 - authDateRaw > MAX_AGE_SECONDS) throw new InitDataError("stale");

  const userRaw = params.get("user");
  if (!userRaw) throw new InitDataError("malformed");

  let user: TelegramUser;
  try {
    user = JSON.parse(userRaw) as TelegramUser;
  } catch {
    throw new InitDataError("malformed");
  }
  if (typeof user.id !== "number") throw new InitDataError("malformed");

  return {
    user,
    startParam: params.get("start_param") ?? undefined,
    authDate: new Date(authDateRaw * 1000),
    queryId: params.get("query_id") ?? undefined,
  };
}

// поля профиля, которые дублируем в stampy_customers
export function profileOf(user: TelegramUser) {
  return {
    first_name: user.first_name ?? null,
    last_name: user.last_name ?? null,
    username: user.username ?? null,
    photo_url: user.photo_url ?? null,
    language_code: user.language_code ?? null,
  };
}
