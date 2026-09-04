import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

const COOKIE = "stampy_tenant";
const MAX_AGE = 60 * 60 * 24 * 365;

function sign(value: string): string {
  return createHmac("sha256", env.sessionSecret).update(value).digest("base64url");
}

// запоминаем последнюю открытую кофейню — чтобы бренд рисовался ещё до JS
export async function rememberTenant(tenantId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, `${tenantId}.${sign(tenantId)}`, {
    httpOnly: true,
    sameSite: "none",
    secure: true,
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function rememberedTenant(): Promise<string | null> {
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
