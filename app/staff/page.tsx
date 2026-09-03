import { requireStaff } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { StaffConsole } from "@/components/staff/StaffConsole";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const { staff, tenant } = await requireStaff();
  const supabase = await supabaseServer();

  const { data: venues } = await supabase
    .from("venues")
    .select("id, name")
    .eq("tenant_id", tenant.id)
    .eq("active", true)
    .order("name");

  return (
    <StaffConsole
      tenantName={tenant.name}
      venues={venues ?? []}
      defaultVenueId={staff.venue_id}
    />
  );
}
