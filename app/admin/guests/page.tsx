import { supabaseServer } from "@/lib/supabase/server";
import { GuestsPanel, type GuestRow } from "@/components/admin/GuestsPanel";

export const dynamic = "force-dynamic";

export default async function GuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() || null;
  const supabase = await supabaseServer();
  const { data } = await supabase.rpc("admin_guests_search", {
    p_query: q,
    p_limit: 100,
  });

  return <GuestsPanel initialGuests={(data ?? []) as GuestRow[]} initialQuery={q ?? ""} />;
}
