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

  return (
    <div className="flex flex-col gap-6">
      <header className="border-b border-line pb-5">
        <h1 className="page-title">Заявки</h1>
        <p className="page-subtitle">Кофейни, которые оставили заявку с лендинга и ждут ответа</p>
      </header>
      <ApplicationsPanel applications={(data ?? []) as Application[]} />
    </div>
  );
}
