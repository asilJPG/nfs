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
    <form onSubmit={submit} className="card p-5 md:p-6">
      <h2 className="card-title mb-1">Новая рассылка</h2>
      <p className="mb-4 text-xs text-ink-soft">Выберите, кому уходит сообщение</p>

      <div className="mb-4 flex flex-wrap gap-2">
        {PRESETS.map((preset, presetIndex) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => setIndex(presetIndex)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              index === presetIndex
                ? "border-violet-500/50 bg-violet-500/15 text-violet-200"
                : "border-line text-ink-soft hover:border-line-strong hover:text-slate-200"
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <p className="mb-3 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
        {PRESETS[index].hint}
        <span className="badge badge-accent">
          {size === null
            ? "считаем…"
            : `${size} ${plural(size, "получатель", "получателя", "получателей")}`}
        </span>
      </p>

      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={5}
        maxLength={3500}
        placeholder="Соскучились? До конца недели дарим круассан к любому кофе ☕"
        className="input resize-y leading-relaxed"
      />
      <p className="field-hint">
        Поддерживается простой HTML: &lt;b&gt;жирный&lt;/b&gt;, &lt;i&gt;курсив&lt;/i&gt;.
        Сообщение придёт от бота — гость увидит его как обычный чат.
      </p>

      {result && (
        <p className={`note mt-4 ${result.ok ? "note-ok" : "note-bad"}`}>{result.message}</p>
      )}

      <button
        type="submit"
        disabled={pending || body.trim().length === 0 || size === 0}
        className="btn btn-primary btn-block mt-5"
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
