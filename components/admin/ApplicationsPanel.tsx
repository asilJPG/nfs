"use client";

import { useState } from "react";
import { ApplicationRow, type Application } from "@/components/admin/AdminConsole";
import { useAdminAction } from "@/components/admin/shared";

type Props = { applications: Application[] };

export function ApplicationsPanel({ applications }: Props) {
  const { notice, pending, run } = useAdminAction();
  const [filter, setFilter] = useState<"open" | "all">("open");

  const visible = applications.filter((a) =>
    filter === "open" ? a.status === "new" || a.status === "contacted" : true,
  );

  return (
    <div className="flex flex-col gap-4">
      {notice && (
        <p className={`text-sm ${notice.ok ? "text-bean-dark" : "text-red-600"}`}>{notice.message}</p>
      )}

      <section className="rounded-2xl border border-line bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">Заявки ({visible.length})</h2>
          <div className="flex gap-1 rounded-xl bg-line/60 p-1 text-xs">
            {(["open", "all"] as const).map((option) => (
              <button
                key={option}
                onClick={() => setFilter(option)}
                className={`rounded-lg px-3 py-1.5 ${
                  filter === option ? "bg-white shadow-sm" : "text-ink-soft"
                }`}
              >
                {option === "open" ? "Активные" : "Все"}
              </button>
            ))}
          </div>
        </div>
        {visible.length === 0 ? (
          <p className="text-sm text-ink-soft">Заявок нет.</p>
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
