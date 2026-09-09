"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PendingDot } from "@/components/ui/PendingDot";

const TABS = [
  { href: "/admin", label: "Обзор" },
  { href: "/admin/tenants", label: "Кофейни" },
  { href: "/admin/guests", label: "Гости" },
  { href: "/admin/applications", label: "Заявки" },
  { href: "/admin/tags", label: "Метки" },
];

export function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav className="mx-auto flex max-w-6xl gap-1.5 overflow-x-auto px-4 pb-3 scrollbar-none">
      {TABS.map((tab) => {
        const active = pathname === tab.href || (tab.href !== "/admin" && pathname?.startsWith(tab.href));
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide transition-all ${
              active
                ? "bg-[#5B8DEF]/15 text-[#7BA5FF] border border-[#5B8DEF]/30 shadow-sm"
                : "text-ink-label hover:text-white hover:bg-white/[0.04]"
            }`}
          >
            {tab.label}
            <PendingDot className="ml-1.5 align-middle" />
          </Link>
        );
      })}
    </nav>
  );
}
