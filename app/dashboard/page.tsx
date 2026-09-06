import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { can } from "@/lib/plan";
import { LazyDailyChart } from "@/components/dashboard/LazyDailyChart";
import { Heatmap } from "@/components/dashboard/Heatmap";
import { StatTile } from "@/components/dashboard/StatTile";
import { RangeFilter } from "@/components/dashboard/RangeFilter";
import { RewardMeter } from "@/components/dashboard/RewardMeter";
import type { AnalyticsDay, AnalyticsOverview } from "@/types/db";

export const dynamic = "force-dynamic";

const TASHKENT = "Asia/Tashkent";
const RANGES = [7, 30, 90];

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { tenant } = await requireRole("owner", "manager");
  const params = await searchParams;
  const days = RANGES.includes(Number(params.days)) ? Number(params.days) : 30;

  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  const supabase = await supabaseServer();
  const advanced = can(tenant, "advanced_analytics");

  const [overviewResult, dailyResult, heatmapResult] = await Promise.all([
    supabase.rpc("analytics_overview", {
      p_tenant: tenant.id,
      p_from: from.toISOString(),
      p_to: to.toISOString(),
    }),
    supabase.rpc("analytics_daily", {
      p_tenant: tenant.id,
      p_from: from.toISOString(),
      p_to: to.toISOString(),
      p_tz: TASHKENT,
    }),
    advanced
      ? supabase.rpc("analytics_heatmap", {
          p_tenant: tenant.id,
          p_from: from.toISOString(),
          p_to: to.toISOString(),
          p_tz: TASHKENT,
        })
      : Promise.resolve({ data: null }),
  ]);

  const overview = (overviewResult.data ?? null) as AnalyticsOverview | null;
  const daily = (dailyResult.data ?? []) as AnalyticsDay[];
  const heatmap = (heatmapResult.data ?? []) as { dow: number; hour: number; stamps: number }[];

  const earned = overview?.rewards_earned ?? 0;
  const redeemed = overview?.rewards_redeemed ?? 0;
  const outstanding = overview?.rewards_outstanding ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div>
          <h1 className="page-title">Обзор</h1>
          <p className="page-subtitle">
            Что происходило с картами за {days} дн. · время по Ташкенту
          </p>
        </div>
        <RangeFilter ranges={RANGES} active={days} />
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Штампов собрано" value={overview?.stamps ?? 0} accent="violet" />
        <StatTile label="Уникальных гостей" value={overview?.unique_visitors ?? 0} accent="sky" />
        <StatTile label="Новых карт" value={overview?.new_customers ?? 0} accent="amber" />
        <StatTile label="Всего карт" value={overview?.total_cards ?? 0} accent="pink" />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card flex flex-col p-5 md:p-6 lg:col-span-2">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="card-title">Посещения по дням</h2>
              <p className="mt-0.5 text-xs text-ink-faint">Сколько штампов начислено за день</p>
            </div>
            <span className="badge badge-muted">{days} дн.</span>
          </div>
          <LazyDailyChart data={daily} />
        </section>

        <section className="card flex flex-col p-5 md:p-6">
          <h2 className="card-title mb-5">Награды</h2>
          <RewardMeter earned={earned} redeemed={redeemed} outstanding={outstanding} />
          <Link href="/dashboard/card" className="btn btn-ghost btn-sm btn-block mt-6">
            Настроить награду
          </Link>
        </section>
      </div>

      {advanced ? (
        <section className="card p-5 md:p-6">
          <div className="mb-5">
            <h2 className="card-title">Когда приходят гости</h2>
            <p className="mt-0.5 text-xs text-ink-faint">Часы пик по Ташкенту</p>
          </div>
          <Heatmap data={heatmap} />
        </section>
      ) : (
        <section className="empty">
          <h2 className="card-title">Тепловая карта посещений и когорты</h2>
          <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-ink-soft">
            Видно, в какие часы приходят гости и как возвращаются группы по месяцам. Доступно на
            тарифе с маркетингом.
          </p>
          <Link href="/dashboard/billing" className="btn btn-primary btn-sm mt-5">
            Посмотреть тарифы
          </Link>
        </section>
      )}
    </div>
  );
}

