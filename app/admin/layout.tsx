import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth";
import { AdminTabs } from "@/components/admin/AdminTabs";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin();

  return (
    <div className="min-h-dvh bg-cream">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/admin" className="font-semibold">
            Stampy · Платформа
          </Link>
          <form action="/auth/signout" method="post">
            <button className="rounded-xl border border-line px-3 py-1.5 text-sm text-ink-soft">
              Выйти
            </button>
          </form>
        </div>
        <AdminTabs />
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
