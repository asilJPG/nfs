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
        <section className="rounded-2xl border border-line bg-white p-4">
          <h2 className="mb-4 font-medium">Кофейня</h2>

          <label className="mb-4 block">
            <span className="mb-1 block text-sm text-ink-soft">Название</span>
            <input value={name} onChange={(event) => setName(event.target.value)} className={input} />
          </label>

          <div className="flex items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="size-14 rounded-2xl border border-line object-cover" />
            ) : (
              <div className="grid size-14 place-items-center rounded-2xl border border-dashed border-line text-ink-soft">
                —
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
                className="rounded-xl border border-line px-3 py-2 text-sm disabled:opacity-60"
              >
                {uploading ? "Загружаем…" : "Загрузить логотип"}
              </button>
              {logoUrl && (
                <button
                  type="button"
                  onClick={() => setLogoUrl(null)}
                  className="rounded-xl px-3 py-2 text-sm text-ink-soft"
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

        <section className="rounded-2xl border border-line bg-white p-4">
          <h2 className="mb-4 font-medium">Оформление</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {COLORS.map((field) => (
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
                key={style}
                type="button"
                onClick={() => setBrand({ ...brand, card_style: style })}
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  brand.card_style === style ? "border-bean bg-bean/10" : "border-line"
                }`}
              >
                {STYLE_LABELS[style]}
              </button>
            ))}
          </div>
          {warning && <p className="mt-3 text-sm text-amber-700">{warning}</p>}
        </section>

        <section className="rounded-2xl border border-line bg-white p-4">
          <h2 className="mb-4 font-medium">Условия карты</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm text-ink-soft">Штампов до награды</span>
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
              <span className="mb-1 block text-sm text-ink-soft">Награда</span>
              <input
                value={rules.reward_title}
                onChange={(event) => setRules({ ...rules, reward_title: event.target.value })}
                maxLength={60}
                className={input}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-sm text-ink-soft">Пояснение к награде</span>
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
              <span className="mb-1 block text-sm text-ink-soft">Награда сгорает через, дней</span>
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
              <span className="mb-1 block text-sm text-ink-soft">Пауза между штампами, мин</span>
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
              <span className="mt-1 block text-xs text-ink-soft">
                Защита от накрутки: второй штамп подряд не начислится раньше этого времени.
              </span>
            </label>
          </div>
        </section>

        {result && (
          <p className={`text-sm ${result.ok ? "text-bean-dark" : "text-red-600"}`}>{result.message}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-2xl bg-bean py-3.5 font-medium text-white disabled:opacity-50"
        >
          {pending ? "Сохраняем…" : "Сохранить"}
        </button>
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <p className="mb-2 text-sm text-ink-soft">Так карту увидит гость</p>
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

const input = "w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none focus:border-bean";
