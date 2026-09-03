"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { SLUG_PATTERN } from "@/lib/slug";
import type { Brand, CreateTenantResult } from "@/types/db";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Цвет должен быть в формате #RRGGBB");

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().regex(SLUG_PATTERN, "Адрес: латиница, цифры и дефис, от 3 символов"),
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

export type OnboardingInput = z.input<typeof schema>;
export type OnboardingError = { field?: string; message: string };

const FAILURES: Record<string, string> = {
  slug_taken: "Такой адрес уже занят — попробуйте другой.",
  already_has_tenant: "К этому аккаунту уже привязана кофейня.",
};

/** Creates tenant + venue + card + owner in one transaction, then opens the dashboard. */
export async function createTenantAction(input: OnboardingInput): Promise<OnboardingError | never> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { field: String(issue.path[0] ?? ""), message: issue.message };
  }

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/onboarding");

  const { data, error } = await supabase.rpc("create_tenant", {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
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
    return {
      field: result.code === "slug_taken" ? "slug" : undefined,
      message: FAILURES[result.code] ?? "Не получилось.",
    };
  }

  redirect("/dashboard?welcome=1");
}
