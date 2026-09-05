import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Overview = {
  tenants_total: number;
  tenants_active: number;
  tenants_paying: number;
  tenants_new_week: number;
  guests_total: number;
  guests_active_month: number;
  stamps_today: number;
  stamps_week: number;
  rewards_redeemed_week: number;
  applications_open: number;
  tags_total: number;
  tags_unassigned: number;
};

export default async function AdminOverview() {
  const supabase = await supabaseServer();
  const { data } = await supabase.rpc("admin_platform_overview");
  const o = (data as Overview | null) ?? {
    tenants_total: 0,
    tenants_active: 0,
    tenants_paying: 0,
    tenants_new_week: 0,
    guests_total: 0,
    guests_active_month: 0,
    stamps_today: 0,
    stamps_week: 0,
    rewards_redeemed_week: 0,
    applications_open: 0,
    tags_total: 0,
    tags_unassigned: 0,
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Кофеен" value={o.tenants_total} hint={`${o.tenants_active} активных`} href="/admin/tenants" />
        <Tile label="Платящих" value={o.tenants_paying} hint={`+${o.tenants_new_week} за неделю`} />
        <Tile label="Гостей" value={o.guests_total} hint={`${o.guests_active_month} активны за 30 дн.`} href="/admin/guests" />
        <Tile label="Заявок" value={o.applications_open} hint="ждут ответа" href="/admin/applications" />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Штампов сегодня" value={o.stamps_today} />
        <Tile label="Штампов за 7 дн." value={o.stamps_week} />
        <Tile label="Наград выдано (7 дн.)" value={o.rewards_redeemed_week} />
        <Tile
          label="Меток"
          value={o.tags_total}
          hint={`${o.tags_unassigned} без привязки`}
          href="/admin/tags"
        />
      </section>
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: number;
  hint?: string;
  href?: string;
}) {
  const body = (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="text-xs uppercase tracking-wider text-ink-soft">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value.toLocaleString("ru-RU")}</p>
      {hint && <p className="mt-1 text-xs text-ink-soft">{hint}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
