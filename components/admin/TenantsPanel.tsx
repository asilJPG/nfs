"use client";

import Link from "next/link";
import { setKitStatus } from "@/app/admin/actions";
import { CreateTenantSection, TenantRow } from "@/components/admin/AdminConsole";
import { useAdminAction } from "@/components/admin/shared";
import type { KitOrder, TenantSummary } from "@/types/db";

type Props = {
  tenants: TenantSummary[];
  kits: (KitOrder & { tenant_name: string })[];
};

const KIT_ACTIONS = [
  { id: "shipped", label: "Отправлен" },
  { id: "delivered", label: "Доставлен" },
  { id: "cancelled", label: "Отменить" },
] as const;

export function TenantsPanel({ tenants, kits }: Props) {
  const { notice, pending, run } = useAdminAction();

  return (
    <div className="flex flex-col gap-6">
      {notice && <p className={`note ${notice.ok ? "note-ok" : "note-bad"}`}>{notice.message}</p>}

      <CreateTenantSection pending={pending} onSave={run} />

      {kits.length > 0 && (
        <section className="card p-5 md:p-6">
          <h2 className="card-title mb-1">Заявки на комплекты ({kits.length})</h2>
          <p className="mb-4 text-xs text-ink-faint">Кому везём NFC-стенд</p>
          <ul className="flex flex-col gap-2">
            {kits.map((kit) => (
              <li key={kit.id} className="rounded-2xl border border-line bg-surface-2 p-4 text-sm">
                <p className="font-semibold text-ink">{kit.tenant_name}</p>
                <p className="mt-1 text-xs text-ink-soft">
                  {kit.contact_name} · {kit.phone}
                </p>
                <p className="text-xs text-ink-soft">{kit.address}</p>
                {kit.note && <p className="mt-1 text-xs text-ink-faint">{kit.note}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {KIT_ACTIONS.map((action) => (
                    <button
                      key={action.id}
                      onClick={() => run(() => setKitStatus(kit.id, action.id))}
                      disabled={pending || kit.status === action.id}
                      className={`btn btn-sm ${action.id === "cancelled" ? "btn-danger" : "btn-ghost"}`}
                    >
                      {kit.status === action.id ? `${action.label} ✓` : action.label}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="card-title">Кофейни ({tenants.length})</h2>
          <span className="eyebrow">тариф и подписка</span>
        </div>

        {tenants.length === 0 ? (
          <div className="empty">
            <h3 className="card-title">Кофеен пока нет</h3>
            <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-ink-soft">
              Заведите первую в форме выше — или примите заявку с лендинга.
            </p>
          </div>
        ) : (
          tenants.map((tenant) => (
            <div key={tenant.id} className="flex flex-col gap-2">
              <TenantRow tenant={tenant} pending={pending} onSave={run} />
              <Link
                href={`/admin/tenants/${tenant.id}`}
                className="self-start text-xs font-medium text-latte hover:underline"
              >
                Открыть карточку →
              </Link>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
