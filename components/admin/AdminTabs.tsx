"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
    <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
      {TABS.map((tab) => {
        const active = pathname === tab.href || (tab.href !== "/admin" && pathname?.startsWith(tab.href));
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm ${
              active ? "border-bean font-medium text-ink" : "border-transparent text-ink-soft"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
