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
const NEW = "#2a78d6";
const RETURNING = "#eb6834";
const SURFACE = "#ffffff";
const GRID = "#eadfd4";
const INK_SOFT = "#6b5c52";

const dayLabel = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" });

export function DailyChart({ data }: { data: AnalyticsDay[] }) {
  if (data.every((row) => row.stamps === 0)) {
    return (
      <p className="py-10 text-center text-sm text-ink-soft">
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
      <div className="mb-3 flex flex-wrap gap-4 text-sm">
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
              cursor={{ fill: "rgba(0,0,0,0.04)" }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as (typeof rows)[number];
                return (
                  <div className="rounded-xl border border-line bg-white px-3 py-2 text-xs shadow-lg">
                    <p className="mb-1 font-medium text-ink">{label}</p>
                    <Row color={NEW} label="Новые" value={row.new_customers} />
                    <Row color={RETURNING} label="Вернувшиеся" value={row.returning_customers} />
                    <p className="mt-1 border-t border-line pt-1 text-ink-soft">
                      Штампов: {row.stamps}
                    </p>
                  </div>
                );
              }}
            />
            <Bar dataKey="new_customers" stackId="guests" fill={NEW} stroke={SURFACE} strokeWidth={2} />
            <Bar
              dataKey="returning_customers"
              stackId="guests"
              fill={RETURNING}
              stroke={SURFACE}
              strokeWidth={2}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-ink-soft">Показать таблицей</summary>
        <div className="mt-2 max-h-64 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-white text-ink-soft">
              <tr>
                <th className="py-1 font-medium">День</th>
                <th className="py-1 font-medium">Новые</th>
                <th className="py-1 font-medium">Вернувшиеся</th>
                <th className="py-1 font-medium">Штампы</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.day} className="border-t border-line/60">
                  <td className="py-1">{row.label}</td>
                  <td className="py-1 tabular-nums">{row.new_customers}</td>
                  <td className="py-1 tabular-nums">{row.returning_customers}</td>
                  <td className="py-1 tabular-nums">{row.stamps}</td>
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
    <span className="flex items-center gap-1.5 text-ink-soft">
      <span className="size-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

function Row({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <p className="flex items-center gap-1.5 text-ink">
      <span className="size-2 rounded-sm" style={{ background: color }} />
      {label}: <span className="tabular-nums">{value}</span>
    </p>
  );
}
