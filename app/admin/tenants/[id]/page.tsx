import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { impersonateTenantAction } from "@/app/admin/actions";
import type { StaffUser, Tenant, Venue } from "@/types/db";

export const dynamic = "force-dynamic";

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

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/tenants" className="text-sm text-ink-soft underline">
        ← К списку кофеен
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-line bg-white p-5">
        <div>
          <h1 className="text-xl font-semibold">{tenant.name}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            /{tenant.slug} · тариф {tenant.plan} · подписка {tenant.subscription_status}
          </p>
        </div>
        <form action={bindImpersonate}>
          <button className="rounded-xl bg-bean px-4 py-2 text-sm font-medium text-white">
            Войти как владелец
          </button>
        </form>
      </header>

      <section>
        <h2 className="mb-2 font-medium">Точки ({venues?.length ?? 0})</h2>
        {(venues ?? []).length === 0 ? (
          <p className="text-sm text-ink-soft">Точек нет.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {venues!.map((v) => (
              <li key={v.id} className="rounded-xl border border-line bg-white px-3 py-2">
                {v.name}
                {!v.active && <span className="ml-2 text-xs text-red-600">неактивна</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-medium">Сотрудники ({staff?.length ?? 0})</h2>
        {(staff ?? []).length === 0 ? (
          <p className="text-sm text-ink-soft">Никого нет.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {staff!.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-white px-3 py-2"
              >
                <span>
                  <span className="font-mono text-xs">{s.username}</span>
                  <span className="ml-2 text-ink-soft">· {s.role}</span>
                  {!s.active && <span className="ml-2 text-xs text-red-600">неактивен</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-medium">Меток привязано: {tagsCount ?? 0}</h2>
      </section>

      <section>
        <h2 className="mb-2 font-medium">Недавние штампы ({recent?.length ?? 0})</h2>
        {(recent ?? []).length === 0 ? (
          <p className="text-sm text-ink-soft">Пусто.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {recent!.map((s, i) => (
              <li key={i} className="flex gap-3 rounded-xl border border-line bg-white px-3 py-2">
                <span className="text-ink-soft">{new Date(s.created_at).toLocaleString("ru-RU")}</span>
                <span className="ml-auto text-xs text-ink-soft">
                  {s.stampy_venues?.name ?? "—"} · {s.source === "nfc" ? "NFC" : "вручную"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
