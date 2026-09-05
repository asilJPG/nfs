import { supabaseServer } from "@/lib/supabase/server";
import { TagsPanel } from "@/components/admin/TagsPanel";
import type { Tag } from "@/components/admin/AdminConsole";
import type { TenantSummary } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function TagsPage() {
  const supabase = await supabaseServer();
  const [{ data: tenants }, { data: tags }] = await Promise.all([
    supabase.rpc("admin_tenant_summary"),
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

  const rows: Tag[] = (tags ?? []).map((t) => ({
    uid: t.uid,
    label: t.label,
    tenant_id: t.tenant_id,
    tenant_name: t.stampy_tenants?.name ?? null,
    created_at: t.created_at,
  }));

  return <TagsPanel tenants={(tenants ?? []) as TenantSummary[]} tags={rows} />;
}
