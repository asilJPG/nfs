"use client";

import { useEffect, useState } from "react";
import type { Reward } from "@/types/db";

type Props = {
  reward: Pick<Reward, "id" | "title" | "expires_at">;
  initData: string;
  onClose: () => void;
};

type Phase =
  | { step: "idle" }
  | { step: "loading" }
  | { step: "code"; value: string; expiresAt: number }
  | { step: "error"; message: string };

const ERRORS: Record<string, string> = {
  not_yours: "Эта награда принадлежит другому аккаунту.",
  expired: "Срок награды истёк.",
  already_redeemed: "Награда уже использована.",
  already_expired: "Срок награды истёк.",
  server: "Не получилось получить код. Попробуйте ещё раз.",
};

/** Shows the barista a short-lived code. Nothing is spent until they type it in. */
export function RewardSheet({ reward, initData, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>({ step: "idle" });
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (phase.step !== "code") return;
    const tick = () => setSecondsLeft(Math.max(0, Math.round((phase.expiresAt - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  async function requestCode() {
    setPhase({ step: "loading" });
    try {
      const response = await fetch("/api/miniapp/redeem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initData, rewardId: reward.id }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setPhase({ step: "error", message: ERRORS[payload.error] ?? ERRORS.server });
        return;
      }
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");
      setPhase({ step: "code", value: payload.code, expiresAt: new Date(payload.expiresAt).getTime() });
    } catch {
      setPhase({ step: "error", message: ERRORS.server });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3" onClick={onClose}>
      <div
        className="animate-rise w-full max-w-sm rounded-3xl p-6 text-center shadow-2xl"
        style={{ background: "var(--brand-surface)", color: "var(--brand-text)" }}
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-sm opacity-60">Награда готова</p>
        <h2 className="mt-1 text-xl font-semibold">{reward.title}</h2>

        {phase.step === "code" ? (
          <>
            <p className="mt-5 text-sm opacity-70">Назовите этот код бариста</p>
            <p
              className="my-3 font-mono text-6xl font-bold tracking-[0.2em]"
              style={{ color: "var(--brand-primary)" }}
            >
              {phase.value}
            </p>
            <p className="text-sm opacity-60">
              {secondsLeft > 0
                ? `Действует ещё ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`
                : "Код истёк — запросите новый"}
            </p>
            {secondsLeft === 0 && (
              <button
                onClick={requestCode}
                className="mt-4 w-full rounded-2xl py-3 font-medium"
                style={{ background: "var(--brand-primary)", color: "var(--brand-surface)" }}
              >
                Новый код
              </button>
            )}
          </>
        ) : (
          <>
            <p className="mt-4 text-sm opacity-70">
              Нажмите, когда будете у кассы. Код живёт 5 минут, награда не сгорает.
            </p>
            {phase.step === "error" && <p className="mt-3 text-sm text-red-600">{phase.message}</p>}
            <button
              onClick={requestCode}
              disabled={phase.step === "loading"}
              className="mt-5 w-full rounded-2xl py-3 font-medium disabled:opacity-60"
              style={{ background: "var(--brand-primary)", color: "var(--brand-surface)" }}
            >
              {phase.step === "loading" ? "Получаем код…" : "Получить код"}
            </button>
          </>
        )}

        <button onClick={onClose} className="mt-3 w-full rounded-2xl py-3 text-sm opacity-60">
          Закрыть
        </button>
      </div>
    </div>
  );
}
