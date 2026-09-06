"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalyticsDay } from "@/types/db";

/**
 * Guests per day, split into first-time and returning. Both series count people,
 * so stacking them is honest: the column height is unique guests that day.
 * Stamps ride along in the tooltip rather than on a second axis.
 *
 * Colours are categorical slots 1 and 2 of the validated palette
 * (adjacent CVD ΔE 24.7, normal-vision ΔE 33.6 — both clear).
 */
const NEW = "#8b5cf6";
const RETURNING = "#c084fc";
const SURFACE = "#161822";
const GRID = "rgba(255, 255, 255, 0.05)";
const INK_SOFT = "#94a3b8";

const dayLabel = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" });

export function DailyChart({ data }: { data: AnalyticsDay[] }) {
  if (data.every((row) => row.stamps === 0)) {
    return (
      <p className="py-10 text-center text-xs text-slate-400 font-mono">
        Пока нет посещений за этот период.
      </p>
    );
  }

  const rows = data.map((row) => ({
    ...row,
    label: dayLabel.format(new Date(`${row.day}T00:00:00`)),
  }));

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-4 text-xs font-medium">
        <Legend color={NEW} label="Новые гости" />
        <Legend color={RETURNING} label="Вернувшиеся" />
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -18 }} barCategoryGap="22%">
            <CartesianGrid stroke={GRID} strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: GRID }}
              tick={{ fill: INK_SOFT, fontSize: 11 }}
              minTickGap={18}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: INK_SOFT, fontSize: 11 }}
              allowDecimals={false}
              width={40}
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.03)" }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as (typeof rows)[number];
                return (
                  <div className="rounded-xl border border-white/10 bg-[#0d0e14] px-3.5 py-2.5 text-xs shadow-2xl text-white">
                    <p className="mb-1.5 font-bold tracking-tight text-white border-b border-white/10 pb-1">{label}</p>
                    <Row color={NEW} label="Новые гости" value={row.new_customers} />
                    <Row color={RETURNING} label="Вернувшиеся" value={row.returning_customers} />
                    <p className="mt-1.5 border-t border-white/10 pt-1 text-[11px] text-purple-400 font-mono">
                      Штампов: {row.stamps}
                    </p>
                  </div>
                );
              }}
            />
            <Bar dataKey="new_customers" stackId="guests" fill={NEW} stroke={SURFACE} strokeWidth={1} />
            <Bar
              dataKey="returning_customers"
              stackId="guests"
              fill={RETURNING}
              stroke={SURFACE}
              strokeWidth={1}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-slate-500 hover:text-slate-300 font-mono">Показать таблицей</summary>
        <div className="mt-2 max-h-64 overflow-auto rounded-xl border border-white/5 bg-[#0d0e14]">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-[#161822] text-slate-400 border-b border-white/5">
              <tr>
                <th className="py-2 px-3 font-semibold">День</th>
                <th className="py-2 px-3 font-semibold">Новые</th>
                <th className="py-2 px-3 font-semibold">Вернувшиеся</th>
                <th className="py-2 px-3 font-semibold">Штампы</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((row) => (
                <tr key={row.day} className="hover:bg-white/5 text-slate-300">
                  <td className="py-2 px-3 font-mono">{row.label}</td>
                  <td className="py-2 px-3 tabular-nums font-mono text-purple-400">{row.new_customers}</td>
                  <td className="py-2 px-3 tabular-nums font-mono text-indigo-400">{row.returning_customers}</td>
                  <td className="py-2 px-3 tabular-nums font-mono font-bold text-white">{row.stamps}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-slate-400">
      <span className="size-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

function Row({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <p className="flex items-center justify-between gap-4 text-xs">
      <span className="flex items-center gap-1.5 text-slate-300">
        <span className="size-2 rounded-full" style={{ background: color }} />
        {label}
      </span>
      <span className="tabular-nums font-mono font-bold text-white">{value}</span>
    </p>
  );
}

