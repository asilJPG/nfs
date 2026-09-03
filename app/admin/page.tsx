import { requirePlatformAdmin } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { AdminConsole } from "@/components/admin/AdminConsole";
import type { KitOrder, TenantSummary } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requirePlatformAdmin();
  const supabase = await supabaseServer();

  const [{ data: tenants }, { data: kits }] = await Promise.all([
    supabase.rpc("admin_tenant_summary"),
    supabase
      .from("kit_orders")
      .select("*, tenants(name)")
      .in("status", ["requested", "shipped"])
      .order("created_at")
      .returns<(KitOrder & { tenants: { name: string } | null })[]>(),
  ]);

  const kitRows = (kits ?? []).map((kit) => ({
    ...kit,
    tenant_name: kit.tenants?.name ?? "—",
  }));

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Платформа</h1>
        <form action="/auth/signout" method="post">
          <button className="rounded-xl border border-line px-3 py-1.5 text-sm text-ink-soft">
            Выйти
          </button>
        </form>
      </div>
      <AdminConsole tenants={(tenants ?? []) as TenantSummary[]} kits={kitRows} />
    </main>
  );
}
