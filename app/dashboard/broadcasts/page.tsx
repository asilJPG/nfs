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
      <div className="empty">
        <h1 className="card-title">Рассылки</h1>
        <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-ink-soft">
          Напоминайте о себе тем, кто давно не заходил, и тем, кому остался один штамп до награды.
          Доступно на тарифе с маркетингом.
        </p>
        <Link
          href="/dashboard/billing"
          className="btn btn-primary btn-sm mt-5"
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
      <header className="border-b border-line pb-5">
        <h1 className="page-title">Рассылки</h1>
        <p className="page-subtitle">Сообщение уходит гостям в Telegram от имени кофейни</p>
      </header>

      <BroadcastComposer />

      <section className="flex flex-col gap-2">
        <h2 className="card-title">История</h2>
        {(broadcasts ?? []).length === 0 && (
          <p className="empty text-[13px] text-ink-soft">Рассылок пока не было.</p>
        )}
        {(broadcasts ?? []).map((broadcast: Broadcast) => (
          <article key={broadcast.id} className="card p-4">
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-slate-300">
                {SEGMENT_LABELS[broadcast.segment.type] ?? broadcast.segment.type}
              </span>
              <span
                className={`badge ${
                  broadcast.status === "done"
                    ? "badge-ok"
                    : broadcast.status === "failed"
                      ? "badge-bad"
                      : "badge-muted"
                }`}
              >
                {STATUS_LABELS[broadcast.status]}
              </span>
            </div>
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-200">
              {broadcast.body}
            </p>
            <p className="mt-3 text-xs text-ink-faint">
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
