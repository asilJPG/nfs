import type { Brand } from "@/types/db";
import { StampGrid } from "@/components/card/StampGrid";
import { plateColors, withAlpha } from "@/lib/color";

export { contrastRatio } from "@/lib/color";

type Props = {
  brand: Brand;
  name: string;
  logoUrl?: string | null;
  stamps: number;
  filled?: number;
  reward: string;
};

/**
 * Ровно то, что видит гость: та же вёрстка и тот же StampGrid, что в мини-аппе.
 * Если меняете плашку в CardScreen — меняйте и здесь, иначе превью начнёт врать.
 */
export function CardPreview({ brand: raw, name, logoUrl, stamps, filled = 3, reward }: Props) {
  const safe = plateColors(raw);
  const brand = { ...raw, ...safe };
  const total = stamps || 6;
  const capped = Math.min(filled, total);
  const remaining = Math.max(0, total - capped);

  return (
    <div
      className="rounded-[26px] p-6 relative overflow-hidden"
      style={{
        background: `linear-gradient(160deg, ${brand.surface} 0%, ${brand.bg} 100%)`,
        color: brand.text,
        border: `1px solid ${withAlpha(brand.primary, 0.25)}`,
        boxShadow: `0 24px 50px -20px ${withAlpha(brand.primary, 0.3)}`,
      }}
    >
      <div
        className="pointer-events-none absolute -top-20 -right-20 size-48 rounded-full"
        style={{ background: `radial-gradient(circle, ${withAlpha(brand.primary, 0.22)}, transparent 65%)` }}
      />

      <div className="flex justify-between items-start mb-6 relative">
        <div className="min-w-0 pr-2">
          <div
            className="font-mono text-[10px] uppercase tracking-widest mb-1.5 font-medium truncate"
            style={{ color: brand.accent }}
          >
            {name || "Ваша кофейня"}
          </div>
          <h3 className="text-xl font-bold tracking-tight leading-snug">
            {reward || "Награда пока не задана"}
          </h3>
        </div>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt=""
            className="size-9 shrink-0 rounded-xl object-cover"
            style={{ border: `1px solid ${withAlpha(brand.text, 0.1)}` }}
          />
        ) : (
          <div
            className="grid size-9 shrink-0 place-items-center rounded-xl font-mono text-xs font-bold"
            style={{
              color: brand.primary,
              border: `1px solid ${withAlpha(brand.primary, 0.3)}`,
              background: withAlpha(brand.primary, 0.15),
            }}
          >
            {(name || "СТ").slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>

      <div className="mb-6 relative">
        <StampGrid filled={capped} total={total} brand={brand} />
      </div>

      <div
        className="flex items-end justify-between pt-4 relative"
        style={{ borderTop: `1px solid ${withAlpha(brand.text, 0.08)}` }}
      >
        <div>
          <div className="text-2xl font-bold tracking-tight">
            {capped}
            <span className="text-sm font-normal" style={{ color: withAlpha(brand.text, 0.4) }}>
              /{total}
            </span>
          </div>
          <div className="text-[11px] mt-0.5 font-medium" style={{ color: withAlpha(brand.text, 0.5) }}>
            {capped === 0 ? "новая карта" : capped >= total ? "награда готова!" : "в процессе накопления"}
          </div>
        </div>
        <div className="text-right">
          {capped >= total ? (
            <span
              className="inline-block px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider"
              style={{ background: brand.primary, color: brand.surface }}
            >
              Получить QR
            </span>
          ) : (
            <div>
              <div className="text-xs font-semibold" style={{ color: brand.accent }}>
                осталось {remaining}
              </div>
              <div
                className="text-[10px] mt-0.5 max-w-[140px] truncate"
                style={{ color: withAlpha(brand.text, 0.4) }}
              >
                до «{reward || "награды"}»
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
