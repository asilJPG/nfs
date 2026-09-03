"use client";

import { useMemo, useState, useTransition } from "react";
import { createTenantAction, type OnboardingError } from "@/app/onboarding/actions";
import { CardPreview, contrastRatio } from "@/components/brand/CardPreview";
import { slugify, SLUG_PATTERN } from "@/lib/slug";
import type { Brand } from "@/types/db";

const PALETTES: { label: string; brand: Brand }[] = [
  {
    label: "Классика",
    brand: { primary: "#6F4E37", bg: "#FFF8F0", surface: "#FFFFFF", text: "#2A1E17", accent: "#C8A27A", card_style: "circles" },
  },
  {
    label: "Тёмный",
    brand: { primary: "#E8C39E", bg: "#14100D", surface: "#1E1813", text: "#F5EDE5", accent: "#9C7A5B", card_style: "cups" },
  },
  {
    label: "Матча",
    brand: { primary: "#4F7A46", bg: "#F4F8EF", surface: "#FFFFFF", text: "#1E2A1A", accent: "#A8C79A", card_style: "circles" },
  },
  {
    label: "Ягода",
    brand: { primary: "#A63A5B", bg: "#FFF4F6", surface: "#FFFFFF", text: "#2B1218", accent: "#E8A0B4", card_style: "hearts" },
  },
];

const COLOR_FIELDS: { key: keyof Omit<Brand, "card_style">; label: string }[] = [
  { key: "primary", label: "Основной" },
  { key: "bg", label: "Фон" },
  { key: "surface", label: "Карточка" },
  { key: "text", label: "Текст" },
];

const STYLES: { value: Brand["card_style"]; label: string }[] = [
  { value: "circles", label: "● Кружки" },
  { value: "cups", label: "☕ Стаканы" },
  { value: "hearts", label: "♥ Сердца" },
  { value: "stars", label: "★ Звёзды" },
];

/** One screen, live preview: a shop should be running in about three minutes. */
export function OnboardingForm() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [venueName, setVenueName] = useState("");
  const [stamps, setStamps] = useState(6);
  const [reward, setReward] = useState("Бесплатный кофе");
  const [brand, setBrand] = useState<Brand>(PALETTES[0].brand);
  const [error, setError] = useState<OnboardingError | null>(null);
  const [pending, startTransition] = useTransition();

  const effectiveSlug = slugTouched ? slug : slugify(name);
  const slugValid = SLUG_PATTERN.test(effectiveSlug);

  const contrastWarning = useMemo(() => {
    if (contrastRatio(brand.text, brand.surface) < 4.5) return "Текст плохо читается на карточке.";
    if (contrastRatio(brand.primary, brand.surface) < 2) return "Основной цвет сливается с карточкой.";
    return null;
  }, [brand]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createTenantAction({
        name,
        slug: effectiveSlug,
        venueName: venueName || undefined,
        stamps,
        reward,
        brand,
      });
      if (result) setError(result);
    });
  }

  return (
    <form onSubmit={submit} className="mx-auto grid max-w-5xl gap-8 px-5 py-8 lg:grid-cols-[1fr_20rem]">
      <div className="flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-semibold">Настройте карту</h1>
          <p className="text-sm text-ink-soft">
            30 дней бесплатно. Карта заработает сразу — ещё до того, как приедут NFC-подставки.
          </p>
        </header>

        <Field label="Название кофейни" error={error?.field === "name" ? error.message : undefined}>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={80}
            placeholder="Кофе на Амире Темура"
            className={inputClass}
          />
        </Field>

        <Field
          label="Адрес карты"
          hint={`t.me/…?startapp=t_${effectiveSlug || "your-cafe"}`}
          error={error?.field === "slug" ? error.message : undefined}
        >
          <input
            value={effectiveSlug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(slugify(event.target.value));
            }}
            required
            className={inputClass}
          />
          {!slugValid && effectiveSlug.length > 0 && (
            <p className="mt-1 text-xs text-red-600">Латиница, цифры и дефис, минимум 3 символа.</p>
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Штампов до награды">
            <input
              type="number"
              min={2}
              max={20}
              value={stamps}
              onChange={(event) => setStamps(Number(event.target.value))}
              className={inputClass}
            />
          </Field>
          <Field label="Что получает гость">
            <input
              value={reward}
              onChange={(event) => setReward(event.target.value)}
              required
              maxLength={60}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Название точки" hint="Если точек несколько, остальные добавите позже">
          <input
            value={venueName}
            onChange={(event) => setVenueName(event.target.value)}
            maxLength={80}
            placeholder={name || "Главная"}
            className={inputClass}
          />
        </Field>

        <div>
          <p className="mb-2 text-sm font-medium">Оформление</p>
          <div className="mb-4 flex flex-wrap gap-2">
            {PALETTES.map((palette) => (
              <button
                key={palette.label}
                type="button"
                onClick={() => setBrand(palette.brand)}
                className="flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm"
              >
                <span className="size-3 rounded-full" style={{ background: palette.brand.primary }} />
                {palette.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {COLOR_FIELDS.map((field) => (
              <label key={field.key} className="text-xs text-ink-soft">
                {field.label}
                <input
                  type="color"
                  value={brand[field.key]}
                  onChange={(event) => setBrand({ ...brand, [field.key]: event.target.value })}
                  className="mt-1 h-10 w-full cursor-pointer rounded-xl border border-line bg-white"
                />
              </label>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {STYLES.map((style) => (
              <button
                key={style.value}
                type="button"
                onClick={() => setBrand({ ...brand, card_style: style.value })}
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  brand.card_style === style.value ? "border-bean bg-bean/10" : "border-line"
                }`}
              >
                {style.label}
              </button>
            ))}
          </div>

          {contrastWarning && <p className="mt-3 text-sm text-amber-700">{contrastWarning}</p>}
        </div>

        {error && !error.field && <p className="text-sm text-red-600">{error.message}</p>}

        <button
          type="submit"
          disabled={pending || !slugValid || name.trim().length < 2}
          className="rounded-2xl bg-bean py-3.5 font-medium text-white disabled:opacity-50"
        >
          {pending ? "Создаём…" : "Запустить карту"}
        </button>
      </div>

      <aside className="lg:sticky lg:top-8 lg:self-start">
        <p className="mb-2 text-sm text-ink-soft">Так карту увидит гость</p>
        <CardPreview brand={brand} name={name} stamps={stamps} reward={reward} />
      </aside>
    </form>
  );
}

const inputClass =
  "w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none focus:border-bean";

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-soft">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}
