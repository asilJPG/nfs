"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

export type GuestRow = {
  id: string;
  telegram_id: number;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  can_message: boolean;
  blocked_at: string | null;
  created_at: string;
  cards_count: number;
  stamps_count: number;
  rewards_earned: number;
  last_stamp_at: string | null;
};

function guestName(guest: GuestRow): string {
  if (guest.first_name || guest.last_name) {
    return `${guest.first_name ?? ""} ${guest.last_name ?? ""}`.trim();
  }
  return guest.username ? `@${guest.username}` : `Гость ${guest.telegram_id}`;
}

export function GuestsPanel({
  initialGuests,
  initialQuery,
}: {
  initialGuests: GuestRow[];
  initialQuery: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? `/admin/guests?q=${encodeURIComponent(trimmed)}` : "/admin/guests");
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={submit} className="flex flex-wrap gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Имя, username или Telegram-id"
          className="input flex-1 min-w-[220px]"
        />
        <button type="submit" className="btn btn-accent">
          Найти
        </button>
        {initialQuery && (
          <Link href="/admin/guests" className="btn btn-ghost">
            Сбросить
          </Link>
        )}
      </form>

      {initialGuests.length === 0 ? (
        <div className="empty">
          <h2 className="card-title">{initialQuery ? "Никого не нашлось" : "Гостей пока нет"}</h2>
          <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-ink-soft">
            {initialQuery
              ? "Проверьте написание или поищите по Telegram-id."
              : "Гости появятся здесь, как только заведут первую карту через NFC-стенд."}
          </p>
        </div>
      ) : (
        <>
          <p className="eyebrow">
            Показано {initialGuests.length}
            {initialGuests.length === 100 ? " — первые совпадения" : ""}
          </p>

          <ul className="flex flex-col gap-2">
            {initialGuests.map((guest) => (
              <li key={guest.id}>
                <Link
                  href={`/admin/guests/${guest.id}`}
                  className="card card-hover flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 truncate text-sm font-semibold text-ink">
                      {guestName(guest)}
                      {!guest.can_message && <span className="badge badge-bad">заблокирован</span>}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-soft">
                      id {guest.telegram_id}
                      {guest.username && ` · @${guest.username}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs text-ink-soft tabular-nums">
                    <span>{guest.cards_count} карт</span>
                    <span>{guest.stamps_count} штампов</span>
                    <span>{guest.rewards_earned} наград</span>
                    {guest.last_stamp_at && (
                      <span>
                        посл. {new Date(guest.last_stamp_at).toLocaleDateString("ru-RU")}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
