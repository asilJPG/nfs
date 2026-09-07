type Accent = "violet" | "sky" | "amber" | "pink" | "emerald" | "slate" | "blue";

type Props = {
  label: string;
  value: number | string;
  hint?: string;
  accent?: Accent;
};

export function StatTile({ label, value, hint }: Props) {
  return (
    <div className="card card-hover relative overflow-hidden p-5 bg-[#14161D] border border-white/[0.06] rounded-[20px]">
      <div className="flex justify-between items-baseline mb-2">
        <p className="text-[10px] font-mono uppercase tracking-wider text-[#F4F4F2]/50 font-semibold">{label}</p>
      </div>
      <p className="text-[28px] font-bold leading-none tracking-tight text-white tabular-nums">
        {value}
      </p>
      {hint && <p className="mt-2 text-[11px] leading-snug text-[#7BA5FF] font-medium">{hint}</p>}
    </div>
  );
}
