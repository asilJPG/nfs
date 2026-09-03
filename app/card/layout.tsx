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

/**
 * Returning customers get their shop's colours painted server-side, straight
 * from the cookie the last session left behind — no flash of our own palette
 * while the card loads.
 */
export default async function CardLayout({ children }: { children: React.ReactNode }) {
  const tenantId = await rememberedTenant();
  let brand = FALLBACK;

  if (tenantId) {
    const { data } = await supabaseAdmin()
      .from("tenants")
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
      <div
        style={{ background: "var(--brand-bg)", color: "var(--brand-text)" } as React.CSSProperties}
        className="min-h-dvh"
      >
        <style>{`:root{${variables}}`}</style>
        {children}
      </div>
    </>
  );
}
