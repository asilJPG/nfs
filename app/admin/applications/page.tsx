import { supabaseServer } from "@/lib/supabase/server";
import { ApplicationsPanel } from "@/components/admin/ApplicationsPanel";
import type { Application } from "@/components/admin/AdminConsole";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("stampy_applications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  return <ApplicationsPanel applications={(data ?? []) as Application[]} />;
}
