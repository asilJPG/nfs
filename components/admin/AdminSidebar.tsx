"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Counts = {
  tenants: number;
  guests: number;
  applications: number;
  tags: number;
};

export function AdminSidebar({ counts }: { counts?: Counts }) {
  const pathname = usePathname();

  const NAV_ITEMS = [
    {
      href: "/admin",
      label: "Обзор",
      exact: true,
      count: undefined,
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </svg>
      ),
    },
    {
      href: "/admin/tenants",
      label: "Кофейни",
      exact: false,
      count: counts?.tenants,
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M3 21h18M6 21V10M12 21V4M18 21v-8" />
        </svg>
      ),
    },
    {
      href: "/admin/guests",
      label: "Гости",
      exact: false,
      count: counts?.guests,
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      href: "/admin/applications",
      label: "Заявки",
      exact: false,
      count: counts?.applications,
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect x="1" y="4" width="22" height="16" rx="2" />
          <path d="M1 10h22" />
        </svg>
      ),
    },
    {
      href: "/admin/tags",
      label: "NFC-метки",
      exact: false,
      count: counts?.tags,
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
          <circle cx="7" cy="7" r="1.5" />
        </svg>
      ),
    },
    {
      href: "/admin/account",
      label: "Аккаунт",
      exact: false,
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4.5" y="10" width="15" height="10" rx="2.5" />
          <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
        </svg>
      ),
    },
  ];

  return (
    <aside className="w-[220px] flex-shrink-0 bg-[#0B0C0E] border-r border-white/[0.06] p-5 flex flex-col min-h-screen">
      {/* Brand logo as in Screen 14 */}
      <Link href="/admin" className="flex items-center gap-2.5 px-2 py-1 mb-2 group">
        <div className="size-[26px] rounded-lg bg-[#F4F4F2] grid place-items-center flex-shrink-0 shadow-sm transition-transform group-hover:scale-105">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0E0F11" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 2v2M12 2v2M16 2v2M4 8h16v9a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Z" />
          </svg>
        </div>
        <span className="text-sm font-semibold tracking-tight text-white">Stampy</span>
        <span className="font-mono text-[9px] text-[#7BA5FF] px-1.5 py-0.5 rounded bg-[#5B8DEF]/15 border border-[#5B8DEF]/25 uppercase tracking-wider">
          INT
        </span>
      </Link>

      {/* Group: Управление */}
      <div className="text-[10px] text-ink-label font-mono uppercase tracking-[0.1em] px-2.5 pt-5 pb-2">
        Управление
      </div>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = item.exact ? pathname === item.href : pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-2.5 py-2 rounded-xl text-[13px] font-medium transition-all flex items-center gap-2.5 ${
                active
                  ? "bg-[#5B8DEF]/15 text-white shadow-sm border border-[#5B8DEF]/20"
                  : "text-ink-label hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              <span className={active ? "text-[#7BA5FF]" : "text-ink-label"}>{item.icon}</span>
              <span>{item.label}</span>
              {item.count !== undefined && item.count > 0 && (
                <span className="ml-auto font-mono text-[10px] text-ink-label px-1.5 py-0.5 rounded bg-white/[0.04]">
                  {item.count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Group: Система */}
      <div className="text-[10px] text-ink-label font-mono uppercase tracking-[0.1em] px-2.5 pt-6 pb-2">
        Продукт
      </div>
      <div className="flex flex-col gap-1 text-[13px] text-ink-label">
        <Link
          href="/dashboard"
          className="px-2.5 py-2 rounded-xl hover:text-white hover:bg-white/[0.04] transition-all flex items-center gap-2.5"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
          </svg>
          <span>В кабинет кофейни</span>
        </Link>
        <Link
          href="/"
          target="_blank"
          className="px-2.5 py-2 rounded-xl hover:text-white hover:bg-white/[0.04] transition-all flex items-center gap-2.5"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20" />
          </svg>
          <span>Витрина (лендинг)</span>
        </Link>
      </div>

      {/* Profile footer as in Screen 14 */}
      <div className="mt-auto pt-4 border-t border-white/[0.06] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-[30px] rounded-full bg-gradient-to-br from-[#E85D45] to-[#C43A22] grid place-items-center text-white text-xs font-semibold flex-shrink-0 shadow-sm">
            А
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-white truncate">Super-Admin</div>
            <div className="text-[10px] text-ink-label font-mono">Ops · Stampy</div>
          </div>
        </div>
        <form action="/auth/signout" method="post">
          <button
            title="Выйти"
            className="size-7 rounded-lg border border-white/10 bg-white/[0.04] text-ink-label hover:text-white hover:bg-white/10 grid place-items-center transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
          </button>
        </form>
      </div>
    </aside>
  );
}
