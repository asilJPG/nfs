import Link from "next/link";
import { CardPreview } from "@/components/brand/CardPreview";
import type { Brand } from "@/types/db";

export const dynamic = "force-static";

const DEMO_BRAND: Brand = {
  primary: "#6F4E37",
  bg: "#FFF8F0",
  surface: "#FFFFFF",
  text: "#2A1E17",
  accent: "#C8A27A",
  card_style: "cups",
};

const STEPS = [
  {
    title: "Гость прикладывает телефон",
    body: "К брендированной подставке на прилавке. Ничего скачивать не нужно — открывается Telegram.",
  },
  {
    title: "Штамп появляется сам",
    body: "Метка подписывает каждое касание криптографически, поэтому «поставить себе штамп дома» не выйдет.",
  },
  {
    title: "Карта заполнилась — гость возвращается",
    body: "Бариста вводит четыре цифры, и напиток уходит по акции. Всё видно в статистике.",
  },
];

const FEATURES = [
  ["Ноль установок", "Карта живёт в Telegram, который уже стоит у всех. Никаких «скачайте приложение»."],
  ["Своё оформление", "Цвета, логотип, форма штампов, текст награды — карта выглядит как ваша, а не наша."],
  ["Защита от накрутки", "NFC-метки NTAG 424 DNA со счётчиком касаний. Скопировать ссылку бесполезно."],
  ["Видно, кто возвращается", "Сколько гостей приходит снова, в какие часы, сколько наград забрали."],
  ["Рассылки по делу", "«Остался один штамп» или «давно не были» — сегменты считаются сами."],
  ["Работает без интернета у кассы", "Всё происходит на телефоне гостя. Кассе не нужен планшет."],
];

export default function LandingPage() {
  return (
    <div className="bg-cream">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <span className="text-lg font-semibold">☕ Stampy</span>
        <Link href="/login" className="rounded-xl border border-line px-4 py-2 text-sm">
          Войти
        </Link>
      </header>

      <section className="mx-auto grid max-w-5xl items-center gap-10 px-5 py-10 lg:grid-cols-2 lg:py-16">
        <div>
          <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
            Бумажная карточка со штампами — теперь в Telegram
          </h1>
          <p className="mt-4 text-ink-soft">
            Гость прикладывает телефон к подставке на кассе и получает штамп. Карточки не теряются,
            штампы не подделываются, а вы наконец видите, кто к вам возвращается.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="rounded-2xl bg-bean px-6 py-3.5 font-medium text-white"
            >
              Попробовать 30 дней бесплатно
            </Link>
            <a
              href="https://t.me/stampy_support"
              className="rounded-2xl border border-line px-6 py-3.5 font-medium"
            >
              Задать вопрос
            </a>
          </div>
          <p className="mt-3 text-sm text-ink-soft">
            Настройка занимает пару минут. Карта работает сразу — ещё до того, как приедут подставки.
          </p>
        </div>

        <div className="mx-auto w-full max-w-xs">
          <CardPreview
            brand={DEMO_BRAND}
            name="Кофе на Амире Темура"
            stamps={6}
            filled={4}
            reward="Бесплатный капучино"
          />
        </div>
      </section>

      <section className="border-y border-line bg-white py-14">
        <div className="mx-auto max-w-5xl px-5">
          <h2 className="mb-8 text-2xl font-semibold">Как это работает</h2>
          <ol className="grid gap-6 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title}>
                <span className="grid size-8 place-items-center rounded-full bg-bean text-sm text-white">
                  {index + 1}
                </span>
                <h3 className="mt-3 font-medium">{step.title}</h3>
                <p className="mt-1 text-sm text-ink-soft">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-14">
        <h2 className="mb-8 text-2xl font-semibold">Что получает кофейня</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(([title, body]) => (
            <div key={title}>
              <h3 className="font-medium">{title}</h3>
              <p className="mt-1 text-sm text-ink-soft">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-line bg-white py-14">
        <div className="mx-auto max-w-2xl px-5 text-center">
          <h2 className="text-2xl font-semibold">Попробуйте на одной точке</h2>
          <p className="mt-3 text-ink-soft">
            30 дней бесплатно, со всеми функциями. Комплект на прилавок — подставка с NFC и табличка
            с QR — привезём после регистрации.
          </p>
          <Link
            href="/register"
            className="mt-6 inline-block rounded-2xl bg-bean px-6 py-3.5 font-medium text-white"
          >
            Создать карту
          </Link>
        </div>
      </section>

      <footer className="mx-auto max-w-5xl px-5 py-8 text-sm text-ink-soft">
        Stampy · Ташкент · <a href="https://t.me/stampy_support" className="underline">поддержка</a>
      </footer>
    </div>
  );
}
