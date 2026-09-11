"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  value: number;
  suffix?: string;
  duration?: number;
};

// Скачёт от предыдущего показанного числа к новому — заметно оживляет
// KPI-плитки. Ease-out квадратичный, за 700 мс. Пропускает 0 без анимации,
// чтобы не крутить нолями на первом рендере.
export function CountUp({ value, suffix, duration = 700 }: Props) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    if (fromRef.current === value) return;
    const from = fromRef.current;
    const to = value;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) * (1 - t);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(step);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return (
    <span className="tabular-nums">
      {display}
      {suffix ?? ""}
    </span>
  );
}
