"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { saveCardSettings, type SaveResult } from "@/app/dashboard/card/actions";
import { CardPreview, contrastRatio } from "@/components/brand/CardPreview";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Brand, LoyaltyProgram, Tenant } from "@/types/db";

type Props = {
  tenant: Pick<Tenant, "id" | "name" | "logo_url" | "brand">;
  program: Pick<
    LoyaltyProgram,
    "stamps_required" | "reward_title" | "reward_description" | "reward_expires_days" | "stamp_cooldown_minutes"
  >;
};

const COLORS: { key: keyof Omit<Brand, "card_style">; label: string }[] = [
  { key: "primary", label: "Основной" },
  { key: "bg", label: "Фон" },
  { key: "surface", label: "Карточка" },
  { key: "text", label: "Текст" },
  { key: "accent", label: "Акцент" },
];

const STYLES: Brand["card_style"][] = ["circles", "cups", "hearts", "stars"];
const STYLE_LABELS: Record<Brand["card_style"], string> = {
  circles: "● Кружки",
  cups: "☕ Стаканы",
  hearts: "♥ Сердца",
  stars: "★ Звёзды",
};

export function CardSettingsForm({ tenant, program }: Props) {
  const [name, setName] = useState(tenant.name);
  const [logoUrl, setLogoUrl] = useState(tenant.logo_url);
  const [brand, setBrand] = useState<Brand>(tenant.brand);
  const [rules, setRules] = useState(program);
  const [result, setResult] = useState<SaveResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const warning = useMemo(() => {
    if (contrastRatio(brand.text, brand.surface) < 4.5) return "Текст плохо читается на карточке.";
    if (contrastRatio(brand.primary, brand.surface) < 2) return "Штампы сливаются с карточкой.";
    if (contrastRatio(brand.text, brand.bg) < 4.5) return "Текст плохо читается на фоне.";
    return null;
  }, [brand]);

  async function uploadLogo(file: File) {
    setUploading(true);
    setResult(null);
    const supabase = supabaseBrowser();
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "png";
    const path = `${tenant.id}/logo-${Date.now()}.${extension}`;

    const { error } = await supabase.storage.from("stampy-logos").upload(path, file, { upsert: true });
    setUploading(false);
    if (error) {
      setResult({ ok: false, message: `Не удалось загрузить логотип: ${error.message}` });
      return;
    }
    const { data } = supabase.storage.from("stampy-logos").getPublicUrl(path);
    setLogoUrl(data.publicUrl);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      setResult(await saveCardSettings({ name, logoUrl, brand, program: rules }));
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="flex flex-col gap-6">
        <section className="card p-5">
          <h2 className="card-title mb-4">Кофейня</h2>

          <label className="mb-4 block">
            <span className="field-label">Название</span>
            <input value={name} onChange={(event) => setName(event.target.value)} className={input} />
          </label>

          <div className="flex items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="size-14 rounded-2xl border border-line object-cover" />
            ) : (
              <div className="grid size-14 place-items-center rounded-2xl border border-dashed border-line-strong text-xs text-ink-faint">
                лого
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
                className="btn btn-ghost btn-sm"
              >
                {uploading ? "Загружаем…" : "Загрузить логотип"}
              </button>
              {logoUrl && (
                <button
                  type="button"
                  onClick={() => setLogoUrl(null)}
                  className="btn btn-ghost btn-sm"
                >
                  Убрать
                </button>
              )}
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadLogo(file);
              }}
            />
          </div>
        </section>

        <section className="card p-5">
          <h2 className="card-title mb-4">Оформление</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {COLORS.map((field) => (
              <label key={field.key} className="text-xs text-ink-soft">
                {field.label}
                <input
                  type="color"
                  value={brand[field.key]}
                  onChange={(event) => setBrand({ ...brand, [field.key]: event.target.value })}
                  className="mt-1.5 h-10 w-full cursor-pointer rounded-xl border border-line bg-surface-2 p-1"
                />
              </label>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {STYLES.map((style) => (
              <button
                key={style}
                type="button"
                onClick={() => setBrand({ ...brand, card_style: style })}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  brand.card_style === style
                    ? "border-violet-500/50 bg-violet-500/15 text-violet-200"
                    : "border-line text-ink-soft hover:border-line-strong hover:text-slate-200"
                }`}
              >
                {STYLE_LABELS[style]}
              </button>
            ))}
          </div>
          {warning && <p className="note note-warn mt-4">{warning}</p>}
        </section>

        <section className="card p-5">
          <h2 className="card-title mb-4">Условия карты</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="field-label">Штампов до награды</span>
              <input
                type="number"
                min={2}
                max={20}
                value={rules.stamps_required}
                onChange={(event) => setRules({ ...rules, stamps_required: Number(event.target.value) })}
                className={input}
              />
            </label>
            <label className="block">
              <span className="field-label">Награда</span>
              <input
                value={rules.reward_title}
                onChange={(event) => setRules({ ...rules, reward_title: event.target.value })}
                maxLength={60}
                className={input}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="field-label">Пояснение к награде</span>
              <input
                value={rules.reward_description ?? ""}
                onChange={(event) =>
                  setRules({ ...rules, reward_description: event.target.value || null })
                }
                maxLength={200}
                placeholder="Любой напиток объёмом до 400 мл"
                className={input}
              />
            </label>
            <label className="block">
              <span className="field-label">Награда сгорает через, дней</span>
              <input
                type="number"
                min={1}
                max={365}
                value={rules.reward_expires_days ?? ""}
                onChange={(event) =>
                  setRules({
                    ...rules,
                    reward_expires_days: event.target.value ? Number(event.target.value) : null,
                  })
                }
                placeholder="без срока"
                className={input}
              />
            </label>
            <label className="block">
              <span className="field-label">Пауза между штампами, мин</span>
              <input
                type="number"
                min={0}
                max={1440}
                value={rules.stamp_cooldown_minutes}
                onChange={(event) =>
                  setRules({ ...rules, stamp_cooldown_minutes: Number(event.target.value) })
                }
                className={input}
              />
              <span className="field-hint">
                Защита от накрутки: второй штамп подряд не начислится раньше этого времени.
              </span>
            </label>
          </div>
        </section>

        {result && (
          <p className={`note ${result.ok ? "note-ok" : "note-bad"}`}>{result.message}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary btn-block"
        >
          {pending ? "Сохраняем…" : "Сохранить"}
        </button>
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <p className="eyebrow mb-3">Так карту увидит гость</p>
        <CardPreview
          brand={brand}
          name={name}
          logoUrl={logoUrl}
          stamps={rules.stamps_required}
          reward={rules.reward_title}
        />
      </aside>
    </form>
  );
}

const input = "input";
