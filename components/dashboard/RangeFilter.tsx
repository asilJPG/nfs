"use client";

import Link from "next/link";
import { PendingDot } from "@/components/ui/PendingDot";

/** Переключатель периода. Клик перерисовывает страницу на сервере — показываем спиннер. */
export function RangeFilter({ ranges, active }: { ranges: number[]; active: number }) {
  return (
    <div className="flex gap-1 rounded-2xl border border-slate-200/80 bg-slate-200/60 p-1">
      {ranges.map((range) => (
        <Link
          key={range}
          href={`/dashboard?days=${range}`}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold tracking-wide transition-all ${
            active === range ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          {range} дн.
          <PendingDot />
        </Link>
      ))}
    </div>
  );
}
