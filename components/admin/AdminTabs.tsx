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
    <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-3">
      {TABS.map((tab) => {
        const active = pathname === tab.href || (tab.href !== "/admin" && pathname?.startsWith(tab.href));
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-xs font-semibold tracking-wide transition-all ${
              active
                ? "bg-white text-zinc-950 shadow-sm"
                : "text-zinc-400 hover:text-white hover:bg-zinc-900"
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

