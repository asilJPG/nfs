import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { can, daysLeftInTrial } from "@/lib/plan";
import { DashboardNav } from "@/components/dashboard/DashboardNav";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { staff, tenant } = await requireStaff();
  const trialDays = daysLeftInTrial(tenant);

  return (
    <div className="min-h-dvh bg-cream">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-semibold">{tenant.name}</p>
            <p className="text-xs text-ink-soft">{staff.email}</p>
          </div>
          <form action="/auth/signout" method="post">
            <button className="rounded-xl border border-line px-3 py-1.5 text-sm text-ink-soft">
              Выйти
            </button>
          </form>
        </div>
        <DashboardNav canBroadcast={can(tenant, "broadcasts")} role={staff.role} />
      </header>

      {trialDays !== null && trialDays <= 7 && (
        <p className="bg-amber-50 px-4 py-2 text-center text-sm text-amber-800">
          {trialDays > 0
            ? `Пробный период заканчивается через ${trialDays} дн. `
            : "Пробный период закончился. "}
          <Link href="/dashboard/billing" className="underline">
            Продлить
          </Link>
        </p>
      )}

      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
