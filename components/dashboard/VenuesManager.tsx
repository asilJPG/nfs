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
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<StaffRole>("cashier");
  const [venueId, setVenueId] = useState<string>("");

  // key — чтобы «…» горело на нажатой кнопке, а не на всех сразу
  function run(key: string, action: () => Promise<Result>, onSuccess?: () => void) {
    setBusy(key);
    startTransition(async () => {
      try {
        const result = await action();
        setNotice(result);
        if (result.ok) onSuccess?.();
      } finally {
        setBusy(null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {notice && (
        <p className={`note ${notice.ok ? "note-ok" : "note-bad"}`}>{notice.message}</p>
      )}

      <section className="card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="card-title">Точки</h2>
          <span className="badge badge-muted">{venues.length}</span>
        </div>

        <ul className="mb-5 flex flex-col gap-2">
          {venues.map((venue) => (
            <li
              key={venue.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white/[0.02] px-4 py-3"
            >
              <div className="min-w-0">
                <p className={`truncate text-sm font-semibold ${venue.active ? "text-white" : "text-ink-faint line-through"}`}>
                  {venue.name}
                </p>
                {venue.address && <p className="truncate text-xs text-ink-soft">{venue.address}</p>}
              </div>
              <button
                onClick={() => run(`venue:${venue.id}`, () => setVenueActive(venue.id, !venue.active))}
                disabled={pending}
                className="btn btn-ghost btn-sm shrink-0"
              >
                {busy === `venue:${venue.id}` ? "…" : venue.active ? "Отключить" : "Включить"}
              </button>
            </li>
          ))}
          {venues.length === 0 && (
            <li className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-sm text-ink-soft">
              Точек пока нет — добавьте первую.
            </li>
          )}
        </ul>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            run(
              "add-venue",
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
            className="input"
          />
          <input
            value={venueAddress}
            onChange={(event) => setVenueAddress(event.target.value)}
            placeholder="Адрес (необязательно)"
            className="input"
          />
          <button
            type="submit"
            disabled={pending || venueName.trim().length < 2}
            className="btn btn-primary"
          >
            {busy === "add-venue" ? "Добавляем…" : "Добавить"}
          </button>
        </form>
      </section>

      <section className="card p-5">
        <div className="mb-1 flex items-center justify-between gap-3">
          <h2 className="card-title">Сотрудники</h2>
          <span className="badge badge-muted">{staff.length}</span>
        </div>
        <p className="mb-4 text-xs leading-relaxed text-ink-soft">
          Логин и пароль придумываете вы и передаёте сотруднику лично — писем система не шлёт.
          Бариста видит только кассу: выдать награду и поставить штамп вручную.
        </p>

        <ul className="mb-5 flex flex-col gap-2">
          {staff.map((member) => (
            <StaffRow
              key={member.id}
              member={member}
              pending={pending}
              busy={busy}
              isSelf={member.id === currentStaffId}
              onRun={run}
            />
          ))}
        </ul>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            run(
              "add-staff",
              () => createStaff({ login, password, name, role, venueId: venueId || null }),
              () => {
                setLogin("");
                setPassword("");
                setName("");
              },
            );
          }}
          className="grid gap-3 sm:grid-cols-2"
        >
          <label className="block">
            <span className="field-label">Логин</span>
            <input
              value={login}
              onChange={(event) => setLogin(normalizeLogin(event.target.value))}
              autoCapitalize="none"
              placeholder="amir-barista"
              className="input"
            />
            <span className="field-hint">{LOGIN_HINT}</span>
          </label>

          <label className="block">
            <span className="field-label">Пароль</span>
            <input
              type="text"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="off"
              placeholder={`минимум ${MIN_PASSWORD_LENGTH} символов`}
              className="input"
            />
            <span className="field-hint">Показан открыто — его нужно продиктовать сотруднику.</span>
          </label>

          <label className="block">
            <span className="field-label">Имя</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Необязательно"
              className="input"
            />
          </label>

          <div className="flex gap-2 sm:items-end">
            <label className="block flex-1">
              <span className="field-label">Роль</span>
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as StaffRole)}
                className="input"
              >
                <option value="cashier">Бариста</option>
                <option value="manager">Управляющий</option>
              </select>
            </label>
            {venues.length > 1 && (
              <label className="block flex-1">
                <span className="field-label">Точка</span>
                <select
                  value={venueId}
                  onChange={(event) => setVenueId(event.target.value)}
                  className="input"
                >
                  <option value="">Все точки</option>
                  {venues.map((venue) => (
                    <option key={venue.id} value={venue.id}>
                      {venue.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <button
            type="submit"
            disabled={pending || login.length < 4 || password.length < MIN_PASSWORD_LENGTH}
            className="btn btn-primary sm:col-span-2"
          >
            {busy === "add-staff" ? "Добавляем…" : "Добавить сотрудника"}
          </button>
        </form>
      </section>
    </div>
  );
}

function StaffRow({
  member,
  pending,
  busy,
  isSelf,
  onRun,
}: {
  member: StaffUser;
  pending: boolean;
  busy: string | null;
  isSelf: boolean;
  onRun: (key: string, action: () => Promise<Result>, onSuccess?: () => void) => void;
}) {
  const [resetting, setResetting] = useState(false);
  const [password, setPassword] = useState("");

  return (
    <li className="rounded-xl border border-line bg-white/[0.02] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-white/5 text-xs font-bold text-slate-300">
            {(member.name ?? member.username).slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {member.name ?? member.username}
              {isSelf && <span className="ml-2 text-[11px] font-medium text-ink-faint">это вы</span>}
            </p>
            <p className="truncate text-xs text-ink-soft">
              {ROLE_LABELS[member.role]} · <span className="font-mono">{member.username}</span>
            </p>
          </div>
        </div>
        {!isSelf && (
          <div className="flex shrink-0 gap-2">
            <button
              onClick={() => setResetting((open) => !open)}
              className="btn btn-ghost btn-sm"
            >
              Пароль
            </button>
            {member.role !== "owner" && (
              <button
                onClick={() => onRun(`staff-off:${member.id}`, () => removeStaff(member.id))}
                disabled={pending}
                className="btn btn-danger btn-sm"
              >
                {busy === `staff-off:${member.id}` ? "…" : "Отключить"}
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
            className="input flex-1"
          />
          <button
            onClick={() =>
              onRun(
                `staff-pw:${member.id}`,
                () => resetStaffPassword(member.id, password),
                () => {
                  setPassword("");
                  setResetting(false);
                },
              )
            }
            disabled={pending || password.length < MIN_PASSWORD_LENGTH}
            className="btn btn-primary btn-sm"
          >
            {busy === `staff-pw:${member.id}` ? "…" : "Сменить"}
          </button>
        </div>
      )}
    </li>
  );
}
