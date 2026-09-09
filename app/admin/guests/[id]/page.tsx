import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { GuestDetailActions } from "@/components/admin/GuestDetailActions";

export const dynamic = "force-dynamic";

type Detail = {
  customer: {
    id: string;
    telegram_id: number;
    first_name: string | null;
    last_name: string | null;
    username: string | null;
    can_message: boolean;
    blocked_at: string | null;
    created_at: string;
  };
  cards: {
    tenant_name: string;
    slug: string;
    stamps_count: number;
    lifetime_stamps: number;
    last_stamp_at: string | null;
    rewards_total: number;
    rewards_earned: number;
  }[];
  recent_stamps: {
    created_at: string;
    source: string;
    tenant_name: string;
    venue_name: string | null;
  }[];
  error?: string;
};

export default async function GuestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const { data } = await supabase.rpc("admin_guest_detail", { p_customer: id });
  const detail = data as Detail;

  if (!detail || detail.error === "not_found" || !detail.customer) notFound();

  const customer = detail.customer;
  const name =
    customer.first_name || customer.last_name
      ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim()
      : customer.username
        ? `@${customer.username}`
        : `Гость ${customer.telegram_id}`;

  const totalStamps = detail.cards.reduce((sum, card) => sum + card.lifetime_stamps, 0);
  const readyRewards = detail.cards.reduce((sum, card) => sum + card.rewards_earned, 0);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/guests" className="text-xs font-medium text-latte hover:underline">
        ← К списку гостей
      </Link>

      <header className="card p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="page-title">{name}</h1>
          {!customer.can_message && <span className="badge badge-bad">заблокирован</span>}
        </div>
        <p className="page-subtitle">
          Telegram-id {customer.telegram_id}
          {customer.username && ` · @${customer.username}`} · с{" "}
          {new Date(customer.created_at).toLocaleDateString("ru-RU")}
        </p>
        <div className="mt-4">
          <GuestDetailActions customerId={customer.id} blocked={!customer.can_message} />
        </div>
      </header>

      <section className="grid gap-3.5 sm:grid-cols-3">
        <Metric label="Карт" value={detail.cards.length} />
        <Metric label="Штампов за всё время" value={totalStamps} />
        <Metric label="Наград ждут выдачи" value={readyRewards} />
      </section>

      <section className="card p-5 md:p-6">
        <h2 className="card-title mb-4">Карты ({detail.cards.length})</h2>
        {detail.cards.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-soft">Карт нет.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {detail.cards.map((card) => (
              <li
                key={card.slug}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 p-3.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                    {card.tenant_name}
                    {card.rewards_earned > 0 && (
                      <span className="badge badge-ok">{card.rewards_earned} к выдаче</span>
                    )}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-ink-soft">/{card.slug}</p>
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-ink-soft tabular-nums">
                  <span>{card.stamps_count} на карте</span>
                  <span>{card.lifetime_stamps} за всё время</span>
                  <span>{card.rewards_total} наград</span>
                  {card.last_stamp_at && (
                    <span>посл. {new Date(card.last_stamp_at).toLocaleDateString("ru-RU")}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5 md:p-6">
        <h2 className="card-title mb-1">Последние штампы</h2>
        <p className="mb-4 text-xs text-ink-faint">
          Последние {detail.recent_stamps.length} начислений
        </p>
        {detail.recent_stamps.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-soft">Пусто.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {detail.recent_stamps.map((stamp, index) => (
              <li
                key={index}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface-2 px-3.5 py-2.5"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-ink-soft tabular-nums">
                    {new Date(stamp.created_at).toLocaleString("ru-RU")}
                  </span>
                  <span className="font-medium text-ink">{stamp.tenant_name}</span>
                </span>
                <span className="text-xs text-ink-soft">
                  {stamp.venue_name ?? "без точки"} · {stamp.source === "nfc" ? "NFC" : "вручную"}
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
