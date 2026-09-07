"use client";

import type { Brand } from "@/types/db";

type Props = {
  filled: number;
  total: number;
  style?: Brand["card_style"];
  justStamped?: number | null;
};

export function StampGrid({ filled, total, justStamped }: Props) {
  // Up to 7 columns in one row, or 2 rows if > 7
  const cols = total <= 7 ? total : Math.ceil(total / 2);

  return (
    <div
      className="grid gap-2 relative w-full"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      aria-label={`Собрано ${filled} из ${total} штампов`}
    >
      {Array.from({ length: total }, (_, index) => {
        const isFilled = index < filled;
        const isLast = index === total - 1;
        const isNext = index === filled;
        const isFresh = justStamped === index;

        if (isFilled) {
          return (
            <div
              key={index}
              className={`aspect-square rounded-full bg-[#5B8DEF] grid place-items-center transition-all duration-300 shadow-[0_2px_8px_rgba(91,141,239,0.3)] ${
                isFresh ? "animate-stamp" : ""
              }`}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0E1424" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
          );
        }

        if (isLast) {
          return (
            <div
              key={index}
              className={`aspect-square rounded-full border grid place-items-center transition-all ${
                isNext
                  ? "border-2 border-[#5B8DEF] bg-[#5B8DEF]/20 shadow-[0_0_16px_rgba(91,141,239,0.5)]"
                  : "border-dashed border-[#5B8DEF]/60 bg-[#5B8DEF]/10"
              }`}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill={isNext ? "#5B8DEF" : "none"} stroke="#5B8DEF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15 8.5 22 9.5 17 14.5 18.2 21.5 12 18 5.8 21.5 7 14.5 2 9.5 9 8.5 12 2" />
              </svg>
            </div>
          );
        }

        return (
          <div
            key={index}
            className={`aspect-square rounded-full transition-all ${
              isNext
                ? "border border-[#5B8DEF]/60 bg-[#5B8DEF]/10"
                : "border border-white/15 bg-white/[0.02]"
            }`}
          />
        );
      })}
    </div>
  );
}
