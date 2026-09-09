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
      className={`btn btn-sm ${blocked ? "btn-ghost" : "btn-danger"}`}
    >
      {pending ? "…" : blocked ? "Разблокировать" : "Заблокировать"}
    </button>
  );
}
