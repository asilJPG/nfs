import { requireRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { CardSettingsForm } from "@/components/dashboard/CardSettingsForm";

export const dynamic = "force-dynamic";

export default async function CardSettingsPage() {
  const { tenant } = await requireRole("owner", "manager");
  const supabase = await supabaseServer();

  const { data: program } = await supabase
    .from("stampy_loyalty_programs")
    .select("stamps_required, reward_title, reward_description, reward_expires_days, stamp_cooldown_minutes")
    .eq("tenant_id", tenant.id)
    .eq("active", true)
    .maybeSingle();

  if (!program) {
    return <p className="text-sm text-ink-soft">Карта не найдена. Напишите в поддержку.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Карта</h1>
      <CardSettingsForm tenant={tenant} program={program} />
    </div>
  );
}
