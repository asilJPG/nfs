"use server";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loginToAuthEmail, MIN_PASSWORD_LENGTH } from "@/lib/login";
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

// Владелец/управляющий сам меняет свой пароль. Бариста сюда не пускают
// на уровне requireRole — ему пароль выдаёт руководитель.
export async function changeMyPassword(input: unknown): Promise<ChangePasswordResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Проверьте поля." };
  }

  const { staff } = await requireRole("owner", "manager");
  if (!staff.auth_user_id) {
    return { ok: false, message: "У аккаунта не привязан вход." };
  }
  if (parsed.data.current === parsed.data.next) {
    return { ok: false, message: "Новый пароль совпадает со старым." };
  }

  // Проверяем старый пароль отдельным анон-клиентом без сохранения сессии —
  // иначе signInWithPassword через supabaseServer() перезаписал бы текущую
  // cookie новой сессией, и на UI мог бы «потеряться» impersonation.
  const probe = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: verifyErr } = await probe.auth.signInWithPassword({
    email: loginToAuthEmail(staff.username),
    password: parsed.data.current,
  });
  if (verifyErr) {
    return { ok: false, message: "Текущий пароль неверный." };
  }

  const { error } = await supabaseAdmin().auth.admin.updateUserById(staff.auth_user_id, {
    password: parsed.data.next,
  });
  if (error) {
    console.error("changeMyPassword failed", error);
    return { ok: false, message: "Не удалось сменить пароль." };
  }

  return { ok: true, message: "Пароль обновлён." };
}
