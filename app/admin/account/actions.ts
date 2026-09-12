"use server";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { MIN_PASSWORD_LENGTH } from "@/lib/login";
import { env } from "@/lib/env";

export type ChangePasswordResult = { ok: true; message: string } | { ok: false; message: string };

const schema = z
  .object({
    current: z.string().min(1),
    next: z.string().min(MIN_PASSWORD_LENGTH, `Новый пароль от ${MIN_PASSWORD_LENGTH} символов.`),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, {
    path: ["confirm"],
    message: "Пароли не совпадают.",
  });

export async function changeMyPassword(input: unknown): Promise<ChangePasswordResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Проверьте поля." };
  }
  if (parsed.data.current === parsed.data.next) {
    return { ok: false, message: "Новый пароль совпадает со старым." };
  }

  const { userId } = await requirePlatformAdmin();
  const admin = supabaseAdmin();

  const { data: userRow, error: getErr } = await admin.auth.admin.getUserById(userId);
  if (getErr || !userRow.user?.email) {
    return { ok: false, message: "Не удалось получить данные аккаунта." };
  }
  const email = userRow.user.email;

  // Проверяем старый пароль отдельным клиентом, чтобы не трогать текущую cookie-сессию.
  const probe = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: verifyErr } = await probe.auth.signInWithPassword({
    email,
    password: parsed.data.current,
  });
  if (verifyErr) {
    return { ok: false, message: "Текущий пароль неверный." };
  }

  const { error } = await admin.auth.admin.updateUserById(userId, { password: parsed.data.next });
  if (error) {
    console.error("admin changeMyPassword failed", error);
    return { ok: false, message: "Не удалось сменить пароль." };
  }

  return { ok: true, message: "Пароль обновлён." };
}
