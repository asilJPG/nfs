import { supabaseServer } from "@/lib/supabase/server";
import { TenantsPanel } from "@/components/admin/TenantsPanel";
import type { KitOrder, TenantSummary } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function TenantsPage() {
  const supabase = await supabaseServer();
  const [{ data: tenants }, { data: kits }] = await Promise.all([
    supabase.rpc("admin_tenant_summary"),
    supabase
      .from("stampy_kit_orders")
      .select("*, stampy_tenants(name)")
      .in("status", ["requested", "shipped"])
      .order("created_at")
      .returns<(KitOrder & { stampy_tenants: { name: string } | null })[]>(),
  ]);

  const kitRows = (kits ?? []).map((kit) => ({
    ...kit,
    tenant_name: kit.stampy_tenants?.name ?? "—",
  }));

  return (
    <div className="flex flex-col gap-6">
      <header className="border-b border-line pb-5">
        <h1 className="page-title">Кофейни</h1>
        <p className="page-subtitle">Подписки, тарифы и заявки на NFC-комплекты</p>
      </header>
      <TenantsPanel tenants={(tenants ?? []) as TenantSummary[]} kits={kitRows} />
    </div>
  );
}
