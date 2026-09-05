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

  const c = detail.customer;
  const name =
    c.first_name || c.last_name
      ? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim()
      : c.username
        ? `@${c.username}`
        : `Гость ${c.telegram_id}`;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/guests" className="text-sm text-ink-soft underline">
        ← К списку гостей
      </Link>

      <header className="rounded-2xl border border-line bg-white p-5">
        <h1 className="text-xl font-semibold">{name}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Telegram-id {c.telegram_id}
          {c.username && ` · @${c.username}`} · с {new Date(c.created_at).toLocaleDateString("ru-RU")}
        </p>
        <div className="mt-3">
          <GuestDetailActions customerId={c.id} blocked={!c.can_message} />
        </div>
      </header>

      <section>
        <h2 className="mb-2 font-medium">Карты ({detail.cards.length})</h2>
        {detail.cards.length === 0 ? (
          <p className="text-sm text-ink-soft">Карт нет.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {detail.cards.map((card) => (
              <li
                key={card.slug}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-white p-3 text-sm"
              >
                <div>
                  <p className="font-medium">{card.tenant_name}</p>
                  <p className="text-xs text-ink-soft">/{card.slug}</p>
                </div>
                <div className="flex gap-4 text-xs text-ink-soft">
                  <span>{card.stamps_count} штампов</span>
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

      <section>
        <h2 className="mb-2 font-medium">Последние штампы</h2>
        {detail.recent_stamps.length === 0 ? (
          <p className="text-sm text-ink-soft">Пусто.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {detail.recent_stamps.map((s, i) => (
              <li key={i} className="flex flex-wrap gap-2 rounded-xl border border-line bg-white px-3 py-2">
                <span className="text-ink-soft">
                  {new Date(s.created_at).toLocaleString("ru-RU")}
                </span>
                <span>·</span>
                <span>{s.tenant_name}</span>
                {s.venue_name && (
                  <>
                    <span>·</span>
                    <span className="text-ink-soft">{s.venue_name}</span>
                  </>
                )}
                <span className="ml-auto text-xs text-ink-soft">
                  {s.source === "nfc" ? "NFC" : "вручную"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
