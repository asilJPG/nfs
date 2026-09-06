"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { Reward } from "@/types/db";

type Props = {
  reward: Pick<Reward, "id" | "title" | "expires_at">;
  initData: string;
  onClose: () => void;
};

type Phase =
  | { step: "idle" }
  | { step: "loading" }
  | { step: "qr"; token: string; dataUrl: string; expiresAt: number }
  | { step: "error"; message: string };

const ERRORS: Record<string, string> = {
  not_yours: "Эта награда принадлежит другому аккаунту.",
  expired: "Срок награды истёк.",
  already_redeemed: "Награда уже использована.",
  already_expired: "Срок награды истёк.",
  server: "Не получилось создать QR. Попробуйте ещё раз.",
};

/** Shows the barista a short-lived QR. Nothing is spent until they scan it. */
export function RewardSheet({ reward, initData, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>({ step: "idle" });
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (phase.step !== "qr") return;
    const tick = () => setSecondsLeft(Math.max(0, Math.round((phase.expiresAt - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  async function requestQr() {
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
      const dataUrl = await QRCode.toDataURL(payload.code, { margin: 1, width: 320 });
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");
      setPhase({
        step: "qr",
        token: payload.code,
        dataUrl,
        expiresAt: new Date(payload.expiresAt).getTime(),
      });
    } catch {
      setPhase({ step: "error", message: ERRORS.server });
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-md p-4 transition-all duration-200"
      onClick={onClose}
    >
      <div
        className="animate-rise w-full max-w-sm rounded-[28px] border border-white/10 bg-[#15161a] p-6 text-center shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/15" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Награда готова</p>
        <h2 className="mt-1.5 text-[20px] font-extrabold tracking-tight text-white">{reward.title}</h2>

        {phase.step === "qr" ? (
          <>
            <p className="mt-3 text-[12px] text-neutral-400">Покажите этот QR бариста у кассы</p>
            <div className="mx-auto my-5 w-full max-w-[220px] rounded-[18px] bg-white p-4">
              <img src={phase.dataUrl} alt="QR" className="w-full rounded-lg" />
            </div>
            <p className="inline-block rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] tabular-nums text-neutral-400">
              {secondsLeft > 0
                ? `Действует ещё ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`
                : "QR истёк — обновите"}
            </p>
            {secondsLeft === 0 && (
              <button
                onClick={requestQr}
                className="mt-4 w-full rounded-full bg-white py-3.5 text-[13px] font-bold text-neutral-950 transition-colors hover:bg-neutral-200"
              >
                Получить новый QR
              </button>
            )}
          </>
        ) : (
          <>
            <p className="mt-2 text-[12px] leading-relaxed text-neutral-400">
              Нажмите у кассы. QR действует 5 минут, ваша награда сохранится при закрытии.
            </p>
            {phase.step === "error" && (
              <p className="mt-3 rounded-[14px] border border-red-400/25 bg-red-400/10 px-3 py-2 text-[12px] text-red-300">
                {phase.message}
              </p>
            )}
            <button
              onClick={requestQr}
              disabled={phase.step === "loading"}
              className="mt-6 w-full rounded-full bg-white py-3.5 text-[13px] font-bold text-neutral-950 transition-colors hover:bg-neutral-200 disabled:opacity-50"
            >
              {phase.step === "loading" ? "Готовим QR…" : "Показать QR бариста"}
            </button>
          </>
        )}

        <button
          onClick={onClose}
          className="mt-2.5 w-full rounded-full py-2.5 text-[13px] font-medium text-neutral-500 transition-colors hover:text-neutral-300"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}


