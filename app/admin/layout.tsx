import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin();
  const supabase = await supabaseServer();

  const [
    { count: tenantsCount },
    { count: guestsCount },
    { count: applicationsCount },
    { count: tagsCount },
  ] = await Promise.all([
    supabase.from("stampy_tenants").select("*", { count: "exact", head: true }),
    supabase.from("stampy_customers").select("*", { count: "exact", head: true }),
    supabase.from("stampy_applications").select("*", { count: "exact", head: true }).in("status", ["new", "contacted"]),
    supabase.from("stampy_nfc_tags").select("*", { count: "exact", head: true }),
  ]);

  return (
    <div className="min-h-dvh bg-[#08090B] text-[#F4F4F2] font-sans antialiased selection:bg-[#5B8DEF]/30 flex">
      {/* Desktop Sidebar — exact structure from Screen 14 of Stampy.dc (3).html */}
      <div className="hidden md:block">
        <div className="sticky top-0 h-screen">
          <AdminSidebar
            counts={{
              tenants: tenantsCount ?? 0,
              guests: guestsCount ?? 0,
              applications: applicationsCount ?? 0,
              tags: tagsCount ?? 0,
            }}
          />
        </div>
      </div>

      {/* Main content column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile topbar with tabs */}
        <header className="md:hidden sticky top-0 z-30 border-b border-white/[0.06] bg-[#0E0F11]/90 backdrop-blur-md">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <Link href="/admin" className="flex items-center gap-2 font-bold text-sm text-white tracking-tight">
              <div className="size-6 rounded-lg bg-[#F4F4F2] text-[#0E0F11] grid place-items-center text-xs font-mono font-bold shadow-sm">
                S
              </div>
              <span>Stampy</span>
              <span className="font-mono text-[9px] text-[#7BA5FF] px-1.5 py-0.5 rounded bg-[#5B8DEF]/15 border border-[#5B8DEF]/25 uppercase tracking-wider">
                INT
              </span>
            </Link>
            <form action="/auth/signout" method="post">
              <button className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-ink-body hover:text-white">
                Выйти
              </button>
            </form>
          </div>
          <AdminTabs />
        </header>

        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
