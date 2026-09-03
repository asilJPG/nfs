"use client";

import { useState, useTransition } from "react";
import {
  addVenue,
  createStaff,
  removeStaff,
  resetStaffPassword,
  setVenueActive,
  type Result,
} from "@/app/dashboard/venues/actions";
import { LOGIN_HINT, MIN_PASSWORD_LENGTH, normalizeLogin } from "@/lib/login";
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

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
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
            run(
              () => addVenue({ name: venueName, address: venueAddress }),
              () => {
                setVenueName("");
                setVenueAddress("");
              },
            );
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
          Логин и пароль придумываете вы и передаёте сотруднику лично — писем система не шлёт.
          Бариста видит только кассу: выдать награду и поставить штамп вручную.
        </p>

        <ul className="mb-4 flex flex-col gap-2">
          {staff.map((member) => (
            <StaffRow
              key={member.id}
              member={member}
              pending={pending}
              isSelf={member.id === currentStaffId}
              onRun={run}
            />
          ))}
        </ul>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            run(
              () => createStaff({ login, password, name, role, venueId: venueId || null }),
              () => {
                setLogin("");
                setPassword("");
                setName("");
              },
            );
          }}
          className="grid gap-2 sm:grid-cols-2"
        >
          <label className="block">
            <span className="mb-1 block text-sm text-ink-soft">Логин</span>
            <input
              value={login}
              onChange={(event) => setLogin(normalizeLogin(event.target.value))}
              autoCapitalize="none"
              placeholder="amir-barista"
              className={`${input} w-full`}
            />
            <span className="mt-1 block text-xs text-ink-soft">{LOGIN_HINT}</span>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-ink-soft">Пароль</span>
            <input
              type="text"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="off"
              placeholder={`минимум ${MIN_PASSWORD_LENGTH} символов`}
              className={`${input} w-full`}
            />
            <span className="mt-1 block text-xs text-ink-soft">
              Показан открыто — его нужно продиктовать сотруднику.
            </span>
          </label>

          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Имя (необязательно)"
            className={input}
          />

          <div className="flex gap-2">
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as StaffRole)}
              className={`${input} flex-1`}
            >
              <option value="cashier">Бариста</option>
              <option value="manager">Управляющий</option>
            </select>
            {venues.length > 1 && (
              <select
                value={venueId}
                onChange={(event) => setVenueId(event.target.value)}
                className={`${input} flex-1`}
              >
                <option value="">Все точки</option>
                {venues.map((venue) => (
                  <option key={venue.id} value={venue.id}>
                    {venue.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <button
            type="submit"
            disabled={pending || login.length < 4 || password.length < MIN_PASSWORD_LENGTH}
            className="rounded-2xl bg-bean px-5 py-3 font-medium text-white disabled:opacity-50 sm:col-span-2"
          >
            Добавить сотрудника
          </button>
        </form>
      </section>
    </div>
  );
}

function StaffRow({
  member,
  pending,
  isSelf,
  onRun,
}: {
  member: StaffUser;
  pending: boolean;
  isSelf: boolean;
  onRun: (action: () => Promise<Result>, onSuccess?: () => void) => void;
}) {
  const [resetting, setResetting] = useState(false);
  const [password, setPassword] = useState("");

  return (
    <li className="rounded-2xl border border-line px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{member.name ?? member.username}</p>
          <p className="text-sm text-ink-soft">
            {ROLE_LABELS[member.role]} · логин <span className="font-mono">{member.username}</span>
          </p>
        </div>
        {!isSelf && (
          <div className="flex shrink-0 gap-2">
            <button
              onClick={() => setResetting((open) => !open)}
              className="rounded-xl border border-line px-3 py-1.5 text-sm text-ink-soft"
            >
              Пароль
            </button>
            {member.role !== "owner" && (
              <button
                onClick={() => onRun(() => removeStaff(member.id))}
                disabled={pending}
                className="rounded-xl px-3 py-1.5 text-sm text-red-600"
              >
                Отключить
              </button>
            )}
          </div>
        )}
      </div>

      {resetting && (
        <div className="mt-3 flex gap-2">
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Новый пароль"
            className={`${input} flex-1`}
          />
          <button
            onClick={() =>
              onRun(
                () => resetStaffPassword(member.id, password),
                () => {
                  setPassword("");
                  setResetting(false);
                },
              )
            }
            disabled={pending || password.length < MIN_PASSWORD_LENGTH}
            className="rounded-2xl bg-bean px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Сменить
          </button>
        </div>
      )}
    </li>
  );
}

const input = "rounded-2xl border border-line bg-white px-4 py-3 outline-none focus:border-bean";
