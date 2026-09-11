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

  const [
    { data: venues },
    { count: stampsDayCount },
    { count: rewardsDayCount },
    { data: dayStampsRows },
    { count: totalMembersCount },
    { data: weekStampsRows },
    { data: recentStamps },
    { data: recentRewards },
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
      .select("id, created_at, source, venue:stampy_venues(name)")
      .eq("tenant_id", tenant.id)
      .lt("created_at", dayEnd)
      .order("created_at", { ascending: false })
      .limit(8)
      .returns<{ id: string; created_at: string; source: string; venue: { name: string } | null }[]>(),
    supabase
      .from("stampy_rewards")
      .select("id, title, redeemed_at, venue:stampy_venues(name)")
      .eq("tenant_id", tenant.id)
      .eq("status", "redeemed")
      .lt("redeemed_at", dayEnd)
      .order("redeemed_at", { ascending: false })
      .limit(8)
      .returns<{ id: string; title: string; redeemed_at: string | null; venue: { name: string } | null }[]>(),
  ]);

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

  const stampEvents: EventItem[] = (recentStamps ?? []).map((s) => {
    const d = new Date(s.created_at);
    return {
      id: `s-${s.id}`,
      type: "stamp" as const,
      title: "Штамп добавлен",
      subtitle: [s.source === "manual" ? "вручную" : "NFC-метка", s.venue?.name].filter(Boolean).join(" · "),
      date: d,
      time: labelTime(d),
    };
  });

  const rewardEvents: EventItem[] = (recentRewards ?? []).map((r) => {
    const d = new Date(r.redeemed_at || Date.now());
    return {
      id: `r-${r.id}`,
      type: "reward" as const,
      title: `Награда: ${r.title}`,
      subtitle: r.venue?.name ? `выдано · ${r.venue.name}` : "выдано на кассе",
      date: d,
      time: labelTime(d),
    };
  });

  const combinedEvents = [...stampEvents, ...rewardEvents]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 8);

  const stats: StaffStats = {
    stampsToday: stampsDayCount ?? 0,
    guestsToday: uniqueGuestsDay,
    rewardsToday: rewardsDayCount ?? 0,
    returnRate:
      totalMembersCount && totalMembersCount > 0
        ? Math.min(100, Math.round((uniqueGuestsDay / totalMembersCount) * 100))
        : 0,
    weeklyCounts: dailyCounts,
    recentEvents: combinedEvents.map(({ id, type, title, subtitle, time }) => ({ id, type, title, subtitle, time })),
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
