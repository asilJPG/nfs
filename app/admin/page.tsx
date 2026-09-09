import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { formatUzs } from "@/lib/plan";

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
  mrr_uzs: number;
  mrr_new_week_uzs: number;
  series_stamps: number[];
  series_tenants: number[];
  series_guests: number[];
  series_applications: number[];
};

const EMPTY_OVERVIEW: Overview = {
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
  mrr_uzs: 0,
  mrr_new_week_uzs: 0,
  series_stamps: [],
  series_tenants: [],
  series_guests: [],
  series_applications: [],
};

export default async function AdminOverview() {
  const supabase = await supabaseServer();
  const { data } = await supabase.rpc("admin_platform_overview");
  const o = { ...EMPTY_OVERVIEW, ...((data as Partial<Overview> | null) ?? {}) };

  return (
    <div className="flex flex-col gap-8 animate-rise">
      {/* Platform KPI Grid */}
      <div className="flex justify-between items-baseline">
        <div>
          <div className="text-[11px] font-mono text-ink-label uppercase tracking-wider font-semibold">Сеть Stampy</div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-0.5">Ключевые показатели</h1>
        </div>
      </div>

      <section className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="MRR"
          value={formatUzs(o.mrr_uzs)}
          change={o.mrr_new_week_uzs > 0 ? `+${formatUzs(o.mrr_new_week_uzs)} за 7 дн.` : undefined}
          hint={`${o.tenants_paying} платящих точек`}
          series={o.series_tenants}
        />
        <Tile
          label="Кофейни"
          value={o.tenants_total}
          change={o.tenants_new_week > 0 ? `+${o.tenants_new_week} за 7 дн.` : undefined}
          hint={`${o.tenants_active} активных`}
          href="/admin/tenants"
          series={o.series_tenants}
        />
        <Tile
          label="Гости"
          value={o.guests_total}
          hint={`${o.guests_active_month} активны за 30 дн.`}
          href="/admin/guests"
          series={o.series_guests}
        />
        <Tile
          label="Заявки"
          value={o.applications_open}
          change={o.applications_open > 0 ? "требуют ответа" : "все обработаны"}
          changeColor={o.applications_open > 0 ? "text-[#7BA5FF]" : "text-emerald-400"}
          hint="новые заявки на подключение"
          href="/admin/applications"
          series={o.series_applications}
        />
      </section>

      {/* Operational stats */}
      <section className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <SimpleTile label="Штампов сегодня" value={o.stamps_today} />
        <SimpleTile label="Штампов за 7 дн." value={o.stamps_week} series={o.series_stamps} />
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

/** Точки полилинии из ряда значений. Плоский ряд рисуем ровной линией по нижней кромке. */
function sparklinePoints(series: number[], width = 200, height = 30): string | null {
  if (!series || series.length < 2) return null;
  const max = Math.max(...series);
  const min = Math.min(...series);
  const span = max - min;
  const step = width / (series.length - 1);
  return series
    .map((value, index) => {
      const x = Math.round(index * step);
      const y = span === 0 ? height - 4 : Math.round(height - 4 - ((value - min) / span) * (height - 8));
      return `${x},${y}`;
    })
    .join(" ");
}

function Sparkline({ series }: { series: number[] }) {
  const points = sparklinePoints(series);
  if (!points) return null;
  return (
    <svg viewBox="0 0 200 30" width="100%" height="24" className="mt-3 overflow-visible">
      <polyline points={points} fill="none" stroke="#5B8DEF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Tile({
  label,
  value,
  change,
  changeColor = "text-[#7BA5FF]",
  hint,
  href,
  series,
}: {
  label: string;
  value: number | string;
  change?: string;
  changeColor?: string;
  hint?: string;
  href?: string;
  series?: number[];
}) {
  const body = (
    <div className="rounded-[20px] border border-white/[0.06] bg-[#14161D] p-5 shadow-lg shadow-black/40 hover:border-[#5B8DEF]/30 transition-all flex flex-col justify-between">
      <div className="flex justify-between items-center mb-2">
        <span className="text-[10px] uppercase font-mono tracking-wider text-ink-label font-semibold">{label}</span>
        {change && <span className={`text-[11px] font-mono font-semibold ${changeColor}`}>{change}</span>}
      </div>
      <div className="text-2xl font-bold text-white tracking-tight leading-tight">
        {typeof value === "number" ? value.toLocaleString("ru-RU") : value}
      </div>
      {series && <Sparkline series={series} />}
      {hint && <p className="mt-2 text-[11px] text-ink-label font-medium">{hint}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function SimpleTile({
  label,
  value,
  hint,
  href,
  series,
}: {
  label: string;
  value: number | string;
  hint?: string;
  href?: string;
  series?: number[];
}) {
  const body = (
    <div className="rounded-[20px] border border-white/[0.06] bg-[#14161D] p-5 hover:border-white/10 transition-all">
      <span className="text-[10px] uppercase font-mono tracking-wider text-ink-label font-semibold block mb-2">{label}</span>
      <div className="text-xl font-bold text-white tracking-tight">
        {typeof value === "number" ? value.toLocaleString("ru-RU") : value}
      </div>
      {series && <Sparkline series={series} />}
      {hint && <p className="mt-1 text-[11px] text-ink-label font-medium">{hint}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
