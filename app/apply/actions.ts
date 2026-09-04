"use server";

import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type ApplyResult = { ok: true } | { ok: false; message: string };

const schema = z.object({
  cafe_name: z.string().trim().min(2).max(80),
  city: z.string().trim().max(60).optional(),
  contact_name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(5).max(30),
  telegram: z.string().trim().max(60).optional(),
  message: z.string().trim().max(500).optional(),
});

const PER_PHONE_PER_DAY = 3;

export async function submitApplication(input: unknown): Promise<ApplyResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Проверьте поля." };
  }

  const db = supabaseAdmin();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count } = await db
    .from("stampy_applications")
    .select("id", { count: "exact", head: true })
    .eq("phone", parsed.data.phone)
    .gte("created_at", dayAgo);

  if ((count ?? 0) >= PER_PHONE_PER_DAY) {
    return { ok: false, message: "Слишком много заявок с этого номера. Мы получим её позже." };
  }

  const { error } = await db.from("stampy_applications").insert({
    cafe_name: parsed.data.cafe_name,
    city: parsed.data.city || null,
    contact_name: parsed.data.contact_name,
    phone: parsed.data.phone,
    telegram: parsed.data.telegram || null,
    message: parsed.data.message || null,
  });

  if (error) {
    console.error("submitApplication failed", error);
    return { ok: false, message: "Не удалось отправить. Попробуйте ещё раз." };
  }
  return { ok: true };
}
