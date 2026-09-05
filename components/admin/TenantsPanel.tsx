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

export function TenantsPanel({ tenants, kits }: Props) {
  const { notice, pending, run } = useAdminAction();

  return (
    <div className="flex flex-col gap-6">
      {notice && (
        <p className={`text-sm ${notice.ok ? "text-bean-dark" : "text-red-600"}`}>{notice.message}</p>
      )}

      <CreateTenantSection pending={pending} onSave={run} />

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Кофейни ({tenants.length})</h2>
        {tenants.map((tenant) => (
          <div key={tenant.id} className="flex flex-col gap-2">
            <TenantRow tenant={tenant} pending={pending} onSave={run} />
            <Link
              href={`/admin/tenants/${tenant.id}`}
              className="self-start text-xs text-ink-soft underline"
            >
              Открыть карточку →
            </Link>
          </div>
        ))}
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
    </div>
  );
}
