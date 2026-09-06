import Link from "next/link";

export const dynamic = "force-static";

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-[#08090B] text-[#F4F4F2] font-sans selection:bg-[#5B8DEF]/30 selection:text-white antialiased">
      {/* ============ HEADER ============ */}
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#08090B]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="size-8 rounded-[9px] bg-[#F4F4F2] grid place-items-center shadow-[0_8px_20px_-8px_rgba(255,255,255,0.15)]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0E0F11" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 2v2M12 2v2M16 2v2M4 8h16v9a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Z" />
                <path d="M20 10h1a3 3 0 0 1 0 6h-1" />
              </svg>
            </div>
            <span className="font-semibold text-base tracking-tight text-white">Stampy</span>
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-xs text-[#F4F4F2]/60 font-medium">
            <a href="#how" className="hover:text-[#5B8DEF] transition-colors">Как это работает</a>
            <a href="#guests" className="hover:text-[#5B8DEF] transition-colors">Гостям</a>
            <a href="#cafes" className="hover:text-[#5B8DEF] transition-colors">Кофейням</a>
            <a href="#pricing" className="hover:text-[#5B8DEF] transition-colors">Тарифы</a>
            <a href="#faq" className="hover:text-[#5B8DEF] transition-colors">Вопросы</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-xs font-medium text-[#F4F4F2]/70 hover:text-white px-3 py-1.5 transition-colors"
            >
              Войти
            </Link>
            <Link
              href="/apply"
              className="rounded-full bg-[#F4F4F2] px-4 py-2 text-xs font-semibold text-[#0E0F11] hover:bg-white hover:scale-[1.02] active:scale-[0.98] transition-all shadow-sm"
            >
              Подключить
            </Link>
          </div>
        </div>
      </header>

      {/* ============ HERO SECTION ============ */}
      <section className="relative overflow-hidden bg-[#0E0F11] border-b border-white/[0.06]">
        {/* Glow background */}
        <div className="pointer-events-none absolute -top-48 -right-48 size-[800px] rounded-full bg-[radial-gradient(circle,_rgba(91,141,239,0.12),_transparent_65%)]" />

        <div className="mx-auto max-w-7xl px-6 py-20 lg:py-28 grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#5B8DEF]/25 bg-[#5B8DEF]/10 px-3 py-1 text-[11px] font-mono uppercase tracking-widest text-[#7BA5FF] mb-8">
              <span className="size-1.5 rounded-full bg-[#5B8DEF]" />
              Для владельцев кофеен
            </div>

            <h1 className="text-4xl sm:text-6xl lg:text-[68px] font-semibold tracking-[-0.04em] leading-[1.05] text-white">
              Программа лояльности — за одно касание.
            </h1>

            <p className="mt-6 text-base sm:text-lg text-[#F4F4F2]/70 leading-relaxed max-w-xl">
              Без пластиковых карт, без приложений, без установки. Метка на стойке — и постоянные гости в Telegram.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/apply"
                className="rounded-full bg-[#F4F4F2] px-6 py-3.5 text-sm font-semibold text-[#0E0F11] hover:bg-white hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg"
              >
                Подключить кофейню
              </Link>
              <a
                href="#how"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-transparent px-6 py-3.5 text-sm font-medium text-[#F4F4F2] hover:bg-white/5 transition-all"
              >
                Как это работает
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </a>
            </div>

            {/* Metrics */}
            <div className="mt-14 pt-8 border-t border-white/[0.06] grid grid-cols-3 gap-6 max-w-lg">
              <div>
                <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
                  +38<span className="text-[#F4F4F2]/50">%</span>
                </div>
                <div className="mt-1 text-xs text-[#F4F4F2]/50 font-medium">возвратов гостей</div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
                  14<span className="text-sm sm:text-base text-[#F4F4F2]/50"> сек</span>
                </div>
                <div className="mt-1 text-xs text-[#F4F4F2]/50 font-medium">на первую карту</div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
                  0<span className="text-sm sm:text-base text-[#F4F4F2]/50"> ₸</span>
                </div>
                <div className="mt-1 text-xs text-[#F4F4F2]/50 font-medium">за пластик</div>
              </div>
            </div>
          </div>

          {/* Phone Mockup */}
          <div className="flex justify-center lg:justify-end">
            <div className="w-full max-w-[340px] rounded-[44px] p-2 bg-[#1B1E27] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8),_0_0_0_1px_rgba(255,255,255,0.06)]">
              <div className="rounded-[36px] overflow-hidden bg-[#0E0F11] p-5 pt-8 relative border border-white/[0.04]">
                <div className="flex justify-between items-center mb-6 px-1">
                  <div>
                    <div className="text-xl font-semibold tracking-tight">Кошелёк</div>
                    <div className="text-xs text-[#F4F4F2]/40 mt-0.5">4 кофейни · 1 награда</div>
                  </div>
                </div>

                {/* Card 1 - Ready */}
                <div className="rounded-[22px] bg-gradient-to-br from-[#17223B] to-[#0E1424] border border-[#5B8DEF]/30 p-4 mb-3 relative overflow-hidden shadow-[0_20px_40px_-20px_rgba(91,141,239,0.3)]">
                  <div className="absolute -top-10 -right-10 size-32 rounded-full bg-[radial-gradient(circle,_rgba(91,141,239,0.25),_transparent_65%)]" />
                  <div className="flex justify-between items-start mb-3.5 relative">
                    <div>
                      <div className="text-[10px] text-[#7BA5FF] font-mono uppercase tracking-wider mb-1 font-medium">Sfumato</div>
                      <div className="text-sm font-semibold tracking-tight text-white">Капучино в подарок</div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-[#5B8DEF] text-[#0E1424] text-[9px] font-bold uppercase tracking-wider">
                      Готова
                    </span>
                  </div>
                  <div className="grid grid-cols-7 gap-1.5 relative">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="aspect-square rounded-full bg-[#5B8DEF] grid place-items-center">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0E1424" strokeWidth="3" strokeLinecap="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      </div>
                    ))}
                    <div className="aspect-square rounded-full bg-[#5B8DEF] shadow-[0_0_0_2px_rgba(91,141,239,0.4)] grid place-items-center">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="#0E1424" stroke="#0E1424" strokeWidth="1">
                        <polygon points="12 2 15 8.5 22 9.5 17 14.5 18.2 21.5 12 18 5.8 21.5 7 14.5 2 9.5 9 8.5 12 2" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Card 2 - In progress */}
                <div className="rounded-[22px] bg-gradient-to-br from-[#1B1E27] to-[#14161D] border border-white/[0.08] p-4 mb-3">
                  <div className="flex justify-between items-start mb-3.5">
                    <div>
                      <div className="text-[10px] text-[#F4F4F2]/40 font-mono uppercase tracking-wider mb-1">Chinor</div>
                      <div className="text-sm font-semibold tracking-tight text-white">
                        4 <span className="text-[#F4F4F2]/40 font-normal">/ 6</span>
                      </div>
                    </div>
                    <div className="text-xs text-[#F4F4F2]/60">осталось 2</div>
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="aspect-square rounded-full bg-[#5B8DEF] grid place-items-center">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0E1424" strokeWidth="3" strokeLinecap="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      </div>
                    ))}
                    <div className="aspect-square rounded-full border border-white/15" />
                    <div className="aspect-square rounded-full border border-white/15" />
                    <div className="aspect-square rounded-full border border-dashed border-[#5B8DEF]/40" />
                  </div>
                </div>

                {/* Card 3 - In progress */}
                <div className="rounded-[22px] bg-gradient-to-br from-[#1B1E27] to-[#14161D] border border-white/[0.08] p-4 opacity-90">
                  <div className="flex justify-between items-start mb-3.5">
                    <div>
                      <div className="text-[10px] text-[#F4F4F2]/40 font-mono uppercase tracking-wider mb-1">Broadway Roasters</div>
                      <div className="text-sm font-semibold tracking-tight text-white">
                        2 <span className="text-[#F4F4F2]/40 font-normal">/ 6</span>
                      </div>
                    </div>
                    <div className="text-xs text-[#F4F4F2]/60">осталось 4</div>
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {[1, 2].map((i) => (
                      <div key={i} className="aspect-square rounded-full bg-[#5B8DEF] grid place-items-center">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0E1424" strokeWidth="3" strokeLinecap="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      </div>
                    ))}
                    <div className="aspect-square rounded-full border border-white/15" />
                    <div className="aspect-square rounded-full border border-white/15" />
                    <div className="aspect-square rounded-full border border-white/15" />
                    <div className="aspect-square rounded-full border border-white/15" />
                    <div className="aspect-square rounded-full border border-dashed border-[#5B8DEF]/40" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Partners Bar */}
        <div className="border-t border-white/[0.06] px-6 py-6 max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-6">
          <div className="text-[11px] font-mono uppercase tracking-widest text-[#F4F4F2]/40 font-medium">
            Работают в Ташкенте
          </div>
          <div className="flex flex-wrap items-center gap-8 sm:gap-12 text-sm sm:text-base font-medium text-[#F4F4F2]/50">
            <span className="hover:text-white transition-colors">Sfumato</span>
            <span className="font-mono uppercase tracking-widest text-xs sm:text-sm hover:text-white transition-colors">CHINOR</span>
            <span className="italic font-serif hover:text-white transition-colors">Broadway Roasters</span>
            <span className="font-semibold hover:text-white transition-colors">Nur Café</span>
            <span className="font-mono text-xs sm:text-sm hover:text-white transition-colors">Milk &amp; Honey</span>
          </div>
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section id="how" className="bg-[#FAFAF9] text-[#0E0F11] py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#0E0F11]/50 mb-4 font-semibold">
                <span className="size-1.5 rounded-full bg-[#5B8DEF]" />
                Как это работает
              </div>
              <h2 className="text-3xl sm:text-5xl font-semibold tracking-[-0.035em] leading-[1.08] max-w-xl text-[#0E0F11]">
                Три шага. Без обучения гостей, без установок.
              </h2>
            </div>
            <p className="text-sm text-[#0E0F11]/60 max-w-xs leading-relaxed">
              Всё, что нужно, — метка NFC у кассы. Дальше сработает Telegram.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-8 rounded-[24px] bg-white border border-black/[0.06] shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div className="font-mono text-xs text-[#0E0F11]/40 font-semibold tracking-widest">01</div>
                <div className="size-12 rounded-2xl bg-[#5B8DEF]/10 grid place-items-center text-[#5B8DEF]">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 8.05a10 10 0 0 1 15.9 0" />
                    <path d="M7 11.5a6 6 0 0 1 10 0" />
                    <path d="M10 14.5a2 2 0 0 1 4 0" />
                  </svg>
                </div>
              </div>
              <h3 className="text-xl font-semibold tracking-tight mb-2 text-[#0E0F11]">Касание</h3>
              <p className="text-sm leading-relaxed text-[#0E0F11]/60">
                Гость подносит телефон к метке. Открывается ваша карта в Telegram — без загрузок, без регистрации.
              </p>
            </div>

            <div className="p-8 rounded-[24px] bg-white border border-black/[0.06] shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div className="font-mono text-xs text-[#0E0F11]/40 font-semibold tracking-widest">02</div>
                <div className="size-12 rounded-2xl bg-[#5B8DEF]/10 grid place-items-center text-[#5B8DEF]">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
              </div>
              <h3 className="text-xl font-semibold tracking-tight mb-2 text-[#0E0F11]">Штамп</h3>
              <p className="text-sm leading-relaxed text-[#0E0F11]/60">
                Бариста подтверждает покупку в панели. Штамп мгновенно добавляется на карту гостя.
              </p>
            </div>

            <div className="p-8 rounded-[24px] bg-white border border-black/[0.06] shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div className="font-mono text-xs text-[#0E0F11]/40 font-semibold tracking-widest">03</div>
                <div className="size-12 rounded-2xl bg-[#5B8DEF]/10 grid place-items-center text-[#5B8DEF]">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <path d="M14 14h3v3h-3zM17 17h4v4h-4zM14 20h3" />
                  </svg>
                </div>
              </div>
              <h3 className="text-xl font-semibold tracking-tight mb-2 text-[#0E0F11]">Награда</h3>
              <p className="text-sm leading-relaxed text-[#0E0F11]/60">
                Собран шестой штамп — гость показывает QR у стойки. Награда списывается на месте.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FOR GUESTS & CAFES ============ */}
      <section className="bg-[#F0EFEC] text-[#0E0F11] py-24 sm:py-32 border-t border-black/[0.04]">
        <div className="mx-auto max-w-7xl px-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Guests Card */}
          <div id="guests" className="p-8 sm:p-12 rounded-[28px] bg-[#FAFAF9] border border-black/[0.05] flex flex-col justify-between">
            <div>
              <div className="font-mono text-xs text-[#0E0F11]/40 uppercase tracking-widest mb-6 font-semibold">
                Гостям
              </div>
              <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4 leading-tight text-[#0E0F11]">
                Ничего не нужно устанавливать.
              </h3>
              <p className="text-sm leading-relaxed text-[#0E0F11]/60 mb-8">
                Карта живёт внутри Telegram. Штампы копятся, награды не теряются, история — всегда под рукой.
              </p>

              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="size-6 rounded-lg bg-[#5B8DEF]/10 grid place-items-center text-[#5B8DEF] shrink-0 mt-0.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[#0E0F11]">Без пластиковых карт</div>
                    <div className="text-xs text-[#0E0F11]/60 mt-0.5 leading-relaxed">Одно касание — и карта в кармане, точнее — в мессенджере.</div>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="size-6 rounded-lg bg-[#5B8DEF]/10 grid place-items-center text-[#5B8DEF] shrink-0 mt-0.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[#0E0F11]">Одна лента, все кофейни</div>
                    <div className="text-xs text-[#0E0F11]/60 mt-0.5 leading-relaxed">Все карты, весь прогресс, все награды — в одном кошельке.</div>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="size-6 rounded-lg bg-[#5B8DEF]/10 grid place-items-center text-[#5B8DEF] shrink-0 mt-0.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[#0E0F11]">Мягкие напоминания</div>
                    <div className="text-xs text-[#0E0F11]/60 mt-0.5 leading-relaxed">Только когда награда готова. Ни спама, ни лишних толчков.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Cafes Card */}
          <div id="cafes" className="p-8 sm:p-12 rounded-[28px] bg-[#0E0F11] text-[#F4F4F2] border border-white/[0.08] relative overflow-hidden flex flex-col justify-between shadow-2xl">
            <div className="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full bg-[radial-gradient(circle,_rgba(91,141,239,0.18),_transparent_65%)]" />

            <div className="relative">
              <div className="font-mono text-xs text-[#F4F4F2]/40 uppercase tracking-widest mb-6 font-semibold">
                Кофейням
              </div>
              <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4 leading-tight text-white">
                Панель бариста — на планшете.
              </h3>
              <p className="text-sm leading-relaxed text-[#F4F4F2]/60 mb-8">
                Начислять штампы, гасить награды, видеть возвраты — всё из одного места. Онбординг за один вечер.
              </p>

              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="size-6 rounded-lg bg-[#5B8DEF]/15 grid place-items-center text-[#7BA5FF] shrink-0 mt-0.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">Аналитика возвратов</div>
                    <div className="text-xs text-[#F4F4F2]/60 mt-0.5 leading-relaxed">Кто приходит второй раз, кто — десятый. Понятно, что работает.</div>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="size-6 rounded-lg bg-[#5B8DEF]/15 grid place-items-center text-[#7BA5FF] shrink-0 mt-0.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">Своя механика награды</div>
                    <div className="text-xs text-[#F4F4F2]/60 mt-0.5 leading-relaxed">6 напитков и 7-й в подарок, скидка, специальный товар — на ваше усмотрение.</div>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="size-6 rounded-lg bg-[#5B8DEF]/15 grid place-items-center text-[#7BA5FF] shrink-0 mt-0.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">NFC-стенд в комплекте</div>
                    <div className="text-xs text-[#F4F4F2]/60 mt-0.5 leading-relaxed">Приезжает готовым. Ставите у кассы — и запустились.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ PRICING ============ */}
      <section id="pricing" className="bg-[#FAFAF9] text-[#0E0F11] py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#0E0F11]/50 mb-3 font-semibold">
              <span className="size-1.5 rounded-full bg-[#5B8DEF]" />
              Тарифы
            </div>
            <h2 className="text-3xl sm:text-5xl font-semibold tracking-[-0.035em] text-[#0E0F11]">
              Один тариф на точку.
            </h2>
            <p className="mt-3 text-sm text-[#0E0F11]/60">
              Без комиссий за транзакции. Без скрытых платежей.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Solo */}
            <div className="p-8 rounded-[24px] bg-white border border-black/[0.06] flex flex-col justify-between shadow-sm">
              <div>
                <div className="font-mono text-xs text-[#0E0F11]/50 uppercase tracking-widest mb-3 font-semibold">Solo</div>
                <div className="flex items-baseline gap-1.5 mb-2">
                  <div className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#0E0F11]">290 000</div>
                  <div className="text-xs text-[#0E0F11]/50">₸ / мес</div>
                </div>
                <div className="text-xs text-[#0E0F11]/60 mb-6">Одна кофейня. До 1 000 гостей.</div>

                <Link
                  href="/apply"
                  className="block text-center py-2.5 rounded-full bg-[#FAFAF9] border border-black/[0.08] text-xs font-semibold text-[#0E0F11] hover:bg-black/5 transition-all mb-6"
                >
                  Начать
                </Link>

                <div className="flex flex-col gap-3 text-xs text-[#0E0F11]/70">
                  <div className="flex gap-2.5 items-start">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5B8DEF" strokeWidth="3" strokeLinecap="round" className="shrink-0 mt-0.5"><path d="M20 6L9 17l-5-5" /></svg>
                    <span>Мини-приложение и NFC-стенд</span>
                  </div>
                  <div className="flex gap-2.5 items-start">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5B8DEF" strokeWidth="3" strokeLinecap="round" className="shrink-0 mt-0.5"><path d="M20 6L9 17l-5-5" /></svg>
                    <span>Панель бариста на планшете</span>
                  </div>
                  <div className="flex gap-2.5 items-start">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5B8DEF" strokeWidth="3" strokeLinecap="round" className="shrink-0 mt-0.5"><path d="M20 6L9 17l-5-5" /></svg>
                    <span>Аналитика возвратов</span>
                  </div>
                  <div className="flex gap-2.5 items-start text-[#0E0F11]/40">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="shrink-0 mt-0.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    <span>Мультибрендовый кошелёк</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Chain */}
            <div className="p-8 rounded-[24px] bg-[#0E0F11] text-[#F4F4F2] border border-white/[0.08] relative shadow-2xl flex flex-col justify-between">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#5B8DEF] text-[#0E1424] text-[9px] font-bold uppercase tracking-wider">
                Популярный
              </div>

              <div>
                <div className="font-mono text-xs text-[#F4F4F2]/50 uppercase tracking-widest mb-3 font-semibold">Chain</div>
                <div className="flex items-baseline gap-1.5 mb-2">
                  <div className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">890 000</div>
                  <div className="text-xs text-[#F4F4F2]/50">₸ / мес</div>
                </div>
                <div className="text-xs text-[#F4F4F2]/60 mb-6">До 5 точек. Общая карта.</div>

                <Link
                  href="/apply"
                  className="block text-center py-2.5 rounded-full bg-[#F4F4F2] text-xs font-semibold text-[#0E0F11] hover:bg-white transition-all mb-6"
                >
                  Начать
                </Link>

                <div className="flex flex-col gap-3 text-xs text-[#F4F4F2]/75">
                  <div className="flex gap-2.5 items-start">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7BA5FF" strokeWidth="3" strokeLinecap="round" className="shrink-0 mt-0.5"><path d="M20 6L9 17l-5-5" /></svg>
                    <span>Всё из Solo для каждой точки</span>
                  </div>
                  <div className="flex gap-2.5 items-start">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7BA5FF" strokeWidth="3" strokeLinecap="round" className="shrink-0 mt-0.5"><path d="M20 6L9 17l-5-5" /></svg>
                    <span>Общая карта на все точки</span>
                  </div>
                  <div className="flex gap-2.5 items-start">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7BA5FF" strokeWidth="3" strokeLinecap="round" className="shrink-0 mt-0.5"><path d="M20 6L9 17l-5-5" /></svg>
                    <span>Сегменты и рассылки</span>
                  </div>
                  <div className="flex gap-2.5 items-start">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7BA5FF" strokeWidth="3" strokeLinecap="round" className="shrink-0 mt-0.5"><path d="M20 6L9 17l-5-5" /></svg>
                    <span>Приоритетная поддержка</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Group */}
            <div className="p-8 rounded-[24px] bg-white border border-black/[0.06] flex flex-col justify-between shadow-sm">
              <div>
                <div className="font-mono text-xs text-[#0E0F11]/50 uppercase tracking-widest mb-3 font-semibold">Group</div>
                <div className="flex items-baseline gap-1.5 mb-2">
                  <div className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#0E0F11]">Договорной</div>
                </div>
                <div className="text-xs text-[#0E0F11]/60 mb-6">Сети от 6 точек, брендинг, API.</div>

                <a
                  href="https://t.me/stampy_support"
                  target="_blank"
                  rel="noreferrer"
                  className="block text-center py-2.5 rounded-full bg-[#FAFAF9] border border-black/[0.08] text-xs font-semibold text-[#0E0F11] hover:bg-black/5 transition-all mb-6"
                >
                  Написать в отдел продаж
                </a>

                <div className="flex flex-col gap-3 text-xs text-[#0E0F11]/70">
                  <div className="flex gap-2.5 items-start">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5B8DEF" strokeWidth="3" strokeLinecap="round" className="shrink-0 mt-0.5"><path d="M20 6L9 17l-5-5" /></svg>
                    <span>Всё из Chain, без ограничений</span>
                  </div>
                  <div className="flex gap-2.5 items-start">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5B8DEF" strokeWidth="3" strokeLinecap="round" className="shrink-0 mt-0.5"><path d="M20 6L9 17l-5-5" /></svg>
                    <span>Свой брендинг карт</span>
                  </div>
                  <div className="flex gap-2.5 items-start">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5B8DEF" strokeWidth="3" strokeLinecap="round" className="shrink-0 mt-0.5"><path d="M20 6L9 17l-5-5" /></svg>
                    <span>API и интеграции с POS</span>
                  </div>
                  <div className="flex gap-2.5 items-start">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5B8DEF" strokeWidth="3" strokeLinecap="round" className="shrink-0 mt-0.5"><path d="M20 6L9 17l-5-5" /></svg>
                    <span>Персональный менеджер</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section id="faq" className="bg-[#FAFAF9] text-[#0E0F11] py-24 border-t border-black/[0.06]">
        <div className="mx-auto max-w-3xl px-6">
          <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#0E0F11]/50 mb-3 font-semibold">
            <span className="size-1.5 rounded-full bg-[#5B8DEF]" />
            Частые вопросы
          </div>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-0.035em] text-[#0E0F11] mb-12">
            Коротко о том, что спрашивают чаще всего.
          </h2>

          <div className="divide-y divide-black/[0.08] border-t border-black/[0.08]">
            <div className="py-6">
              <div className="text-base font-semibold tracking-tight text-[#0E0F11] mb-2">Нужен ли гостю смартфон с NFC?</div>
              <div className="text-sm text-[#0E0F11]/60 leading-relaxed">
                Да — сегодня NFC есть в любом смартфоне последних 5–7 лет. Если модель редкая, гость может открыть карту по QR на стенде.
              </div>
            </div>
            <div className="py-6">
              <div className="text-base font-semibold tracking-tight text-[#0E0F11] mb-2">Работает ли без интернета в кофейне?</div>
              <div className="text-sm text-[#0E0F11]/60 leading-relaxed">
                Для начисления штампа через NFC интернет нужен на смартфоне гостя (мобильный интернет или Wi-Fi). Панель бариста синхронизируется через облако.
              </div>
            </div>
            <div className="py-6">
              <div className="text-base font-semibold tracking-tight text-[#0E0F11] mb-2">Можно ли поменять «6+1» на другую награду?</div>
              <div className="text-sm text-[#0E0F11]/60 leading-relaxed">
                Да, количество штампов (от 3 до 12), условия и наименование подарка настраиваются индивидуально в личном кабинете.
              </div>
            </div>
            <div className="py-6">
              <div className="text-base font-semibold tracking-tight text-[#0E0F11] mb-2">Кому принадлежат данные гостей?</div>
              <div className="text-sm text-[#0E0F11]/60 leading-relaxed">
                Вся база гостей принадлежит исключительно вашей кофейне. Вы можете выгрузить аналитику и запускать целевые рассылки.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section className="bg-[#0E0F11] py-24 sm:py-32 relative overflow-hidden border-t border-white/[0.06]">
        <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 size-[800px] rounded-full bg-[radial-gradient(circle,_rgba(91,141,239,0.14),_transparent_65%)]" />

        <div className="mx-auto max-w-xl px-6 text-center relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#5B8DEF]/25 bg-[#5B8DEF]/10 px-3 py-1 text-[11px] font-mono uppercase tracking-widest text-[#7BA5FF] mb-6">
            <span className="size-1.5 rounded-full bg-[#5B8DEF]" />
            Запустить у себя
          </div>
          <h2 className="text-3xl sm:text-5xl font-semibold tracking-[-0.035em] text-white leading-tight">
            Оставьте заявку — свяжемся сегодня.
          </h2>
          <p className="mt-4 text-sm sm:text-base text-[#F4F4F2]/60 leading-relaxed max-w-md mx-auto">
            Расскажем, как подключить кофейню, и привезём NFC-стенд в течение недели.
          </p>

          <div className="mt-8">
            <Link
              href="/apply"
              className="inline-block rounded-full bg-[#F4F4F2] px-8 py-3.5 text-sm font-semibold text-[#0E0F11] hover:bg-white hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl"
            >
              Оставить заявку
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-[#F4F4F2]/40 font-medium">
            <div className="flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#5B8DEF" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
              Без привязки карты
            </div>
            <div className="flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#5B8DEF" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
              Первый месяц — бесплатно
            </div>
            <div className="flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#5B8DEF" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
              Быстрый запуск за 1 день
            </div>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="bg-[#08090B] py-12 px-6 border-t border-white/[0.06] text-xs">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4 text-[#F4F4F2]/40 font-mono">
          <div className="flex items-center gap-2">
            <span className="text-[#F4F4F2]/70 font-sans font-semibold">Stampy</span>
            <span>· © 2026 Ташкент</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="https://t.me/stampy_support" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Telegram</a>
            <a href="mailto:hello@stampy.co" className="hover:text-white transition-colors">hello@stampy.co</a>
          </div>
        </div>
      </footer>
    </div>
  );
}


