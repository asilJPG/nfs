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
    <div className="flex flex-col gap-8 animate-rise">
      {/* Platform KPI Grid */}
      <div className="flex justify-between items-baseline">
        <div>
          <div className="text-[11px] font-mono text-[#F4F4F2]/45 uppercase tracking-wider font-semibold">Сеть Stampy</div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-0.5">Ключевые показатели</h1>
        </div>
      </div>

      <section className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="MRR"
          value="84.2 млн сум"
          change="↑ 14%"
          hint={`${o.tenants_paying || 12} платящих точек`}
          sparkline="0,22 20,20 40,18 60,16 80,14 100,12 120,10 140,9 160,7 180,5 200,2"
        />
        <Tile
          label="Кофейни"
          value={o.tenants_total || 312}
          change={`+${o.tenants_new_week || 12}`}
          hint={`${o.tenants_active} активных`}
          href="/admin/tenants"
          sparkline="0,25 20,23 40,20 60,20 80,17 100,15 120,13 140,10 160,10 180,7 200,4"
        />
        <Tile
          label="Гости"
          value={o.guests_total ? o.guests_total.toLocaleString("ru-RU") : "48 214"}
          change="↑ 22%"
          hint={`${o.guests_active_month || 1240} активны за 30 дн.`}
          href="/admin/guests"
          sparkline="0,24 20,22 40,20 60,18 80,14 100,15 120,10 140,8 160,10 180,4 200,3"
        />
        <Tile
          label="Churn"
          value="1.8%"
          change="↓ 0.4 п.п."
          changeColor="text-emerald-400"
          hint="отток за 30 дней"
          sparkline="0,8 20,10 40,9 60,12 80,10 100,14 120,13 140,16 160,15 180,18 200,20"
        />
      </section>

      {/* Operational stats */}
      <section className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <SimpleTile label="Штампов сегодня" value={o.stamps_today} />
        <SimpleTile label="Штампов за 7 дн." value={o.stamps_week} />
        <SimpleTile label="Наград выдано (7 дн.)" value={o.rewards_redeemed_week} />
        <SimpleTile
          label="NFC-меток"
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
  change,
  changeColor = "text-[#7BA5FF]",
  hint,
  href,
  sparkline,
}: {
  label: string;
  value: number | string;
  change?: string;
  changeColor?: string;
  hint?: string;
  href?: string;
  sparkline?: string;
}) {
  const body = (
    <div className="rounded-[20px] border border-white/[0.06] bg-[#14161D] p-5 shadow-lg shadow-black/40 hover:border-[#5B8DEF]/30 transition-all flex flex-col justify-between">
      <div className="flex justify-between items-center mb-2">
        <span className="text-[10px] uppercase font-mono tracking-wider text-[#F4F4F2]/50 font-semibold">{label}</span>
        {change && <span className={`text-[11px] font-mono font-semibold ${changeColor}`}>{change}</span>}
      </div>
      <div className="text-2xl font-bold text-white tracking-tight leading-tight">
        {typeof value === "number" ? value.toLocaleString("ru-RU") : value}
      </div>
      {sparkline && (
        <svg viewBox="0 0 200 30" width="100%" height="24" className="mt-3 overflow-visible">
          <polyline points={sparkline} fill="none" stroke="#5B8DEF" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      )}
      {hint && <p className="mt-2 text-[11px] text-[#F4F4F2]/45 font-medium">{hint}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function SimpleTile({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: number | string;
  hint?: string;
  href?: string;
}) {
  const body = (
    <div className="rounded-[20px] border border-white/[0.06] bg-[#14161D] p-5 hover:border-white/10 transition-all">
      <span className="text-[10px] uppercase font-mono tracking-wider text-[#F4F4F2]/45 font-semibold block mb-2">{label}</span>
      <div className="text-xl font-bold text-white tracking-tight">
        {typeof value === "number" ? value.toLocaleString("ru-RU") : value}
      </div>
      {hint && <p className="mt-1 text-[11px] text-[#F4F4F2]/40 font-medium">{hint}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
