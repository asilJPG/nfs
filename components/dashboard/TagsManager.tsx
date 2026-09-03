"use client";

import { useState, useTransition } from "react";
import { requestKit, updateTag, type Result } from "@/app/dashboard/tags/actions";
import type { NfcTag, Venue } from "@/types/db";

type Props = {
  tags: NfcTag[];
  venues: Venue[];
  hasPendingKit: boolean;
};

export function TagsManager({ tags, venues, hasPendingKit }: Props) {
  const [notice, setNotice] = useState<Result | null>(null);
  const [pending, startTransition] = useTransition();
  const [kitOpen, setKitOpen] = useState(false);
  const [kit, setKit] = useState({ contactName: "", phone: "", address: "", note: "", venueId: "" });

  function run(action: () => Promise<Result>, onSuccess?: () => void) {
    startTransition(async () => {
      const result = await action();
      setNotice(result);
      if (result.ok) onSuccess?.();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {notice && (
        <p className={`text-sm ${notice.ok ? "text-bean-dark" : "text-red-600"}`}>{notice.message}</p>
      )}

      {tags.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-6 text-center">
          <p className="font-medium">Меток пока нет</p>
          <p className="mt-1 text-sm text-ink-soft">
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
              onSave={(venueId, label, active) =>
                run(() => updateTag({ tagId: tag.id, venueId, label, active }))
              }
            />
          ))}
        </ul>
      )}

      {!hasPendingKit && (
        <section className="rounded-2xl border border-line bg-white p-4">
          {kitOpen ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                run(
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
              className="grid gap-2 sm:grid-cols-2"
            >
              <h2 className="font-medium sm:col-span-2">Заказать комплект</h2>
              <input
                value={kit.contactName}
                onChange={(event) => setKit({ ...kit, contactName: event.target.value })}
                placeholder="Контактное лицо"
                className={input}
              />
              <input
                value={kit.phone}
                onChange={(event) => setKit({ ...kit, phone: event.target.value })}
                placeholder="+998 90 123 45 67"
                className={input}
              />
              <input
                value={kit.address}
                onChange={(event) => setKit({ ...kit, address: event.target.value })}
                placeholder="Адрес доставки"
                className={`${input} sm:col-span-2`}
              />
              {venues.length > 1 && (
                <select
                  value={kit.venueId}
                  onChange={(event) => setKit({ ...kit, venueId: event.target.value })}
                  className={`${input} sm:col-span-2`}
                >
                  <option value="">Для какой точки</option>
                  {venues.map((venue) => (
                    <option key={venue.id} value={venue.id}>
                      {venue.name}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="submit"
                disabled={pending}
                className="rounded-2xl bg-bean px-5 py-3 font-medium text-white disabled:opacity-50 sm:col-span-2"
              >
                Отправить заявку
              </button>
            </form>
          ) : (
            <button onClick={() => setKitOpen(true)} className="text-sm font-medium text-bean-dark">
              Заказать комплект на прилавок →
            </button>
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
  onSave,
}: {
  tag: NfcTag;
  venues: Venue[];
  pending: boolean;
  onSave: (venueId: string | null, label: string | null, active: boolean) => void;
}) {
  const [venueId, setVenueId] = useState(tag.venue_id ?? "");
  const [label, setLabel] = useState(tag.label ?? "");
  const dirty = (tag.venue_id ?? "") !== venueId || (tag.label ?? "") !== label;

  return (
    <li className="rounded-2xl border border-line bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-sm">{tag.uid}</p>
          <p className="text-xs text-ink-soft">
            {tag.last_seen_at
              ? `Последнее касание: ${new Date(tag.last_seen_at).toLocaleString("ru-RU", { timeZone: "Asia/Tashkent" })}`
              : "Ещё не использовалась"}
            {" · "}
            {tag.last_counter} касаний
          </p>
        </div>
        <button
          onClick={() => onSave(venueId || null, label || null, !tag.active)}
          disabled={pending}
          className={`shrink-0 rounded-xl border px-3 py-1.5 text-sm ${
            tag.active ? "border-line text-ink-soft" : "border-bean text-bean-dark"
          }`}
        >
          {tag.active ? "Отключить" : "Включить"}
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <select value={venueId} onChange={(event) => setVenueId(event.target.value)} className={input}>
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
          className={input}
        />
        <button
          onClick={() => onSave(venueId || null, label || null, tag.active)}
          disabled={pending || !dirty}
          className="rounded-2xl bg-bean px-5 py-3 text-sm font-medium text-white disabled:opacity-40"
        >
          Сохранить
        </button>
      </div>
    </li>
  );
}

const input = "rounded-2xl border border-line bg-white px-4 py-3 outline-none focus:border-bean";
