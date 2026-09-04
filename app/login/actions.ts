"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { loginToAuthEmail, normalizeLogin } from "@/lib/login";

const schema = z.object({
  login: z.string().trim().min(3).max(40),
  password: z.string().min(1),
  next: z.string().startsWith("/").max(200).optional(),
});

export type SignInError = { message: string };

/** Вход по логину и паролю. Почта в этом флоу не участвует вообще. */
export async function signIn(input: z.input<typeof schema>): Promise<SignInError | never> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { message: "Введите логин и пароль." };

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({
    email: loginToAuthEmail(normalizeLogin(parsed.data.login)),
    password: parsed.data.password,
  });

  // Не подсказываем, что именно не совпало — логин или пароль.
  if (error) return { message: "Неверный логин или пароль." };

  // Платформенных админов пускаем сразу в /admin, кофейне — в /dashboard.
  if (!parsed.data.next) {
    const { data: user } = await supabase.auth.getUser();
    if (user.user) {
      const { data: isAdmin } = await supabase
        .from("stampy_platform_admins")
        .select("auth_user_id")
        .eq("auth_user_id", user.user.id)
        .maybeSingle();
      if (isAdmin) redirect("/admin");
    }
  }

  redirect(parsed.data.next ?? "/dashboard");
}
