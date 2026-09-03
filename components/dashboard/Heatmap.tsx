"use client";

import { useMemo, useState } from "react";

type Cell = { dow: number; hour: number; stamps: number };

/**
 * Hour × weekday intensity. Sequential encoding, so it is one hue light→dark
 * (blue ramp, steps 100→650); "no visits" is the surface, not a ramp step.
 */
const RAMP = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"];
const EMPTY = "#f6f1ec";

// Postgres dow: 0 = Sunday. Shown Monday-first, the way a shop reads its week.
const DAYS = [
  { dow: 1, label: "Пн" },
  { dow: 2, label: "Вт" },
  { dow: 3, label: "Ср" },
  { dow: 4, label: "Чт" },
  { dow: 5, label: "Пт" },
  { dow: 6, label: "Сб" },
  { dow: 0, label: "Вс" },
];

export function Heatmap({ data }: { data: Cell[] }) {
  const [hovered, setHovered] = useState<Cell | null>(null);

  const { lookup, max, hours } = useMemo(() => {
    const map = new Map<string, number>();
    let peak = 0;
    for (const cell of data) {
      map.set(`${cell.dow}:${cell.hour}`, cell.stamps);
      if (cell.stamps > peak) peak = cell.stamps;
    }
    // Show only the hours the shop is actually open, padded by one on each side.
    const active = data.filter((cell) => cell.stamps > 0).map((cell) => cell.hour);
    const first = active.length ? Math.max(0, Math.min(...active) - 1) : 7;
    const last = active.length ? Math.min(23, Math.max(...active) + 1) : 21;
    return {
      lookup: map,
      max: peak,
      hours: Array.from({ length: last - first + 1 }, (_, index) => first + index),
    };
  }, [data]);

  if (max === 0) {
    return <p className="py-10 text-center text-sm text-ink-soft">Пока нет данных за период.</p>;
  }

  const colorFor = (value: number) => {
    if (value === 0) return EMPTY;
    const index = Math.min(RAMP.length - 1, Math.floor((value / max) * RAMP.length));
    return RAMP[index];
  };

  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <table className="border-separate border-spacing-[2px]">
          <thead>
            <tr>
              <th />
              {hours.map((hour) => (
                <th key={hour} className="text-[10px] font-normal text-ink-soft">
                  {hour % 3 === 0 ? hour : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day) => (
              <tr key={day.dow}>
                <th className="pr-2 text-right text-[11px] font-normal text-ink-soft">{day.label}</th>
                {hours.map((hour) => {
                  const value = lookup.get(`${day.dow}:${hour}`) ?? 0;
                  return (
                    <td key={hour}>
                      <div
                        onMouseEnter={() => setHovered({ dow: day.dow, hour, stamps: value })}
                        onMouseLeave={() => setHovered(null)}
                        className="size-5 rounded-[3px]"
                        style={{ background: colorFor(value) }}
                        title={`${day.label}, ${hour}:00 — ${value}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-ink-soft">
        <span>
          {hovered
            ? `${DAYS.find((day) => day.dow === hovered.dow)?.label}, ${hovered.hour}:00 — ${hovered.stamps} шт.`
            : `Пик: ${max} штампов за час`}
        </span>
        <span className="flex items-center gap-1">
          меньше
          {RAMP.map((color) => (
            <span key={color} className="size-3 rounded-[2px]" style={{ background: color }} />
          ))}
          больше
        </span>
      </div>
    </div>
  );
}
