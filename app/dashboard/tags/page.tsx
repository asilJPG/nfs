import { requireRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { miniAppLink } from "@/lib/env";
import { qrSvg } from "@/lib/qr";
import { TagsManager } from "@/components/dashboard/TagsManager";

export const dynamic = "force-dynamic";

export default async function TagsPage() {
  const { tenant } = await requireRole("owner", "manager");
  const supabase = await supabaseServer();

  const [{ data: tags }, { data: venues }, { data: kits }] = await Promise.all([
    supabase.from("stampy_nfc_tags").select("*").eq("tenant_id", tenant.id).order("created_at"),
    supabase.from("stampy_venues").select("*").eq("tenant_id", tenant.id).eq("active", true).order("name"),
    supabase
      .from("stampy_kit_orders")
      .select("id")
      .eq("tenant_id", tenant.id)
      .in("status", ["requested", "shipped"])
      .limit(1),
  ]);

  const joinLink = miniAppLink(`t_${tenant.slug}`);
  const qr = await qrSvg(joinLink, 220);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Метки и QR</h1>

      <section className="rounded-2xl border border-line bg-white p-4">
        <h2 className="mb-1 font-medium">QR для стойки</h2>
        <p className="mb-4 text-sm text-ink-soft">
          С него гость заводит карту в первый раз — и им же можно воспользоваться, если NFC не
          сработал. Штампы даёт только подставка.
        </p>
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div
            className="w-[220px] shrink-0 rounded-2xl border border-line p-2"
            dangerouslySetInnerHTML={{ __html: qr }}
          />
          <div className="min-w-0">
            <p className="mb-1 text-sm text-ink-soft">Ссылка на карту</p>
            <code className="block break-all rounded-xl bg-cream px-3 py-2 text-sm">{joinLink}</code>
            <p className="mt-3 text-sm text-ink-soft">
              Распечатайте QR и поставьте у кассы. Его же можно разместить в соцсетях.
            </p>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">NFC-метки</h2>
        <TagsManager tags={tags ?? []} venues={venues ?? []} hasPendingKit={(kits?.length ?? 0) > 0} />
      </section>
    </div>
  );
}
