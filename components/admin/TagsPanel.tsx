"use client";

import { useState } from "react";
import { deleteTag, registerTag } from "@/app/admin/actions";
import { useAdminAction } from "@/components/admin/shared";
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
        <p className={`note ${notice.ok ? "note-ok" : "note-bad"}`}>{notice.message}</p>
      )}

      <section className="card p-5 md:p-6">
        <h2 className="card-title mb-1">Регистрация метки</h2>
        <p className="mb-4 text-[13px] leading-relaxed text-ink-soft">
          Сначала прошейте чип ключами из{" "}
          <code className="rounded bg-surface-2 px-1">npm run mock-tag -- --uid … --keys</code>, потом
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
            className="input font-mono"
          />
          <select value={tagTenant} onChange={(event) => setTagTenant(event.target.value)} className="input">
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
            className="input"
          />
          <button
            type="submit"
            disabled={pending || uid.length !== 14}
            className="btn btn-accent"
          >
            Завести
          </button>
        </form>
      </section>

      <section className="card p-5 md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="card-title">Все метки ({visible.length})</h2>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по UID, подписи, кофейне…"
            className="input max-w-xs"
          />
        </div>
        {visible.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-soft">
            {q ? "Ничего не нашлось." : "Меток пока нет — заведите первую выше."}
          </p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {visible.map((tag) => (
              <li
                key={tag.uid}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface-2 px-3.5 py-2.5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-ink">{tag.uid}</span>
                  {tag.label && <span className="text-xs text-ink-soft">· {tag.label}</span>}
                  {tag.tenant_name ? (
                    <span className="badge badge-accent">{tag.tenant_name}</span>
                  ) : (
                    <span className="badge badge-muted">не привязана</span>
                  )}
                </div>
                <button
                  onClick={() => {
                    if (confirm(`Удалить метку ${tag.uid}?`)) run(() => deleteTag(tag.uid));
                  }}
                  disabled={pending}
                  className="btn btn-danger btn-sm"
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
