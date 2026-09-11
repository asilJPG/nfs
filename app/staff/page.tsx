import { requireStaff } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import {
  StaffConsole,
  type AnalyticsData,
  type HistoryData,
  type RewardsData,
  type StaffStats,
  type StaffTab,
} from "@/components/staff/StaffConsole";
import {
  formatTenantDate,
  formatTenantTime,
  shiftDayISO,
  tenantDateISO,
  tenantDayEnd,
  tenantDayStart,
} from "@/lib/time";

export const dynamic = "force-dynamic";

type SearchParams = { date?: string; tab?: string };

const VALID_TABS: StaffTab[] = ["stamps", "rewards", "analytics", "history"];

function guestLabel(customer: { first_name: string | null; username: string | null } | null | undefined): string {
  if (!customer) return "Гость";
  return customer.first_name?.trim() || (customer.username ? `@${customer.username}` : "Гость");
}

export default async function StaffPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { staff, tenant } = await requireStaff();
  const supabase = await supabaseServer();

  const params = await searchParams;
  const today = tenantDateISO();
  const dayISO =
    /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? "") && params.date! <= today ? params.date! : today;
  const isToday = dayISO === today;
  const activeTab: StaffTab = VALID_TABS.includes(params.tab as StaffTab)
    ? (params.tab as StaffTab)
    : "stamps";

  // Программа нужна почти везде — читаем всегда, дёшево.
  const { data: program } = await supabase
    .from("stampy_loyalty_programs")
    .select("stamps_required")
    .eq("tenant_id", tenant.id)
    .eq("active", true)
    .maybeSingle();
  const stampsRequired = program?.stamps_required ?? 6;

  const { data: venues } = await supabase
    .from("stampy_venues")
    .select("id, name")
    .eq("tenant_id", tenant.id)
    .eq("active", true)
    .order("name");

  const ROLE_LABELS: Record<string, string> = {
    owner: "Владелец",
    manager: "Менеджер",
    cashier: "Бариста",
  };

  const commonProps = {
    tenantName: tenant.name,
    staffName: staff.name?.trim() || staff.username,
    staffRole: ROLE_LABELS[staff.role] ?? staff.role,
    venues: venues ?? [],
    defaultVenueId: staff.venue_id,
    showDashboardLink: staff.role !== "cashier",
    dayISO,
    todayISO: today,
    prevDayISO: shiftDayISO(dayISO, -1),
    nextDayISO: isToday ? null : shiftDayISO(dayISO, 1),
    activeTab,
  };

  if (activeTab === "rewards") {
    const rewards = await loadRewards(supabase, tenant.id, dayISO);
    return <StaffConsole {...commonProps} rewards={rewards} />;
  }
  if (activeTab === "analytics") {
    const analytics = await loadAnalytics(supabase, tenant.id, dayISO);
    return <StaffConsole {...commonProps} analytics={analytics} />;
  }
  if (activeTab === "history") {
    const history = await loadHistory(supabase, tenant.id, dayISO);
    return <StaffConsole {...commonProps} history={history} />;
  }

  // Штампы — основная вкладка
  const stats = await loadStamps(supabase, tenant.id, dayISO, stampsRequired);
  return <StaffConsole {...commonProps} stats={stats} />;
}

type Sb = Awaited<ReturnType<typeof supabaseServer>>;

async function loadStamps(
  supabase: Sb,
  tenantId: string,
  dayISO: string,
  stampsRequired: number,
): Promise<StaffStats> {
  const dayStart = tenantDayStart(dayISO).toISOString();
  const dayEnd = tenantDayEnd(dayISO).toISOString();
  const weekAgo = tenantDayStart(shiftDayISO(dayISO, -6)).toISOString();
  const prevDayStart = tenantDayStart(shiftDayISO(dayISO, -1)).toISOString();

  const [
    { count: stampsDayCount },
    { count: stampsPrevCount },
    { count: rewardsDayCount },
    { data: dayStampsRows },
    { count: totalMembersCount },
    { data: weekStampsRows },
    { data: recentStamps },
    { data: recentRewards },
    { data: closeToRewardRows },
  ] = await Promise.all([
    supabase
      .from("stampy_stamps")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("created_at", dayStart)
      .lt("created_at", dayEnd),
    supabase
      .from("stampy_stamps")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("created_at", prevDayStart)
      .lt("created_at", dayStart),
    supabase
      .from("stampy_rewards")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "redeemed")
      .gte("redeemed_at", dayStart)
      .lt("redeemed_at", dayEnd),
    supabase
      .from("stampy_stamps")
      .select("membership_id")
      .eq("tenant_id", tenantId)
      .gte("created_at", dayStart)
      .lt("created_at", dayEnd),
    supabase
      .from("stampy_memberships")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    supabase
      .from("stampy_stamps")
      .select("created_at")
      .eq("tenant_id", tenantId)
      .gte("created_at", weekAgo)
      .lt("created_at", dayEnd),
    supabase
      .from("stampy_stamps")
      .select(
        "id, created_at, source, venue:stampy_venues(name), membership:stampy_memberships(stamps_count, customer:stampy_customers(first_name, username))",
      )
      .eq("tenant_id", tenantId)
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
      .eq("tenant_id", tenantId)
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
    supabase
      .from("stampy_memberships")
      .select(
        "id, stamps_count, last_stamp_at, customer:stampy_customers(first_name, username)",
      )
      .eq("tenant_id", tenantId)
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
  ]);

  const uniqueGuestsDay = new Set(dayStampsRows?.map((r) => r.membership_id)).size;

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

  const selectedStartMs = tenantDayStart(dayISO).getTime();
  function labelTime(d: Date): string {
    const hhmm = formatTenantTime(d);
    if (d.getTime() >= selectedStartMs) return hhmm;
    return `${formatTenantDate(d)} · ${hhmm}`;
  }

  const stampEvents = (recentStamps ?? []).map((s) => {
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

  const rewardEvents = (recentRewards ?? []).map((r) => {
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
      stampsRequired,
    }));

  return {
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
}

async function loadRewards(supabase: Sb, tenantId: string, dayISO: string): Promise<RewardsData> {
  const dayStart = tenantDayStart(dayISO).toISOString();
  const dayEnd = tenantDayEnd(dayISO).toISOString();
  const monthAgo = tenantDayStart(shiftDayISO(dayISO, -30)).toISOString();

  const [{ data: earnedRows }, { data: redeemedRows }, { count: expiredCount }] = await Promise.all([
    supabase
      .from("stampy_rewards")
      .select(
        "id, title, earned_at, expires_at, membership:stampy_memberships(customer:stampy_customers(first_name, username))",
      )
      .eq("tenant_id", tenantId)
      .eq("status", "earned")
      .order("earned_at", { ascending: false })
      .limit(20)
      .returns<
        {
          id: string;
          title: string;
          earned_at: string;
          expires_at: string | null;
          membership: {
            customer: { first_name: string | null; username: string | null } | null;
          } | null;
        }[]
      >(),
    supabase
      .from("stampy_rewards")
      .select(
        "id, title, redeemed_at, venue:stampy_venues(name), membership:stampy_memberships(customer:stampy_customers(first_name, username))",
      )
      .eq("tenant_id", tenantId)
      .eq("status", "redeemed")
      .gte("redeemed_at", dayStart)
      .lt("redeemed_at", dayEnd)
      .order("redeemed_at", { ascending: false })
      .limit(30)
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
    supabase
      .from("stampy_rewards")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "expired")
      .gte("earned_at", monthAgo),
  ]);

  const readyToRedeem = (earnedRows ?? [])
    .filter((r) => !r.expires_at || new Date(r.expires_at).getTime() > Date.now())
    .map((r) => ({
      id: r.id,
      name: guestLabel(r.membership?.customer),
      title: r.title,
      earnedAt: formatTenantDate(new Date(r.earned_at)),
    }));

  const redeemedToday = (redeemedRows ?? []).map((r) => ({
    id: r.id,
    name: guestLabel(r.membership?.customer),
    title: r.title,
    time: formatTenantTime(new Date(r.redeemed_at || Date.now())),
    venue: r.venue?.name ?? null,
  }));

  return { readyToRedeem, redeemedToday, expiredCount: expiredCount ?? 0 };
}

async function loadAnalytics(supabase: Sb, tenantId: string, dayISO: string): Promise<AnalyticsData> {
  const dayStart = tenantDayStart(dayISO).toISOString();
  const dayEnd = tenantDayEnd(dayISO).toISOString();

  const [{ data: dayStamps }, { data: topMembers }, { count: newGuestsCount }] = await Promise.all([
    supabase
      .from("stampy_stamps")
      .select("created_at, venue_id, venue:stampy_venues(name)")
      .eq("tenant_id", tenantId)
      .gte("created_at", dayStart)
      .lt("created_at", dayEnd)
      .returns<{ created_at: string; venue_id: string | null; venue: { name: string } | null }[]>(),
    supabase
      .from("stampy_memberships")
      .select(
        "id, lifetime_stamps, customer:stampy_customers(first_name, username)",
      )
      .eq("tenant_id", tenantId)
      .gte("lifetime_stamps", 1)
      .order("lifetime_stamps", { ascending: false })
      .limit(5)
      .returns<
        {
          id: string;
          lifetime_stamps: number;
          customer: { first_name: string | null; username: string | null } | null;
        }[]
      >(),
    supabase
      .from("stampy_memberships")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("first_seen_at", dayStart)
      .lt("first_seen_at", dayEnd),
  ]);

  const hourly = new Array<number>(24).fill(0);
  const dayStartMs = tenantDayStart(dayISO).getTime();
  for (const row of dayStamps ?? []) {
    const t = new Date(row.created_at).getTime();
    const hour = Math.floor((t - dayStartMs) / 3_600_000);
    if (hour >= 0 && hour < 24) hourly[hour] += 1;
  }

  const venueMap = new Map<string, { name: string; count: number }>();
  for (const row of dayStamps ?? []) {
    if (!row.venue_id) continue;
    const name = row.venue?.name ?? "—";
    const prev = venueMap.get(row.venue_id) ?? { name, count: 0 };
    prev.count += 1;
    venueMap.set(row.venue_id, prev);
  }

  return {
    topGuests: (topMembers ?? []).map((m) => ({
      id: m.id,
      name: guestLabel(m.customer),
      lifetime: m.lifetime_stamps,
    })),
    hourly,
    topVenues: [...venueMap.entries()]
      .map(([id, v]) => ({ id, name: v.name, count: v.count }))
      .sort((a, b) => b.count - a.count),
    newGuests: newGuestsCount ?? 0,
  };
}

async function loadHistory(supabase: Sb, tenantId: string, dayISO: string): Promise<HistoryData> {
  const dayEnd = tenantDayEnd(dayISO).toISOString();
  const monthAgo = tenantDayStart(shiftDayISO(dayISO, -30)).toISOString();

  const [{ data: stamps }, { data: rewards }, { count: totalStamps }, { count: totalRewards }] =
    await Promise.all([
      supabase
        .from("stampy_stamps")
        .select(
          "id, created_at, source, venue:stampy_venues(name), membership:stampy_memberships(stamps_count, customer:stampy_customers(first_name, username))",
        )
        .eq("tenant_id", tenantId)
        .gte("created_at", monthAgo)
        .lt("created_at", dayEnd)
        .order("created_at", { ascending: false })
        .limit(50)
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
        .eq("tenant_id", tenantId)
        .eq("status", "redeemed")
        .gte("redeemed_at", monthAgo)
        .lt("redeemed_at", dayEnd)
        .order("redeemed_at", { ascending: false })
        .limit(20)
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
      supabase
        .from("stampy_stamps")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .gte("created_at", monthAgo)
        .lt("created_at", dayEnd),
      supabase
        .from("stampy_rewards")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status", "redeemed")
        .gte("redeemed_at", monthAgo)
        .lt("redeemed_at", dayEnd),
    ]);

  const stampEvents = (stamps ?? []).map((s) => {
    const d = new Date(s.created_at);
    return {
      id: `s-${s.id}`,
      type: "stamp" as const,
      title: guestLabel(s.membership?.customer),
      subtitle: [s.venue?.name, s.source === "manual" ? "вручную" : "NFC"].filter(Boolean).join(" · "),
      date: d,
      time: `${formatTenantDate(d)} · ${formatTenantTime(d)}`,
    };
  });
  const rewardEvents = (rewards ?? []).map((r) => {
    const d = new Date(r.redeemed_at || Date.now());
    return {
      id: `r-${r.id}`,
      type: "reward" as const,
      title: `${guestLabel(r.membership?.customer)} — награда`,
      subtitle: [r.title, r.venue?.name].filter(Boolean).join(" · "),
      date: d,
      time: `${formatTenantDate(d)} · ${formatTenantTime(d)}`,
    };
  });

  const events = [...stampEvents, ...rewardEvents]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 30)
    .map(({ id, type, title, subtitle, time }) => ({ id, type, title, subtitle, time }));

  return { events, totalStamps: totalStamps ?? 0, totalRewards: totalRewards ?? 0 };
}
