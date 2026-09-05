import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

// Пометка «сейчас платформенный админ работает от лица владельца X»
// подписана SESSION_SECRET, чтоб её нельзя было подделать.
const COOKIE = "__Host-stampy_impersonate";
const MAX_AGE = 60 * 60 * 2; // 2 часа, потом сбросится

function sign(value: string): string {
  return createHmac("sha256", env.sessionSecret).update("imp:" + value).digest("base64url");
}

export async function setImpersonation(tenantId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, `${tenantId}.${sign(tenantId)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearImpersonation(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function currentImpersonation(): Promise<string | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;

  const separator = raw.lastIndexOf(".");
  if (separator < 1) return null;

  const value = raw.slice(0, separator);
  const given = Buffer.from(raw.slice(separator + 1));
  const expected = Buffer.from(sign(value));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  return value;
}
