import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { can, daysLeftInTrial } from "@/lib/plan";
import { DashboardNav } from "@/components/dashboard/DashboardNav";
import { IconLogout } from "@/components/ui/icons";
import { stopImpersonatingAction } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
  owner: "Владелец",
  manager: "Управляющий",
  cashier: "Бариста",
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { staff, tenant, impersonating } = await requireStaff();
  const trialDays = daysLeftInTrial(tenant);
  const stopImp = stopImpersonatingAction.bind(null, `/admin/tenants/${tenant.id}`);
  const canBroadcast = can(tenant, "broadcasts");

  return (
    <div className="flex min-h-dvh flex-col bg-base font-sans text-ink antialiased md:flex-row">
      {/* Боковое меню — десктоп */}
      <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col justify-between border-r border-line bg-[#0d0e14] md:flex">
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-3 border-b border-line px-4 py-4">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 text-sm font-extrabold text-white shadow-lg shadow-violet-600/25">
              {tenant.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-tight text-white">{tenant.name}</p>
              <p className="truncate text-[11px] text-ink-faint">Кабинет кофейни</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <DashboardNav canBroadcast={canBroadcast} role={staff.role} layout="sidebar" />
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="grid size-8 shrink-0 place-items-center rounded-full border border-violet-500/25 bg-violet-500/15 text-xs font-bold text-violet-200">
                {staff.username.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-slate-200">@{staff.username}</p>
                <p className="truncate text-[11px] text-ink-faint">
                  {ROLE_LABELS[staff.role] ?? staff.role}
                </p>
              </div>
            </div>
            <form action="/auth/signout" method="post">
              <button
                title="Выйти"
                aria-label="Выйти"
                className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-white/5 hover:text-white"
              >
                <IconLogout />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Шапка — мобильный */}
      <header className="sticky top-0 z-30 border-b border-line bg-[#0d0e14]/90 backdrop-blur-md md:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 text-xs font-extrabold text-white">
              {tenant.name.slice(0, 1).toUpperCase()}
            </div>
            <p className="truncate text-sm font-bold text-white">{tenant.name}</p>
          </div>
          <form action="/auth/signout" method="post">
            <button className="btn btn-ghost btn-sm">Выйти</button>
          </form>
        </div>
        <DashboardNav canBroadcast={canBroadcast} role={staff.role} layout="top" />
      </header>

      <div className="flex min-w-0 flex-1 flex-col">
        {impersonating && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-300">
            <span className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-amber-400" />
              Вы смотрите кабинет от лица владельца <b>{tenant.name}</b>.
            </span>
            <form action={stopImp}>
              <button className="rounded-lg border border-amber-500/30 bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-200 transition-colors hover:bg-amber-500/25">
                Выйти из режима
              </button>
            </form>
          </div>
        )}

        {trialDays !== null && trialDays <= 7 && (
          <p className="border-b border-amber-500/20 bg-amber-500/[0.07] px-4 py-2.5 text-center text-xs font-medium text-amber-300">
            {trialDays > 0
              ? `Пробный период заканчивается через ${trialDays} дн. `
              : "Пробный период закончился. "}
            <Link href="/dashboard/billing" className="font-bold underline underline-offset-2 hover:text-amber-100">
              Продлить тариф
            </Link>
          </p>
        )}

        <main className="mx-auto w-full max-w-6xl p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
