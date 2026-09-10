"use client";

import { useState, useEffect, useCallback } from "react";

type ScreenKey = "wallet" | "tap" | "stamp" | "reward" | "history" | "profile";

type CardData = {
  id: string;
  name: string;
  title: string;
  count: number;
  total: number;
  sub: string;
  hint: string;
  ready?: boolean;
  bg: string;
  textColor?: string;
  subColor?: string;
};

const CARDS: CardData[] = [
  {
    id: "broadway",
    name: "Кофейня на Навои",
    title: "КОФЕЙНЯ НА НАВОИ",
    count: 2,
    total: 6,
    sub: "осталось 4",
    hint: "Кофейня на Навои · 4-й латте бесплатно",
    bg: "linear-gradient(160deg,#7BA5FF,#4A7DE0)",
    textColor: "#FAFAF9",
    subColor: "rgba(255,255,255,.8)",
  },
  {
    id: "chinor",
    name: "Пекарня у дома",
    title: "ПЕКАРНЯ У ДОМА",
    count: 4,
    total: 6,
    sub: "осталось 2",
    hint: "Пекарня у дома · капучино за счёт заведения",
    bg: "linear-gradient(160deg,#E85D45,#C43A22)",
    textColor: "#FAFAF9",
    subColor: "rgba(255,255,255,.85)",
  },
  {
    id: "sfumato",
    name: "Обжарка №7",
    title: "ОБЖАРКА №7",
    count: 6,
    total: 6,
    sub: "награда готова",
    hint: "Обжарка №7 · капучино в подарок",
    ready: true,
    bg: "linear-gradient(160deg,#F4B94A,#E89728)",
    textColor: "#14100C",
    subColor: "rgba(20,15,10,.75)",
  },
];

const SCREEN_COPY: Record<ScreenKey, { title: string; sub: string; kicker: string }> = {
  wallet: {
    kicker: "Экран 01 · Кошелёк",
    title: "Все карты — в одной ленте.",
    sub: "Кофейня на Навои, Пекарня у дома и Обжарка №7 живут в одном месте. Активная карта опускается вниз — прогресс, награда и следующий штамп всегда под рукой.",
  },
  tap: {
    kicker: "Экран 02 · Касание NFC",
    title: "Одно касание — окно заведения.",
    sub: "Никаких экранов ожидания и поиска. Гость подносит телефон к NFC-стенду у кассы — и сразу всплывает окно заведения с новой картой. Одно нажатие — и карта в кошельке.",
  },
  stamp: {
    kicker: "Экран 03 · Штамп",
    title: "Штамп — в реальном времени.",
    sub: "Бариста подтверждает покупку в панели — штамп появляется на карте гостя мгновенно, с мягкой тактильной анимацией.",
  },
  reward: {
    kicker: "Экран 04 · Награда",
    title: "Награда — QR у стойки.",
    sub: "Собран шестой штамп — гость показывает одноразовый QR-код у кассы с динамической лазерной полосой сканирования. Списание на месте без задержек.",
  },
  history: {
    kicker: "Экран 05 · История",
    title: "Прозрачная история начислений.",
    sub: "Гость видит каждый визит, начисленный штамп и выданную награду с точностью до минуты. Работает фильтрация по штампам и подаркам.",
  },
  profile: {
    kicker: "Экран 06 · Профиль",
    title: "Личный профиль и статистика.",
    sub: "Сводка по всем картам лояльности в Ташкенте, общее количество выпитых чашек кофе и полученных наград, гибкое управление уведомлениями.",
  },
};

const INITIAL_EVENTS = [
  { t: "2 мин", k: "Штамп", c: "Обжарка №7", color: "#F4B94A", name: "Азиза К." },
  { t: "5 мин", k: "Награда", c: "Пекарня у дома", color: "#E85D45", name: "Тимур Р." },
  { t: "11 мин", k: "Новая карта", c: "Кофейня на Навои", color: "#7BA5FF", name: "Марат Ю." },
  { t: "18 мин", k: "Штамп", c: "Обжарка №7", color: "#F4B94A", name: "Диана А." },
  { t: "26 мин", k: "Штамп", c: "Пекарня у дома", color: "#E85D45", name: "Санжар Б." },
];

type HistoryItem = {
  id: string;
  day: "today" | "yesterday";
  type: "stamp" | "reward";
  title: string;
  cafe: string;
  item: string;
  time: string;
  count: string;
  color: string;
};

const HISTORY_DATA: HistoryItem[] = [
  {
    id: "h1",
    day: "today",
    type: "stamp",
    title: "+1 штамп",
    cafe: "Пекарня у дома",
    item: "флэт уайт",
    time: "09:12",
    count: "5 / 6",
    color: "linear-gradient(160deg,#E85D45,#C43A22)",
  },
  {
    id: "h2",
    day: "yesterday",
    type: "reward",
    title: "Награда",
    cafe: "Обжарка №7",
    item: "капучино",
    time: "16:45",
    count: "★",
    color: "linear-gradient(160deg,#F4B94A,#E89728)",
  },
  {
    id: "h3",
    day: "yesterday",
    type: "stamp",
    title: "+1 штамп",
    cafe: "Кофейня на Навои",
    item: "латте",
    time: "11:20",
    count: "2 / 6",
    color: "linear-gradient(160deg,#7BA5FF,#4A7DE0)",
  },
  {
    id: "h4",
    day: "yesterday",
    type: "stamp",
    title: "+1 штамп",
    cafe: "Пекарня у дома",
    item: "капучино",
    time: "08:05",
    count: "4 / 6",
    color: "linear-gradient(160deg,#E85D45,#C43A22)",
  },
];

export function StampyLivePreview() {
  const [activeScreen, setActiveScreen] = useState<ScreenKey>("wallet");
  const [order, setOrder] = useState<number[]>([0, 1, 2]); // visual stack positions
  const [isPlaying, setIsPlaying] = useState(true);
  const [feed, setFeed] = useState(INITIAL_EVENTS);
  const [stampStep, setStampStep] = useState(0);
  const [tapAdded, setTapAdded] = useState(false);
  const [qrMode, setQrMode] = useState(false);
  const [qrRedeemed, setQrRedeemed] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<"all" | "stamps" | "rewards">("all");
  const [notificationsOn, setNotificationsOn] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(872); // 14:32

  // Top card in stack
  const topCardIdx = order[order.length - 1];
  const topCard = CARDS[topCardIdx] || CARDS[2];

  // Cycle cards
  const cycleCards = useCallback(() => {
    setOrder((prev) => {
      const next = [...prev];
      const first = next.shift()!;
      next.push(first);
      return next;
    });
  }, []);

  // Bring specific card forward on click
  const bringCardToFront = (idx: number) => {
    setIsPlaying(false);
    setOrder((prev) => {
      if (prev[prev.length - 1] === idx) return prev;
      const next = prev.filter((i) => i !== idx);
      next.push(idx);
      return next;
    });
  };

  // Timer for wallet cycle
  useEffect(() => {
    if (!isPlaying || activeScreen !== "wallet") return;
    const interval = setInterval(cycleCards, 2800);
    return () => clearInterval(interval);
  }, [isPlaying, activeScreen, cycleCards]);

  // Feed rotation
  useEffect(() => {
    const feedInterval = setInterval(() => {
      setFeed((prev) => {
        const next = [...prev];
        const last = next.pop()!;
        next.unshift(last);
        return next;
      });
    }, 5200);
    return () => clearInterval(feedInterval);
  }, []);

  // Stamp screen animation & resets on screen switch
  useEffect(() => {
    if (activeScreen !== "tap") {
      setTapAdded(false);
    }
    if (activeScreen !== "reward") {
      setQrRedeemed(false);
    }
    if (activeScreen === "stamp") {
      setStampStep(0);
      const timers = [
        setTimeout(() => setStampStep(1), 200),
        setTimeout(() => setStampStep(2), 350),
        setTimeout(() => setStampStep(3), 500),
        setTimeout(() => setStampStep(4), 650),
        setTimeout(() => setStampStep(5), 800),
      ];
      return () => timers.forEach(clearTimeout);
    }
  }, [activeScreen]);

  // QR countdown timer
  useEffect(() => {
    if (activeScreen === "reward" && qrMode && secondsLeft > 0) {
      const timer = setInterval(() => {
        setSecondsLeft((prev) => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [activeScreen, qrMode, secondsLeft]);

  const copy = SCREEN_COPY[activeScreen];

  // Card transform positions
  const getCardTransform = (pos: number) => {
    switch (pos) {
      case 0:
        return "translate(-72px, -124px) rotate(-14deg) scale(0.94)";
      case 1:
        return "translate(-24px, -96px) rotate(-6deg) scale(0.97)";
      case 2:
      default:
        return "translate(30px, -70px) rotate(6deg) scale(1)";
    }
  };

  const getCardZ = (pos: number) => pos + 1;

  // Filtered history list
  const filteredHistory = HISTORY_DATA.filter((item) => {
    if (historyFilter === "stamps") return item.type === "stamp";
    if (historyFilter === "rewards") return item.type === "reward";
    return true;
  });

  return (
    <section
      id="live-preview"
      className="relative overflow-hidden bg-[#08090B] border-t border-b border-white/[0.06] py-16 sm:py-24 text-white"
    >
      {/* Background glow highlights */}
      <div className="pointer-events-none absolute -top-40 left-1/4 size-[600px] rounded-full bg-[radial-gradient(circle,_rgba(91,141,239,0.1),_transparent_65%)]" />
      <div className="pointer-events-none absolute -bottom-40 right-10 size-[500px] rounded-full bg-[radial-gradient(circle,_rgba(232,93,69,0.06),_transparent_65%)]" />

      <div className="mx-auto max-w-7xl px-6">
        {/* Top Control Bar */}
        <div className="mb-12 flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.06] pb-6">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-[#F4F4F2] grid place-items-center shadow-sm">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E0F11" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 2v2M12 2v2M16 2v2M4 8h16v9a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Z" />
                <path d="M20 10h1a3 3 0 0 1 0 6h-1" />
              </svg>
            </div>
            <div>
              <div className="text-lg font-semibold tracking-tight leading-none text-white">
                Интерфейс гостя
              </div>
              <div className="text-[11px] font-mono text-ink-label uppercase tracking-widest mt-1">
                Telegram Mini App · интерактивное демо
              </div>
            </div>
          </div>

          {/* Screen Tabs from Stampy Mini App Screens */}
          <div className="flex flex-wrap gap-1.5 p-1 rounded-full bg-white/[0.04] border border-white/[0.08]">
            {(["wallet", "tap", "stamp", "reward", "history", "profile"] as const).map((key) => {
              const active = activeScreen === key;
              const labels: Record<ScreenKey, string> = {
                wallet: "Кошелёк",
                tap: "Касание",
                stamp: "Штамп",
                reward: "Награда",
                history: "История",
                profile: "Профиль",
              };
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveScreen(key)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-mono font-medium transition-all ${
                    active
                      ? "bg-[#F4F4F2] text-[#0E0F11] shadow-sm font-semibold"
                      : "text-ink-label hover:text-white hover:bg-white/[0.06]"
                  }`}
                >
                  {labels[key]}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3-Column Stage */}
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr_300px] gap-8 lg:gap-12 items-center">
          {/* Left Column: Caption and interactive stats */}
          <div className="order-2 lg:order-1 flex flex-col justify-center">
            <div className="text-[11px] font-mono uppercase tracking-widest text-[#7BA5FF] mb-3">
              {copy.kicker}
            </div>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white leading-tight mb-4">
              {copy.title}
            </h2>
            <p className="text-sm text-ink-body leading-relaxed mb-6">
              {copy.sub}
            </p>

            {/* Active Card Progress Box */}
            <div className="card p-4 flex flex-col gap-3.5 bg-surface-2/70 border-white/[0.06]">
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink-label font-medium">Активная карта</span>
                <span className="font-mono text-white font-semibold tracking-wider">
                  {topCard.title}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#5B8DEF] transition-all duration-700"
                  style={{ width: `${Math.round((topCard.count / topCard.total) * 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink-label">До награды</span>
                <span className="font-medium text-white">
                  {topCard.ready ? (
                    <span className="text-[#7BA5FF]">Готово к выдаче ✓</span>
                  ) : (
                    `${topCard.total - topCard.count} штампа`
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Center Column: Interactive Smartphone */}
          <div className="order-1 lg:order-2 relative flex justify-center py-4">
            {/* iPhone Frame */}
            <div className="relative w-[340px] sm:w-[360px] h-[720px] rounded-[52px] p-2.5 bg-[#1B1E27] shadow-[0_80px_160px_-40px_rgba(0,0,0,0.9),_0_0_0_1px_rgba(255,255,255,0.08),_inset_0_0_0_1px_rgba(255,255,255,0.04)]">
              {/* Dynamic Island / Notch */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-7 rounded-full bg-[#08090B] z-30" />

              {/* Internal Screen */}
              <div className="relative w-full h-full rounded-[44px] overflow-hidden bg-[#0E0F11] border border-white/[0.04] flex flex-col">
                {/* Status Bar */}
                <div className="h-12 pt-2 px-8 flex items-center justify-between text-xs font-semibold text-ink-body z-20">
                  <span>9:41</span>
                  <div className="flex items-center gap-1.5">
                    <svg width="14" height="10" viewBox="0 0 14 10" fill="#F4F4F2">
                      <rect x="0" y="6" width="2" height="4" rx=".5" />
                      <rect x="4" y="4" width="2" height="6" rx=".5" />
                      <rect x="8" y="2" width="2" height="8" rx=".5" />
                      <rect x="12" y="0" width="2" height="10" rx=".5" />
                    </svg>
                    <svg width="14" height="10" viewBox="0 0 14 10" fill="none" stroke="#F4F4F2" strokeWidth="1.2">
                      <rect x="1" y="1" width="10" height="8" rx="1.5" />
                      <rect x="2.5" y="2.5" width="5" height="5" rx=".5" fill="#F4F4F2" />
                    </svg>
                  </div>
                </div>

                {/* Content Container */}
                <div className="flex-1 relative overflow-hidden flex flex-col">
                  {/* SCREEN 1: WALLET (Screen 05 from design) */}
                  {activeScreen === "wallet" && (
                    <div className="p-6 pt-3 flex flex-col h-full animate-rise">
                      <div className="text-2xl font-bold tracking-tight text-white mb-0.5">
                        Мои карты
                      </div>
                      <div className="text-xs text-ink-label mb-6">
                        3 кофейни · <span className="text-[#7BA5FF] font-medium">1 награда готова</span>
                      </div>

                      {/* Animated Fan Stack */}
                      <div className="relative h-[340px] flex items-center justify-center select-none">
                        {CARDS.map((card, idx) => {
                          const pos = order.indexOf(idx);
                          return (
                            <div
                              key={card.id}
                              onClick={() => bringCardToFront(idx)}
                              style={{
                                background: card.bg,
                                transform: getCardTransform(pos),
                                zIndex: getCardZ(pos),
                              }}
                              className="w-card cursor-pointer transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] absolute w-[240px] h-[155px] rounded-[20px] p-4 flex flex-col justify-between shadow-[0_20px_40px_-12px_rgba(0,0,0,0.55)] hover:brightness-105"
                            >
                              <div
                                style={{ color: card.subColor }}
                                className="font-mono text-[9px] uppercase tracking-widest font-semibold"
                              >
                                {card.name}
                              </div>
                              <div>
                                <div
                                  style={{ color: card.textColor }}
                                  className="text-xl font-bold tracking-tight"
                                >
                                  {card.count} / {card.total}
                                </div>
                                <div
                                  style={{ color: card.subColor }}
                                  className="text-[10px] mt-0.5"
                                >
                                  {card.sub}
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {/* Glass Front Pouch */}
                        <div
                          style={{ zIndex: 4, transform: "translate(0, 48px) scale(1.02)" }}
                          className="absolute w-[280px] h-[190px] rounded-[24px] bg-[#14161D]/80 backdrop-blur-2xl border border-white/15 p-4 shadow-[0_30px_60px_-14px_rgba(0,0,0,0.8)] flex flex-col justify-between"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-mono text-[9px] text-ink-label uppercase tracking-widest mb-0.5">
                                {topCard.title}
                              </div>
                              <div className="text-sm font-semibold tracking-tight text-white">
                                {topCard.ready ? "Награда готова" : "Активная карта"}
                              </div>
                            </div>
                            <div className="size-7 rounded-full bg-white/[0.08] border border-white/10 grid place-items-center text-white">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <path d="M5 12h14M13 5l7 7-7 7" />
                              </svg>
                            </div>
                          </div>

                          {/* Stamps dots */}
                          <div className="grid grid-cols-6 gap-1.5 my-1">
                            {Array.from({ length: topCard.total }).map((_, i) => (
                              <div
                                key={i}
                                className={`aspect-square rounded-full border transition-all duration-300 ${
                                  i < topCard.count
                                    ? "bg-[#5B8DEF] border-[#5B8DEF] shadow-sm shadow-[#5B8DEF]/30 scale-100"
                                    : "border-white/15 bg-white/[0.02]"
                                }`}
                              />
                            ))}
                          </div>

                          <div className="flex items-end justify-between">
                            <div>
                              <div className="text-2xl font-bold tracking-tight text-white leading-none">
                                {topCard.ready ? `★ ${topCard.count} / ${topCard.total}` : `${topCard.count} / ${topCard.total}`}
                              </div>
                              <div className="text-[10px] text-ink-label mt-1 truncate max-w-[160px]">
                                {topCard.hint}
                              </div>
                            </div>

                            {topCard.ready ? (
                              <button
                                type="button"
                                onClick={() => setActiveScreen("reward")}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#5B8DEF]/20 border border-[#5B8DEF]/35 text-[10px] font-semibold text-[#7BA5FF] hover:bg-[#5B8DEF]/30 transition-all"
                              >
                                Получить QR →
                              </button>
                            ) : (
                              <div className="text-[10px] text-ink-faint font-mono">
                                ещё {topCard.total - topCard.count}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SCREEN 2: TAP & BOTTOM SHEET POPUP (Screen 03 & 04 from design) */}
                  {activeScreen === "tap" && (
                    <div className="relative flex flex-col h-full animate-rise overflow-hidden">
                      {!tapAdded ? (
                        <>
                          {/* Background: Ghost wallet cards behind the sheet */}
                          <div className="p-6 pt-3 flex flex-col opacity-25 filter blur-[2px] select-none pointer-events-none">
                            <div className="text-2xl font-bold tracking-tight text-white mb-0.5">
                              Мои карты
                            </div>
                            <div className="text-xs text-ink-label mb-6">
                              3 кофейни · 1 награда готова
                            </div>
                            <div className="w-full h-28 rounded-2xl bg-gradient-to-br from-[#7BA5FF]/40 to-[#4A7DE0]/20 p-4 mb-3 border border-white/10" />
                            <div className="w-full h-28 rounded-2xl bg-gradient-to-br from-[#E85D45]/40 to-[#C43A22]/20 p-4 border border-white/10" />
                          </div>

                          {/* Backdrop dim */}
                          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />

                          {/* NFC Bottom Sheet Window (Screen 03) */}
                          <div className="absolute inset-x-0 bottom-0 rounded-t-[32px] bg-[#14161D] border-t border-white/15 p-6 pb-5 flex flex-col shadow-[0_-20px_60px_rgba(0,0,0,0.85)] animate-rise">
                            {/* Sheet Handle */}
                            <div className="w-10 h-1 rounded-full bg-white/25 mx-auto mb-3.5" />

                            {/* Detection Badge */}
                            <div className="flex items-center justify-between mb-3">
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#5B8DEF]/15 border border-[#5B8DEF]/30 text-[#7BA5FF] text-[10px] font-mono uppercase tracking-wider font-semibold">
                                <span className="size-1.5 rounded-full bg-[#5B8DEF] animate-pulse" />
                                Метка найдена · Касса #04
                              </div>
                              <span className="text-[10px] font-mono text-ink-label">NFC tap</span>
                            </div>

                            {/* Cafe Info */}
                            <div className="mb-4">
                              <h3 className="text-2xl font-bold tracking-tight text-white leading-tight">
                                Обжарка №7
                              </h3>
                              <p className="text-xs text-ink-label mt-0.5 flex items-center gap-1">
                                <span>ул. Шота Руставели, 47</span>
                                <span>·</span>
                                <span>Yakkasaray</span>
                              </p>
                            </div>

                            {/* Preview Card */}
                            <div className="relative w-full aspect-[1.6/1] rounded-2xl bg-gradient-to-br from-[#F4B94A] to-[#E89728] p-4 text-[#14100C] shadow-[0_24px_48px_-16px_rgba(232,151,40,0.45)] flex flex-col justify-between mb-5 select-none float">
                              <div className="flex justify-between items-start">
                                <div className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#14100C]">
                                  ОБЖАРКА №7
                                </div>
                                <span className="text-[9px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/15 text-[#14100C]">
                                  Новая карта
                                </span>
                              </div>

                              <div>
                                <div className="text-2xl font-extrabold tracking-tight leading-none text-[#14100C]">
                                  6 напитков
                                </div>
                                <div className="text-xs font-semibold text-[#14100C] mt-1">
                                  7-й капучино — за счёт заведения
                                </div>
                              </div>

                              {/* 6 Stamp dots preview */}
                              <div className="grid grid-cols-6 gap-1.5 pt-2 border-t border-black/10">
                                {Array.from({ length: 6 }).map((_, i) => (
                                  <div
                                    key={i}
                                    className={`aspect-square rounded-full flex items-center justify-center transition-all ${
                                      i === 0
                                        ? "bg-[#14100C] text-[#F4B94A] shadow-sm font-bold text-[9px]"
                                        : "border border-black/25 bg-black/5"
                                    }`}
                                  >
                                    {i === 0 ? "★" : ""}
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Action CTA */}
                            <div className="flex flex-col gap-2 mt-auto">
                              <button
                                type="button"
                                onClick={() => setTapAdded(true)}
                                className="w-full py-3.5 rounded-full text-xs font-semibold tracking-wide transition-all shadow-md bg-[#F4F4F2] text-[#0E0F11] hover:bg-white active:scale-[0.98]"
                              >
                                Добавить в кошелёк
                              </button>
                              <button
                                type="button"
                                onClick={() => setActiveScreen("wallet")}
                                className="text-[11px] text-ink-label hover:text-white text-center py-1 transition-colors"
                              >
                                Не сейчас
                              </button>
                            </div>
                          </div>
                        </>
                      ) : (
                        /* Screen 04: Card added celebration */
                        <div className="p-6 pt-4 flex flex-col h-full justify-between items-center text-center animate-rise">
                          <div className="relative size-44 mt-8 flex items-center justify-center">
                            <div className="ring" />
                            <div className="ring d2" />
                            <div className="size-20 rounded-full bg-[#5B8DEF] grid place-items-center glow shadow-[0_20px_50px_-10px_rgba(91,141,239,0.6)] z-10">
                              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#0E1424" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 6L9 17l-5-5" />
                              </svg>
                            </div>
                          </div>

                          <div className="my-auto">
                            <h3 className="text-2xl font-bold tracking-tight text-white mb-2">
                              Готово
                            </h3>
                            <p className="text-xs text-ink-label leading-relaxed max-w-[220px] mx-auto">
                              Карта Обжарка №7 в вашем кошельке. Первый штамп уже начислен.
                            </p>

                            <div className="mt-6 p-3.5 rounded-2xl bg-[#5B8DEF]/10 border border-[#5B8DEF]/25 flex items-center gap-3 text-left">
                              <div className="size-9 rounded-xl bg-gradient-to-br from-[#F4B94A] to-[#E89728] shrink-0" />
                              <div>
                                <div className="text-xs font-semibold text-white">+1 штамп</div>
                                <div className="text-[11px] text-ink-label mt-0.5">Обжарка №7 · 1 / 6</div>
                              </div>
                            </div>
                          </div>

                          <div className="w-full flex flex-col gap-2 mb-2">
                            <button
                              type="button"
                              onClick={() => setActiveScreen("wallet")}
                              className="w-full py-3.5 rounded-full text-xs font-semibold tracking-wide bg-[#F4F4F2] text-[#0E0F11] hover:bg-white"
                            >
                              К кошельку
                            </button>
                            <button
                              type="button"
                              onClick={() => setTapAdded(false)}
                              className="text-[11px] text-ink-label hover:text-white py-1"
                            >
                              Повторить касание
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* SCREEN 3: STAMP (Screen 07 from design) */}
                  {activeScreen === "stamp" && (
                    <div className="p-6 pt-3 flex flex-col h-full animate-rise">
                      <div className="text-[11px] font-mono uppercase tracking-widest text-[#7BA5FF] mb-1 glow">
                        +1 штамп · только что
                      </div>
                      <div className="text-2xl font-bold tracking-tight text-white mb-0.5">
                        Пекарня у дома
                      </div>
                      <div className="text-xs text-ink-label mb-4">
                        Флэт уайт · <span className="text-white font-medium">28 000 сум</span>
                      </div>

                      {/* Stamp card */}
                      <div className="p-5 rounded-3xl bg-gradient-to-br from-[#E85D45] to-[#C43A22] text-white shadow-xl shadow-[#C43A22]/30">
                        <div className="flex justify-between items-start mb-6">
                          <span className="font-mono text-[10px] tracking-widest uppercase font-bold text-ink-body">
                            ПЕКАРНЯ У ДОМА
                          </span>
                          <span className="text-xs text-ink-body">карта №0142</span>
                        </div>
                        <div className="text-4xl font-extrabold tracking-tight leading-none mb-1">
                          5 / 6
                        </div>
                        <div className="text-xs text-ink-body">остался 1 штамп до кофе</div>

                        {/* Animated Grid */}
                        <div className="grid grid-cols-6 gap-2 mt-5">
                          {Array.from({ length: 6 }).map((_, i) => (
                            <div
                              key={i}
                              className={`aspect-square rounded-full border transition-all duration-500 ${
                                i < stampStep
                                  ? "bg-white border-white scale-100 shadow-sm"
                                  : "border-white/30 bg-black/10 scale-90"
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="mt-4 p-4 rounded-2xl bg-[#5B8DEF]/10 border border-[#5B8DEF]/20">
                        <div className="text-xs font-semibold text-white">
                          Ещё один — и капучино за счёт заведения!
                        </div>
                        <div className="text-[11px] text-ink-label mt-1">
                          Обычно вы возвращаетесь через 3 дня.
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setStampStep(0);
                          setTimeout(() => setStampStep(1), 150);
                          setTimeout(() => setStampStep(2), 300);
                          setTimeout(() => setStampStep(3), 450);
                          setTimeout(() => setStampStep(4), 600);
                          setTimeout(() => setStampStep(5), 750);
                        }}
                        className="mt-auto mb-2 text-center text-xs text-[#7BA5FF] hover:underline font-mono py-2"
                      >
                        ↻ Повторить анимацию начисления
                      </button>
                    </div>
                  )}

                  {/* SCREEN 4: REWARD & QR CODE (Screen 08 & 09 from design) */}
                  {activeScreen === "reward" && (
                    <div className="p-6 pt-3 flex flex-col h-full animate-rise">
                      {!qrMode ? (
                        /* Screen 08: Reward ready */
                        <>
                          <div className="text-[11px] font-mono uppercase tracking-widest text-[#F4B94A] font-semibold mb-1 glow">
                            НАГРАДА ГОТОВА
                          </div>
                          <div className="text-2xl font-bold tracking-tight text-white mb-0.5">
                            Обжарка №7 · капучино
                          </div>
                          <div className="text-xs text-ink-label mb-4">
                            Покажите баристе на кассе
                          </div>

                          <div className="relative w-full aspect-[1.55/1] rounded-2xl bg-gradient-to-br from-[#F4B94A] to-[#E89728] p-5 text-[#14100C] shadow-[0_30px_60px_-20px_rgba(232,151,40,0.6)] overflow-hidden float">
                            <div className="shimmer-sweep" />
                            <div className="relative flex justify-between items-start">
                              <div className="font-mono text-[10px] uppercase tracking-widest text-[#14100C] font-semibold">
                                ОБЖАРКА №7 · REWARD
                              </div>
                              <div className="font-bold text-[#14100C]">★</div>
                            </div>
                            <div className="relative mt-auto">
                              <div className="text-3xl font-extrabold tracking-tight leading-none text-[#14100C]">
                                Капучино
                              </div>
                              <div className="text-xs font-semibold text-[#14100C] mt-1">
                                за счёт заведения
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-xs text-ink-label leading-relaxed">
                            Действует в любой кофейне Обжарка №7. Бариста отсканирует ваш персональный одноразовый QR-код.
                          </div>

                          <div className="mt-auto mb-2">
                            <button
                              type="button"
                              onClick={() => setQrMode(true)}
                              className="w-full py-3.5 rounded-full text-xs font-semibold tracking-wide bg-[#F4F4F2] text-[#0E0F11] hover:bg-white transition-all shadow-md"
                            >
                              Показать QR для списания
                            </button>
                          </div>
                        </>
                      ) : (
                        /* Screen 09: QR code laser scan */
                        <>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-mono uppercase tracking-widest text-[#F4B94A] font-semibold glow">
                              КОД ДЛЯ БАРИСТА
                            </span>
                            <button
                              type="button"
                              onClick={() => setQrMode(false)}
                              className="text-[10px] font-mono text-ink-label hover:text-white"
                            >
                              ‹ Назад
                            </button>
                          </div>
                          <div className="text-2xl font-bold tracking-tight text-white mb-0.5">
                            Обжарка №7 · капучино
                          </div>
                          <div className="text-xs text-ink-label mb-3">
                            Одноразовый код списания
                          </div>

                          {/* White QR ticket with laser scan */}
                          <div className="relative p-4 rounded-3xl bg-[#FAFAF9] text-[#0E0F11] shadow-2xl overflow-hidden">
                            <div className="qr-scan" />

                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <div className="font-mono text-[9px] uppercase tracking-widest text-carbon-label font-semibold">
                                  STAMPY · REWARD
                                </div>
                                <div className="text-base font-bold tracking-tight text-carbon mt-0.5">
                                  SFM · 6F42A
                                </div>
                              </div>
                              <div className="size-8 rounded-lg bg-gradient-to-br from-[#F4B94A] to-[#E89728]" />
                            </div>

                            {/* Stylized QR */}
                            <div className="w-full aspect-square rounded-xl bg-carbon/5 border border-carbon/10 p-3 relative flex items-center justify-center">
                              <div className="size-32 bg-[#0E0F11] rounded-lg p-2 flex flex-wrap gap-1 items-center justify-center opacity-90">
                                <div className="size-6 rounded border-2 border-white grid place-items-center"><div className="size-2 bg-white rounded-xs" /></div>
                                <div className="size-6 rounded border-2 border-white grid place-items-center ml-auto"><div className="size-2 bg-white rounded-xs" /></div>
                                <div className="w-full h-6 flex items-center justify-around">
                                  <div className="size-1.5 bg-white rounded-xs" />
                                  <div className="size-2 bg-white rounded-xs" />
                                  <div className="size-1.5 bg-white rounded-xs" />
                                </div>
                                <div className="size-6 rounded border-2 border-white grid place-items-center mr-auto"><div className="size-2 bg-white rounded-xs" /></div>
                              </div>
                            </div>

                            <div className="text-center font-mono text-[10px] text-carbon-label tracking-widest mt-2 font-semibold">
                              {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")} ДО ИСТЕЧЕНИЯ
                            </div>
                          </div>

                          <div className="mt-auto mb-2 flex flex-col gap-2">
                            <button
                              type="button"
                              onClick={() => setQrRedeemed(true)}
                              className={`w-full py-3.5 rounded-full text-xs font-semibold tracking-wide transition-all shadow-md ${
                                qrRedeemed
                                  ? "bg-[#5B8DEF] text-white shadow-[#5B8DEF]/30"
                                  : "bg-[#F4F4F2] text-[#0E0F11] hover:bg-white"
                              }`}
                            >
                              {qrRedeemed ? "✓ Награда успешно списана" : "Списать на кассе"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setQrMode(false)}
                              className="text-[11px] text-ink-label hover:text-white text-center py-0.5"
                            >
                              Закрыть QR
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* SCREEN 5: HISTORY (Screen 10 from design) */}
                  {activeScreen === "history" && (
                    <div className="p-6 pt-3 flex flex-col h-full animate-rise">
                      <div className="text-2xl font-bold tracking-tight text-white mb-0.5">
                        История
                      </div>
                      <div className="text-xs text-ink-label mb-3">
                        42 штампа · 3 награды за месяц
                      </div>

                      {/* Filter pills */}
                      <div className="flex gap-1.5 mb-4">
                        {(["all", "stamps", "rewards"] as const).map((filter) => {
                          const labels = { all: "Все", stamps: "Штампы", rewards: "Награды" };
                          const active = historyFilter === filter;
                          return (
                            <button
                              key={filter}
                              type="button"
                              onClick={() => setHistoryFilter(filter)}
                              className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all ${
                                active
                                  ? "bg-[#F4F4F2] text-[#0E0F11] font-semibold"
                                  : "bg-white/[0.04] border border-white/[0.08] text-ink-label hover:text-white"
                              }`}
                            >
                              {labels[filter]}
                            </button>
                          );
                        })}
                      </div>

                      {/* History list */}
                      <div className="flex flex-col gap-2 overflow-y-auto max-h-[380px] pr-1">
                        <div className="font-mono text-[9px] uppercase tracking-widest text-ink-label">
                          СЕГОДНЯ
                        </div>
                        {filteredHistory
                          .filter((i) => i.day === "today")
                          .map((item) => (
                            <div
                              key={item.id}
                              className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center gap-3"
                            >
                              <div
                                className="size-8 rounded-xl shrink-0"
                                style={{ background: item.color }}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold text-white truncate">
                                  {item.title} · {item.cafe}
                                </div>
                                <div className="text-[10px] text-ink-label mt-0.5">
                                  {item.item} · {item.time}
                                </div>
                              </div>
                              <div className="font-mono text-xs text-ink-label font-semibold">
                                {item.count}
                              </div>
                            </div>
                          ))}

                        <div className="font-mono text-[9px] uppercase tracking-widest text-ink-label mt-2">
                          ВЧЕРА
                        </div>
                        {filteredHistory
                          .filter((i) => i.day === "yesterday")
                          .map((item) => (
                            <div
                              key={item.id}
                              className={`p-3 rounded-2xl flex items-center gap-3 ${
                                item.type === "reward"
                                  ? "bg-[#F4B94A]/10 border border-[#F4B94A]/25"
                                  : "bg-white/[0.03] border border-white/[0.06]"
                              }`}
                            >
                              <div
                                className="size-8 rounded-xl shrink-0 grid place-items-center font-bold text-xs"
                                style={{ background: item.color, color: item.type === "reward" ? "#14100C" : "#FFFFFF" }}
                              >
                                {item.type === "reward" ? "★" : ""}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold text-white truncate">
                                  {item.title} · {item.cafe}
                                </div>
                                <div className="text-[10px] text-ink-label mt-0.5">
                                  {item.item} · {item.time}
                                </div>
                              </div>
                              <div
                                className={`font-mono text-xs font-semibold ${
                                  item.type === "reward" ? "text-[#F4B94A]" : "text-ink-label"
                                }`}
                              >
                                {item.count}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* SCREEN 6: PROFILE (Screen 11 from design) */}
                  {activeScreen === "profile" && (
                    <div className="p-6 pt-3 flex flex-col h-full animate-rise">
                      <div className="text-2xl font-bold tracking-tight text-white mb-3">
                        Профиль
                      </div>

                      {/* User card */}
                      <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center gap-3.5 mb-4">
                        <div className="size-12 rounded-full bg-gradient-to-br from-[#5B8DEF] to-[#4A7DE0] grid place-items-center text-base font-bold text-white shadow-md">
                          Т
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-white">Тимур Р.</div>
                          <div className="text-xs text-ink-label mt-0.5">@timur_r · с марта 2025</div>
                        </div>
                      </div>

                      {/* 3 KPI stats */}
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center">
                          <div className="text-xl font-bold text-white">4</div>
                          <div className="text-[10px] text-ink-label mt-0.5 font-mono">карты</div>
                        </div>
                        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center">
                          <div className="text-xl font-bold text-white">42</div>
                          <div className="text-[10px] text-ink-label mt-0.5 font-mono">штампа</div>
                        </div>
                        <div className="p-3 rounded-xl bg-[#F4B94A]/10 border border-[#F4B94A]/20 text-center">
                          <div className="text-xl font-bold text-[#F4B94A]">3</div>
                          <div className="text-[10px] text-[#F4B94A] mt-0.5 font-mono">награды</div>
                        </div>
                      </div>

                      {/* Settings menu */}
                      <div className="flex flex-col divide-y divide-white/[0.06] text-xs">
                        <div className="py-3 flex items-center justify-between">
                          <span className="text-white">Уведомления о штампах</span>
                          <button
                            type="button"
                            onClick={() => setNotificationsOn(!notificationsOn)}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-mono transition-colors ${
                              notificationsOn
                                ? "bg-[#5B8DEF]/20 text-[#7BA5FF] border border-[#5B8DEF]/30 font-semibold"
                                : "bg-white/[0.04] text-ink-label"
                            }`}
                          >
                            {notificationsOn ? "Включены ✓" : "Выключены"}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveScreen("history")}
                          className="py-3 flex items-center justify-between text-left hover:text-[#5B8DEF] transition-colors"
                        >
                          <span className="text-white">История заказов</span>
                          <span className="text-ink-label">42 записи ›</span>
                        </button>
                        <div className="py-3 flex items-center justify-between text-ink-label">
                          <span>Версия приложения</span>
                          <span className="font-mono text-[10px]">v1.4.2 · prod</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Navigation inside Phone Frame */}
                <div className="h-12 border-t border-white/[0.06] bg-[#0E0F11]/90 backdrop-blur-md px-4 flex items-center justify-around z-20">
                  <button
                    type="button"
                    onClick={() => setActiveScreen("wallet")}
                    className={`flex flex-col items-center gap-0.5 text-[9px] font-mono transition-colors ${
                      activeScreen === "wallet" ? "text-[#5B8DEF] font-bold" : "text-ink-label hover:text-white"
                    }`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="5" width="20" height="14" rx="3" />
                      <line x1="2" y1="10" x2="22" y2="10" />
                    </svg>
                    <span>Карты</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveScreen("tap")}
                    className={`flex flex-col items-center gap-0.5 text-[9px] font-mono transition-colors ${
                      activeScreen === "tap" ? "text-[#5B8DEF] font-bold" : "text-ink-label hover:text-white"
                    }`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 8.05a10 10 0 0 1 15.9 0" />
                      <path d="M7 11.5a6 6 0 0 1 10 0" />
                      <path d="M10 14.5a2 2 0 0 1 4 0" />
                    </svg>
                    <span>Вход</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveScreen("stamp")}
                    className={`flex flex-col items-center gap-0.5 text-[9px] font-mono transition-colors ${
                      activeScreen === "stamp" ? "text-[#5B8DEF] font-bold" : "text-ink-label hover:text-white"
                    }`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 8v8M8 12h8" />
                    </svg>
                    <span>Штамп</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveScreen("reward")}
                    className={`flex flex-col items-center gap-0.5 text-[9px] font-mono transition-colors ${
                      activeScreen === "reward" ? "text-[#5B8DEF] font-bold" : "text-ink-label hover:text-white"
                    }`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                    <span>Награда</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveScreen("profile")}
                    className={`flex flex-col items-center gap-0.5 text-[9px] font-mono transition-colors ${
                      activeScreen === "profile" ? "text-[#5B8DEF] font-bold" : "text-ink-label hover:text-white"
                    }`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    <span>Профиль</span>
                  </button>
                </div>

                {/* Home bar */}
                <div className="h-3 flex items-center justify-center pb-1">
                  <div className="w-28 h-1 rounded-full bg-white/40" />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Activity Feed */}
          <div className="order-3 flex flex-col justify-center">
            <div className="text-[11px] font-mono uppercase tracking-widest text-ink-label mb-2">
              События в реальном времени
            </div>
            <div className="text-4xl font-bold tracking-tight text-white leading-none mb-1">
              142
            </div>
            <div className="text-xs text-ink-label mb-6">
              начислений и наград по всем кофейням сети
            </div>

            {/* Live Feed List */}
            <div className="flex flex-col gap-2.5">
              {feed.slice(0, 4).map((item, i) => (
                <div
                  key={`${item.name}-${i}`}
                  className="card p-3 flex items-center gap-3 bg-surface-2/60 border-white/[0.06] transition-all"
                >
                  <div
                    className="size-8 rounded-lg flex-shrink-0 grid place-items-center font-bold text-xs text-white"
                    style={{ background: `linear-gradient(160deg, ${item.color}, rgba(0,0,0,0.4))` }}
                  >
                    {item.c[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-white truncate">
                      {item.k} · {item.c}
                    </div>
                    <div className="text-[10px] text-ink-faint mt-0.5">
                      {item.name} · {item.t} назад
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Play/Pause Button */}
            <div className="mt-6 flex items-center justify-between pt-4 border-t border-white/[0.06]">
              <span className="text-[11px] text-ink-faint">
                {isPlaying ? "Автопоказ каждые 2.8 сек" : "Автопоказ на паузе"}
              </span>
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className="btn btn-ghost btn-sm text-xs font-mono"
              >
                {isPlaying ? (
                  <>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
                    Пауза
                  </>
                ) : (
                  <>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                    Авто
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Cafe Names Ticker (seamless infinite running ticker) */}
        <div className="mt-16 pt-6 pb-2 border-t border-white/[0.06] overflow-hidden">
          <div className="ticker-track flex items-center text-sm font-medium text-ink-faint whitespace-nowrap">
            <div className="flex items-center gap-12 pr-12">
              <span>Обжарка №7</span>
              <span className="font-mono uppercase tracking-widest text-xs">ПЕКАРНЯ У ДОМА</span>
              <span className="italic font-normal">Кофейня на Навои Roasters</span>
              <span className="font-semibold tracking-tight">Nur Café</span>
              <span className="font-mono text-xs">Milk &amp; Honey</span>
              <span className="tracking-wide">Cezve Coffee</span>
              <span>Kofema</span>
              <span className="font-mono uppercase tracking-widest text-xs">BONJUR</span>
            </div>
            <div className="flex items-center gap-12 pr-12" aria-hidden="true">
              <span>Обжарка №7</span>
              <span className="font-mono uppercase tracking-widest text-xs">ПЕКАРНЯ У ДОМА</span>
              <span className="italic font-normal">Кофейня на Навои Roasters</span>
              <span className="font-semibold tracking-tight">Nur Café</span>
              <span className="font-mono text-xs">Milk &amp; Honey</span>
              <span className="tracking-wide">Cezve Coffee</span>
              <span>Kofema</span>
              <span className="font-mono uppercase tracking-widest text-xs">BONJUR</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
