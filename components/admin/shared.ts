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
  "w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-xs text-white placeholder-zinc-500 outline-none focus:border-zinc-600 transition-colors";

