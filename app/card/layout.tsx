import Script from "next/script";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rememberedTenant } from "@/lib/session";
import type { Brand } from "@/types/db";

export const dynamic = "force-dynamic";

const FALLBACK: Brand = {
  primary: "#6F4E37",
  bg: "#FFF8F0",
  surface: "#FFFFFF",
  text: "#2A1E17",
  accent: "#C8A27A",
  card_style: "circles",
};

// Оболочка кошелька всегда тёмная (#0e0f11) — цвет кофейни лежит на плашке карты.
// Раньше фоном был brand.bg, и у кофейни со светлым бренд-фоном экран уезжал в крем.
export default async function CardLayout({ children }: { children: React.ReactNode }) {
  const tenantId = await rememberedTenant();
  let brand = FALLBACK;

  if (tenantId) {
    const { data } = await supabaseAdmin()
      .from("stampy_tenants")
      .select("brand")
      .eq("id", tenantId)
      .maybeSingle();
    if (data?.brand) brand = { ...FALLBACK, ...data.brand };
  }

  const variables = [
    `--brand-primary:${brand.primary}`,
    `--brand-bg:${brand.bg}`,
    `--brand-surface:${brand.surface}`,
    `--brand-text:${brand.text}`,
    `--brand-accent:${brand.accent}`,
  ].join(";");

  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      <div className="min-h-dvh bg-[#0e0f11] text-white">
        <style>{`:root{${variables}}`}</style>
        {children}
      </div>
    </>
  );
}
