"use client";

import { useState } from "react";
import { ApplicationRow, type Application } from "@/components/admin/AdminConsole";
import { useAdminAction } from "@/components/admin/shared";

type Props = { applications: Application[] };

const FILTERS = [
  { id: "open", label: "Активные" },
  { id: "all", label: "Все" },
] as const;

export function ApplicationsPanel({ applications }: Props) {
  const { notice, pending, run } = useAdminAction();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("open");

  const visible = applications.filter((application) =>
    filter === "open"
      ? application.status === "new" || application.status === "contacted"
      : true,
  );

  return (
    <div className="flex flex-col gap-4">
      {notice && <p className={`note ${notice.ok ? "note-ok" : "note-bad"}`}>{notice.message}</p>}

      <section className="card p-5 md:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="card-title">Заявки ({visible.length})</h2>
            <p className="mt-0.5 text-xs text-ink-faint">
              Новые и те, с кем уже связались
            </p>
          </div>
          <div className="flex gap-1 rounded-xl border border-line bg-surface-2 p-1 text-xs">
            {FILTERS.map((option) => (
              <button
                key={option.id}
                onClick={() => setFilter(option.id)}
                className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
                  filter === option.id
                    ? "bg-bean text-[#0E1424]"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-soft">
            {filter === "open" ? "Все заявки обработаны." : "Заявок пока нет."}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {visible.map((application) => (
              <ApplicationRow
                key={application.id}
                application={application}
                pending={pending}
                onSave={run}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
