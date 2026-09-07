import type { Brand } from "@/types/db";

type Props = {
  brand: Brand;
  name: string;
  logoUrl?: string | null;
  stamps: number;
  filled?: number;
  reward: string;
};

/** Exactly what the customer sees, at phone width — used wherever brand is edited. */
export function CardPreview({ brand, name, logoUrl, stamps, filled = 3, reward }: Props) {
  const total = stamps || 6;
  const columns = Math.min(total, 7);

  return (
    <div
      className="rounded-[26px] p-6 shadow-2xl relative overflow-hidden border border-[#5B8DEF]/25"
      style={{
        background: brand.bg?.includes("gradient") ? brand.bg : "linear-gradient(160deg, #17223B 0%, #0E1424 100%)",
        color: brand.text || "#F4F4F2",
      }}
    >
      {/* Subtle Glow */}
      <div className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full bg-[radial-gradient(circle,_rgba(91,141,239,0.2),_transparent_65%)]" />

      {/* Header */}
      <div className="flex justify-between items-start mb-6 relative">
        <div className="min-w-0 pr-2">
          <div className="font-mono text-[10px] text-[#7BA5FF] uppercase tracking-widest mb-1.5 font-medium">
            {name || "Sfumato"} · Ташкент
          </div>
          <h3 className="text-lg font-bold tracking-tight text-white leading-snug">
            {reward || "7-й напиток за счёт заведения"}
          </h3>
        </div>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="size-9 rounded-xl object-cover border border-white/10" />
        ) : (
          <div
            className="grid size-9 place-items-center rounded-xl font-mono text-xs font-bold text-[#7BA5FF] border border-[#5B8DEF]/30 bg-[#5B8DEF]/15 shrink-0"
          >
            {(name || "S").slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>

      {/* Stamp Grid */}
      <div
        className="grid gap-2 mb-6 relative"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: total }, (_, index) => {
          const isFilled = index < filled;
          const isRewardSlot = index === total - 1;

          if (isRewardSlot) {
            return (
              <div
                key={index}
                className="aspect-square rounded-full border border-dashed border-[#5B8DEF]/60 bg-[#5B8DEF]/10 grid place-items-center"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill={isFilled ? "#5B8DEF" : "none"} stroke="#5B8DEF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15 8.5 22 9.5 17 14.5 18.2 21.5 12 18 5.8 21.5 7 14.5 2 9.5 9 8.5 12 2" />
                </svg>
              </div>
            );
          }

          return (
            <div
              key={index}
              className={`aspect-square rounded-full grid place-items-center transition-all ${
                isFilled
                  ? "bg-[#5B8DEF] text-[#0E1424] shadow-[0_2px_8px_rgba(91,141,239,0.4)]"
                  : "border border-white/15 bg-white/[0.02]"
              }`}
            >
              {isFilled && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
            </div>
          );
        })}
      </div>

      {/* Progress Footer */}
      <div className="flex items-end justify-between pt-4 border-t border-white/[0.08] relative">
        <div>
          <div className="text-2xl font-bold tracking-tight text-white">
            {filled}
            <span className="text-sm font-normal text-white/40">/{total}</span>
          </div>
          <div className="text-[11px] text-[#F4F4F2]/50 mt-0.5 font-medium">
            {filled === total ? "награда готова" : `осталось ${Math.max(0, total - filled)}`}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs font-semibold text-[#7BA5FF]">
            {filled === total ? "Готово к выдаче" : "Накопительная"}
          </div>
          <div className="text-[10px] text-[#F4F4F2]/40 mt-0.5">В Telegram</div>
        </div>
      </div>
    </div>
  );
}

/** Rough WCAG contrast, so a shop cannot ship white text on white. */
export function contrastRatio(a: string, b: string): number {
  const luminance = (hex: string) => {
    const value = hex.replace("#", "");
    const channels = [0, 2, 4].map((offset) => {
      const channel = parseInt(value.slice(offset, offset + 2), 16) / 255;
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}
