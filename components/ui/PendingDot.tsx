"use client";

import { useLinkStatus } from "next/link";

/**
 * Спиннер внутри <Link>. Дашборд — force-dynamic, поэтому клик по пункту меню
 * всегда ждёт сервер: без индикатора кажется, что кнопка «не сработала».
 * useLinkStatus (Next 15.3+) включается ровно на время навигации.
 */
export function PendingDot({ className = "" }: { className?: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      aria-label="Загрузка"
      className={`inline-block size-3 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70 ${className}`}
    />
  );
}
