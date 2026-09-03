"use client";

import { useState, useTransition } from "react";
import { manualStampAction, redeemAction, type ActionResult } from "@/app/staff/actions";

type Venue = { id: string; name: string };

type Props = {
  tenantName: string;
  venues: Venue[];
  defaultVenueId: string | null;
};

type Tab = "redeem" | "stamp";

/** The whole cashier surface: two big inputs, one answer at a time. */
export function StaffConsole({ tenantName, venues, defaultVenueId }: Props) {
  const [tab, setTab] = useState<Tab>("redeem");
  const [venueId, setVenueId] = useState<string | null>(defaultVenueId ?? venues[0]?.id ?? null);
  const [value, setValue] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const input = value;
    startTransition(async () => {
      const action = tab === "redeem" ? redeemAction : manualStampAction;
      const outcome = await action(input, venueId);
      setResult(outcome);
      if (outcome.ok) setValue("");
    });
  }

  const isRedeem = tab === "redeem";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-4 py-6">
      <header>
        <p className="text-sm text-ink-soft">{tenantName}</p>
        <h1 className="text-xl font-semibold">Касса</h1>
      </header>

      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-line/60 p-1">
        {(["redeem", "stamp"] as Tab[]).map((option) => (
          <button
            key={option}
            onClick={() => {
              setTab(option);
              setValue("");
              setResult(null);
            }}
            className={`rounded-xl py-2.5 text-sm font-medium transition ${
              tab === option ? "bg-white text-ink shadow-sm" : "text-ink-soft"
            }`}
          >
            {option === "redeem" ? "Выдать награду" : "Начислить штамп"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="text-sm text-ink-soft">
          {isRedeem ? "Код награды из телефона гостя" : "Код карты гостя (6 символов)"}
        </label>
        <input
          value={value}
          onChange={(event) => setValue(isRedeem ? event.target.value.replace(/\D/g, "").slice(0, 4) : event.target.value.toUpperCase().slice(0, 6))}
          inputMode={isRedeem ? "numeric" : "text"}
          autoComplete="off"
          autoFocus
          placeholder={isRedeem ? "0000" : "AB12CD"}
          className="w-full rounded-2xl border border-line bg-white px-4 py-5 text-center font-mono text-4xl tracking-[0.3em] outline-none focus:border-bean"
        />

        {venues.length > 1 && (
          <select
            value={venueId ?? ""}
            onChange={(event) => setVenueId(event.target.value || null)}
            className="w-full rounded-2xl border border-line bg-white px-4 py-3"
          >
            {venues.map((venue) => (
              <option key={venue.id} value={venue.id}>
                {venue.name}
              </option>
            ))}
          </select>
        )}

        <button
          type="submit"
          disabled={pending || value.length === 0}
          className="rounded-2xl bg-bean py-4 text-lg font-medium text-white disabled:opacity-50"
        >
          {pending ? "Проверяем…" : isRedeem ? "Погасить" : "Поставить штамп"}
        </button>
      </form>

      {result && (
        <p
          className={`animate-rise rounded-2xl px-4 py-4 text-center font-medium ${
            result.ok ? "bg-bean/10 text-bean-dark" : "bg-red-50 text-red-700"
          }`}
        >
          {result.message}
        </p>
      )}

      <p className="mt-auto text-center text-xs text-ink-soft">
        Штампы обычно ставятся сами — гость прикладывает телефон к подставке. Ручное начисление
        нужно, только если это не сработало.
      </p>
    </main>
  );
}
