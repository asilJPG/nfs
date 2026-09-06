"use client";

import Link from "next/link";
import { PendingDot } from "@/components/ui/PendingDot";

/** Переключатель периода. Клик перерисовывает страницу на сервере — показываем спиннер. */
export function RangeFilter({ ranges, active }: { ranges: number[]; active: number }) {
  return (
    <div className="flex gap-1 rounded-xl border border-line bg-white/[0.04] p-1">
      {ranges.map((range) => (
        <Link
          key={range}
          href={`/dashboard?days=${range}`}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
            active === range
              ? "bg-white/10 text-white shadow-sm"
              : "text-slate-400 hover:text-white"
          }`}
        >
          {range} дн.
          <PendingDot />
        </Link>
      ))}
    </div>
  );
}
