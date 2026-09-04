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

/**
 * Development escape hatch: lets the card render in a plain browser, with no
 * Telegram around it. Refuses to exist in a production build, and stays off
 * until DEV_TELEGRAM_ID is set on purpose.
 */
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

/** verifyInitData, but falling back to the dev user when one is configured. */
export function resolveUser(raw: string | null | undefined): TelegramUser {
  if (!raw || raw === "dev") {
    const fallback = devUser();
    if (fallback) return fallback;
  }
  return verifyInitData(raw).user;
}

/**
 * Verifies the signed payload Telegram hands the mini app.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 * This is the only proof of identity a customer ever presents — nothing that
 * comes out of here may be taken from the request body instead.
 */
export function verifyInitData(raw: string | null | undefined): InitData {
  if (!raw) throw new InitDataError("missing");

  const params = new URLSearchParams(raw);
  const hash = params.get("hash");
  if (!hash) throw new InitDataError("malformed");

  params.delete("hash");
  params.delete("signature"); // Ed25519 third-party check, not part of the HMAC

  const checkString = [...params.entries()]
    .map(([key, value]) => [key, value] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secret = createHmac("sha256", "WebAppData").update(env.botToken).digest();
  const expected = createHmac("sha256", secret).update(checkString).digest();
  const given = Buffer.from(hash, "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    const err = new InitDataError("bad_signature");
    (err as unknown as { detail: unknown }).detail = {
      tokenLen: env.botToken.length,
      tokenTail: env.botToken.slice(-6),
      hashGiven: hash,
      hashExpected: expected.toString("hex"),
    };
    throw err;
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

/** Profile fields we mirror into `customers`. */
export function profileOf(user: TelegramUser) {
  return {
    first_name: user.first_name ?? null,
    last_name: user.last_name ?? null,
    username: user.username ?? null,
    photo_url: user.photo_url ?? null,
    language_code: user.language_code ?? null,
  };
}
