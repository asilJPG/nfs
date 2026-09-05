"use client";

import { useState } from "react";
import { deleteTag, registerTag } from "@/app/admin/actions";
import { input, useAdminAction } from "@/components/admin/shared";
import type { Tag } from "@/components/admin/AdminConsole";
import type { TenantSummary } from "@/types/db";

type Props = { tenants: TenantSummary[]; tags: Tag[] };

export function TagsPanel({ tenants, tags }: Props) {
  const { notice, pending, run } = useAdminAction();
  const [uid, setUid] = useState("");
  const [tagTenant, setTagTenant] = useState("");
  const [tagLabel, setTagLabel] = useState("");
  const [q, setQ] = useState("");

  const visible = q
    ? tags.filter(
        (t) =>
          t.uid.toLowerCase().includes(q.toLowerCase()) ||
          (t.label ?? "").toLowerCase().includes(q.toLowerCase()) ||
          (t.tenant_name ?? "").toLowerCase().includes(q.toLowerCase()),
      )
    : tags;

  return (
    <div className="flex flex-col gap-4">
      {notice && (
        <p className={`text-sm ${notice.ok ? "text-bean-dark" : "text-red-600"}`}>{notice.message}</p>
      )}

      <section className="rounded-2xl border border-line bg-white p-4">
        <h2 className="mb-1 font-medium">Регистрация метки</h2>
        <p className="mb-3 text-sm text-ink-soft">
          Сначала прошейте чип ключами из{" "}
          <code className="rounded bg-cream px-1">npm run mock-tag -- --uid … --keys</code>, потом
          заведите UID здесь.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            run(
              () => registerTag({ uid, tenantId: tagTenant || null, label: tagLabel || undefined }),
              () => {
                setUid("");
                setTagLabel("");
              },
            );
          }}
          className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]"
        >
          <input
            value={uid}
            onChange={(event) => setUid(event.target.value.toUpperCase().slice(0, 14))}
            placeholder="04A1B2C3D4E580"
            className={`${input} font-mono`}
          />
          <select value={tagTenant} onChange={(event) => setTagTenant(event.target.value)} className={input}>
            <option value="">Без кофейни</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
          <input
            value={tagLabel}
            onChange={(event) => setTagLabel(event.target.value)}
            placeholder="Подпись"
            className={input}
          />
          <button
            type="submit"
            disabled={pending || uid.length !== 14}
            className="rounded-2xl bg-bean px-5 py-3 font-medium text-white disabled:opacity-50"
          >
            Завести
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-line bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">Все метки ({visible.length})</h2>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по UID, подписи, кофейне…"
            className={`${input} max-w-xs`}
          />
        </div>
        {visible.length === 0 ? (
          <p className="text-sm text-ink-soft">Ничего не нашлось.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {visible.map((tag) => (
              <li
                key={tag.uid}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-3 py-2"
              >
                <div>
                  <span className="font-mono text-xs">{tag.uid}</span>
                  {tag.label && <span className="ml-2 text-ink-soft">· {tag.label}</span>}
                  <span className="ml-2 text-ink-soft">
                    {tag.tenant_name ? `→ ${tag.tenant_name}` : "не привязана"}
                  </span>
                </div>
                <button
                  onClick={() => {
                    if (confirm(`Удалить метку ${tag.uid}?`)) run(() => deleteTag(tag.uid));
                  }}
                  disabled={pending}
                  className="rounded-lg border border-line px-2 py-1 text-xs text-red-700 disabled:opacity-40"
                >
                  Удалить
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
