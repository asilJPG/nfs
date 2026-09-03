import { requireRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { VenuesManager } from "@/components/dashboard/VenuesManager";

export const dynamic = "force-dynamic";

export default async function VenuesPage() {
  const { tenant, staff } = await requireRole("owner", "manager");
  const supabase = await supabaseServer();

  const [{ data: venues }, { data: team }] = await Promise.all([
    supabase.from("venues").select("*").eq("tenant_id", tenant.id).order("created_at"),
    supabase
      .from("staff_users")
      .select("*")
      .eq("tenant_id", tenant.id)
      .eq("active", true)
      .order("created_at"),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Точки и сотрудники</h1>
      <VenuesManager venues={venues ?? []} staff={team ?? []} currentStaffId={staff.id} />
    </div>
  );
}
