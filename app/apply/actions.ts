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

export async function submitApplication(input: unknown): Promise<ApplyResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Проверьте поля." };
  }

  const { error } = await supabaseAdmin().from("stampy_applications").insert({
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
