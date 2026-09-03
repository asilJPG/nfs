"use client";

import { useState, useTransition } from "react";
import {
  addVenue,
  inviteStaff,
  removeStaff,
  setVenueActive,
  type Result,
} from "@/app/dashboard/venues/actions";
import type { StaffRole, StaffUser, Venue } from "@/types/db";

type Props = {
  venues: Venue[];
  staff: StaffUser[];
  currentStaffId: string;
};

const ROLE_LABELS: Record<StaffRole, string> = {
  owner: "Владелец",
  manager: "Управляющий",
  cashier: "Бариста",
};

export function VenuesManager({ venues, staff, currentStaffId }: Props) {
  const [notice, setNotice] = useState<Result | null>(null);
  const [pending, startTransition] = useTransition();

  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("cashier");
  const [venueId, setVenueId] = useState<string>("");

  function run(action: () => Promise<Result>, onSuccess?: () => void) {
    startTransition(async () => {
      const result = await action();
      setNotice(result);
      if (result.ok) onSuccess?.();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {notice && (
        <p className={`text-sm ${notice.ok ? "text-bean-dark" : "text-red-600"}`}>{notice.message}</p>
      )}

      <section className="rounded-2xl border border-line bg-white p-4">
        <h2 className="mb-4 font-medium">Точки</h2>

        <ul className="mb-4 flex flex-col gap-2">
          {venues.map((venue) => (
            <li
              key={venue.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3"
            >
              <div className="min-w-0">
                <p className={`truncate font-medium ${venue.active ? "" : "opacity-50"}`}>{venue.name}</p>
                {venue.address && <p className="truncate text-sm text-ink-soft">{venue.address}</p>}
              </div>
              <button
                onClick={() => run(() => setVenueActive(venue.id, !venue.active))}
                disabled={pending}
                className="shrink-0 rounded-xl border border-line px-3 py-1.5 text-sm text-ink-soft"
              >
                {venue.active ? "Отключить" : "Включить"}
              </button>
            </li>
          ))}
          {venues.length === 0 && <li className="text-sm text-ink-soft">Точек пока нет.</li>}
        </ul>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            run(() => addVenue({ name: venueName, address: venueAddress }), () => {
              setVenueName("");
              setVenueAddress("");
            });
          }}
          className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
        >
          <input
            value={venueName}
            onChange={(event) => setVenueName(event.target.value)}
            placeholder="Название точки"
            className={input}
          />
          <input
            value={venueAddress}
            onChange={(event) => setVenueAddress(event.target.value)}
            placeholder="Адрес (необязательно)"
            className={input}
          />
          <button
            type="submit"
            disabled={pending || venueName.trim().length < 2}
            className="rounded-2xl bg-bean px-5 py-3 font-medium text-white disabled:opacity-50"
          >
            Добавить
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-line bg-white p-4">
        <h2 className="mb-1 font-medium">Сотрудники</h2>
        <p className="mb-4 text-sm text-ink-soft">
          Бариста видит только кассу: выдать награду и поставить штамп вручную.
        </p>

        <ul className="mb-4 flex flex-col gap-2">
          {staff.map((member) => (
            <li
              key={member.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{member.name ?? member.email}</p>
                <p className="text-sm text-ink-soft">
                  {ROLE_LABELS[member.role]}
                  {member.auth_user_id ? "" : " · ещё не заходил"}
                </p>
              </div>
              {member.id !== currentStaffId && member.role !== "owner" && (
                <button
                  onClick={() => run(() => removeStaff(member.id))}
                  disabled={pending}
                  className="shrink-0 rounded-xl px-3 py-1.5 text-sm text-red-600"
                >
                  Отключить
                </button>
              )}
            </li>
          ))}
        </ul>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            run(
              () => inviteStaff({ email, role, venueId: venueId || null }),
              () => setEmail(""),
            );
          }}
          className="grid gap-2 sm:grid-cols-[1fr_auto_auto]"
        >
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="barista@coffee.uz"
            className={input}
          />
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as StaffRole)}
            className={input}
          >
            <option value="cashier">Бариста</option>
            <option value="manager">Управляющий</option>
          </select>
          <button
            type="submit"
            disabled={pending || !email.includes("@")}
            className="rounded-2xl bg-bean px-5 py-3 font-medium text-white disabled:opacity-50"
          >
            Пригласить
          </button>
          {venues.length > 1 && (
            <select
              value={venueId}
              onChange={(event) => setVenueId(event.target.value)}
              className={`${input} sm:col-span-3`}
            >
              <option value="">Все точки</option>
              {venues.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name}
                </option>
              ))}
            </select>
          )}
        </form>
      </section>
    </div>
  );
}

const input = "rounded-2xl border border-line bg-white px-4 py-3 outline-none focus:border-bean";
