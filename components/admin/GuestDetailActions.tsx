"use client";

import { useTransition } from "react";
import { setGuestBlocked } from "@/app/admin/actions";

export function GuestDetailActions({ customerId, blocked }: { customerId: string; blocked: boolean }) {
  const [pending, startTransition] = useTransition();

  function toggle() {
    const willBlock = !blocked;
    const label = willBlock ? "Заблокировать гостя? Он не сможет получать рассылки." : "Разблокировать гостя?";
    if (!confirm(label)) return;
    startTransition(async () => {
      await setGuestBlocked(customerId, willBlock);
      location.reload();
    });
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      className={`rounded-xl border px-3 py-1.5 text-sm disabled:opacity-40 ${
        blocked ? "border-line text-ink" : "border-red-200 text-red-700"
      }`}
    >
      {blocked ? "Разблокировать" : "Заблокировать"}
    </button>
  );
}
