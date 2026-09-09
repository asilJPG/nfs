import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { impersonateTenantAction } from "@/app/admin/actions";
import { daysLeftInTrial, isServing, PLAN_CARDS } from "@/lib/plan";
import type { StaffUser, Tenant, Venue } from "@/types/db";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  trial: "Пробный период",
  active: "Активна",
  past_due: "Ожидает оплаты",
  suspended: "Приостановлена",
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Владелец",
  manager: "Менеджер",
  cashier: "Бариста",
};

export default async function TenantDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();

  const [{ data: tenant }, { data: venues }, { data: staff }, { data: tagsCount }, { data: recent }] =
    await Promise.all([
      supabase.from("stampy_tenants").select("*").eq("id", id).maybeSingle<Tenant>(),
      supabase.from("stampy_venues").select("*").eq("tenant_id", id).order("created_at").returns<Venue[]>(),
      supabase
        .from("stampy_staff_users")
        .select("*")
        .eq("tenant_id", id)
        .order("role")
        .returns<StaffUser[]>(),
      supabase
        .from("stampy_nfc_tags")
        .select("uid", { count: "exact", head: true })
        .eq("tenant_id", id)
        .then((r) => ({ data: r.count ?? 0 })),
      supabase
        .from("stampy_stamps")
        .select("created_at, source, stampy_venues(name)")
        .eq("tenant_id", id)
        .order("created_at", { ascending: false })
        .limit(25)
        .returns<{ created_at: string; source: string; stampy_venues: { name: string } | null }[]>(),
    ]);

  if (!tenant) notFound();

  const bindImpersonate = impersonateTenantAction.bind(null, id);
  const serving = isServing(tenant);
  const planName = PLAN_CARDS.find((plan) => plan.id === tenant.plan)?.name ?? tenant.plan;
  const trialDays = daysLeftInTrial(tenant);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/tenants" className="text-xs font-medium text-latte hover:underline">
        ← К списку кофеен
      </Link>

      <header className="card flex flex-wrap items-start justify-between gap-4 p-5 md:p-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="page-title">{tenant.name}</h1>
            <span className={`badge ${serving ? "badge-ok" : "badge-bad"}`}>
              {STATUS_LABELS[tenant.subscription_status] ?? tenant.subscription_status}
            </span>
          </div>
          <p className="page-subtitle">
            /{tenant.slug} · {planName}
            {trialDays !== null && ` · осталось ${trialDays} дн. пробного`}
          </p>
        </div>
        <form action={bindImpersonate}>
          <button className="btn btn-accent btn-sm">Войти как владелец</button>
        </form>
      </header>

      <section className="grid gap-3.5 sm:grid-cols-3">
        <Metric label="Точек" value={venues?.length ?? 0} />
        <Metric label="Сотрудников" value={staff?.length ?? 0} />
        <Metric label="Меток привязано" value={tagsCount ?? 0} />
      </section>

      <section className="card p-5 md:p-6">
        <h2 className="card-title mb-4">Точки ({venues?.length ?? 0})</h2>
        {(venues ?? []).length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-soft">Точек нет.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {venues!.map((venue) => (
              <li
                key={venue.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface-2 px-3.5 py-2.5"
              >
                <span className="font-medium text-ink">{venue.name}</span>
                {!venue.active && <span className="badge badge-bad">неактивна</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5 md:p-6">
        <h2 className="card-title mb-4">Сотрудники ({staff?.length ?? 0})</h2>
        {(staff ?? []).length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-soft">Никого нет.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {staff!.map((member) => (
              <li
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface-2 px-3.5 py-2.5"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-ink">{member.username}</span>
                  <span className="badge badge-muted">
                    {ROLE_LABELS[member.role] ?? member.role}
                  </span>
                </span>
                {!member.active && <span className="badge badge-bad">неактивен</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5 md:p-6">
        <h2 className="card-title mb-1">Недавние штампы</h2>
        <p className="mb-4 text-xs text-ink-faint">Последние {recent?.length ?? 0} начислений</p>
        {(recent ?? []).length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-soft">Пусто.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {recent!.map((stamp, index) => (
              <li
                key={index}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface-2 px-3.5 py-2.5"
              >
                <span className="text-xs text-ink-soft tabular-nums">
                  {new Date(stamp.created_at).toLocaleString("ru-RU")}
                </span>
                <span className="text-xs text-ink-soft">
                  {stamp.stampy_venues?.name ?? "без точки"} ·{" "}
                  {stamp.source === "nfc" ? "NFC" : "вручную"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-5">
      <span className="eyebrow block">{label}</span>
      <p className="mt-2 text-2xl font-bold tracking-tight text-ink tabular-nums">{value}</p>
    </div>
  );
}
