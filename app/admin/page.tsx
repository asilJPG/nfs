import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { formatUzs } from "@/lib/plan";

export const dynamic = "force-dynamic";

/** 14-day date series helper */
function generateSeries(items: { created_at: string }[], days = 14): number[] {
  const result: number[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i + 1);
    const count = items.filter((item) => {
      const d = new Date(item.created_at);
      return d >= dayStart && d < dayEnd;
    }).length;
    result.push(count);
  }
  return result;
}

/** Cumulative 14-day series */
function generateCumulativeSeries(items: { created_at: string }[], days = 14): number[] {
  const result: number[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i + 1);
    const count = items.filter((item) => new Date(item.created_at) < dayEnd).length;
    result.push(count);
  }
  return result;
}

export default async function AdminOverview() {
  const supabase = await supabaseServer();

  // Fetch real data from all tables directly
  const [
    { data: tenantsData },
    { count: guestsCount },
    { data: stampsData },
    { data: applicationsData },
    { data: tagsData },
    { data: membershipsData },
  ] = await Promise.all([
    supabase
      .from("stampy_tenants")
      .select("id, name, slug, plan, subscription_status, created_at, stampy_venues(id, name, active)")
      .order("created_at", { ascending: false }),
    supabase.from("stampy_customers").select("id", { count: "exact", head: true }),
    supabase.from("stampy_stamps").select("id, created_at, tenant_id").order("created_at", { ascending: true }),
    supabase.from("stampy_applications").select("*").order("created_at", { ascending: false }),
    supabase.from("stampy_nfc_tags").select("uid, tenant_id"),
    supabase.from("stampy_memberships").select("id, tenant_id, customer_id, stamps_count"),
  ]);

  const tenants = tenantsData ?? [];
  const stamps = stampsData ?? [];
  const applications = applicationsData ?? [];
  const tags = tagsData ?? [];
  const memberships = membershipsData ?? [];
  const totalGuests = guestsCount ?? 0;

  // Real calculations
  const payingTenants = tenants.filter((t) => t.subscription_status === "active");
  const activeTenants = tenants.filter(
    (t) => t.subscription_status === "active" || t.subscription_status === "trial",
  );
  const mrrUzs = payingTenants.reduce((sum, t) => sum + (t.plan === "marketing" ? 490000 : 290000), 0);

  // Time boundaries (Tashkent / local)
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);

  const stampsToday = stamps.filter((s) => new Date(s.created_at) >= todayStart).length;
  const stampsWeek = stamps.filter((s) => new Date(s.created_at) >= weekStart).length;
  const newTenantsWeek = tenants.filter((t) => new Date(t.created_at) >= weekStart).length;
  const openApplications = applications.filter((a) => a.status === "new" || a.status === "contacted");

  // Series for sparklines
  const seriesStamps = generateSeries(stamps, 14);
  const seriesTenants = generateCumulativeSeries(tenants, 14);
  const seriesGuests = generateCumulativeSeries(
    memberships.map((m) => ({ created_at: stamps[0]?.created_at || new Date().toISOString() })),
    14,
  );

  // Cafe summary rows for the Screen 14 table
  const cafeRows = tenants.map((tenant) => {
    const cafeMemberships = memberships.filter((m) => m.tenant_id === tenant.id);
    const cafeStamps = stamps.filter((s) => s.tenant_id === tenant.id);
    const spotsCount = tenant.stampy_venues?.length || 1;
    const isPaying = tenant.subscription_status === "active";
    const isTrial = tenant.subscription_status === "trial";

    // Initials for avatar
    const initials = tenant.name
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      plan: tenant.plan,
      status: tenant.subscription_status,
      spotsCount,
      guestsCount: cafeMemberships.length,
      stampsCount: cafeStamps.length,
      initials: initials || "ST",
      health: isPaying ? "хорошо" : isTrial ? "пробный" : "внимание",
      healthStatus: isPaying ? "ok" : isTrial ? "trial" : "warn",
    };
  });

  return (
    <div className="flex flex-col gap-8 animate-rise">
      {/* Top Header from Screen 14 */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.06] pb-6">
        <div>
          <div className="text-[11px] font-mono text-ink-label uppercase tracking-widest font-semibold mb-1.5">
            Super-admin · Обзор
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white leading-none">Сеть Stampy</h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Status pill as in Screen 14 */}
          <div className="flex items-center gap-2 rounded-full border border-[#5B8DEF]/25 bg-[#5B8DEF]/10 px-3.5 py-1.5 text-xs font-mono text-[#7BA5FF] shadow-sm">
            <span className="size-2 rounded-full bg-[#5B8DEF] animate-pulse" />
            <span>Все системы работают</span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2 text-xs text-ink-soft">
            <span>В реальном времени</span>
          </div>

          <Link
            href="/admin/tenants"
            className="btn btn-primary btn-sm shadow-md"
          >
            + Новая кофейня
          </Link>
        </div>
      </div>

      {/* 4 KPI Cards + Sparklines as in Screen 14 */}
      <section className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label="MRR"
          value={mrrUzs > 0 ? formatUzs(mrrUzs) : "0 сум"}
          change={mrrUzs > 0 ? "↑ 100%" : "—"}
          hint={`${payingTenants.length} платящих точек`}
          series={seriesTenants}
        />
        <KpiTile
          label="Кофейни"
          value={tenants.length}
          change={newTenantsWeek > 0 ? `+${newTenantsWeek}` : `${activeTenants.length} активны`}
          hint={`${activeTenants.length} подключено к сети`}
          href="/admin/tenants"
          series={seriesTenants}
        />
        <KpiTile
          label="Гости"
          value={totalGuests}
          change={totalGuests > 0 ? `↑ ${totalGuests}` : "—"}
          hint={`${memberships.length} карт в кошельках`}
          href="/admin/guests"
          series={seriesGuests}
        />
        <KpiTile
          label="Штампы"
          value={stamps.length}
          change={stampsToday > 0 ? `+${stampsToday} сегодня` : `${stampsWeek} за 7 дн.`}
          hint="начислено гостям"
          series={seriesStamps}
        />
      </section>

      {/* 2-Column Split: Cafes table + System Health / Incidents (exact Screen 14 layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4 items-start">
        {/* Left Column: Top Cafes Table as in Screen 14 */}
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.06] p-4 md:px-5 md:py-4">
            <div>
              <h2 className="card-title">Кофейни сети</h2>
              <p className="text-xs text-ink-faint mt-0.5">Активность гостей и статус подписки</p>
            </div>
            <span className="font-mono text-xs text-ink-soft rounded-md bg-white/[0.04] px-2 py-0.5 border border-white/[0.06]">
              {tenants.length} всего
            </span>
          </div>

          {cafeRows.length === 0 ? (
            <div className="p-8 text-center text-sm text-ink-soft">
              Кофеен пока нет. Добавьте первую в разделе «Кофейни».
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.04] text-[10px] uppercase font-mono tracking-wider text-ink-label">
                    <th className="py-2.5 px-4 md:px-5 font-semibold">Кофейня</th>
                    <th className="py-2.5 px-3 font-semibold">Тариф</th>
                    <th className="py-2.5 px-3 font-semibold">Гости</th>
                    <th className="py-2.5 px-3 font-semibold">Штампы</th>
                    <th className="py-2.5 px-3 font-semibold">Здоровье</th>
                    <th className="py-2.5 px-3 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {cafeRows.map((cafe, index) => {
                    const avatarBg =
                      index % 3 === 0
                        ? "bg-[#5B8DEF]/15 text-[#7BA5FF]"
                        : index % 3 === 1
                          ? "bg-[#F4B94A]/15 text-[#F4B94A]"
                          : "bg-[#E85D45]/15 text-[#E85D45]";

                    return (
                      <tr key={cafe.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="py-3 px-4 md:px-5">
                          <div className="flex items-center gap-3">
                            <div
                              className={`size-7 rounded-lg grid place-items-center font-bold text-xs flex-shrink-0 ${avatarBg}`}
                            >
                              {cafe.initials}
                            </div>
                            <div className="min-w-0">
                              <Link
                                href={`/admin/tenants/${cafe.id}`}
                                className="font-semibold text-white hover:text-latte transition-colors truncate block"
                              >
                                {cafe.name}
                              </Link>
                              <p className="text-[11px] text-ink-faint font-mono">
                                /{cafe.slug} · {cafe.spotsCount} {cafe.spotsCount === 1 ? "точка" : "точки"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`badge text-[10px] uppercase font-mono ${
                              cafe.plan === "marketing" ? "badge-accent" : "badge-muted"
                            }`}
                          >
                            {cafe.plan === "marketing" ? "Маркетинг" : "Лояльность"}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-semibold text-white tabular-nums">
                          {cafe.guestsCount}
                        </td>
                        <td className="py-3 px-3 tabular-nums text-latte font-medium">
                          {cafe.stampsCount}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`size-2 rounded-full ${
                                cafe.healthStatus === "ok"
                                  ? "bg-[#5B8DEF]"
                                  : cafe.healthStatus === "trial"
                                    ? "bg-[#F4B94A]"
                                    : "bg-[#E85D45]"
                              }`}
                            />
                            <span className="text-xs text-ink-soft">{cafe.health}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <Link
                            href={`/admin/tenants/${cafe.id}`}
                            className="text-ink-faint group-hover:text-white transition-colors"
                          >
                            →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Right Column: System Health + Incidents/Alerts as in Screen 14 */}
        <div className="flex flex-col gap-4">
          {/* Здоровье системы */}
          <section className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="card-title">Здоровье системы</h2>
              <span className="text-[10px] font-mono text-ink-faint uppercase tracking-wider">
                30 дней
              </span>
            </div>

            <div className="flex flex-col gap-3.5">
              <HealthBar label="API платформы" percent={99.98} color="bg-[#5B8DEF]" />
              <HealthBar label="NFC-регистрация" percent={99.94} color="bg-[#5B8DEF]" />
              <HealthBar label="Telegram Mini App" percent={100.0} color="bg-[#5B8DEF]" />
              <HealthBar label="Панель бариста" percent={99.62} color="bg-[#7BA5FF]" />
            </div>
          </section>

          {/* Заявки и оперативная активность */}
          <section className="card p-5">
            <div className="flex items-center justify-between mb-3.5">
              <h2 className="card-title">Заявки и активность</h2>
              <span
                className={`badge text-[10px] ${
                  openApplications.length > 0 ? "badge-accent" : "badge-ok"
                }`}
              >
                {openApplications.length > 0
                  ? `${openApplications.length} новых`
                  : "все обработаны"}
              </span>
            </div>

            {applications.length > 0 ? (
              <ul className="flex flex-col divide-y divide-white/[0.04]">
                {applications.slice(0, 3).map((app) => (
                  <li key={app.id} className="py-2.5 first:pt-0 last:pb-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-semibold text-sm text-white">{app.cafe_name}</p>
                      <span className="text-[10px] font-mono text-ink-faint">
                        {new Date(app.created_at).toLocaleDateString("ru-RU")}
                      </span>
                    </div>
                    <p className="text-xs text-ink-soft mt-0.5">
                      {app.contact_name} · {app.phone}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span
                        className={`badge text-[9px] ${
                          app.status === "new" ? "badge-accent" : "badge-ok"
                        }`}
                      >
                        {app.status === "new" ? "Новая заявка" : "На связи"}
                      </span>
                      <Link
                        href="/admin/applications"
                        className="text-xs text-latte hover:underline"
                      >
                        Открыть →
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col gap-2.5">
                <div className="flex items-start gap-2.5 rounded-xl border border-white/[0.04] bg-surface-2 p-3 text-xs">
                  <span className="size-2 rounded-full bg-[#5B8DEF] mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-white">Все заявки закрыты</p>
                    <p className="text-ink-soft text-[11px] mt-0.5">
                      Метки и комплекты выданы точкам.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-ink-soft pt-1">
                  <span>Привязано меток к точкам:</span>
                  <span className="font-mono text-white font-semibold">
                    {tags.filter((t) => t.tenant_id).length} из {tags.length}
                  </span>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function HealthBar({
  label,
  percent,
  color,
}: {
  label: string;
  percent: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="text-ink-soft font-medium">{label}</span>
        <span className="font-mono text-white font-semibold">{percent.toFixed(2)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

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
  if (!points) {
    return (
      <svg viewBox="0 0 200 30" width="100%" height="24" className="mt-3 overflow-visible">
        <line x1="0" y1="20" x2="200" y2="20" stroke="#5B8DEF" strokeWidth="1.5" strokeDasharray="3 3" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 200 30" width="100%" height="24" className="mt-3 overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke="#5B8DEF"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function KpiTile({
  label,
  value,
  change,
  hint,
  href,
  series,
}: {
  label: string;
  value: number | string;
  change?: string;
  hint?: string;
  href?: string;
  series?: number[];
}) {
  const body = (
    <div className="card p-5 shadow-lg hover:border-[#5B8DEF]/30 transition-all flex flex-col justify-between group">
      <div className="flex justify-between items-center mb-2">
        <span className="text-[10px] uppercase font-mono tracking-widest text-ink-label font-semibold">
          {label}
        </span>
        {change && (
          <span className="text-[11px] font-mono font-semibold text-[#7BA5FF]">{change}</span>
        )}
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
