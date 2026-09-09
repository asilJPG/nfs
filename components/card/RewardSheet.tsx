"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { Reward } from "@/types/db";

type Props = {
  reward: Pick<Reward, "id" | "title" | "expires_at">;
  venueName?: string;
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

export function RewardSheet({ reward, venueName, initData, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>({ step: "idle" });
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    // Auto-request QR on open
    void requestQr();
  }, []);

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
      const dataUrl = await QRCode.toDataURL(payload.code, {
        margin: 1,
        width: 320,
        color: {
          dark: "#0E0F11",
          light: "#FAFAF9",
        },
      });
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 transition-all duration-200"
      onClick={onClose}
    >
      <div
        className="animate-rise w-full max-w-sm rounded-[32px] border border-white/10 bg-[#0E0F11] p-6 text-center shadow-[0_30px_60px_-20px_rgba(0,0,0,0.8)] relative overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#5B8DEF]/15 border border-[#5B8DEF]/25 text-[10px] font-mono text-[#7BA5FF] uppercase tracking-widest mb-3">
          <span className="size-1.5 rounded-full bg-[#5B8DEF]" />
          Награда готова
        </div>

        <h2 className="text-2xl font-bold tracking-tight text-white mb-1">{reward.title}</h2>
        <p className="text-xs text-ink-label mb-5">
          {venueName ? `Покажите баристе в ${venueName}` : "Покажите баристе у стойки"}
        </p>

        {phase.step === "loading" && (
          <div className="my-10 flex flex-col items-center justify-center gap-3">
            <div className="size-8 animate-spin rounded-full border-2 border-white/15 border-t-[#5B8DEF]" />
            <p className="text-xs text-ink-label">Генерируем персональный QR…</p>
          </div>
        )}

        {phase.step === "error" && (
          <div className="my-6">
            <p className="rounded-2xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-xs text-red-300">
              {phase.message}
            </p>
            <button
              onClick={requestQr}
              className="mt-4 w-full rounded-full bg-[#F4F4F2] py-3 text-xs font-semibold text-[#0E0F11]"
            >
              Попробовать снова
            </button>
          </div>
        )}

        {phase.step === "qr" && (
          <div>
            <div className="mx-auto my-3 size-56 rounded-[24px] bg-[#FAFAF9] p-3 shadow-[0_20px_40px_-20px_rgba(91,141,239,0.3)] relative overflow-hidden">
              <div className="qr-scan" />
              <img src={phase.dataUrl} alt="QR Code" className="w-full h-full object-contain rounded-xl" />
            </div>

            <div className="mt-4 font-mono text-xs tracking-[0.2em] text-ink-label">
              {phase.token.toUpperCase().slice(0, 16).replace(/(.{4})/g, "$1 ")}
            </div>

            <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-ink-label">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              {secondsLeft > 0
                ? `Действует ещё ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`
                : "Срок истёк — нажмите для обновления"}
            </div>

            {secondsLeft === 0 && (
              <button
                onClick={requestQr}
                className="mt-4 w-full rounded-full bg-[#F4F4F2] py-3 text-xs font-semibold text-[#0E0F11]"
              >
                Обновить QR
              </button>
            )}
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-5 w-full rounded-full py-2.5 text-xs font-medium text-ink-label hover:text-white transition-colors"
        >
          Закрыть
        </button>
      </div>
    </div>
  );
}
