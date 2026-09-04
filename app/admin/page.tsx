import { requirePlatformAdmin } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { AdminConsole } from "@/components/admin/AdminConsole";
import type { KitOrder, TenantSummary } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requirePlatformAdmin();
  const supabase = await supabaseServer();

  const [{ data: tenants }, { data: kits }, { data: applications }, { data: tags }] = await Promise.all([
    supabase.rpc("admin_tenant_summary"),
    supabase
      .from("stampy_kit_orders")
      .select("*, stampy_tenants(name)")
      .in("status", ["requested", "shipped"])
      .order("created_at")
      .returns<(KitOrder & { stampy_tenants: { name: string } | null })[]>(),
    supabase
      .from("stampy_applications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("stampy_nfc_tags")
      .select("uid, label, tenant_id, created_at, stampy_tenants(name)")
      .order("created_at", { ascending: false })
      .returns<
        {
          uid: string;
          label: string | null;
          tenant_id: string | null;
          created_at: string;
          stampy_tenants: { name: string } | null;
        }[]
      >(),
  ]);

  const kitRows = (kits ?? []).map((kit) => ({
    ...kit,
    tenant_name: kit.stampy_tenants?.name ?? "—",
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
      <AdminConsole
        tenants={(tenants ?? []) as TenantSummary[]}
        kits={kitRows}
        applications={applications ?? []}
        tags={(tags ?? []).map((t) => ({
          uid: t.uid,
          label: t.label,
          tenant_id: t.tenant_id,
          tenant_name: t.stampy_tenants?.name ?? null,
          created_at: t.created_at,
        }))}
      />
    </main>
  );
}
