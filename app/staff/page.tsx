import { requireStaff } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { StaffConsole, type StaffStats } from "@/components/staff/StaffConsole";
import { formatTenantDate, formatTenantTime, shiftDayISO, tenantDateISO, tenantDayEnd, tenantDayStart } from "@/lib/time";

export const dynamic = "force-dynamic";

type SearchParams = { date?: string };

export default async function StaffPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { staff, tenant } = await requireStaff();
  const supabase = await supabaseServer();

  const params = await searchParams;
  const today = tenantDateISO();
  // ?date=YYYY-MM-DD — просмотр любого прошедшего дня. Валидируем формат и
  // не даём заглядывать в будущее.
  const dayISO = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? "") && (params.date! <= today)
    ? params.date!
    : today;
  const isToday = dayISO === today;

  const dayStart = tenantDayStart(dayISO).toISOString();
  const dayEnd = tenantDayEnd(dayISO).toISOString();
  // Спарклайн смотрим по неделе относительно выбранного дня.
  const weekAgo = tenantDayStart(shiftDayISO(dayISO, -6)).toISOString();
  // Для дельты «vs вчера» на плитке штампов.
  const prevDayStart = tenantDayStart(shiftDayISO(dayISO, -1)).toISOString();

  const [
    { data: venues },
    { count: stampsDayCount },
    { count: stampsPrevCount },
    { count: rewardsDayCount },
    { data: dayStampsRows },
    { count: totalMembersCount },
    { data: weekStampsRows },
    { data: recentStamps },
    { data: recentRewards },
    { data: closeToRewardRows },
    { data: program },
  ] = await Promise.all([
    supabase
      .from("stampy_venues")
      .select("id, name")
      .eq("tenant_id", tenant.id)
      .eq("active", true)
      .order("name"),
    supabase
      .from("stampy_stamps")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .gte("created_at", dayStart)
      .lt("created_at", dayEnd),
    supabase
      .from("stampy_stamps")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .gte("created_at", prevDayStart)
      .lt("created_at", dayStart),
    supabase
      .from("stampy_rewards")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .eq("status", "redeemed")
      .gte("redeemed_at", dayStart)
      .lt("redeemed_at", dayEnd),
    supabase
      .from("stampy_stamps")
      .select("membership_id")
      .eq("tenant_id", tenant.id)
      .gte("created_at", dayStart)
      .lt("created_at", dayEnd),
    supabase
      .from("stampy_memberships")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id),
    supabase
      .from("stampy_stamps")
      .select("created_at")
      .eq("tenant_id", tenant.id)
      .gte("created_at", weekAgo)
      .lt("created_at", dayEnd),
    supabase
      .from("stampy_stamps")
      .select(
        "id, created_at, source, venue:stampy_venues(name), membership:stampy_memberships(stamps_count, customer:stampy_customers(first_name, username))",
      )
      .eq("tenant_id", tenant.id)
      .lt("created_at", dayEnd)
      .order("created_at", { ascending: false })
      .limit(8)
      .returns<
        {
          id: string;
          created_at: string;
          source: string;
          venue: { name: string } | null;
          membership: {
            stamps_count: number;
            customer: { first_name: string | null; username: string | null } | null;
          } | null;
        }[]
      >(),
    supabase
      .from("stampy_rewards")
      .select(
        "id, title, redeemed_at, venue:stampy_venues(name), membership:stampy_memberships(customer:stampy_customers(first_name, username))",
      )
      .eq("tenant_id", tenant.id)
      .eq("status", "redeemed")
      .lt("redeemed_at", dayEnd)
      .order("redeemed_at", { ascending: false })
      .limit(8)
      .returns<
        {
          id: string;
          title: string;
          redeemed_at: string | null;
          venue: { name: string } | null;
          membership: {
            customer: { first_name: string | null; username: string | null } | null;
          } | null;
        }[]
      >(),
    // Топ по накопленным штампам — из них клиентски отфильтруем тех, кому
    // остался один до награды. Полезнее всего бариста: «Азиз пришёл, 5/6,
    // предложи капучино с рекомендацией добить».
    supabase
      .from("stampy_memberships")
      .select(
        "id, stamps_count, last_stamp_at, customer:stampy_customers(first_name, username)",
      )
      .eq("tenant_id", tenant.id)
      .gte("stamps_count", 1)
      .order("stamps_count", { ascending: false })
      .order("last_stamp_at", { ascending: false })
      .limit(10)
      .returns<
        {
          id: string;
          stamps_count: number;
          last_stamp_at: string | null;
          customer: { first_name: string | null; username: string | null } | null;
        }[]
      >(),
    supabase
      .from("stampy_loyalty_programs")
      .select("stamps_required")
      .eq("tenant_id", tenant.id)
      .eq("active", true)
      .maybeSingle(),
  ]);

  const stampsRequired = program?.stamps_required ?? 6;

  const uniqueGuestsDay = new Set(dayStampsRows?.map((r) => r.membership_id)).size;

  // Кладём 7 дней, где последний — выбранный. Границы дней считаем в Ташкенте.
  const dailyCounts = [0, 0, 0, 0, 0, 0, 0];
  const dayBuckets: Array<[Date, Date]> = [];
  for (let i = 6; i >= 0; i--) {
    const iso = shiftDayISO(dayISO, -i);
    dayBuckets.push([tenantDayStart(iso), tenantDayEnd(iso)]);
  }
  for (const s of weekStampsRows ?? []) {
    const t = new Date(s.created_at).getTime();
    for (let i = 0; i < 7; i++) {
      const [a, b] = dayBuckets[i];
      if (t >= a.getTime() && t < b.getTime()) {
        dailyCounts[i] = (dailyCounts[i] || 0) + 1;
        break;
      }
    }
  }

  type EventItem = {
    id: string;
    type: "stamp" | "reward";
    title: string;
    subtitle: string;
    date: Date;
    time: string;
  };

  const selectedStartMs = tenantDayStart(dayISO).getTime();

  function labelTime(d: Date): string {
    const hhmm = formatTenantTime(d);
    if (d.getTime() >= selectedStartMs) return hhmm;
    return `${formatTenantDate(d)} · ${hhmm}`;
  }

  function guestLabel(customer: { first_name: string | null; username: string | null } | null | undefined): string {
    if (!customer) return "Гость";
    return customer.first_name?.trim() || (customer.username ? `@${customer.username}` : "Гость");
  }

  const stampEvents: EventItem[] = (recentStamps ?? []).map((s) => {
    const d = new Date(s.created_at);
    const name = guestLabel(s.membership?.customer);
    const progress =
      typeof s.membership?.stamps_count === "number"
        ? `${s.membership.stamps_count}/${stampsRequired}`
        : "";
    const source = s.source === "manual" ? "вручную" : "NFC";
    return {
      id: `s-${s.id}`,
      type: "stamp" as const,
      title: name,
      subtitle: [progress, source, s.venue?.name].filter(Boolean).join(" · "),
      date: d,
      time: labelTime(d),
    };
  });

  const rewardEvents: EventItem[] = (recentRewards ?? []).map((r) => {
    const d = new Date(r.redeemed_at || Date.now());
    const name = guestLabel(r.membership?.customer);
    return {
      id: `r-${r.id}`,
      type: "reward" as const,
      title: `${name} — награда`,
      subtitle: [r.title, r.venue?.name ? r.venue.name : "на кассе"].filter(Boolean).join(" · "),
      date: d,
      time: labelTime(d),
    };
  });

  const combinedEvents = [...stampEvents, ...rewardEvents]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 8);

  const closeToReward = (closeToRewardRows ?? [])
    .filter((row) => row.stamps_count === stampsRequired - 1)
    .slice(0, 5)
    .map((row) => ({
      id: row.id,
      name: guestLabel(row.customer),
      stampsCount: row.stamps_count,
      stampsRequired: stampsRequired,
    }));

  const stats: StaffStats = {
    stampsToday: stampsDayCount ?? 0,
    stampsDelta: (stampsDayCount ?? 0) - (stampsPrevCount ?? 0),
    guestsToday: uniqueGuestsDay,
    rewardsToday: rewardsDayCount ?? 0,
    returnRate:
      totalMembersCount && totalMembersCount > 0
        ? Math.min(100, Math.round((uniqueGuestsDay / totalMembersCount) * 100))
        : 0,
    weeklyCounts: dailyCounts,
    recentEvents: combinedEvents.map(({ id, type, title, subtitle, time }) => ({ id, type, title, subtitle, time })),
    closeToReward,
  };

  const ROLE_LABELS: Record<string, string> = {
    owner: "Владелец",
    manager: "Менеджер",
    cashier: "Бариста",
  };

  return (
    <StaffConsole
      tenantName={tenant.name}
      staffName={staff.name?.trim() || staff.username}
      staffRole={ROLE_LABELS[staff.role] ?? staff.role}
      venues={venues ?? []}
      defaultVenueId={staff.venue_id}
      stats={stats}
      showDashboardLink={staff.role !== "cashier"}
      dayISO={dayISO}
      todayISO={today}
      prevDayISO={shiftDayISO(dayISO, -1)}
      nextDayISO={isToday ? null : shiftDayISO(dayISO, 1)}
    />
  );
}
