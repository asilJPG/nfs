"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { StampGrid } from "./StampGrid";
import { inkOn, Monogram, WalletCardRow } from "./WalletCard";

// RewardSheet тащит qrcode (~50KB gzip). Грузим только когда гость открывает награду.
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
      if ("cards" in payload) {
        // Кошелёк «Мои карты» — стартовый экран, даже если карта одна.
        // Прямо в карту заходим только по тапу метки: тогда прилетает startParam
        // и сервер отдаёт уже состояние карты, а не список.
        setScreen({ step: "cards", cards: payload.cards });
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

  // Кошелёк «Мои карты»: список всех карт гостя, без подстановки последней кофейни.
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
    // start_param приходит только для t.me/bot/appname?startapp=...
    // Кнопка web_app в клавиатуре открывает URL напрямую — параметр читаем оттуда.
    const url = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const startParam =
      app.initDataUnsafe?.start_param ??
      url.get("startapp") ??
      hash.get("tgWebAppStartParam") ??
      undefined;
    // Без параметра гость открыл мини-апп сам — показываем кошелёк.
    // С параметром пришёл тап метки или ссылка на кофейню — открываем карту.
    if (startParam) void load(startParam);
    else void loadWallet();
  }, [load, loadWallet]);

  // Polling пока карта открыта: если штамп прилетел откуда-то ещё (тап NFC, бариста
  // подтвердил), UI обновится сам без reload. Пауза когда открыт лист награды/история
  // или мини-апп в фоне, чтоб не жечь запросы впустую.
  useEffect(() => {
    if (screen.step !== "ready") return;
    const currentScreen = screen;
    let cancelled = false;

    async function poll() {
      if (cancelled || document.hidden || openReward) return;
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
          setScreen({
            step: "ready",
            state: payload.state,
            claim: newStamps > prevStamps
              ? {
                  kind: "stamped",
                  stamps_count: newStamps,
                  stamps_required: payload.state.program?.stamps_required ?? 0,
                  reward: newRewards > prevRewards ? payload.state.rewards[newRewards - 1] : null,
                }
              : null,
          });
        }
      } catch {
        // молчим — следующий тик попробует снова
      }
    }

    const timer = setInterval(poll, 2500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [screen, openReward]);

  if (screen.step === "loading") return <Splash />;
  if (screen.step === "outside") return <OutsideTelegram />;
  if (screen.step === "failed") return <Message text={screen.message} />;
  if (screen.step === "cards") return <CardsList cards={screen.cards} onPick={(slug) => load(`t_${slug}`)} />;

  const { state, claim } = screen;
  const { tenant, program, card } = state;

  if (!program) return <Message text="Кофейня ещё не настроила карту лояльности." />;
  if (!tenant.serving) {
    return <Message text="Карта этой кофейни временно недоступна. Ваши штампы сохранены." />;
  }

  const filled = card?.stamps_count ?? 0;
  const remaining = Math.max(0, program.stamps_required - filled);
  const justStamped = claim?.kind === "stamped" ? claim.stamps_count - 1 : null;
  const cardFill = tenant.brand.primary;
  const cardInk = inkOn(cardFill);

  return (
    <main className="tg-safe mx-auto flex min-h-dvh max-w-md flex-col gap-3 px-4 pb-6">
      <WalletHeader
        title="Моя карта"
        subtitle={tenant.name}
        onBack={() => void loadWallet()}
      />

      {claim && <ClaimBanner claim={claim} />}

      {/* Карта по референсу кошелька: знак и название сверху, белая панель с
          кодом в середине, снизу две колонки со статусом */}
      <section
        className="relative overflow-hidden rounded-[28px] p-5"
        style={{ background: cardFill, color: cardInk }}
      >
        {/* крупный знак кофейни фоном — на месте иллюстрации из референса */}
        <span
          aria-hidden
          className="pointer-events-none absolute -right-6 -top-8 text-[132px] font-black leading-none"
          style={{ opacity: cardInk === "#141414" ? 0.07 : 0.1 }}
        >
          {tenant.name.slice(0, 1).toUpperCase()}
        </span>

        <div className="relative">
          <Monogram name={tenant.name} logoUrl={tenant.logo_url} ink={cardInk} size={34} />

          <h2 className="mt-3.5 truncate text-[21px] font-extrabold leading-tight tracking-tight">
            {tenant.name}
          </h2>
          <p className="truncate text-[12px]" style={{ opacity: 0.7 }}>
            {program.reward_title}
          </p>

          <div className="mt-4 rounded-[18px] bg-white px-4 pb-3 pt-4">
            <StampGrid
              filled={filled}
              total={program.stamps_required}
              style={tenant.brand.card_style}
              justStamped={justStamped}
            />
            <p className="mt-3 text-center text-[11px] font-medium tracking-[0.32em] text-neutral-400">
              {formatCode(card?.public_code)}
            </p>
          </div>

          <div className="mt-4 flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest" style={{ opacity: 0.6 }}>
                Собрано
              </p>
              <p className="text-[15px] font-bold tabular-nums">
                {filled} из {program.stamps_required}
              </p>
            </div>
            <div className="min-w-0 text-right">
              <p className="text-[10px] uppercase tracking-widest" style={{ opacity: 0.6 }}>
                Статус
              </p>
              <p className="truncate text-[15px] font-bold">
                {state.rewards.length > 0
                  ? "награда готова"
                  : remaining === 0
                    ? "начисляется"
                    : `ещё ${remaining} ${plural(remaining, "штамп", "штампа", "штампов")}`}
              </p>
            </div>
          </div>

          {program.reward_description && (
            <p className="mt-3 text-[11px] leading-relaxed" style={{ opacity: 0.7 }}>
              {program.reward_description}
            </p>
          )}
        </div>
      </section>

      {state.rewards.length > 0 && (
        <section className="flex flex-col gap-2">
          {state.rewards.map((reward) => (
            <button
              key={reward.id}
              onClick={() => setOpenReward(reward as Reward)}
              className="flex items-center justify-between gap-3 rounded-[22px] border border-emerald-400/25 bg-emerald-400/10 px-4 py-3.5 text-left transition-transform active:scale-[0.98]"
            >
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-bold text-emerald-300">
                  {reward.title}
                </span>
                <span className="block text-[11px] text-emerald-400/70">
                  {reward.expires_at ? `Действует до ${formatDate(reward.expires_at)}` : "Без срока"}
                </span>
              </span>
              <span className="shrink-0 rounded-full bg-emerald-400 px-3.5 py-2 text-[12px] font-bold text-neutral-950">
                Забрать
              </span>
            </button>
          ))}
        </section>
      )}

      {state.history.length > 0 && (
        <section className="rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-3">
          <button
            onClick={() => setShowHistory((open) => !open)}
            className="flex w-full items-center justify-between text-[13px] font-medium text-neutral-400"
          >
            <span>История посещений</span>
            <span className="text-neutral-600">{showHistory ? "−" : "+"}</span>
          </button>
          {showHistory && (
            <ul className="mt-3 flex flex-col gap-2 border-t border-white/8 pt-3 text-[12px]">
              {state.history.map((visit, index) => (
                <li key={index} className="flex justify-between text-neutral-300">
                  <span>{formatDateTime(visit.created_at)}</span>
                  <span className="text-neutral-500">{visit.venue ?? ""}</span>
                </li>
              ))}
            </ul>
          )}
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

/** Шапка кошелька: крупный заголовок слева, аватар гостя справа — как в референсе. */
function WalletHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
}) {
  const user = typeof window !== "undefined" ? window.Telegram?.WebApp?.initDataUnsafe?.user : null;
  const photo = user?.photo_url ?? null;
  const initial = (user?.first_name ?? "").slice(0, 1).toUpperCase();

  return (
    <header className="flex items-center justify-between gap-3 pb-1 pt-5">
      <div className="flex min-w-0 items-center gap-2.5">
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Ко всем картам"
            className="grid size-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5 text-neutral-300 transition-colors hover:bg-white/10"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
        )}
        <div className="min-w-0">
        <h1 className="truncate text-[28px] font-extrabold leading-none tracking-tight text-white">
          {title}
        </h1>
        {subtitle && <p className="mt-1 truncate text-[12px] text-neutral-500">{subtitle}</p>}
        </div>
      </div>
      <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full border border-white/10 bg-white/5 text-[13px] font-bold text-neutral-300">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="h-full w-full object-cover" />
        ) : (
          initial || "☕"
        )}
      </span>
    </header>
  );
}

function ClaimBanner({ claim }: { claim: ClaimOutcome }) {
  if (claim.kind === "stamped") {
    return (
      <Banner tone="good">
        {claim.reward
          ? "Карта заполнена — ваша награда готова"
          : `Штамп ${claim.stamps_count} из ${claim.stamps_required} зачислен`}
      </Banner>
    );
  }
  if (claim.kind === "already_counted") {
    return <Banner tone="muted">Этот штамп уже был начислен ранее</Banner>;
  }
  if (claim.kind === "cooldown") {
    const minutes = Math.ceil(claim.retry_after_seconds / 60);
    return <Banner tone="muted">Следующий штамп можно получить через {minutes} мин</Banner>;
  }
  return <Banner tone="bad">{CLAIM_ERRORS[claim.code] ?? CLAIM_ERRORS.server}</Banner>;
}

function Banner({ tone, children }: { tone: "good" | "bad" | "muted"; children: React.ReactNode }) {
  const styles = {
    good: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
    muted: "border-white/10 bg-white/5 text-neutral-300",
    bad: "border-red-400/25 bg-red-400/10 text-red-300",
  }[tone];
  return (
    <p className={`animate-rise rounded-[18px] border px-4 py-3 text-center text-[13px] font-semibold ${styles}`}>
      {children}
    </p>
  );
}

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="size-8 animate-spin rounded-full border-2 border-white/15 border-t-white/70" />
    </div>
  );
}

function Message({ text }: { text: string }) {
  return (
    <div className="grid min-h-dvh place-items-center px-6 text-center">
      <p className="max-w-xs whitespace-pre-wrap text-[13px] leading-relaxed text-neutral-400">
        {text}
      </p>
    </div>
  );
}

// высота карты и видимая полоса лежащей под ней — как в кошельке
const CARD_HEIGHT = 168;
const PEEK = 92;

function CardsList({ cards, onPick }: { cards: CardBadge[]; onPick: (slug: string) => void }) {
  if (cards.length === 0) {
    return (
      <main className="tg-safe mx-auto flex min-h-dvh max-w-md flex-col px-4">
        <WalletHeader title="Мои карты" />
        <div className="mt-6 rounded-[22px] border border-dashed border-white/12 px-5 py-8 text-center">
          <p className="text-[15px] font-bold text-white">Пока нет ни одной карты</p>
          <p className="mx-auto mt-2 max-w-[16rem] text-[12px] leading-relaxed text-neutral-400">
            Приложите телефон к NFC-подставке на стойке кофейни — карта появится здесь
            автоматически.
          </p>
        </div>
      </main>
    );
  }

  // Карты лежат стопкой: у каждой видна верхняя полоса, передняя открыта целиком —
  // так же, как карты лежат в кошельке.
  const stackHeight = CARD_HEIGHT + PEEK * (cards.length - 1);

  return (
    <main className="tg-safe mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-8">
      <WalletHeader
        title="Мои карты"
        subtitle={`${cards.length} ${plural(cards.length, "карта", "карты", "карт")}`}
      />

      <div className="relative mt-4" style={{ height: stackHeight }}>
        {cards.map((card, index) => (
          <div
            key={card.slug}
            className="animate-deal absolute inset-x-0"
            style={{ top: index * PEEK, zIndex: index + 1, ["--deal-index" as string]: index }}
          >
            <WalletCardRow
              card={{
                slug: card.slug,
                name: card.name,
                subtitle: "Карта лояльности",
                logo_url: card.logo_url,
                brand: card.brand,
                stamps_count: card.stamps_count,
                stamps_required: card.stamps_required,
              }}
              onClick={() => onPick(card.slug)}
            />
          </div>
        ))}
      </div>
    </main>
  );
}

function OutsideTelegram() {
  return (
    <div className="grid min-h-dvh place-items-center px-8 text-center">
      <div className="max-w-xs">
        <h1 className="mb-2 text-[17px] font-bold text-white">Откройте карту в Telegram</h1>
        <p className="text-[13px] leading-relaxed text-neutral-400">
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
  // шапка и фон Telegram — под тёмную оболочку кошелька, не под бренд кофейни
  window.Telegram?.WebApp?.setBackgroundColor?.("#0e0f11");
  window.Telegram?.WebApp?.setHeaderColor?.("#0e0f11");
}

/** Код карты под штампами — аналог номера под штрихкодом в кошельке. */
function formatCode(code: string | undefined): string {
  if (!code) return "";
  return code.toUpperCase().replace(/(.{4})(?=.)/g, "$1 ");
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
