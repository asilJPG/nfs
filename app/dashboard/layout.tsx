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
    <div className="flex min-h-dvh flex-col bg-[#08090B] font-sans text-[#F4F4F2] antialiased md:flex-row">
      {/* Боковое меню — десктоп */}
      <aside className="sticky top-0 hidden h-dvh w-[240px] shrink-0 flex-col justify-between border-r border-white/[0.06] bg-[#0E0F11] md:flex">
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-4">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#6B9BFF] to-[#4A7DE0] text-sm font-bold text-white shadow-md">
              {tenant.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-tight text-white">{tenant.name}</p>
              <p className="truncate text-[10px] font-mono uppercase tracking-wider text-ink-label">Ташкент</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            <DashboardNav canBroadcast={canBroadcast} role={staff.role} layout="sidebar" />
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] px-4 py-3 bg-[#08090B]/60">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="grid size-8 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-xs font-bold text-[#7BA5FF]">
                {staff.username.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-white">@{staff.username}</p>
                <p className="truncate text-[10px] text-ink-label">
                  {ROLE_LABELS[staff.role] ?? staff.role}
                </p>
              </div>
            </div>
            <form action="/auth/signout" method="post">
              <button
                title="Выйти"
                aria-label="Выйти"
                className="rounded-lg p-2 text-ink-label transition-colors hover:bg-white/5 hover:text-white"
              >
                <IconLogout />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Шапка — мобильный */}
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#0E0F11]/90 backdrop-blur-md md:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#5B8DEF] text-xs font-bold text-white">
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

      <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-6 lg:p-8">
        {impersonating && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs font-medium text-amber-300">
            <span className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-amber-400" />
              Вы смотрите кабинет от лица владельца <b>{tenant.name}</b>.
            </span>
            <form action={stopImp}>
              <button className="rounded-lg border border-amber-500/30 bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-200 hover:bg-amber-500/25">
                Выйти из режима
              </button>
            </form>
          </div>
        )}

        {trialDays !== null && trialDays <= 7 && (
          <div className="mb-6 rounded-2xl border border-[#5B8DEF]/20 bg-[#5B8DEF]/10 p-3 text-center text-xs font-medium text-[#7BA5FF]">
            {trialDays > 0
              ? `Пробный период: осталось ${trialDays} дн.`
              : "Пробный период завершён."}
          </div>
        )}

        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
