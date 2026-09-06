type Accent = "violet" | "sky" | "amber" | "pink" | "emerald" | "slate";

type Props = {
  label: string;
  value: number | string;
  hint?: string;
  accent?: Accent;
};

// Тонкая цветная линия сверху вместо полностью залитой плитки: восемь ярких
// прямоугольников подряд читались как набор кнопок, а не как цифры.
const ACCENTS: Record<Accent, string> = {
  violet: "from-violet-500 to-indigo-500",
  sky: "from-sky-500 to-cyan-400",
  amber: "from-amber-500 to-orange-400",
  pink: "from-pink-500 to-rose-400",
  emerald: "from-emerald-500 to-teal-400",
  slate: "from-slate-500 to-slate-400",
};

export function StatTile({ label, value, hint, accent = "violet" }: Props) {
  return (
    <div className="card card-hover relative overflow-hidden p-5">
      <span
        className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${ACCENTS[accent]} opacity-70`}
      />
      <p className="text-xs font-medium text-ink-soft">{label}</p>
      <p className="mt-2.5 text-[28px] font-bold leading-none tracking-tight text-white tabular-nums">
        {value}
      </p>
      {hint && <p className="mt-2 text-[11px] leading-snug text-ink-faint">{hint}</p>}
    </div>
  );
}
