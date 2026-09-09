"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { StampGrid } from "./StampGrid";
import { Monogram, WalletCardRow } from "./WalletCard";
import { plateColors, withAlpha } from "@/lib/color";

const RewardSheet = dynamic(() => import("./RewardSheet").then((m) => ({ default: m.RewardSheet })), {
  ssr: false,
});
import type { CardBadge, MiniAppState } from "@/lib/miniapp/state";

// награда в мини-аппе приходит урезанной — ровно то, что нужно QR-шторке
type CardReward = MiniAppState["rewards"][number];

type ClaimOutcome =
  | { kind: "stamped"; stamps_count: number; stamps_required: number; reward: CardReward | null }
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

/** Русские числительные: 1 чашка, 2 чашки, 5 чашек. */
function plural(count: number, one: string, few: string, many: string): string {
  const mod100 = Math.abs(count) % 100;
  const mod10 = mod100 % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

type CardNotification = {
  id: string;
  title: string;
  text: string;
  time: string;
  unread: boolean;
};

/** Лента уведомлений собирается из состояния карты — готовых наград и последних штампов. */
function buildNotifications(state: MiniAppState): CardNotification[] {
  const items: CardNotification[] = state.rewards.map((reward) => ({
    id: `reward-${reward.id}`,
    title: "Награда готова",
    text: `${reward.title} в ${state.tenant.name} ждёт вас. Покажите QR баристе.`,
    time: reward.earned_at
      ? new Date(reward.earned_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
      : "Сейчас",
    unread: true,
  }));

  for (const stamp of state.history.slice(0, 3)) {
    const at = new Date(stamp.created_at);
    items.push({
      id: `stamp-${stamp.created_at}`,
      title: "Штамп добавлен",
      text: `${state.tenant.name}${stamp.venue ? ` · ${stamp.venue}` : ""} — штамп зачислен на карту.`,
      time: at.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }),
      unread: false,
    });
  }

  if (items.length === 0) {
    items.push({
      id: "welcome",
      title: "Добро пожаловать в Stampy",
      text: `Карта ${state.tenant.name} подключена к вашему Telegram.`,
      time: "Сегодня",
      unread: false,
    });
  }
  return items;
}

const FAILURES: Record<string, string> = {
  no_tenant: "Не удалось определить кофейню. Отсканируйте QR на стойке или приложите телефон к подставке.",
  bad_signature: "Не удалось подтвердить вход. Откройте карту заново из бота.",
  stale: "Сессия устарела. Откройте карту заново из бота.",
  server: "Сервис недоступен. Попробуйте через минуту.",
};

export function CardScreen() {
  const [screen, setScreen] = useState<Screen>({ step: "loading" });
  const [activeTab, setActiveTab] = useState<Tab>("card");
  const [openReward, setOpenReward] = useState<CardReward | null>(null);
  const [showStampPop, setShowStampPop] = useState<ClaimOutcome | null>(null);
  const [freshStampIndex, setFreshStampIndex] = useState<number | null>(null);
  const [notifications, setNotifications] = useState<CardNotification[]>([]);

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

      setNotifications(buildNotifications(payload.state));

      if (payload.claim?.kind === "stamped") {
        setShowStampPop(payload.claim);
        setFreshStampIndex(Math.max(0, payload.claim.stamps_count - 1));
        window.setTimeout(() => setFreshStampIndex(null), 900);
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

  // Живое обновление карты: тянем состояние и показываем поп-ап, когда бариста начислил штамп
  useEffect(() => {
    if (screen.step !== "ready") return;
    let cancelled = false;

    async function poll() {
      if (cancelled || document.hidden) return;
      try {
        const response = await fetch("/api/miniapp/state", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ initData: initDataRef.current }),
        });
        if (!response.ok) return;
        const payload = await response.json();
        if (cancelled || !payload || !("state" in payload) || !payload.state) return;
        const next = payload.state as MiniAppState;
        setNotifications(buildNotifications(next));

        setScreen((prev) => {
          if (prev.step !== "ready") return prev;
          const prevStamps = prev.state.card?.stamps_count ?? 0;
          const nextStamps = next.card?.stamps_count ?? 0;
          const prevRewards = prev.state.rewards.length;
          const nextRewards = next.rewards.length;

          if (nextStamps > prevStamps || nextRewards > prevRewards) {
            window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");
            setFreshStampIndex(Math.max(0, nextStamps - 1));
            window.setTimeout(() => setFreshStampIndex(null), 900);
            setShowStampPop({
              kind: "stamped",
              stamps_count: nextStamps,
              stamps_required: next.program?.stamps_required ?? 6,
              reward: nextRewards > prevRewards ? next.rewards[nextRewards - 1] : null,
            });
          }
          return { ...prev, state: next };
        });
      } catch {
        // тихо: следующий тик попробует снова
      }
    }

    const timer = setInterval(poll, 4000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [screen.step]);

  if (screen.step === "loading") return <Splash />;
  if (screen.step === "outside") return <OutsideNfcFlow onRetry={() => loadWallet()} />;
  if (screen.step === "failed") return <Message text={screen.message} onRetry={() => loadWallet()} />;

  const tgUser = typeof window !== "undefined" ? (window.Telegram?.WebApp?.initDataUnsafe?.user as { id?: number; first_name?: string; last_name?: string; username?: string; photo_url?: string } | undefined) : undefined;
  const userName = tgUser?.first_name || "Гость";
  const userHandle = tgUser?.username ? `@${tgUser.username}` : "Telegram";

  // Суммарные метрики поверх всех карт — как в режиме одной кофейни, так и в кошельке.
  const walletCards = screen.step === "cards" ? screen.cards : [];
  const totalCupsCount =
    screen.step === "ready"
      ? (screen.state.card?.lifetime_stamps ?? screen.state.card?.stamps_count ?? screen.state.history.length) +
        (screen.state.otherCards?.reduce((s, c) => s + c.stamps_count, 0) ?? 0)
      : walletCards.reduce((s, c) => s + c.stamps_count, 0);

  const totalRewardsCount =
    screen.step === "ready"
      ? screen.state.rewards.length
      : walletCards.filter((c) => c.stamps_required && c.stamps_count >= c.stamps_required).length;

  const totalCardsCount =
    screen.step === "ready"
      ? 1 + (screen.state.otherCards?.length ?? 0)
      : walletCards.length || 1;

  // Уведомления в режиме кошелька — сводка по каждой карте
  const walletNotifications: CardNotification[] =
    screen.step === "cards"
      ? (() => {
          if (walletCards.length === 0) {
            return [
              {
                id: "welcome-empty",
                title: "Добро пожаловать в Stampy",
                text: "Приложите телефон к NFC-подставке на кассе — первая карта появится здесь.",
                time: "Сейчас",
                unread: false,
              },
            ];
          }
          const items: CardNotification[] = [];
          for (const c of walletCards) {
            const req = c.stamps_required ?? 6;
            const remaining = Math.max(0, req - c.stamps_count);
            if (c.stamps_count >= req) {
              items.push({
                id: `wallet-ready-${c.slug}`,
                title: "Награда готова",
                text: `${c.name} — покажите QR у стойки.`,
                time: "Сейчас",
                unread: true,
              });
            } else if (remaining === 1) {
              items.push({
                id: `wallet-almost-${c.slug}`,
                title: "Один штамп до награды",
                text: `${c.name} — загляните сегодня.`,
                time: "Сейчас",
                unread: true,
              });
            } else {
              items.push({
                id: `wallet-progress-${c.slug}`,
                title: `${c.name}`,
                text: `${c.stamps_count} из ${req} штампов. Осталось ${remaining}.`,
                time: "",
                unread: false,
              });
            }
          }
          return items;
        })()
      : notifications;

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
                  ? screen.state.tenant.name
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
            freshStampIndex={freshStampIndex}
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
            card={screen.step === "ready" ? screen.state.card : null}
            walletCards={walletCards}
            totalCups={totalCupsCount}
            totalRewards={totalRewardsCount}
            totalCards={totalCardsCount}
          />
        )}

        {/* TAB 4: NOTIFICATIONS (10) */}
        {activeTab === "notifications" && (
          <NotificationsView
            items={walletNotifications}
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
            totalCups={totalCupsCount}
            totalRewards={totalRewardsCount}
            totalCards={totalCardsCount}
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
  freshStampIndex,
  onOpenReward,
  onViewHistory,
}: {
  state: MiniAppState;
  freshStampIndex: number | null;
  onOpenReward: (reward: CardReward) => void;
  onViewHistory: () => void;
  }) {
  const { tenant, program, card, rewards } = state;
  const filled = card?.stamps_count ?? 0;
  const total = program?.stamps_required ?? 6;
  const remaining = Math.max(0, total - filled);
  const isRewardReady = rewards.length > 0 || remaining === 0;

  const brand = plateColors(tenant.brand);

  return (
    <div className="flex flex-col gap-4 animate-rise">
      {/* Плашка карты в цветах кофейни — то же, что владелец видит в кабинете */}
      <div
        className="rounded-[26px] p-6 relative overflow-hidden"
        style={{
          background: `linear-gradient(160deg, ${brand.surface} 0%, ${brand.bg} 100%)`,
          color: brand.text,
          border: `1px solid ${withAlpha(brand.primary, 0.25)}`,
          boxShadow: `0 24px 50px -20px ${withAlpha(brand.primary, 0.3)}`,
        }}
      >
        <div
          className="pointer-events-none absolute -top-20 -right-20 size-48 rounded-full"
          style={{ background: `radial-gradient(circle, ${withAlpha(brand.primary, 0.22)}, transparent 65%)` }}
        />

        <div className="flex justify-between items-start mb-6 relative">
          <div className="min-w-0 pr-2">
            <div
              className="font-mono text-[10px] uppercase tracking-widest mb-1.5 font-medium truncate"
              style={{ color: brand.accent }}
            >
              {tenant.name}
            </div>
            <h2 className="text-xl font-bold tracking-tight leading-snug">
              {program?.reward_title || "Карта лояльности"}
            </h2>
          </div>
          <Monogram name={tenant.name} logoUrl={tenant.logo_url} ink={brand.primary} size={36} />
        </div>

        {/* Stamp Grid */}
        <div className={`mb-6 relative ${freshStampIndex !== null ? "stamp-grid-celebrate" : ""}`}>
          <StampGrid
            filled={filled}
            total={total}
            brand={{ ...tenant.brand, ...brand }}
            justStamped={freshStampIndex}
          />
        </div>

        {/* Progress Footer */}
        <div
          className="flex items-end justify-between pt-4 relative"
          style={{ borderTop: `1px solid ${withAlpha(brand.text, 0.08)}` }}
        >
          <div>
            <div className="text-2xl font-bold tracking-tight">
              {filled}
              <span className="text-sm font-normal" style={{ color: withAlpha(brand.text, 0.4) }}>
                /{total}
              </span>
            </div>
            <div className="text-[11px] mt-0.5 font-medium" style={{ color: withAlpha(brand.text, 0.5) }}>
              {filled === 0
                ? "новая карта"
                : filled >= total
                  ? "награда готова!"
                  : "в процессе накопления"}
            </div>
          </div>
          <div className="text-right">
            {isRewardReady ? (
              <button
                onClick={() => rewards[0] && onOpenReward(rewards[0])}
                className="px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider animate-pulse"
                style={{
                  background: brand.primary,
                  color: brand.surface,
                  boxShadow: `0 0 20px ${withAlpha(brand.primary, 0.5)}`,
                }}
              >
                Получить QR
              </button>
            ) : (
              <div>
                <div className="text-xs font-semibold" style={{ color: brand.accent }}>
                  осталось {remaining} {plural(remaining, "штамп", "штампа", "штампов")}
                </div>
                <div
                  className="text-[10px] mt-0.5 max-w-[140px] truncate"
                  style={{ color: withAlpha(brand.text, 0.4) }}
                >
                  до «{program?.reward_title ?? "награды"}»
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Near Reward Hint Banner */}
      {remaining === 1 && (
        <div className="p-4 rounded-[20px] bg-[#5B8DEF]/10 border border-[#5B8DEF]/20 flex gap-3.5 items-start">
          <div className="size-8 rounded-xl bg-[#5B8DEF]/20 text-[#5B8DEF] grid place-items-center shrink-0">
            ★
          </div>
          <div className="flex-1">
            <div className="text-xs font-semibold text-white">Загляните в {tenant.name} сегодня</div>
            <div className="text-[11px] text-[#F4F4F2]/65 mt-0.5">
              Ещё один штамп — и «{program?.reward_title ?? "награда"}» за счёт заведения.
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
          <div className="text-[11px] text-[#F4F4F2]/45 truncate mt-0.5">
            {program
              ? `${total} ${plural(total, "штамп", "штампа", "штампов")} → ${program.reward_title}`
              : "Программа лояльности ещё настраивается"}
          </div>
        </div>
      </div>

      {/* Activity Section with REAL data */}
      <div className="p-4 rounded-[20px] bg-[#14161D] border border-white/[0.06]">
        <div className="flex justify-between items-center mb-3">
          <div className="font-mono text-[10px] text-[#F4F4F2]/45 uppercase tracking-widest font-semibold">
            Активность
          </div>
          {state.history.length > 0 && (
            <button onClick={onViewHistory} className="text-[11px] text-[#5B8DEF] hover:underline">
              Вся история
            </button>
          )}
        </div>
        <div className="flex flex-col gap-2.5 text-xs">
          {state.history.length > 0 ? (
            state.history.slice(0, 3).map((item, idx) => {
              const d = new Date(item.created_at);
              const isToday = new Date().toDateString() === d.toDateString();
              const dateStr = isToday
                ? "Сегодня"
                : d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
              return (
                <div
                  key={idx}
                  className={`flex justify-between items-center py-1 ${idx > 0 ? "border-t border-white/[0.04]" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`size-1.5 rounded-full ${idx === 0 ? "bg-[#5B8DEF]" : "bg-white/30"}`} />
                    <span>Штамп добавлен {item.venue ? `· ${item.venue}` : ""}</span>
                  </div>
                  <span className="text-[11px] text-[#F4F4F2]/45 font-mono">{dateStr}</span>
                </div>
              );
            })
          ) : (
            <div className="text-[11px] text-[#F4F4F2]/40 py-2 text-center">
              Штампов пока нет. Приложите телефон к метке на кассе.
            </div>
          )}
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
        <div className="stamp-success-mark mx-auto mb-4 size-16 rounded-full bg-gradient-to-br from-[#6B9BFF] to-[#4A7DE0] grid place-items-center shadow-[0_12px_30px_rgba(91,141,239,0.5)]">
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
  const [queue, setQueue] = useState(cards);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => {
    setQueue(cards);
    setSwipeDirection(null);
  }, [cards]);

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

  const active = queue[0] ?? cards[0];
  const backCards = queue.slice(1, 4);

  function rotateQueue(direction: "left" | "right") {
    if (queue.length < 2 || swipeDirection) return;
    suppressClick.current = true;
    setSwipeDirection(direction);
    window.setTimeout(() => {
      setQueue((current) => [...current.slice(1), current[0]]);
      setSwipeDirection(null);
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 0);
    }, 280);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (queue.length < 2 || swipeDirection) return;
    pointerStart.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start || swipeDirection) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) < 52 || Math.abs(deltaX) < Math.abs(deltaY)) return;
    rotateQueue(deltaX < 0 ? "left" : "right");
  }

  function handleCardClick() {
    if (suppressClick.current) return;
    onSelectCard(active.slug);
  }

  return (
    <div className="flex flex-col gap-3 animate-rise">
      <div className="flex justify-between items-baseline mb-1">
        <div className="text-xs text-[#F4F4F2]/50 font-medium">
          {cards.length} {plural(cards.length, "кофейня", "кофейни", "кофеен")}
        </div>
      </div>

      <div
        className="wallet-deck"
        aria-label="Кошелёк карт"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          pointerStart.current = null;
        }}
      >
        <div className="wallet-deck-cards">
          {backCards.map((card, index) => (
            <button
              type="button"
              key={card.slug}
              className={`wallet-deck-back wallet-deck-back-${index}`}
              aria-label={`Открыть карту ${card.name}`}
              onClick={() => onSelectCard(card.slug)}
              style={{
                background: `linear-gradient(155deg, ${card.brand.primary} 0%, ${withAlpha(card.brand.primary, 0.52)} 100%)`,
              }}
            >
              <span>{card.name}</span>
            </button>
          ))}
        </div>
        <div
          className={`wallet-carousel-card ${swipeDirection ? `wallet-carousel-swipe-${swipeDirection}` : ""}`}
        >
          <WalletCardRow
            card={{
              slug: active.slug,
              name: active.name,
              subtitle: "Карта лояльности",
              logo_url: active.logo_url,
              brand: active.brand,
              stamps_count: active.stamps_count,
              stamps_required: active.stamps_required,
              is_ready: active.stamps_count >= (active.stamps_required ?? 6),
            }}
            onClick={handleCardClick}
            isActive
          />
        </div>
      </div>

    </div>
  );
}

/** 08 · История наград (History view with REAL data) */
function HistoryView({
  rewards,
  history,
  card,
  walletCards,
  totalCups: totalCupsProp,
  totalRewards,
  totalCards,
}: {
  rewards: MiniAppState["rewards"];
  history: MiniAppState["history"];
  card: MiniAppState["card"];
  walletCards: CardBadge[];
  totalCups: number;
  totalRewards: number;
  totalCards: number;
}) {
  // В режиме кошелька истории по одной карте нет — показываем сводку по всем.
  const isWalletMode = !card && walletCards.length > 0;
  const totalCups = isWalletMode ? totalCupsProp : card?.lifetime_stamps ?? card?.stamps_count ?? history.length;
  const sparkPoints = cumulativeSpark(history);

  return (
    <div className="flex flex-col gap-4 animate-rise">
      {/* Stat Card */}
      <div className="p-6 rounded-[24px] bg-[#FAFAF9] text-[#0E0F11] border border-black/[0.06] shadow-sm">
        <div className="text-[11px] font-mono uppercase tracking-widest text-[#0E0F11]/50 font-semibold mb-1">
          История
        </div>
        <div className="flex items-baseline gap-2 mb-2">
          <div className="text-4xl font-extrabold tracking-tight">{totalCups}</div>
          <div className="text-xs text-[#0E0F11]/60">{plural(totalCups, "чашка", "чашки", "чашек")} всего</div>
        </div>

        {/* Sparkline или сводка по картам, если истории по кофейне нет */}
        {sparkPoints && !isWalletMode && (
          <svg viewBox="0 0 300 40" width="100%" height="40" className="mt-3 overflow-visible">
            <defs>
              <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#5B8DEF" stopOpacity="0.25" />
                <stop offset="1" stopColor="#5B8DEF" stopOpacity="0" />
              </linearGradient>
            </defs>
            <polyline points={sparkPoints} fill="none" stroke="#5B8DEF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <polyline points={`0,40 ${sparkPoints} 300,40`} fill="url(#histGrad)"/>
          </svg>
        )}
        {isWalletMode && (
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-[#0E0F11]/5 border border-black/[0.06] p-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-[#0E0F11]/50">Карт</div>
              <div className="mt-0.5 text-lg font-bold">{totalCards}</div>
            </div>
            <div className="rounded-xl bg-[#0E0F11]/5 border border-black/[0.06] p-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-[#0E0F11]/50">Наград</div>
              <div className="mt-0.5 text-lg font-bold">{totalRewards}</div>
            </div>
          </div>
        )}
      </div>

      {/* В режиме кошелька — список карт с прогрессом вместо истории одной кофейни */}
      {isWalletMode && (
        <div className="flex flex-col gap-2">
          <div className="font-mono text-[10px] text-[#F4F4F2]/45 uppercase tracking-widest font-semibold px-1">
            По кофейням
          </div>
          {walletCards.map((c) => {
            const req = c.stamps_required ?? 6;
            const isReady = c.stamps_count >= req;
            const percent = Math.min(100, Math.round((c.stamps_count / req) * 100));
            return (
              <div
                key={c.slug}
                className="p-3.5 rounded-[16px] bg-[#14161D] border border-white/[0.04]"
              >
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-semibold text-white truncate pr-2">{c.name}</span>
                  <span className="font-mono text-[11px] text-[#F4F4F2]/50 shrink-0">
                    {c.stamps_count} / {req}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${percent}%`,
                      background: isReady ? "#5B8DEF" : withAlpha(c.brand.primary ?? "#5B8DEF", 0.9),
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rewards history items */}
      {rewards.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="font-mono text-[10px] text-[#F4F4F2]/45 uppercase tracking-widest font-semibold px-1">
            Готовые награды
          </div>
          {rewards.map((r) => (
            <div key={r.id} className="p-4 rounded-[18px] bg-[#14161D] border border-[#5B8DEF]/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-[#5B8DEF]/15 text-[#5B8DEF] grid place-items-center">
                  ★
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">{r.title}</div>
                  <div className="text-[11px] text-[#7BA5FF] mt-0.5">
                    {r.expires_at ? `До ${new Date(r.expires_at).toLocaleDateString("ru-RU")}` : "Готово к получению"}
                  </div>
                </div>
              </div>
              <span className="font-mono text-[11px] text-[#7BA5FF] font-semibold shrink-0">
                {r.earned_at ? new Date(r.earned_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) : "—"}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* History log */}
      <div className="flex flex-col gap-2">
        <div className="font-mono text-[10px] text-[#F4F4F2]/45 uppercase tracking-widest font-semibold px-1">
          История посещений
        </div>
        {history.length > 0 ? (
          history.map((h, i) => {
            const d = new Date(h.created_at);
            return (
              <div key={i} className="p-3.5 rounded-[16px] bg-[#14161D] border border-white/[0.04] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="size-2 rounded-full bg-[#5B8DEF]" />
                  <div className="text-xs text-white font-medium">Штамп добавлен {h.venue ? `· ${h.venue}` : ""}</div>
                </div>
                <span className="text-[11px] text-[#F4F4F2]/40 font-mono">
                  {d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            );
          })
        ) : (
          <div className="p-6 rounded-[18px] bg-[#14161D] border border-white/[0.04] text-center text-xs text-[#F4F4F2]/40">
            История пока пуста
          </div>
        )}
      </div>
    </div>
  );
}

/** Накопительный ряд штампов за последние 14 дней → точки полилинии 300x40. */
function cumulativeSpark(history: MiniAppState["history"]): string | null {
  if (history.length < 2) return null;
  const days = 14;
  const dayMs = 86_400_000;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const perDay = new Array<number>(days).fill(0);
  for (const item of history) {
    const diff = Math.floor((startOfToday.getTime() - new Date(item.created_at).setHours(0, 0, 0, 0)) / dayMs);
    if (diff >= 0 && diff < days) perDay[days - 1 - diff] += 1;
  }
  let running = 0;
  const cumulative = perDay.map((n) => (running += n));
  const max = cumulative[cumulative.length - 1];
  if (max === 0) return null;
  const step = 300 / (days - 1);
  return cumulative
    .map((value, index) => `${Math.round(index * step)},${Math.round(36 - (value / max) * 32)}`)
    .join(" ");
}

/** 09 · Профиль и настройки (Profile view with REAL data) */
function ProfileView({
  userName,
  userHandle,
  totalCups,
  totalRewards,
  totalCards,
}: {
  userName: string;
  userHandle: string;
  totalCups: number;
  totalRewards: number;
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
          <p className="text-xs text-[#F4F4F2]/50 font-mono mt-0.5">{userHandle}</p>
        </div>
      </div>

      {/* 3 Metrics */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="p-4 rounded-[18px] bg-[#14161D] border border-white/[0.06] text-center">
          <div className="text-xl font-bold text-white">{totalCups}</div>
          <div className="text-[10px] text-[#F4F4F2]/50 mt-1">{plural(totalCups, "чашка", "чашки", "чашек")}</div>
        </div>
        <div className="p-4 rounded-[18px] bg-[#14161D] border border-white/[0.06] text-center">
          <div className="text-xl font-bold text-white">{totalRewards}</div>
          <div className="text-[10px] text-[#F4F4F2]/50 mt-1">{plural(totalRewards, "награда", "награды", "наград")}</div>
        </div>
        <div className="p-4 rounded-[18px] bg-[#14161D] border border-white/[0.06] text-center">
          <div className="text-xl font-bold text-white">{totalCards}</div>
          <div className="text-[10px] text-[#F4F4F2]/50 mt-1">{plural(totalCards, "кофейня", "кофейни", "кофеен")}</div>
        </div>
      </div>

      {/* Settings list */}
      <div className="rounded-[22px] bg-[#14161D] border border-white/[0.06] overflow-hidden text-xs">
        <div className="p-4 flex items-center justify-between border-b border-white/[0.04]">
          <div className="flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
            <span>Уведомления</span>
          </div>
          <span className="text-[#F4F4F2]/50 font-mono">в Telegram</span>
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

/** 10 · Уведомления (Notifications view with REAL data) */
function NotificationsView({
  items,
  onMarkRead,
}: {
  items: CardNotification[];
  onMarkRead: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 animate-rise">
      <div className="flex justify-between items-center px-1 mb-1">
        <div className="text-xs text-[#F4F4F2]/50 font-medium">
          {items.length} {plural(items.length, "уведомление", "уведомления", "уведомлений")}
        </div>
        {items.some((i) => i.unread) && (
          <button onClick={onMarkRead} className="text-[11px] text-[#5B8DEF] hover:underline">
            Прочитать все
          </button>
        )}
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
        Stampy · {new Date().getFullYear()}
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
