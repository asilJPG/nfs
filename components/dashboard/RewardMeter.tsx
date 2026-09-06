type Props = {
  earned: number;
  redeemed: number;
  outstanding: number;
};

/**
 * Одно отношение (сколько наград забрали из выданных) — это метр, а не круговая
 * диаграмма из двух долей: два сегмента в кольце глазом не сравниваются, да и
 * прошлое «кольцо» было просто цветным border-ом, не связанным с числами.
 */
export function RewardMeter({ earned, redeemed, outstanding }: Props) {
  const rate = earned > 0 ? Math.round((redeemed / earned) * 100) : null;

  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-[34px] font-bold leading-none tracking-tight text-white tabular-nums">
          {rate === null ? "—" : `${rate}%`}
        </span>
        <span className="text-xs text-ink-soft">наград забрали</span>
      </div>

      <div
        className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-white/[0.07]"
        role="img"
        aria-label={`Погашено ${redeemed} из ${earned} наград`}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-400 transition-[width] duration-500"
          style={{ width: `${rate ?? 0}%` }}
        />
      </div>

      <dl className="mt-5 flex flex-col gap-2.5 text-[13px]">
        <Row label="Выдано за период" value={earned} />
        <Row label="Погашено гостями" value={redeemed} />
        <Row label="Ждут выдачи" value={outstanding} muted />
      </dl>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className={muted ? "text-ink-faint" : "text-ink-soft"}>{label}</dt>
      <dd className="font-semibold tabular-nums text-white">{value}</dd>
    </div>
  );
}
