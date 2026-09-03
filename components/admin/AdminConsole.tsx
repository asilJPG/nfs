"use client";

import { useState, useTransition } from "react";
import { registerTag, setKitStatus, setSubscription, type Result } from "@/app/admin/actions";
import type { KitOrder, SubscriptionStatus, TenantPlan, TenantSummary } from "@/types/db";

type Props = {
  tenants: TenantSummary[];
  kits: (KitOrder & { tenant_name: string })[];
};

const STATUSES: SubscriptionStatus[] = ["trial", "active", "past_due", "suspended"];
const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trial: "Триал",
  active: "Активна",
  past_due: "Просрочена",
  suspended: "Заморожена",
};

export function AdminConsole({ tenants, kits }: Props) {
  const [notice, setNotice] = useState<Result | null>(null);
  const [pending, startTransition] = useTransition();
  const [uid, setUid] = useState("");
  const [tagTenant, setTagTenant] = useState("");
  const [tagLabel, setTagLabel] = useState("");

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
        <h2 className="mb-1 font-medium">Регистрация метки</h2>
        <p className="mb-3 text-sm text-ink-soft">
          Сначала прошейте чип ключами из{" "}
          <code className="rounded bg-cream px-1">npm run mock-tag -- --uid … --keys</code>, потом
          заведите UID здесь.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            run(
              () => registerTag({ uid, tenantId: tagTenant || null, label: tagLabel || undefined }),
              () => {
                setUid("");
                setTagLabel("");
              },
            );
          }}
          className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]"
        >
          <input
            value={uid}
            onChange={(event) => setUid(event.target.value.toUpperCase().slice(0, 14))}
            placeholder="04A1B2C3D4E580"
            className={`${input} font-mono`}
          />
          <select value={tagTenant} onChange={(event) => setTagTenant(event.target.value)} className={input}>
            <option value="">Без кофейни</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
          <input
            value={tagLabel}
            onChange={(event) => setTagLabel(event.target.value)}
            placeholder="Подпись"
            className={input}
          />
          <button
            type="submit"
            disabled={pending || uid.length !== 14}
            className="rounded-2xl bg-bean px-5 py-3 font-medium text-white disabled:opacity-50"
          >
            Завести
          </button>
        </form>
      </section>

      {kits.length > 0 && (
        <section className="rounded-2xl border border-line bg-white p-4">
          <h2 className="mb-3 font-medium">Заявки на комплекты</h2>
          <ul className="flex flex-col gap-2">
            {kits.map((kit) => (
              <li key={kit.id} className="rounded-2xl border border-line p-3 text-sm">
                <p className="font-medium">{kit.tenant_name}</p>
                <p className="text-ink-soft">
                  {kit.contact_name} · {kit.phone}
                </p>
                <p className="text-ink-soft">{kit.address}</p>
                {kit.note && <p className="text-ink-soft">{kit.note}</p>}
                <div className="mt-2 flex gap-2">
                  {(["shipped", "delivered", "cancelled"] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => run(() => setKitStatus(kit.id, status))}
                      disabled={pending || kit.status === status}
                      className="rounded-xl border border-line px-3 py-1.5 text-xs disabled:opacity-40"
                    >
                      {status === "shipped" ? "Отправлен" : status === "delivered" ? "Доставлен" : "Отменить"}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Кофейни ({tenants.length})</h2>
        {tenants.map((tenant) => (
          <TenantRow key={tenant.id} tenant={tenant} pending={pending} onSave={run} />
        ))}
      </section>
    </div>
  );
}

function TenantRow({
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

  return (
    <article className="rounded-2xl border border-line bg-white p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="font-medium">{tenant.name}</p>
          <p className="text-xs text-ink-soft">/{tenant.slug}</p>
        </div>
        <p className="text-sm text-ink-soft">
          {tenant.customers} карт · {tenant.stamps_30d} штампов за 30 дн. · {tenant.tags} меток
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-[auto_auto_auto_auto]">
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as SubscriptionStatus)}
          className={input}
        >
          {STATUSES.map((option) => (
            <option key={option} value={option}>
              {STATUS_LABELS[option]}
            </option>
          ))}
        </select>
        <select value={plan} onChange={(event) => setPlan(event.target.value as TenantPlan)} className={input}>
          <option value="loyalty">Лояльность</option>
          <option value="marketing">+ Маркетинг</option>
        </select>
        <input
          type="number"
          min={0}
          max={24}
          value={months}
          onChange={(event) => setMonths(Number(event.target.value))}
          className={`${input} w-24`}
          title="На сколько месяцев продлить"
        />
        <button
          onClick={() => onSave(() => setSubscription({ tenantId: tenant.id, status, plan, months }))}
          disabled={pending}
          className="rounded-2xl bg-bean px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          Применить
        </button>
      </div>

      <p className="mt-2 text-xs text-ink-soft">
        {tenant.subscription_status === "trial"
          ? `Триал до ${new Date(tenant.trial_ends_at).toLocaleDateString("ru-RU")}`
          : tenant.subscription_until
            ? `Оплачено до ${new Date(tenant.subscription_until).toLocaleDateString("ru-RU")}`
            : "Без срока"}
      </p>
    </article>
  );
}

const input = "rounded-2xl border border-line bg-white px-4 py-3 text-sm outline-none focus:border-bean";
