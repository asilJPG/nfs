import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { can } from "@/lib/plan";
import { BroadcastComposer } from "@/components/dashboard/BroadcastComposer";
import type { Broadcast, BroadcastStatus } from "@/types/db";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<BroadcastStatus, string> = {
  draft: "Черновик",
  scheduled: "Запланирована",
  sending: "Отправляется",
  done: "Отправлена",
  failed: "Остановлена",
};

const SEGMENT_LABELS: Record<string, string> = {
  all: "Все гости",
  inactive: "Давно не были",
  new: "Новые",
  close_to_reward: "Почти собрали карту",
  has_reward: "Есть незабранная награда",
};

export default async function BroadcastsPage() {
  const { tenant } = await requireRole("owner", "manager");

  if (!can(tenant, "broadcasts")) {
    return (
      <div className="rounded-2xl border border-dashed border-line p-8 text-center">
        <h1 className="text-lg font-semibold">Рассылки</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
          Напоминайте о себе тем, кто давно не заходил, и тем, кому остался один штамп до награды.
          Доступно на тарифе с маркетингом.
        </p>
        <Link
          href="/dashboard/billing"
          className="mt-4 inline-block rounded-2xl bg-bean px-5 py-3 text-sm font-medium text-white"
        >
          Посмотреть тарифы
        </Link>
      </div>
    );
  }

  const supabase = await supabaseServer();
  const { data: broadcasts } = await supabase
    .from("stampy_broadcasts")
    .select("*")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false })
    .limit(30);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Рассылки</h1>

      <BroadcastComposer />

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">История</h2>
        {(broadcasts ?? []).length === 0 && (
          <p className="text-sm text-ink-soft">Рассылок пока не было.</p>
        )}
        {(broadcasts ?? []).map((broadcast: Broadcast) => (
          <article key={broadcast.id} className="rounded-2xl border border-line bg-white p-4">
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="text-ink-soft">
                {SEGMENT_LABELS[broadcast.segment.type] ?? broadcast.segment.type}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs ${
                  broadcast.status === "done"
                    ? "bg-bean/10 text-bean-dark"
                    : broadcast.status === "failed"
                      ? "bg-red-50 text-red-700"
                      : "bg-line/60 text-ink-soft"
                }`}
              >
                {STATUS_LABELS[broadcast.status]}
              </span>
            </div>
            <p className="whitespace-pre-wrap text-sm">{broadcast.body}</p>
            <p className="mt-2 text-xs text-ink-soft">
              {new Date(broadcast.created_at).toLocaleString("ru-RU", { timeZone: "Asia/Tashkent" })}
              {" · "}
              доставлено {broadcast.sent_count}
              {broadcast.failed_count > 0 && `, не доставлено ${broadcast.failed_count}`}
            </p>
          </article>
        ))}
      </section>
    </div>
  );
}
