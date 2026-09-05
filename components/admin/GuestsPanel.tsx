"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { input } from "@/components/admin/shared";

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

export function GuestsPanel({
  initialGuests,
  initialQuery,
}: {
  initialGuests: GuestRow[];
  initialQuery: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const url = q.trim() ? `/admin/guests?q=${encodeURIComponent(q.trim())}` : "/admin/guests";
    router.push(url);
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск по имени, username, Telegram-id…"
          className={`${input} flex-1`}
        />
        <button type="submit" className="rounded-2xl bg-bean px-5 py-3 text-sm font-medium text-white">
          Найти
        </button>
      </form>

      <p className="text-sm text-ink-soft">
        {initialGuests.length === 0
          ? initialQuery
            ? "Никого не нашлось."
            : "Гостей пока нет."
          : `Показано ${initialGuests.length}${initialGuests.length === 100 ? " (первые)" : ""}`}
      </p>

      <ul className="flex flex-col gap-2">
        {initialGuests.map((g) => (
          <li key={g.id}>
            <Link
              href={`/admin/guests/${g.id}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-3 text-sm hover:bg-cream/40"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {g.first_name || g.last_name
                    ? `${g.first_name ?? ""} ${g.last_name ?? ""}`.trim()
                    : g.username
                      ? `@${g.username}`
                      : `Гость ${g.telegram_id}`}
                  {!g.can_message && (
                    <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700">
                      заблокирован
                    </span>
                  )}
                </p>
                <p className="text-xs text-ink-soft">
                  id {g.telegram_id}
                  {g.username && ` · @${g.username}`}
                </p>
              </div>
              <div className="flex gap-4 text-xs text-ink-soft">
                <span>{g.cards_count} карт</span>
                <span>{g.stamps_count} штампов</span>
                <span>{g.rewards_earned} наград</span>
                {g.last_stamp_at && (
                  <span>посл. {new Date(g.last_stamp_at).toLocaleDateString("ru-RU")}</span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
