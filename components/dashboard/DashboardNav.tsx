"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PendingDot } from "@/components/ui/PendingDot";
import {
  IconBolt,
  IconCard,
  IconChart,
  IconCrown,
  IconLock,
  IconMegaphone,
  IconPin,
  IconTag,
} from "@/components/ui/icons";
import type { StaffRole } from "@/types/db";

type Item = {
  href: string;
  label: string;
  short: string;
  Icon: (props: { className?: string }) => React.ReactElement;
  feature?: "broadcasts";
};

const MAIN_ITEMS: Item[] = [
  { href: "/dashboard", label: "Обзор", short: "Обзор", Icon: IconChart },
  { href: "/dashboard/card", label: "Карта лояльности", short: "Карта", Icon: IconCard },
  { href: "/dashboard/venues", label: "Точки и сотрудники", short: "Точки", Icon: IconPin },
  { href: "/dashboard/tags", label: "NFC-метки", short: "Метки", Icon: IconTag },
];

const SECONDARY_ITEMS: Item[] = [
  {
    href: "/dashboard/broadcasts",
    label: "Рассылки",
    short: "Рассылки",
    Icon: IconMegaphone,
    feature: "broadcasts",
  },
  { href: "/dashboard/billing", label: "Тариф и оплата", short: "Тариф", Icon: IconCrown },
  { href: "/staff", label: "Касса бариста", short: "Касса", Icon: IconBolt },
];

export function DashboardNav({
  canBroadcast,
  role,
  layout = "sidebar",
}: {
  canBroadcast: boolean;
  role: StaffRole;
  layout?: "sidebar" | "top";
}) {
  const pathname = usePathname();
  const main = role === "cashier" ? [] : MAIN_ITEMS;
  const secondary =
    role === "cashier" ? SECONDARY_ITEMS.filter((item) => item.href === "/staff") : SECONDARY_ITEMS;

  if (layout === "top") {
    return (
      <nav className="flex gap-1 overflow-x-auto px-3 pb-2.5 scrollbar-none">
        {[...main, ...secondary].map((item) => {
          const active = pathname === item.href;
          const locked = item.feature === "broadcasts" && !canBroadcast;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                active ? "bg-[#5B8DEF]/15 text-[#7BA5FF] font-semibold" : "text-ink-label hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              <item.Icon className="size-4" />
              {item.short}
              {locked && <IconLock className="size-3.5 opacity-50" />}
              <PendingDot className="size-2.5" />
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-3">
      {main.length > 0 && (
        <NavGroup title="Заведение" items={main} pathname={pathname} canBroadcast={canBroadcast} />
      )}
      <NavGroup
        title="Маркетинг и сервис"
        items={secondary}
        pathname={pathname}
        canBroadcast={canBroadcast}
      />
    </div>
  );
}

function NavGroup({
  title,
  items,
  pathname,
  canBroadcast,
}: {
  title: string;
  items: Item[];
  pathname: string;
  canBroadcast: boolean;
}) {
  return (
    <div>
      <div className="px-3 pb-2 text-[10px] font-mono font-semibold uppercase tracking-wider text-ink-label">
        {title}
      </div>
      <div className="flex flex-col gap-1">
        {items.map((item) => {
          const active = pathname === item.href;
          const locked = item.feature === "broadcasts" && !canBroadcast;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                active
                  ? "bg-[#5B8DEF]/15 text-[#7BA5FF] font-semibold"
                  : "text-ink-body hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              <item.Icon className={`size-4 shrink-0 ${active ? "text-[#7BA5FF]" : "text-ink-label"}`} />
              <span className="truncate">{item.label}</span>
              {locked && <IconLock className="ml-auto size-3.5 opacity-40" />}
              <PendingDot className="ml-auto size-2" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
