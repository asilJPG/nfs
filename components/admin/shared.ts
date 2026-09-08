"use client";

import { useState, useTransition } from "react";
import type { Result } from "@/app/admin/actions";

export function useAdminAction() {
  const [notice, setNotice] = useState<Result | null>(null);
  const [pending, startTransition] = useTransition();
  function run(action: () => Promise<Result>, onSuccess?: () => void) {
    startTransition(async () => {
      const result = await action();
      setNotice(result);
      if (result.ok) onSuccess?.();
    });
  }
  return { notice, pending, run };
}

export const input =
  "w-full rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint hover:border-line-strong focus:border-bean";

