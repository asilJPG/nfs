"use client";

/**
 * Формы и строки, из которых собраны страницы /admin.
 * Все элементы используют классы дизайн-системы: .card, .btn, .input, .badge, .field-label.
 */

import { useState } from "react";
import {
  createTenantFromApplication,
  deleteTenant,
  renameTenant,
  resetOwnerPassword,
  setApplicationStatus,
  setSubscription,
  type Result,
} from "@/app/admin/actions";
import { slugify } from "@/lib/slug";
import type { SubscriptionStatus, TenantPlan, TenantSummary } from "@/types/db";

export type Application = {
  id: string;
  cafe_name: string;
  city: string | null;
  contact_name: string;
  phone: string;
  telegram: string | null;
  message: string | null;
  status: "new" | "contacted" | "converted" | "rejected";
  created_at: string;
};

export type Tag = {
  uid: string;
  label: string | null;
  tenant_id: string | null;
  tenant_name: string | null;
  created_at: string;
};

const STATUSES: SubscriptionStatus[] = ["trial", "active", "past_due", "suspended"];
const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trial: "Триал",
  active: "Активна",
  past_due: "Просрочена",
  suspended: "Заморожена",
};

const APPLICATION_STATUS_BADGE: Record<
  Application["status"],
  { label: string; className: string }
> = {
  new: { label: "Новая", className: "badge badge-accent" },
  contacted: { label: "На связи", className: "badge badge-ok" },
  converted: { label: "Подключена", className: "badge badge-ok" },
  rejected: { label: "Отклонена", className: "badge badge-muted" },
};

export function TenantRow({
  tenant,
  pending,
  onSave,
}: {
  tenant: TenantSummary;
  pending: boolean;
  onSave: (action: () => Promise<Result>) => void;
}) {
  const [status, setStatus] = useState<SubscriptionStatus>(tenant.subscription_status);
  const [plan, setPlan] = useState<TenantPlan>(tenant.plan);
  const [months, setMonths] = useState(1);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(tenant.name);
  const [slug, setSlug] = useState(tenant.slug);
  const [resettingPw, setResettingPw] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  const statusBadgeClass =
    tenant.subscription_status === "active"
      ? "badge-ok"
      : tenant.subscription_status === "trial"
        ? "badge-accent"
        : "badge-bad";

  return (
    <article className="card p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="card-title">{tenant.name}</p>
          <span className={`badge ${statusBadgeClass}`}>
            {STATUS_LABELS[tenant.subscription_status] ?? tenant.subscription_status}
          </span>
          <span className="font-mono text-xs text-ink-soft">/{tenant.slug}</span>
        </div>
        <p className="text-xs text-ink-soft tabular-nums">
          {tenant.customers} карт · {tenant.stamps_30d} штампов (30 дн.) · {tenant.tags} меток
        </p>
      </div>

      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        <button
          onClick={() => setEditing((o) => !o)}
          disabled={pending}
          className="btn btn-ghost btn-sm"
        >
          {editing ? "Скрыть" : "Переименовать / slug"}
        </button>
        <button
          onClick={() => setResettingPw((o) => !o)}
          disabled={pending}
          className="btn btn-ghost btn-sm"
        >
          {resettingPw ? "Скрыть" : "Сбросить пароль"}
        </button>
        <button
          onClick={() => {
            if (
              confirm(
                `Удалить кофейню «${tenant.name}» со всеми данными и аккаунтом владельца?`,
              )
            ) {
              onSave(() => deleteTenant(tenant.id));
            }
          }}
          disabled={pending}
          className="btn btn-danger btn-sm ml-auto"
        >
          Удалить
        </button>
      </div>

      {editing && (
        <div className="mb-4 grid gap-3 rounded-xl border border-line bg-surface-2 p-4">
          <div>
            <label className="field-label">Название кофейни</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="field-label">Slug (адрес карты)</label>
            <input
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
              className="input font-mono"
            />
          </div>
          <button
            onClick={() =>
              onSave(async () => {
                const r = await renameTenant({ tenantId: tenant.id, name, slug });
                if (r.ok) setEditing(false);
                return r;
              })
            }
            disabled={pending || name.length < 2 || slug.length < 3}
            className="btn btn-accent btn-sm btn-block"
          >
            {pending ? "Сохраняем…" : "Сохранить изменения"}
          </button>
        </div>
      )}

      {resettingPw && (
        <div className="mb-4 grid gap-3 rounded-xl border border-line bg-surface-2 p-4">
          <div>
            <label className="field-label">Новый пароль владельца</label>
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="от 8 символов"
              className="input font-mono"
            />
            <span className="field-hint">Пароль для входа в кабинет /login</span>
          </div>
          <button
            onClick={() =>
              onSave(async () => {
                const r = await resetOwnerPassword({ tenantId: tenant.id, password: newPassword });
                if (r.ok) {
                  setResettingPw(false);
                  setNewPassword("");
                }
                return r;
              })
            }
            disabled={pending || newPassword.length < 8}
            className="btn btn-accent btn-sm btn-block"
          >
            {pending ? "Устанавливаем…" : "Установить пароль"}
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as SubscriptionStatus)}
          className="input w-auto min-w-[140px]"
        >
          {STATUSES.map((option) => (
            <option key={option} value={option}>
              {STATUS_LABELS[option]}
            </option>
          ))}
        </select>
        <select
          value={plan}
          onChange={(event) => setPlan(event.target.value as TenantPlan)}
          className="input w-auto min-w-[140px]"
        >
          <option value="loyalty">Лояльность</option>
          <option value="marketing">+ Маркетинг</option>
        </select>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={0}
            max={24}
            value={months}
            onChange={(event) => setMonths(Number(event.target.value))}
            className="input w-20 text-center"
            title="На сколько месяцев продлить"
          />
          <span className="text-xs text-ink-faint whitespace-nowrap">мес.</span>
        </div>
        <button
          onClick={() => onSave(() => setSubscription({ tenantId: tenant.id, status, plan, months }))}
          disabled={pending}
          className="btn btn-accent sm:ml-auto"
        >
          {pending ? "Применяем…" : "Применить"}
        </button>
      </div>

      <p className="mt-2.5 text-xs text-ink-faint">
        {tenant.subscription_status === "trial"
          ? `Триал до ${new Date(tenant.trial_ends_at).toLocaleDateString("ru-RU")}`
          : tenant.subscription_until
            ? `Оплачено до ${new Date(tenant.subscription_until).toLocaleDateString("ru-RU")}`
            : "Без срока"}
      </p>
    </article>
  );
}

export function CreateTenantSection({
  pending,
  onSave,
}: {
  pending: boolean;
  onSave: (action: () => Promise<Result>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [stamps, setStamps] = useState(6);
  const [reward, setReward] = useState("Бесплатный кофе");
  const [venueName, setVenueName] = useState("");

  return (
    <section className="card p-5 md:p-6">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left group"
      >
        <div>
          <span className="card-title group-hover:text-white transition-colors">Создать кофейню вручную</span>
          <p className="mt-0.5 text-xs text-ink-faint">Завести нового партнёра без заявки с лендинга</p>
        </div>
        <span className="btn btn-ghost btn-sm">{open ? "Свернуть" : "Развернуть"}</span>
      </button>

      {open && (
        <div className="mt-5 grid gap-4 border-t border-line pt-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="field-label">Название кофейни</label>
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slug) setSlug(slugify(e.target.value));
                }}
                placeholder="Surf Coffee"
                className="input"
              />
            </div>
            <div>
              <label className="field-label">Slug (адрес карты)</label>
              <input
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                placeholder="surf-coffee"
                className="input font-mono"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="field-label">Логин владельца</label>
              <input
                value={login}
                onChange={(e) => setLogin(e.target.value.toLowerCase())}
                placeholder="surf_owner"
                className="input font-mono"
              />
            </div>
            <div>
              <label className="field-label">Пароль владельца</label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="от 8 символов"
                className="input font-mono"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[100px_1fr_1fr]">
            <div>
              <label className="field-label">Штампов</label>
              <input
                type="number"
                min={2}
                max={20}
                value={stamps}
                onChange={(e) => setStamps(Number(e.target.value))}
                className="input"
              />
            </div>
            <div>
              <label className="field-label">Награда за заполненную карту</label>
              <input
                value={reward}
                onChange={(e) => setReward(e.target.value)}
                placeholder="Бесплатный кофе"
                className="input"
              />
            </div>
            <div>
              <label className="field-label">Первая точка (необязательно)</label>
              <input
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                placeholder="Флагман на Баумана"
                className="input"
              />
            </div>
          </div>

          <button
            onClick={() =>
              onSave(async () => {
                const result = await createTenantFromApplication({
                  name,
                  slug,
                  login,
                  password,
                  venueName: venueName || undefined,
                  stamps,
                  reward,
                });
                if (result.ok) {
                  setName("");
                  setSlug("");
                  setLogin("");
                  setPassword("");
                  setVenueName("");
                  setOpen(false);
                }
                return result;
              })
            }
            disabled={
              pending ||
              name.length < 2 ||
              slug.length < 3 ||
              login.length < 3 ||
              password.length < 8
            }
            className="btn btn-accent btn-block mt-2"
          >
            {pending ? "Создаём кофейню…" : "Создать кофейню"}
          </button>
        </div>
      )}
    </section>
  );
}

export function ApplicationRow({
  application,
  pending,
  onSave,
}: {
  application: Application;
  pending: boolean;
  onSave: (action: () => Promise<Result>) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState(application.cafe_name);
  const [slug, setSlug] = useState(slugify(application.cafe_name));
  const [login, setLogin] = useState(slugify(application.cafe_name).replace(/-/g, ""));
  const [password, setPassword] = useState("");
  const [stamps, setStamps] = useState(6);
  const [reward, setReward] = useState("Бесплатный кофе");
  const [venueName, setVenueName] = useState("");

  const statusBadge = APPLICATION_STATUS_BADGE[application.status] ?? {
    label: application.status,
    className: "badge badge-muted",
  };

  return (
    <li className="rounded-2xl border border-line bg-surface-2 p-4 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold text-ink">
          {application.cafe_name}
          {application.city && <span className="font-normal text-ink-soft"> · {application.city}</span>}
        </p>
        <span className="text-xs text-ink-faint tabular-nums">
          {new Date(application.created_at).toLocaleString("ru-RU")}
        </span>
      </div>
      <p className="mt-1 text-xs text-ink-soft">
        {application.contact_name} · {application.phone}
        {application.telegram && <> · @{application.telegram.replace(/^@/, "")}</>}
      </p>
      {application.message && (
        <p className="mt-2 rounded-xl bg-surface p-2.5 text-xs leading-relaxed text-ink-soft">
          {application.message}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setCreating((open) => !open)}
          disabled={pending}
          className="btn btn-accent btn-sm"
        >
          {creating ? "Свернуть форму" : "Создать кофейню"}
        </button>
        {(["contacted", "rejected"] as const).map((status) => (
          <button
            key={status}
            onClick={() => onSave(() => setApplicationStatus(application.id, status))}
            disabled={pending || application.status === status}
            className={`btn btn-sm ${status === "rejected" ? "btn-danger" : "btn-ghost"}`}
          >
            {status === "contacted" ? "Связались" : "Отклонить"}
          </button>
        ))}
        <div className="ml-auto">
          <span className={statusBadge.className}>{statusBadge.label}</span>
        </div>
      </div>

      {creating && (
        <div className="mt-3 grid gap-3 rounded-xl border border-line bg-surface p-4">
          <div>
            <label className="field-label">Название кофейни</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="field-label">Slug (адрес карты)</label>
            <input
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
              className="input font-mono"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="field-label">Логин владельца</label>
              <input
                value={login}
                onChange={(e) => setLogin(e.target.value.toLowerCase())}
                className="input font-mono"
              />
            </div>
            <div>
              <label className="field-label">Пароль владельца</label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="от 8 символов"
                className="input font-mono"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[100px_1fr_1fr]">
            <div>
              <label className="field-label">Штампов</label>
              <input
                type="number"
                min={2}
                max={20}
                value={stamps}
                onChange={(e) => setStamps(Number(e.target.value))}
                className="input"
              />
            </div>
            <div>
              <label className="field-label">Награда</label>
              <input
                value={reward}
                onChange={(e) => setReward(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="field-label">Точка (необязательно)</label>
              <input
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                className="input"
              />
            </div>
          </div>
          <button
            onClick={() =>
              onSave(() =>
                createTenantFromApplication({
                  applicationId: application.id,
                  name,
                  slug,
                  login,
                  password,
                  venueName: venueName || undefined,
                  stamps,
                  reward,
                }),
              )
            }
            disabled={
              pending ||
              name.length < 2 ||
              slug.length < 3 ||
              login.length < 3 ||
              password.length < 8
            }
            className="btn btn-accent btn-block mt-1"
          >
            {pending ? "Создаём…" : "Создать и подключить"}
          </button>
        </div>
      )}
    </li>
  );
}
