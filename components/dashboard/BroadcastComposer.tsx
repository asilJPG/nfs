"use client";

import { useEffect, useState, useTransition } from "react";
import { segmentSize, sendBroadcast, type Result } from "@/app/dashboard/broadcasts/actions";
import type { Segment } from "@/types/db";

const PRESETS: { label: string; hint: string; segment: Segment }[] = [
  { label: "Все гости", hint: "Каждый, у кого есть ваша карта", segment: { type: "all" } },
  {
    label: "Давно не были",
    hint: "Последний визит больше 14 дней назад",
    segment: { type: "inactive", days: 14 },
  },
  {
    label: "Почти собрали карту",
    hint: "Остался один штамп до награды",
    segment: { type: "close_to_reward", remaining: 1 },
  },
  {
    label: "Есть незабранная награда",
    hint: "Заработали, но ещё не пришли",
    segment: { type: "has_reward" },
  },
  { label: "Новые за неделю", hint: "Завели карту за 7 дней", segment: { type: "new", days: 7 } },
];

export function BroadcastComposer() {
  const [index, setIndex] = useState(0);
  const [body, setBody] = useState("");
  const [size, setSize] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [pending, startTransition] = useTransition();

  const segment = PRESETS[index].segment;

  useEffect(() => {
    let cancelled = false;
    setSize(null);
    void segmentSize(segment).then((value) => {
      if (!cancelled) setSize(value);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const outcome = await sendBroadcast({ body, segment, scheduledAt: null });
      setResult(outcome);
      if (outcome.ok) setBody("");
    });
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-line bg-white p-4">
      <h2 className="mb-3 font-medium">Новая рассылка</h2>

      <div className="mb-4 flex flex-wrap gap-2">
        {PRESETS.map((preset, presetIndex) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => setIndex(presetIndex)}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              index === presetIndex ? "border-bean bg-bean/10" : "border-line text-ink-soft"
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <p className="mb-3 text-sm text-ink-soft">
        {PRESETS[index].hint} ·{" "}
        {size === null ? "считаем…" : `${size} ${plural(size, "получатель", "получателя", "получателей")}`}
      </p>

      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={5}
        maxLength={3500}
        placeholder="Соскучились? До конца недели дарим круассан к любому кофе ☕"
        className="w-full rounded-2xl border border-line px-4 py-3 outline-none focus:border-bean"
      />
      <p className="mt-1 text-xs text-ink-soft">
        Поддерживается простой HTML: &lt;b&gt;жирный&lt;/b&gt;, &lt;i&gt;курсив&lt;/i&gt;.
        Сообщение придёт от бота — гость увидит его как обычный чат.
      </p>

      {result && (
        <p className={`mt-3 text-sm ${result.ok ? "text-bean-dark" : "text-red-600"}`}>
          {result.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || body.trim().length === 0 || size === 0}
        className="mt-4 w-full rounded-2xl bg-bean py-3.5 font-medium text-white disabled:opacity-50"
      >
        {pending ? "Отправляем…" : "Отправить"}
      </button>
    </form>
  );
}

function plural(count: number, one: string, few: string, many: string) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
