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
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
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
    <div className="flex flex-col gap-7 p-3">
      {main.length > 0 && (
        <NavGroup title="Кабинет" items={main} pathname={pathname} canBroadcast={canBroadcast} />
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
  pathname: string | null;
  canBroadcast: boolean;
}) {
  return (
    <div>
      <p className="eyebrow px-3 pb-2">{title}</p>
      <nav className="flex flex-col gap-0.5">
        {items.map((item) => {
          const active = pathname === item.href;
          const locked = item.feature === "broadcasts" && !canBroadcast;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors ${
                active
                  ? "bg-white/[0.07] text-white"
                  : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
              }`}
            >
              <span
                className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-violet-500 transition-opacity ${
                  active ? "opacity-100" : "opacity-0"
                }`}
              />
              <item.Icon
                className={active ? "text-violet-300" : "text-slate-500 group-hover:text-slate-300"}
              />
              <span className="truncate">{item.label}</span>
              <span className="ml-auto flex items-center gap-1.5">
                {locked && <IconLock className="size-3.5 text-slate-600" />}
                <PendingDot />
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
