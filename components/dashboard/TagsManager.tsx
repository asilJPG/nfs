"use client";

import { useState, useTransition } from "react";
import { requestKit, updateTag, type Result } from "@/app/dashboard/tags/actions";
import type { NfcTag, Venue } from "@/types/db";

type Props = {
  tags: NfcTag[];
  venues: Venue[];
  hasPendingKit: boolean;
};

const dateTime = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Asia/Tashkent",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function TagsManager({ tags, venues, hasPendingKit }: Props) {
  const [notice, setNotice] = useState<Result | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [kitOpen, setKitOpen] = useState(false);
  const [kit, setKit] = useState({ contactName: "", phone: "", address: "", note: "", venueId: "" });

  // key — чтобы «…» горело на нажатой кнопке, а не на всех сразу
  function run(key: string, action: () => Promise<Result>, onSuccess?: () => void) {
    setBusy(key);
    startTransition(async () => {
      try {
        const result = await action();
        setNotice(result);
        if (result.ok) onSuccess?.();
      } finally {
        setBusy(null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {notice && <p className={`note ${notice.ok ? "note-ok" : "note-bad"}`}>{notice.message}</p>}

      {tags.length === 0 ? (
        <div className="empty">
          <p className="card-title">Меток пока нет</p>
          <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-ink-soft">
            {hasPendingKit
              ? "Заявка на комплект принята — метки появятся здесь, когда мы их привяжем."
              : "Закажите комплект на прилавок: подставка с NFC и табличка с QR."}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {tags.map((tag) => (
            <TagRow
              key={tag.id}
              tag={tag}
              venues={venues}
              pending={pending}
              busy={busy}
              onSave={(key, venueId, label, active) =>
                run(key, () => updateTag({ tagId: tag.id, venueId, label, active }))
              }
            />
          ))}
        </ul>
      )}

      {!hasPendingKit && (
        <section className="card p-5">
          {kitOpen ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                run(
                  "kit",
                  () =>
                    requestKit({
                      contactName: kit.contactName,
                      phone: kit.phone,
                      address: kit.address,
                      note: kit.note || undefined,
                      venueId: kit.venueId || null,
                    }),
                  () => setKitOpen(false),
                );
              }}
              className="grid gap-3 sm:grid-cols-2"
            >
              <div className="sm:col-span-2">
                <h2 className="card-title">Заказать комплект</h2>
                <p className="mt-0.5 text-xs text-ink-soft">
                  Подставка с NFC и табличка с QR — привезём и привяжем к вашей кофейне.
                </p>
              </div>
              <input
                value={kit.contactName}
                onChange={(event) => setKit({ ...kit, contactName: event.target.value })}
                placeholder="Контактное лицо"
                className="input"
              />
              <input
                value={kit.phone}
                onChange={(event) => setKit({ ...kit, phone: event.target.value })}
                placeholder="+998 90 123 45 67"
                className="input"
              />
              <input
                value={kit.address}
                onChange={(event) => setKit({ ...kit, address: event.target.value })}
                placeholder="Адрес доставки"
                className="input sm:col-span-2"
              />
              {venues.length > 1 && (
                <select
                  value={kit.venueId}
                  onChange={(event) => setKit({ ...kit, venueId: event.target.value })}
                  className="input sm:col-span-2"
                >
                  <option value="">Для какой точки</option>
                  {venues.map((venue) => (
                    <option key={venue.id} value={venue.id}>
                      {venue.name}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex gap-2 sm:col-span-2">
                <button type="submit" disabled={pending} className="btn btn-primary flex-1">
                  {busy === "kit" ? "Отправляем…" : "Отправить заявку"}
                </button>
                <button type="button" onClick={() => setKitOpen(false)} className="btn btn-ghost">
                  Отмена
                </button>
              </div>
            </form>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="card-title">Нужны ещё метки?</h2>
                <p className="mt-0.5 text-xs text-ink-soft">
                  Комплект на прилавок: подставка с NFC и табличка с QR.
                </p>
              </div>
              <button onClick={() => setKitOpen(true)} className="btn btn-ghost btn-sm">
                Заказать комплект
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function TagRow({
  tag,
  venues,
  pending,
  busy,
  onSave,
}: {
  tag: NfcTag;
  venues: Venue[];
  pending: boolean;
  busy: string | null;
  onSave: (key: string, venueId: string | null, label: string | null, active: boolean) => void;
}) {
  const [venueId, setVenueId] = useState(tag.venue_id ?? "");
  const [label, setLabel] = useState(tag.label ?? "");
  const dirty = (tag.venue_id ?? "") !== venueId || (tag.label ?? "") !== label;

  return (
    <li className="card p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate font-mono text-sm text-white">{tag.uid}</p>
            <span className={`badge ${tag.active ? "badge-ok" : "badge-muted"}`}>
              {tag.active ? "работает" : "выключена"}
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-soft">
            {tag.last_seen_at
              ? `Последнее касание: ${dateTime.format(new Date(tag.last_seen_at))}`
              : "Ещё не использовалась"}
            {" · "}
            {tag.last_counter} касаний
          </p>
        </div>
        <button
          onClick={() => onSave(`tag-active:${tag.id}`, venueId || null, label || null, !tag.active)}
          disabled={pending}
          className="btn btn-ghost btn-sm shrink-0"
        >
          {busy === `tag-active:${tag.id}` ? "…" : tag.active ? "Отключить" : "Включить"}
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <select value={venueId} onChange={(event) => setVenueId(event.target.value)} className="input">
          <option value="">Точка не выбрана</option>
          {venues.map((venue) => (
            <option key={venue.id} value={venue.id}>
              {venue.name}
            </option>
          ))}
        </select>
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Подпись, напр. «у кассы»"
          className="input"
        />
        <button
          onClick={() => onSave(`tag-save:${tag.id}`, venueId || null, label || null, tag.active)}
          disabled={pending || !dirty}
          className="btn btn-primary"
        >
          {busy === `tag-save:${tag.id}` ? "Сохраняем…" : "Сохранить"}
        </button>
      </div>
    </li>
  );
}
