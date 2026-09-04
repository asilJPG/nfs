"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

export type Result = { ok: boolean; message: string };

const tagSchema = z.object({
  tagId: z.string().uuid(),
  venueId: z.string().uuid().nullable(),
  label: z.string().trim().max(60).nullable(),
  active: z.boolean(),
});

// кофейня может привязать метку и выключить; перепрошить или переприсвоить — нельзя
export async function updateTag(input: z.input<typeof tagSchema>): Promise<Result> {
  const { tenant } = await requireRole("owner", "manager");
  const parsed = tagSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Проверьте поля метки." };

  const supabase = await supabaseServer();

  // venue должен быть из этой же кофейни — RLS этого не проверяет
  if (parsed.data.venueId) {
    const { data: venue } = await supabase
      .from("stampy_venues")
      .select("id")
      .eq("id", parsed.data.venueId)
      .eq("tenant_id", tenant.id)
      .maybeSingle();
    if (!venue) return { ok: false, message: "Точка не найдена." };
  }

  const { error } = await supabase
    .from("stampy_nfc_tags")
    .update({
      venue_id: parsed.data.venueId,
      label: parsed.data.label,
      active: parsed.data.active,
    })
    .eq("id", parsed.data.tagId)
    .eq("tenant_id", tenant.id);

  if (error) {
    console.error("tag update failed", error);
    return { ok: false, message: "Не удалось сохранить метку." };
  }

  revalidatePath("/dashboard/tags");
  return { ok: true, message: "Метка обновлена." };
}

const kitSchema = z.object({
  contactName: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(7).max(30),
  address: z.string().trim().min(5).max(300),
  note: z.string().trim().max(300).optional(),
  venueId: z.string().uuid().nullable(),
});

// заказ комплекта на прилавок — подставка с NFC + QR-табличка
export async function requestKit(input: z.input<typeof kitSchema>): Promise<Result> {
  const { tenant } = await requireRole("owner", "manager");
  const parsed = kitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Заполните имя, телефон и адрес доставки." };

  const supabase = await supabaseServer();

  if (parsed.data.venueId) {
    const { data: venue } = await supabase
      .from("stampy_venues")
      .select("id")
      .eq("id", parsed.data.venueId)
      .eq("tenant_id", tenant.id)
      .maybeSingle();
    if (!venue) return { ok: false, message: "Точка не найдена." };
  }

  const { error } = await supabase.from("stampy_kit_orders").insert({
    tenant_id: tenant.id,
    venue_id: parsed.data.venueId,
    contact_name: parsed.data.contactName,
    phone: parsed.data.phone,
    address: parsed.data.address,
    note: parsed.data.note || null,
  });

  if (error) {
    console.error("kit order failed", error);
    return { ok: false, message: "Не удалось отправить заявку." };
  }

  revalidatePath("/dashboard/tags");
  return { ok: true, message: "Заявка принята — свяжемся по телефону." };
}
