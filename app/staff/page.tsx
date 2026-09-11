import { requireStaff } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { StaffConsole, type StaffStats } from "@/components/staff/StaffConsole";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const { staff, tenant } = await requireStaff();
  const supabase = await supabaseServer();

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();

  const [
    { data: venues },
    { count: stampsTodayCount },
    { count: rewardsTodayCount },
    { data: todayStampsRows },
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
      .gte("created_at", todayStart),
    supabase
      .from("stampy_rewards")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .eq("status", "redeemed")
      .gte("redeemed_at", todayStart),
    supabase
      .from("stampy_stamps")
      .select("membership_id")
      .eq("tenant_id", tenant.id)
      .gte("created_at", todayStart),
    supabase
      .from("stampy_memberships")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id),
    supabase
      .from("stampy_stamps")
      .select("created_at")
      .eq("tenant_id", tenant.id)
      .gte("created_at", weekAgo),
    supabase
      .from("stampy_stamps")
      .select("id, created_at, source, venue:stampy_venues(name)")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .limit(5)
      .returns<{ id: string; created_at: string; source: string; venue: { name: string } | null }[]>(),
    supabase
      .from("stampy_rewards")
      .select("id, title, redeemed_at, venue:stampy_venues(name)")
      .eq("tenant_id", tenant.id)
      .eq("status", "redeemed")
      .order("redeemed_at", { ascending: false })
      .limit(5)
      .returns<{ id: string; title: string; redeemed_at: string | null; venue: { name: string } | null }[]>(),
  ]);

  const uniqueGuestsToday = new Set(todayStampsRows?.map((r) => r.membership_id)).size;

  // Build 7-day sparkline
  const dailyCounts = [0, 0, 0, 0, 0, 0, 0];
  for (const s of weekStampsRows ?? []) {
    const diffDays = Math.floor((now.getTime() - new Date(s.created_at).getTime()) / 86_400_000);
    if (diffDays >= 0 && diffDays < 7) {
      dailyCounts[6 - diffDays] = (dailyCounts[6 - diffDays] || 0) + 1;
    }
  }

  // Combine recent events
  type EventItem = {
    id: string;
    type: "stamp" | "reward";
    title: string;
    subtitle: string;
    date: Date;
    time: string;
  };

  // Метка «08.09 · 19:50» для не-сегодняшних событий: иначе после ночи
  // событие с 19:50 читается как «сегодня в 19:50» и путает.
  const todayStartMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  function labelTime(d: Date): string {
    const hhmm = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    if (d.getTime() >= todayStartMs) return hhmm;
    const dm = d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
    return `${dm} · ${hhmm}`;
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
    .slice(0, 5);

  const stats: StaffStats = {
    stampsToday: stampsTodayCount ?? 0,
    guestsToday: uniqueGuestsToday,
    rewardsToday: rewardsTodayCount ?? 0,
    returnRate: totalMembersCount && totalMembersCount > 0 ? Math.min(100, Math.round((uniqueGuestsToday / totalMembersCount) * 100)) : 0,
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
    />
  );
}
