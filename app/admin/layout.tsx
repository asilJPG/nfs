import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth";
import { AdminTabs } from "@/components/admin/AdminTabs";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin();

  return (
    <div className="min-h-dvh bg-zinc-950 text-white font-sans antialiased">
      <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5">
          <Link href="/admin" className="flex items-center gap-2 font-bold text-sm text-white tracking-tight">
            <span className="grid size-6 place-items-center rounded-md bg-white text-zinc-950 text-xs font-mono font-bold">S</span>
            Stampy Platform
          </Link>
          <form action="/auth/signout" method="post">
            <button className="rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-zinc-400 hover:text-white transition-all">
              Выйти
            </button>
          </form>
        </div>
        <AdminTabs />
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}

