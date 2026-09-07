"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { StampGrid } from "./StampGrid";
import { Monogram, WalletCardRow } from "./WalletCard";

const RewardSheet = dynamic(() => import("./RewardSheet").then((m) => ({ default: m.RewardSheet })), {
  ssr: false,
});
import type { CardBadge, MiniAppState } from "@/lib/miniapp/state";
import type { Reward } from "@/types/db";

type ClaimOutcome =
  | { kind: "stamped"; stamps_count: number; stamps_required: number; reward: Reward | null }
  | { kind: "already_counted" }
  | { kind: "cooldown"; retry_after_seconds: number }
  | { kind: "error"; code: string };

type Screen =
  | { step: "loading" }
  | { step: "outside" }
  | { step: "failed"; message: string }
  | { step: "cards"; cards: CardBadge[] }
  | { step: "ready"; state: MiniAppState; claim: ClaimOutcome | null };

type Tab = "card" | "wallet" | "history" | "notifications" | "profile";

const FAILURES: Record<string, string> = {
  no_tenant: "Не удалось определить кофейню. Отсканируйте QR на стойке или приложите телефон к подставке.",
  bad_signature: "Не удалось подтвердить вход. Откройте карту заново из бота.",
  stale: "Сессия устарела. Откройте карту заново из бота.",
  server: "Сервис недоступен. Попробуйте через минуту.",
};

const CLAIM_ERRORS: Record<string, string> = {
  token_unknown: "Отметка не найдена. Приложите телефон к подставке ещё раз.",
  token_expired: "Отметка просрочена — приложите телефон к подставке ещё раз.",
  token_used: "Эта отметка уже использована.",
  tenant_inactive: "Карта этой кофейни временно неактивна.",
  no_program: "Кофейня ещё не настроила карту.",
  server: "Не удалось начислить штамп. Попробуйте ещё раз.",
};

export function CardScreen() {
  const [screen, setScreen] = useState<Screen>({ step: "loading" });
  const [activeTab, setActiveTab] = useState<Tab>("card");
  const [openReward, setOpenReward] = useState<Reward | null>(null);
  const [showStampPop, setShowStampPop] = useState<ClaimOutcome | null>(null);
  const [notifications, setNotifications] = useState([
    { id: 1, title: "Штамп добавлен", text: "Ваш штамп успешно зачислен.", time: "Сегодня", unread: true },
    { id: 2, title: "Добро пожаловать", text: "Карта лояльности подключена к вашему Telegram.", time: "Вчера", unread: false },
  ]);

  const initDataRef = useRef("");
  const bootstrapped = useRef(false);

  const load = useCallback(async (startParam?: string) => {
    try {
      const response = await fetch("/api/miniapp/state", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initData: initDataRef.current, startParam }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setScreen({ step: "failed", message: FAILURES[payload.error] ?? FAILURES.server });
        return;
      }
      if ("cards" in payload) {
        setScreen({ step: "cards", cards: payload.cards });
        setActiveTab("wallet");
        return;
      }
      applyBrand(payload.state.tenant.brand);
      setScreen({ step: "ready", state: payload.state, claim: payload.claim });
      setActiveTab("card");

      if (payload.claim?.kind === "stamped") {
        setShowStampPop(payload.claim);
        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");
      }
    } catch {
      setScreen({ step: "failed", message: FAILURES.server });
    }
  }, []);

  const loadWallet = useCallback(async () => {
    setScreen({ step: "loading" });
    try {
      const response = await fetch("/api/miniapp/state", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initData: initDataRef.current, wallet: true }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setScreen({ step: "failed", message: FAILURES[payload.error] ?? FAILURES.server });
        return;
      }
      setScreen({ step: "cards", cards: payload.cards ?? [] });
      setActiveTab("wallet");
    } catch {
      setScreen({ step: "failed", message: FAILURES.server });
    }
  }, []);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    const app = window.Telegram?.WebApp;
    if (!app?.initData) {
      if (process.env.NEXT_PUBLIC_DEV_MINIAPP === "1") {
        initDataRef.current = "dev";
        const devStart = new URLSearchParams(window.location.search).get("startapp");
        if (devStart) void load(devStart);
        else void loadWallet();
        return;
      }
      setScreen({ step: "outside" });
      return;
    }
    app.ready();
    app.expand();
    initDataRef.current = app.initData;

    const url = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const startParam =
      app.initDataUnsafe?.start_param ??
      url.get("startapp") ??
      hash.get("tgWebAppStartParam") ??
      undefined;

    if (startParam) void load(startParam);
    else void loadWallet();
  }, [load, loadWallet]);

  // Polling for live updates
  useEffect(() => {
    if (screen.step !== "ready") return;
    const currentScreen = screen;
    let cancelled = false;

    async function poll() {
      if (cancelled || document.hidden || openReward || showStampPop) return;
      try {
        const response = await fetch("/api/miniapp/state", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ initData: initDataRef.current }),
        });
        if (!response.ok) return;
        const payload = await response.json();
        if (cancelled || "cards" in payload || !payload.state) return;

        const prevStamps = currentScreen.state.card?.stamps_count ?? 0;
        const newStamps = payload.state.card?.stamps_count ?? 0;
        const prevRewards = currentScreen.state.rewards.length;
        const newRewards = payload.state.rewards.length;

        if (newStamps > prevStamps || newRewards > prevRewards) {
          window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");
          const outcome: ClaimOutcome = {
            kind: "stamped",
            stamps_count: newStamps,
            stamps_required: payload.state.program?.stamps_required ?? 6,
            reward: newRewards > prevRewards ? payload.state.rewards[newRewards - 1] : null,
          };
          setShowStampPop(outcome);
          setScreen({
            step: "ready",
            state: payload.state,
            claim: outcome,
          });
        }
      } catch {
        // silent
      }
    }

    const timer = setInterval(poll, 2500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [screen, openReward, showStampPop]);

  if (screen.step === "loading") return <Splash />;
  if (screen.step === "outside") return <OutsideNfcFlow onRetry={() => loadWallet()} />;
  if (screen.step === "failed") return <Message text={screen.message} onRetry={() => loadWallet()} />;

  const tgUser = typeof window !== "undefined" ? (window.Telegram?.WebApp?.initDataUnsafe?.user as { id?: number; first_name?: string; last_name?: string; username?: string; photo_url?: string } | undefined) : undefined;
  const userName = tgUser?.first_name || "Гость";
  const userHandle = tgUser?.username ? `@${tgUser.username}` : "Telegram";

  return (
    <div className="min-h-dvh bg-[#08090B] text-[#F4F4F2] font-sans antialiased flex flex-col justify-between selection:bg-[#5B8DEF]/30">
      {/* Safe container */}
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col p-4 pb-24">
        {/* Main Header */}
        <header className="flex items-center justify-between gap-3 py-3 border-b border-white/[0.06] mb-4">
          <div className="flex items-center gap-2.5">
            {screen.step === "ready" && (
              <button
                onClick={() => void loadWallet()}
                className="size-8 rounded-full bg-white/[0.06] border border-white/10 grid place-items-center text-xs text-[#F4F4F2]/70 hover:text-white"
              >
                ‹
              </button>
            )}
            <div>
              <h1 className="text-base font-semibold tracking-tight text-white">
                {activeTab === "card" && screen.step === "ready"
                  ? screen.state.tenant.name
                  : activeTab === "wallet"
                    ? "Ваши карты"
                    : activeTab === "history"
                      ? "История"
                      : activeTab === "notifications"
                        ? "Уведомления"
                        : "Профиль"}
              </h1>
              <p className="text-[11px] font-mono text-[#F4F4F2]/40 uppercase tracking-wider">
                {activeTab === "card" && screen.step === "ready"
                  ? "Sfumato · Ташкент"
                  : "Stampy"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("notifications")}
              className="size-8 rounded-full bg-white/[0.06] border border-white/10 grid place-items-center text-xs relative text-[#F4F4F2]/70"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
              {notifications.some((n) => n.unread) && (
                <span className="absolute top-1 right-1 size-2 rounded-full bg-[#5B8DEF]" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("profile")}
              className="size-8 rounded-full bg-gradient-to-br from-[#5B8DEF] to-[#4A7DE0] grid place-items-center text-xs font-semibold text-white shadow-sm"
            >
              {userName.slice(0, 1).toUpperCase()}
            </button>
          </div>
        </header>

        {/* TAB 1: CARD VIEW (02, 03, 05) */}
        {activeTab === "card" && screen.step === "ready" && (
          <CardView
            state={screen.state}
            onOpenReward={(reward) => setOpenReward(reward)}
            onViewHistory={() => setActiveTab("history")}
          />
        )}

        {/* TAB 2: WALLET VIEW (07) */}
        {(activeTab === "wallet" || (activeTab === "card" && screen.step === "cards")) && (
          <WalletView
            cards={screen.step === "cards" ? screen.cards : []}
            onSelectCard={(slug) => void load(`t_${slug}`)}
          />
        )}

        {/* TAB 3: HISTORY (08) */}
        {activeTab === "history" && (
          <HistoryView
            rewards={screen.step === "ready" ? screen.state.rewards : []}
            history={screen.step === "ready" ? screen.state.history : []}
          />
        )}

        {/* TAB 4: NOTIFICATIONS (10) */}
        {activeTab === "notifications" && (
          <NotificationsView
            items={notifications}
            onMarkRead={() =>
              setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })))
            }
          />
        )}

        {/* TAB 5: PROFILE (09) */}
        {activeTab === "profile" && (
          <ProfileView
            userName={userName}
            userHandle={userHandle}
            totalCards={screen.step === "cards" ? screen.cards.length : 1}
          />
        )}
      </div>

      {/* Modern Bottom Navigation Bar */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-[#0E0F11]/90 backdrop-blur-xl border-t border-white/[0.08] px-6 py-2.5 max-w-md mx-auto flex items-center justify-around">
        <button
          onClick={() => {
            if (screen.step === "ready") setActiveTab("card");
            else setActiveTab("wallet");
          }}
          className={`flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${
            activeTab === "card" || activeTab === "wallet" ? "text-[#5B8DEF]" : "text-[#F4F4F2]/45 hover:text-white"
          }`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="3" />
            <line x1="2" y1="10" x2="22" y2="10" />
          </svg>
          <span>Карта</span>
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={`flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${
            activeTab === "history" ? "text-[#5B8DEF]" : "text-[#F4F4F2]/45 hover:text-white"
          }`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          <span>История</span>
        </button>

        <button
          onClick={() => setActiveTab("notifications")}
          className={`flex flex-col items-center gap-1 text-[10px] font-medium transition-colors relative ${
            activeTab === "notifications" ? "text-[#5B8DEF]" : "text-[#F4F4F2]/45 hover:text-white"
          }`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          <span>События</span>
          {notifications.some((n) => n.unread) && (
            <span className="absolute top-0 right-3 size-1.5 rounded-full bg-[#5B8DEF]" />
          )}
        </button>

        <button
          onClick={() => setActiveTab("profile")}
          className={`flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${
            activeTab === "profile" ? "text-[#5B8DEF]" : "text-[#F4F4F2]/45 hover:text-white"
          }`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span>Профиль</span>
        </button>
      </nav>

      {/* Stamp Pop Modal (04 · Штамп добавлен) */}
      {showStampPop && (
        <StampPopModal
          claim={showStampPop}
          onClose={() => setShowStampPop(null)}
          onViewReward={() => {
            const reward = showStampPop.kind === "stamped" ? showStampPop.reward : null;
            setShowStampPop(null);
            if (reward) setOpenReward(reward);
          }}
        />
      )}

      {/* QR Reward Modal (06 · QR-код) */}
      {openReward && (
        <RewardSheet
          reward={openReward}
          venueName={screen.step === "ready" ? screen.state.tenant.name : undefined}
          initData={initDataRef.current}
          onClose={() => {
            setOpenReward(null);
            if (screen.step === "ready") void load();
          }}
        />
      )}
    </div>
  );
}

/** 02, 03, 05 · Экран карты лояльности */
function CardView({
  state,
  onOpenReward,
  onViewHistory,
}: {
  state: MiniAppState;
  onOpenReward: (reward: Reward) => void;
  onViewHistory: () => void;
}) {
  const { tenant, program, card, rewards } = state;
  const filled = card?.stamps_count ?? 0;
  const total = program?.stamps_required ?? 6;
  const remaining = Math.max(0, total - filled);
  const isRewardReady = rewards.length > 0 || remaining === 0;

  return (
    <div className="flex flex-col gap-4 animate-rise">
      {/* Loyalty Card Container */}
      <div className="rounded-[26px] bg-gradient-to-br from-[#17223B] via-[#111827] to-[#0E1424] border border-[#5B8DEF]/25 p-6 relative overflow-hidden shadow-[0_24px_50px_-20px_rgba(91,141,239,0.3)]">
        {/* Glow */}
        <div className="pointer-events-none absolute -top-20 -right-20 size-48 rounded-full bg-[radial-gradient(circle,_rgba(91,141,239,0.22),_transparent_65%)]" />

        <div className="flex justify-between items-start mb-6 relative">
          <div>
            <div className="font-mono text-[10px] text-[#7BA5FF] uppercase tracking-widest mb-1.5 font-medium">
              {tenant.name} · Ташкент
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white leading-snug">
              {program?.reward_title || "7-й напиток за счёт заведения"}
            </h2>
          </div>
          <Monogram name={tenant.name} logoUrl={tenant.logo_url} ink="#5B8DEF" size={36} />
        </div>

        {/* Stamp Grid */}
        <div className="mb-6 relative">
          <StampGrid filled={filled} total={total} style={tenant.brand.card_style} />
        </div>

        {/* Progress Footer */}
        <div className="flex items-end justify-between pt-4 border-t border-white/[0.08] relative">
          <div>
            <div className="text-2xl font-bold tracking-tight text-white">
              {filled}
              <span className="text-sm text-[#F4F4F2]/40 font-normal"> / {total}</span>
            </div>
            <div className="text-[11px] text-[#F4F4F2]/50 mt-0.5">
              {isRewardReady
                ? "награда готова к получению"
                : remaining === 1
                  ? "почти на месте"
                  : filled > 0
                    ? "в процессе накопления"
                    : "начало пути"}
            </div>
          </div>

          <div className="text-right">
            {isRewardReady ? (
              <span className="px-3 py-1 rounded-full bg-[#5B8DEF] text-[#0E1424] text-[10px] font-bold uppercase tracking-wider">
                Готова
              </span>
            ) : (
              <div>
                <div className="text-xs font-semibold text-[#7BA5FF]">осталось {remaining}</div>
                <div className="text-[10px] text-[#F4F4F2]/40 mt-0.5">до бесплатного напитка</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action banner if reward ready */}
      {rewards.length > 0 && (
        <div className="flex flex-col gap-2">
          {rewards.map((reward) => (
            <button
              key={reward.id}
              onClick={() => onOpenReward(reward as Reward)}
              className="flex items-center justify-between gap-3 p-4 rounded-[20px] bg-gradient-to-r from-[#5B8DEF]/20 to-[#5B8DEF]/10 border border-[#5B8DEF]/35 text-left transition-transform active:scale-[0.99] shadow-lg"
            >
              <div className="min-w-0">
                <span className="block truncate text-sm font-bold text-white">
                  {reward.title}
                </span>
                <span className="block text-[11px] text-[#7BA5FF]">
                  Нажмите, чтобы показать QR баристе
                </span>
              </div>
              <span className="shrink-0 px-3.5 py-1.5 rounded-full bg-[#5B8DEF] text-[#0E1424] text-xs font-bold uppercase tracking-wider">
                Забрать
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Near reward hint banner */}
      {!isRewardReady && remaining <= 2 && (
        <div className="p-4 rounded-[18px] bg-[#5B8DEF]/10 border border-[#5B8DEF]/20 flex items-start gap-3">
          <div className="size-7 rounded-lg bg-[#5B8DEF]/20 grid place-items-center text-[#5B8DEF] shrink-0 mt-0.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v6l3-3M12 8l-3-3"/><circle cx="12" cy="14" r="8"/></svg>
          </div>
          <div>
            <div className="text-xs font-semibold text-white">Загляните в {tenant.name} сегодня</div>
            <div className="text-[11px] text-[#F4F4F2]/60 mt-0.5 leading-relaxed">
              Ещё {remaining} {remaining === 1 ? "чашка" : "чашки"} — и награда за счёт заведения.
            </div>
          </div>
        </div>
      )}

      {/* Venue card */}
      <div className="p-3.5 rounded-[18px] bg-[#14161D] border border-white/[0.06] flex items-center gap-3">
        <div className="size-10 rounded-xl bg-gradient-to-br from-[#2B3140] to-[#1B1E27] grid place-items-center font-mono text-xs font-bold text-[#7BA5FF]">
          {tenant.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-white truncate">{tenant.name}</div>
          <div className="text-[11px] text-[#F4F4F2]/45 truncate mt-0.5">ул. Амира Темура, 12 · Ташкент</div>
        </div>
      </div>

      {/* Activity Section */}
      <div className="p-4 rounded-[20px] bg-[#14161D] border border-white/[0.06]">
        <div className="flex justify-between items-center mb-3">
          <div className="font-mono text-[10px] text-[#F4F4F2]/45 uppercase tracking-widest font-semibold">
            Активность
          </div>
          <button onClick={onViewHistory} className="text-[11px] text-[#5B8DEF] hover:underline">
            Вся история
          </button>
        </div>
        <div className="flex flex-col gap-2.5 text-xs">
          <div className="flex justify-between items-center py-1">
            <div className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-[#5B8DEF]" />
              <span>Штамп добавлен</span>
            </div>
            <span className="text-[11px] text-[#F4F4F2]/45 font-mono">Сегодня</span>
          </div>
          <div className="flex justify-between items-center py-1 border-t border-white/[0.04]">
            <div className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-white/30" />
              <span>Штамп добавлен</span>
            </div>
            <span className="text-[11px] text-[#F4F4F2]/45 font-mono">Вчера</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 04 · Штамп добавлен (Pop-up modal) */
function StampPopModal({
  claim,
  onClose,
  onViewReward,
}: {
  claim: ClaimOutcome;
  onClose: () => void;
  onViewReward: () => void;
}) {
  const count = claim.kind === "stamped" ? claim.stamps_count : 1;
  const total = claim.kind === "stamped" ? claim.stamps_required : 6;
  const hasReward = claim.kind === "stamped" && claim.reward;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="animate-rise w-full max-w-sm rounded-[28px] border border-white/10 bg-[#14161D]/90 backdrop-blur-2xl p-6 text-center shadow-2xl relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 size-16 rounded-full bg-gradient-to-br from-[#6B9BFF] to-[#4A7DE0] grid place-items-center shadow-[0_12px_30px_rgba(91,141,239,0.5)]">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F4F4F2" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>

        <h2 className="text-xl font-bold tracking-tight text-white mb-2">Штамп добавлен</h2>
        <p className="text-xs text-[#F4F4F2]/65 leading-relaxed mb-6">
          {hasReward
            ? "Поздравляем! Ваша награда готова к получению."
            : `${count} из ${total} — ещё ${Math.max(0, total - count)}, и напиток за счёт заведения.`}
        </p>

        <div className="flex gap-2.5">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-white/[0.06] border border-white/10 text-xs font-semibold text-white"
          >
            Карта
          </button>
          <button
            onClick={hasReward ? onViewReward : onClose}
            className="flex-1 py-3 rounded-xl bg-[#F4F4F2] text-xs font-bold text-[#0E0F11]"
          >
            {hasReward ? "Показать QR" : "Готово"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 07 · Кошелёк (Wallet view with fanned/stacked cards) */
function WalletView({
  cards,
  onSelectCard,
}: {
  cards: CardBadge[];
  onSelectCard: (slug: string) => void;
}) {
  if (cards.length === 0) {
    return (
      <div className="text-center py-16 px-4">
        <div className="size-16 rounded-3xl bg-white/[0.04] border border-white/10 grid place-items-center mx-auto mb-4 text-2xl">
          ☕
        </div>
        <h2 className="text-lg font-bold text-white mb-2">Пока нет ни одной карты</h2>
        <p className="text-xs text-[#F4F4F2]/50 max-w-xs mx-auto leading-relaxed">
          Приложите телефон к NFC-стенду на стойке любой кофейни Stampy, чтобы добавить карту.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 animate-rise">
      <div className="flex justify-between items-baseline mb-1">
        <div className="text-xs text-[#F4F4F2]/50 font-medium">
          {cards.length} {cards.length === 1 ? "кофейня" : "кофейни"}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {cards.map((card) => (
          <WalletCardRow
            key={card.slug}
            card={{
              slug: card.slug,
              name: card.name,
              subtitle: "Карта лояльности",
              logo_url: card.logo_url,
              brand: card.brand,
              stamps_count: card.stamps_count,
              stamps_required: card.stamps_required,
              is_ready: card.stamps_count >= (card.stamps_required ?? 6),
            }}
            onClick={() => onSelectCard(card.slug)}
          />
        ))}
      </div>
    </div>
  );
}

/** 08 · История наград (History view) */
function HistoryView({
  rewards,
  history,
}: {
  rewards: MiniAppState["rewards"];
  history: MiniAppState["history"];
}) {
  return (
    <div className="flex flex-col gap-4 animate-rise">
      {/* Stat Card */}
      <div className="p-6 rounded-[24px] bg-[#FAFAF9] text-[#0E0F11] border border-black/[0.06] shadow-sm">
        <div className="text-[11px] font-mono uppercase tracking-widest text-[#0E0F11]/50 font-semibold mb-1">
          История
        </div>
        <div className="flex items-baseline gap-2 mb-2">
          <div className="text-4xl font-extrabold tracking-tight">148</div>
          <div className="text-xs text-[#0E0F11]/60">чашек всего</div>
        </div>

        {/* Sparkline */}
        <svg viewBox="0 0 300 40" width="100%" height="40" className="mt-3 overflow-visible">
          <defs>
            <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#5B8DEF" stopOpacity="0.25" />
              <stop offset="1" stopColor="#5B8DEF" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polyline points="0,32 25,28 50,30 75,22 100,24 125,16 150,18 175,10 200,14 225,8 250,12 275,6 300,4" fill="none" stroke="#5B8DEF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          <polyline points="0,32 25,28 50,30 75,22 100,24 125,16 150,18 175,10 200,14 225,8 250,12 275,6 300,4 300,40 0,40" fill="url(#histGrad)"/>
        </svg>
      </div>

      {/* Rewards history items */}
      <div className="flex flex-col gap-2">
        <div className="font-mono text-[10px] text-[#F4F4F2]/45 uppercase tracking-widest font-semibold px-1">
          Последние награды
        </div>
        <div className="p-4 rounded-[18px] bg-[#14161D] border border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-[#5B8DEF]/15 text-[#5B8DEF] grid place-items-center">
              ★
            </div>
            <div>
              <div className="text-xs font-semibold text-white">Капучино в подарок</div>
              <div className="text-[11px] text-[#F4F4F2]/45 mt-0.5">Sfumato · 2 сен</div>
            </div>
          </div>
          <span className="font-mono text-xs text-[#7BA5FF]">−0 сум</span>
        </div>
        <div className="p-4 rounded-[18px] bg-[#14161D] border border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-[#5B8DEF]/15 text-[#5B8DEF] grid place-items-center">
              ★
            </div>
            <div>
              <div className="text-xs font-semibold text-white">Раф в подарок</div>
              <div className="text-[11px] text-[#F4F4F2]/45 mt-0.5">Chinor · 24 авг</div>
            </div>
          </div>
          <span className="font-mono text-xs text-[#7BA5FF]">−0 сум</span>
        </div>
      </div>
    </div>
  );
}

/** 09 · Профиль и настройки (Profile view) */
function ProfileView({
  userName,
  userHandle,
  totalCards,
}: {
  userName: string;
  userHandle: string;
  totalCards: number;
}) {
  return (
    <div className="flex flex-col gap-4 animate-rise">
      {/* Profile Card */}
      <div className="p-6 rounded-[24px] bg-[#14161D] border border-white/[0.06] flex items-center gap-4">
        <div className="size-14 rounded-2xl bg-gradient-to-br from-[#5B8DEF] to-[#4A7DE0] grid place-items-center text-xl font-bold text-white shadow-lg">
          {userName.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">{userName}</h2>
          <p className="text-xs text-[#F4F4F2]/50 font-mono mt-0.5">{userHandle} · с 2025</p>
        </div>
      </div>

      {/* 3 Metrics */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="p-4 rounded-[18px] bg-[#14161D] border border-white/[0.06] text-center">
          <div className="text-xl font-bold text-white">148</div>
          <div className="text-[10px] text-[#F4F4F2]/50 mt-1">чашек</div>
        </div>
        <div className="p-4 rounded-[18px] bg-[#14161D] border border-white/[0.06] text-center">
          <div className="text-xl font-bold text-white">12</div>
          <div className="text-[10px] text-[#F4F4F2]/50 mt-1">наград</div>
        </div>
        <div className="p-4 rounded-[18px] bg-[#14161D] border border-white/[0.06] text-center">
          <div className="text-xl font-bold text-white">{totalCards}</div>
          <div className="text-[10px] text-[#F4F4F2]/50 mt-1">кофеен</div>
        </div>
      </div>

      {/* Settings list */}
      <div className="rounded-[22px] bg-[#14161D] border border-white/[0.06] overflow-hidden text-xs">
        <div className="p-4 flex items-center justify-between border-b border-white/[0.04]">
          <div className="flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
            <span>Уведомления</span>
          </div>
          <div className="w-10 h-6 rounded-full bg-[#5B8DEF] relative">
            <div className="absolute top-1 right-1 size-4 rounded-full bg-white shadow-sm" />
          </div>
        </div>

        <div className="p-4 flex items-center justify-between border-b border-white/[0.04]">
          <div className="flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></svg>
            <span>Язык</span>
          </div>
          <span className="text-[#F4F4F2]/50 font-mono">Русский</span>
        </div>

        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
            <span>Помощь и поддержка</span>
          </div>
          <a href="https://t.me/stampy_support" target="_blank" rel="noreferrer" className="text-[#5B8DEF]">
            @stampy_support
          </a>
        </div>
      </div>
    </div>
  );
}

/** 10 · Уведомления (Notifications view) */
function NotificationsView({
  items,
  onMarkRead,
}: {
  items: { id: number; title: string; text: string; time: string; unread: boolean }[];
  onMarkRead: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 animate-rise">
      <div className="flex justify-between items-center px-1 mb-1">
        <div className="text-xs text-[#F4F4F2]/50 font-medium">{items.length} уведомления</div>
        <button onClick={onMarkRead} className="text-[11px] text-[#5B8DEF] hover:underline">
          Прочитать все
        </button>
      </div>

      <div className="flex flex-col gap-2.5">
        {items.map((item) => (
          <div
            key={item.id}
            className={`p-4 rounded-[18px] border flex gap-3.5 items-start ${
              item.unread
                ? "bg-[#14161D] border-[#5B8DEF]/30"
                : "bg-[#14161D]/60 border-white/[0.04] opacity-80"
            }`}
          >
            <div className="size-8 rounded-xl bg-[#5B8DEF]/15 text-[#5B8DEF] grid place-items-center shrink-0 mt-0.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline mb-0.5">
                <span className="text-xs font-semibold text-white">{item.title}</span>
                <span className="text-[10px] text-[#F4F4F2]/45 font-mono">{item.time}</span>
              </div>
              <p className="text-[11px] text-[#F4F4F2]/60 leading-relaxed">{item.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 01 · Касание (NFC tap screen outside/intro) */
function OutsideNfcFlow({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="min-h-dvh bg-[#08090B] text-[#F4F4F2] p-6 flex flex-col justify-between items-center text-center">
      <div className="pt-6 font-mono text-[11px] uppercase tracking-widest text-[#F4F4F2]/40">
        Stampy · NFC
      </div>

      <div className="flex flex-col items-center max-w-xs">
        <div className="relative size-48 mb-8">
          <div className="nfc-pulse absolute inset-0 rounded-full border border-[#5B8DEF]/20" />
          <div className="nfc-pulse absolute inset-6 rounded-full border border-[#5B8DEF]/30" style={{ animationDelay: "0.4s" }} />
          <div className="nfc-pulse absolute inset-12 rounded-full border border-[#5B8DEF]/40" style={{ animationDelay: "0.8s" }} />
          <div className="absolute inset-16 rounded-full bg-gradient-to-br from-[#6B9BFF] to-[#4A7DE0] grid place-items-center shadow-[0_16px_40px_-8px_rgba(91,141,239,0.5)]">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F4F4F2" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 8.05a10 10 0 0 1 15.9 0" />
              <path d="M7 11.5a6 6 0 0 1 10 0" />
              <path d="M10 14.5a2 2 0 0 1 4 0" />
            </svg>
          </div>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-white mb-3">Поднесите к стенду</h1>
        <p className="text-xs text-[#F4F4F2]/60 leading-relaxed">
          Приложите телефон к метке Stampy на стойке кофейни, чтобы открыть карту в Telegram.
        </p>

        <button
          onClick={onRetry}
          className="mt-8 px-6 py-3 rounded-full bg-[#F4F4F2] text-xs font-bold text-[#0E0F11] hover:bg-white"
        >
          Открыть мои карты
        </button>
      </div>

      <div className="pb-4 text-[10px] font-mono text-[#F4F4F2]/30 uppercase tracking-widest">
        Ташкент · 2026
      </div>
    </main>
  );
}

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center bg-[#08090B]">
      <div className="size-8 animate-spin rounded-full border-2 border-white/15 border-t-[#5B8DEF]" />
    </div>
  );
}

function Message({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div className="grid min-h-dvh place-items-center px-6 text-center bg-[#08090B]">
      <div className="max-w-xs">
        <p className="text-xs leading-relaxed text-[#F4F4F2]/60 mb-6">{text}</p>
        <button
          onClick={onRetry}
          className="px-6 py-2.5 rounded-full bg-white/[0.08] text-xs font-semibold text-white border border-white/10"
        >
          Вернуться к картам
        </button>
      </div>
    </div>
  );
}

function applyBrand(brand: MiniAppState["tenant"]["brand"]) {
  const root = document.documentElement;
  root.style.setProperty("--brand-primary", brand.primary);
  root.style.setProperty("--brand-bg", brand.bg);
  root.style.setProperty("--brand-surface", brand.surface);
  root.style.setProperty("--brand-text", brand.text);
  root.style.setProperty("--brand-accent", brand.accent);
  window.Telegram?.WebApp?.setBackgroundColor?.("#08090B");
  window.Telegram?.WebApp?.setHeaderColor?.("#08090B");
}
