import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { can } from "@/lib/plan";
import { DailyChart } from "@/components/dashboard/DailyChart";
import { Heatmap } from "@/components/dashboard/Heatmap";
import { StatTile } from "@/components/dashboard/StatTile";
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

  const redemptionRate =
    overview && overview.rewards_earned > 0
      ? Math.round((overview.rewards_redeemed / overview.rewards_earned) * 100)
      : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Обзор</h1>
        <div className="flex gap-1 rounded-xl bg-line/50 p-1">
          {RANGES.map((range) => (
            <Link
              key={range}
              href={`/dashboard?days=${range}`}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                days === range ? "bg-white shadow-sm" : "text-ink-soft"
              }`}
            >
              {range} дн.
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Штампов" value={overview?.stamps ?? 0} />
        <StatTile label="Уникальных гостей" value={overview?.unique_visitors ?? 0} />
        <StatTile label="Новых карт" value={overview?.new_customers ?? 0} />
        <StatTile label="Всего карт" value={overview?.total_cards ?? 0} />
        <StatTile label="Наград выдано" value={overview?.rewards_earned ?? 0} />
        <StatTile label="Наград погашено" value={overview?.rewards_redeemed ?? 0} />
        <StatTile
          label="Доля погашения"
          value={redemptionRate === null ? "—" : `${redemptionRate}%`}
          hint="Сколько заработанных наград гости реально забрали"
        />
        <StatTile
          label="Не погашено"
          value={overview?.rewards_outstanding ?? 0}
          hint="Ожидают выдачи прямо сейчас"
        />
      </div>

      <section className="rounded-2xl border border-line bg-white p-4">
        <h2 className="mb-4 font-medium">Посещения по дням</h2>
        <DailyChart data={daily} />
      </section>

      {advanced ? (
        <section className="rounded-2xl border border-line bg-white p-4">
          <h2 className="mb-1 font-medium">Когда приходят гости</h2>
          <p className="mb-4 text-sm text-ink-soft">Часы по Ташкенту, за выбранный период.</p>
          <Heatmap data={heatmap} />
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-line p-6 text-center">
          <p className="font-medium">Тепловая карта посещений и когорты</p>
          <p className="mt-1 text-sm text-ink-soft">
            Доступны на тарифе с маркетингом.{" "}
            <Link href="/dashboard/billing" className="underline">
              Подробнее
            </Link>
          </p>
        </section>
      )}
    </div>
  );
}
