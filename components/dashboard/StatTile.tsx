type Props = {
  label: string;
  value: number | string;
  hint?: string;
};

/** A number that needs no plot. Value first, label under it, hint only if it earns space. */
export function StatTile({ label, value, hint }: Props) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-sm text-ink-soft">{label}</p>
      {hint && <p className="mt-1 text-xs text-ink-soft/80">{hint}</p>}
    </div>
  );
}
