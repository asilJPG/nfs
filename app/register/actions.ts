"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loginToAuthEmail, LOGIN_PATTERN, MIN_PASSWORD_LENGTH, normalizeLogin } from "@/lib/login";
import { SLUG_PATTERN } from "@/lib/slug";
import type { Brand, CreateTenantResult } from "@/types/db";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Цвет должен быть в формате #RRGGBB");

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().regex(SLUG_PATTERN, "Адрес: латиница, цифры и дефис, от 3 символов"),
  login: z.string().trim().toLowerCase().regex(LOGIN_PATTERN, "Логин: латиница, цифры, точка, дефис"),
  password: z.string().min(MIN_PASSWORD_LENGTH, `Пароль от ${MIN_PASSWORD_LENGTH} символов`),
  venueName: z.string().trim().max(80).optional(),
  stamps: z.coerce.number().int().min(2).max(20),
  reward: z.string().trim().min(1).max(60),
  brand: z.object({
    primary: hex,
    bg: hex,
    surface: hex,
    text: hex,
    accent: hex,
    card_style: z.enum(["circles", "cups", "hearts", "stars"]),
  }),
});

export type RegisterInput = z.input<typeof schema>;
export type RegisterError = { field?: string; message: string };

const FAILURES: Record<string, string> = {
  slug_taken: "Такой адрес карты уже занят — попробуйте другой.",
  username_taken: "Такой логин уже занят.",
  already_has_tenant: "К этому аккаунту уже привязана кофейня.",
};

/**
 * Регистрация без почты: аккаунт создаётся админским API со служебным адресом
 * и подтверждённым флагом, поэтому Supabase не отправляет ни одного письма.
 * Дальше сразу вход по паролю и создание кофейни в одной транзакции.
 */
export async function registerTenant(input: RegisterInput): Promise<RegisterError | never> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { field: String(issue.path[0] ?? ""), message: issue.message };
  }

  const login = normalizeLogin(parsed.data.login);
  const admin = supabaseAdmin();

  const { data: free } = await admin.rpc("username_available", { p_username: login });
  if (free === false) return { field: "login", message: FAILURES.username_taken };

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: loginToAuthEmail(login),
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { login, tenant_name: parsed.data.name },
  });

  if (createError || !created.user) {
    if (createError?.message?.includes("already been registered")) {
      return { field: "login", message: FAILURES.username_taken };
    }
    console.error("createUser failed", createError);
    return { message: "Не удалось создать аккаунт. Попробуйте ещё раз." };
  }

  const supabase = await supabaseServer();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: loginToAuthEmail(login),
    password: parsed.data.password,
  });
  if (signInError) {
    await admin.auth.admin.deleteUser(created.user.id);
    console.error("post-register sign in failed", signInError);
    return { message: "Аккаунт создан, но войти не удалось. Попробуйте войти вручную." };
  }

  const { data, error } = await supabase.rpc("create_tenant", {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
    p_username: login,
    p_venue_name: parsed.data.venueName ?? null,
    p_brand: parsed.data.brand as Brand,
    p_stamps: parsed.data.stamps,
    p_reward: parsed.data.reward,
  });

  if (error) {
    console.error("create_tenant failed", error);
    return { message: "Не удалось создать кофейню. Попробуйте ещё раз." };
  }

  const result = data as CreateTenantResult;
  if (!result.ok) {
    // Аккаунт без кофейни бесполезен — убираем, чтобы логин снова стал свободен.
    await admin.auth.admin.deleteUser(created.user.id);
    await supabase.auth.signOut();
    return {
      field: result.code === "slug_taken" ? "slug" : result.code === "username_taken" ? "login" : undefined,
      message: FAILURES[result.code] ?? "Не получилось.",
    };
  }

  redirect("/dashboard?welcome=1");
}
