"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { StaffRole } from "@/types/db";

const ITEMS = [
  { href: "/dashboard", label: "Обзор" },
  { href: "/dashboard/card", label: "Карта" },
  { href: "/dashboard/venues", label: "Точки" },
  { href: "/dashboard/tags", label: "Метки" },
  { href: "/dashboard/broadcasts", label: "Рассылки", feature: "broadcasts" as const },
  { href: "/dashboard/billing", label: "Подписка" },
  { href: "/staff", label: "Касса" },
];

/** Scrollable on a phone, which is where most owners will open this. */
export function DashboardNav({ canBroadcast, role }: { canBroadcast: boolean; role: StaffRole }) {
  const pathname = usePathname();
  const items = role === "cashier" ? ITEMS.filter((item) => item.href === "/staff") : ITEMS;

  return (
    <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-2 pb-2">
      {items.map((item) => {
        const active = pathname === item.href;
        const locked = item.feature === "broadcasts" && !canBroadcast;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm transition ${
              active ? "bg-bean text-white" : "text-ink-soft hover:bg-line/50"
            }`}
          >
            {item.label}
            {locked && <span className="ml-1 opacity-60">🔒</span>}
          </Link>
        );
      })}
    </nav>
  );
}
