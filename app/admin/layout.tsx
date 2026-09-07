import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth";
import { AdminTabs } from "@/components/admin/AdminTabs";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin();

  return (
    <div className="min-h-dvh bg-[#08090B] text-[#F4F4F2] font-sans antialiased selection:bg-[#5B8DEF]/30">
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#0E0F11]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5">
          <Link href="/admin" className="flex items-center gap-2 font-bold text-sm text-white tracking-tight">
            <div className="size-6 rounded-lg bg-[#F4F4F2] text-[#0E0F11] grid place-items-center text-xs font-mono font-bold shadow-sm">
              S
            </div>
            <span>Stampy Super-Admin</span>
            <span className="font-mono text-[9px] text-[#7BA5FF] px-1.5 py-0.5 rounded bg-[#5B8DEF]/15 border border-[#5B8DEF]/25 uppercase tracking-wider">
              INT
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-[#5B8DEF]/10 border border-[#5B8DEF]/20 text-[11px] text-[#7BA5FF] font-mono">
              <span className="size-1.5 rounded-full bg-[#5B8DEF]" />
              Все системы в норме
            </div>
            <form action="/auth/signout" method="post">
              <button className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-semibold text-[#F4F4F2]/70 hover:text-white hover:bg-white/10 transition-all">
                Выйти
              </button>
            </form>
          </div>
        </div>
        <AdminTabs />
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
