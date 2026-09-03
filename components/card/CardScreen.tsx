"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { StampGrid } from "./StampGrid";
import { RewardSheet } from "./RewardSheet";
import type { MiniAppState } from "@/lib/miniapp/state";
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
  | { step: "ready"; state: MiniAppState; claim: ClaimOutcome | null };

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
  const [openReward, setOpenReward] = useState<Reward | null>(null);
  const [showHistory, setShowHistory] = useState(false);
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
      applyBrand(payload.state.tenant.brand);
      setScreen({ step: "ready", state: payload.state, claim: payload.claim });
      if (payload.claim?.kind === "stamped") {
        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");
      }
    } catch {
      setScreen({ step: "failed", message: FAILURES.server });
    }
  }, []);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    const app = window.Telegram?.WebApp;
    if (!app?.initData) {
      // Dev only: open the card in a plain browser, identity from DEV_TELEGRAM_ID.
      // ?startapp=… stands in for the payload Telegram would have passed.
      if (process.env.NEXT_PUBLIC_DEV_MINIAPP === "1") {
        initDataRef.current = "dev";
        void load(new URLSearchParams(window.location.search).get("startapp") ?? undefined);
        return;
      }
      setScreen({ step: "outside" });
      return;
    }
    app.ready();
    app.expand();
    initDataRef.current = app.initData;
    void load(app.initDataUnsafe?.start_param);
  }, [load]);

  if (screen.step === "loading") return <Splash />;
  if (screen.step === "outside") return <OutsideTelegram />;
  if (screen.step === "failed") return <Message text={screen.message} />;

  const { state, claim } = screen;
  const { tenant, program, card } = state;

  if (!program) return <Message text="Кофейня ещё не настроила карту лояльности." />;
  if (!tenant.serving) {
    return <Message text="Карта этой кофейни временно недоступна. Ваши штампы сохранены." />;
  }

  const filled = card?.stamps_count ?? 0;
  const remaining = Math.max(0, program.stamps_required - filled);
  const justStamped = claim?.kind === "stamped" ? claim.stamps_count - 1 : null;

  return (
    <main className="tg-safe mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4">
      <header className="flex items-center gap-3 pt-2">
        {tenant.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tenant.logo_url} alt="" className="size-11 rounded-2xl object-cover" />
        ) : (
          <div
            className="grid size-11 place-items-center rounded-2xl text-lg"
            style={{ background: "var(--brand-primary)", color: "var(--brand-surface)" }}
          >
            {tenant.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold">{tenant.name}</h1>
          <p className="text-sm opacity-60">Карта лояльности</p>
        </div>
      </header>

      {claim && <ClaimBanner claim={claim} />}

      <section
        className="rounded-3xl p-5 shadow-sm"
        style={{ background: "var(--brand-surface)" }}
      >
        <p className="text-sm opacity-70">
          {remaining === 0
            ? "Карта заполнена — заберите награду"
            : `Ещё ${remaining} ${plural(remaining, "штамп", "штампа", "штампов")} до награды`}
        </p>
        <p className="mb-4 text-xl font-semibold">{program.reward_title}</p>
        <StampGrid
          filled={filled}
          total={program.stamps_required}
          style={tenant.brand.card_style}
          justStamped={justStamped}
        />
        {program.reward_description && (
          <p className="mt-4 text-sm opacity-60">{program.reward_description}</p>
        )}
      </section>

      {state.rewards.length > 0 && (
        <section className="flex flex-col gap-2">
          {state.rewards.map((reward) => (
            <button
              key={reward.id}
              onClick={() => setOpenReward(reward as Reward)}
              className="flex items-center justify-between rounded-3xl px-5 py-4 text-left shadow-sm"
              style={{ background: "var(--brand-primary)", color: "var(--brand-surface)" }}
            >
              <span>
                <span className="block font-semibold">{reward.title}</span>
                <span className="block text-sm opacity-80">
                  {reward.expires_at
                    ? `Действует до ${formatDate(reward.expires_at)}`
                    : "Без срока действия"}
                </span>
              </span>
              <span className="text-sm font-medium">Использовать →</span>
            </button>
          ))}
        </section>
      )}

      {card && (
        <section
          className="flex items-center justify-between rounded-3xl px-5 py-4 text-sm shadow-sm"
          style={{ background: "var(--brand-surface)" }}
        >
          <span className="opacity-60">Код карты для бариста</span>
          <span className="font-mono text-base font-semibold tracking-widest">{card.public_code}</span>
        </section>
      )}

      {state.history.length > 0 && (
        <section className="rounded-3xl px-5 py-4 shadow-sm" style={{ background: "var(--brand-surface)" }}>
          <button
            onClick={() => setShowHistory((open) => !open)}
            className="flex w-full items-center justify-between text-sm"
          >
            <span className="opacity-60">История посещений</span>
            <span className="opacity-40">{showHistory ? "▲" : "▼"}</span>
          </button>
          {showHistory && (
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {state.history.map((visit, index) => (
                <li key={index} className="flex justify-between opacity-80">
                  <span>{formatDateTime(visit.created_at)}</span>
                  <span className="opacity-60">{visit.venue ?? ""}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {state.otherCards.length > 0 && (
        <section className="pb-6">
          <p className="mb-2 px-1 text-sm opacity-60">Другие карты</p>
          <div className="flex flex-col gap-2">
            {state.otherCards.map((other) => (
              <button
                key={other.slug}
                onClick={() => {
                  setScreen({ step: "loading" });
                  void load(`t_${other.slug}`);
                }}
                className="flex items-center justify-between rounded-2xl px-4 py-3 text-left text-sm shadow-sm"
                style={{ background: "var(--brand-surface)" }}
              >
                <span className="font-medium">{other.name}</span>
                <span className="opacity-50">{other.stamps_count} шт.</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {openReward && (
        <RewardSheet
          reward={openReward}
          initData={initDataRef.current}
          onClose={() => {
            setOpenReward(null);
            void load();
          }}
        />
      )}
    </main>
  );
}

function ClaimBanner({ claim }: { claim: ClaimOutcome }) {
  if (claim.kind === "stamped") {
    return (
      <Banner tone="good">
        {claim.reward
          ? "Карта заполнена — награда ваша!"
          : `Штамп ${claim.stamps_count} из ${claim.stamps_required} 🎉`}
      </Banner>
    );
  }
  if (claim.kind === "already_counted") {
    return <Banner tone="muted">Этот штамп уже начислен.</Banner>;
  }
  if (claim.kind === "cooldown") {
    const minutes = Math.ceil(claim.retry_after_seconds / 60);
    return <Banner tone="muted">Штамп можно получить снова через {minutes} мин.</Banner>;
  }
  return <Banner tone="bad">{CLAIM_ERRORS[claim.code] ?? CLAIM_ERRORS.server}</Banner>;
}

function Banner({ tone, children }: { tone: "good" | "bad" | "muted"; children: React.ReactNode }) {
  const styles = {
    good: { background: "color-mix(in srgb, var(--brand-primary) 12%, transparent)" },
    muted: { background: "color-mix(in srgb, var(--brand-text) 8%, transparent)" },
    bad: { background: "color-mix(in srgb, #d94545 14%, transparent)" },
  }[tone];
  return (
    <p className="animate-rise rounded-2xl px-4 py-3 text-sm font-medium" style={styles}>
      {children}
    </p>
  );
}

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="animate-pulse text-4xl">☕</div>
    </div>
  );
}

function Message({ text }: { text: string }) {
  return (
    <div className="grid min-h-dvh place-items-center px-8 text-center">
      <p className="max-w-xs text-sm opacity-70">{text}</p>
    </div>
  );
}

function OutsideTelegram() {
  return (
    <div className="grid min-h-dvh place-items-center px-8 text-center">
      <div className="max-w-xs">
        <p className="mb-3 text-4xl">☕</p>
        <h1 className="mb-2 text-lg font-semibold">Откройте карту в Telegram</h1>
        <p className="text-sm opacity-70">
          Эта страница работает внутри Telegram. Отсканируйте QR-код на стойке кофейни или откройте
          бота, чтобы увидеть свою карту.
        </p>
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
  window.Telegram?.WebApp?.setBackgroundColor?.(brand.bg);
  window.Telegram?.WebApp?.setHeaderColor?.(brand.bg);
}

function plural(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  timeZone: "Asia/Tashkent",
});
const dateTimeFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Tashkent",
});

function formatDate(value: string) {
  return dateFormat.format(new Date(value));
}
function formatDateTime(value: string) {
  return dateTimeFormat.format(new Date(value));
}
