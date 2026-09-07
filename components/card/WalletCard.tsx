"use client";

import type { Brand } from "@/types/db";

export type WalletCardData = {
  slug: string;
  name: string;
  subtitle: string;
  logo_url: string | null;
  brand: Pick<Brand, "primary"> & Partial<Brand>;
  stamps_count: number;
  stamps_required: number | null;
  is_ready?: boolean;
};

export function inkOn(hex: string): string {
  const raw = hex.replace("#", "");
  if (raw.length !== 6) return "#141414";
  const value = parseInt(raw, 16);
  const [r, g, b] = [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.45 ? "#141414" : "#ffffff";
}

export function shade(hex: string, amount: number): string {
  const raw = hex.replace("#", "");
  if (raw.length !== 6) return hex;
  const value = parseInt(raw, 16);
  const channels = [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff].map((channel) =>
    Math.max(0, Math.min(255, channel + Math.round(255 * amount))),
  );
  return `#${channels.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

export function Monogram({
  name,
  logoUrl,
  ink,
  size = 36,
}: {
  name: string;
  logoUrl: string | null;
  ink: string;
  size?: number;
}) {
  const isDarkInk = ink === "#141414";
  return (
    <span
      className="grid shrink-0 place-items-center overflow-hidden rounded-xl font-bold font-mono"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: isDarkInk ? "rgba(0,0,0,0.12)" : "rgba(91,141,239,0.2)",
        color: ink,
        border: `1px solid ${isDarkInk ? "rgba(0,0,0,0.1)" : "rgba(91,141,239,0.3)"}`,
      }}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        name.slice(0, 2).toUpperCase()
      )}
    </span>
  );
}

/**
 * Карточка в стеке кошелька в стиле Stampy.dc (3).html
 */
export function WalletCardRow({
  card,
  onClick,
  isActive,
}: {
  card: WalletCardData;
  onClick: () => void;
  isActive?: boolean;
}) {
  const fill = card.brand.primary ?? "#1B1E27";
  const required = card.stamps_required ?? 6;
  const count = card.stamps_count;
  const isReady = card.is_ready || count >= required;

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      className={`relative w-full rounded-[22px] p-5 text-left cursor-pointer transition-all duration-300 ${
        isActive ? "scale-[1.02] shadow-[0_20px_40px_-12px_rgba(0,0,0,0.8)] border-white/20" : "hover:scale-[1.01] border-white/10"
      }`}
      style={{
        background: isReady
          ? "linear-gradient(160deg, #17223B 0%, #0E1424 100%)"
          : `linear-gradient(160deg, ${shade(fill, 0.1)} 0%, ${shade(fill, -0.2)} 100%)`,
        border: `1px solid ${isReady ? "rgba(91,141,239,0.3)" : "rgba(255,255,255,0.08)"}`,
        boxShadow: "0 20px 40px -20px rgba(0,0,0,0.7)",
      }}
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#7BA5FF] mb-1 font-medium">
            {card.name} · Ташкент
          </div>
          <div className="text-base font-bold tracking-tight text-white">
            {isReady ? "Награда готова" : `${count} из ${required}`}
          </div>
        </div>
        {isReady ? (
          <span className="px-2.5 py-1 rounded-full bg-[#5B8DEF] text-[#0E1424] text-[9px] font-bold uppercase tracking-wider">
            Готова
          </span>
        ) : (
          <span className="text-xs text-[#F4F4F2]/50 font-medium">
            осталось {Math.max(0, required - count)}
          </span>
        )}
      </div>

      {/* Mini stamp slots */}
      <div className="grid grid-cols-7 gap-1.5 pt-2 border-t border-white/[0.06]">
        {Array.from({ length: required }, (_, i) => {
          const filled = i < count;
          const isLast = i === required - 1;
          return (
            <div
              key={i}
              className={`aspect-square rounded-full grid place-items-center ${
                filled
                  ? "bg-[#5B8DEF] text-[#0E1424]"
                  : isLast
                    ? "border border-dashed border-[#5B8DEF]/50 bg-[#5B8DEF]/10"
                    : "border border-white/15"
              }`}
            >
              {filled && (
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
