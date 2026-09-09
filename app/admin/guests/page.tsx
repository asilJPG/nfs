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

  return (
    <div className="flex flex-col gap-6">
      <header className="border-b border-line pb-5">
        <h1 className="page-title">Гости</h1>
        <p className="page-subtitle">Все карты платформы: кто где копит и кому уже выдали награду</p>
      </header>
      <GuestsPanel initialGuests={(data ?? []) as GuestRow[]} initialQuery={q ?? ""} />
    </div>
  );
}
