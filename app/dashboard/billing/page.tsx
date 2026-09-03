import { requireRole } from "@/lib/auth";
import { daysLeftInTrial, isServing } from "@/lib/plan";

export const dynamic = "force-dynamic";

const PLANS = [
  {
    id: "loyalty",
    name: "Лояльность",
    price: "290 000 сум / мес",
    features: [
      "Карта в Telegram без установки приложений",
      "Безлимит гостей и штампов",
      "Своё оформление: цвета, логотип, награда",
      "Панель кассира и ручное начисление",
      "Базовая статистика",
      "Одна точка",
    ],
  },
  {
    id: "marketing",
    name: "Лояльность + маркетинг",
    price: "490 000 сум / мес",
    features: [
      "Всё из тарифа «Лояльность»",
      "Рассылки по сегментам гостей",
      "Тепловая карта посещений и когорты",
      "Несколько точек",
      "Экспорт данных",
    ],
  },
];

const STATUS_LABELS: Record<string, string> = {
  trial: "Пробный период",
  active: "Активна",
  past_due: "Ожидает оплаты",
  suspended: "Приостановлена",
};

export default async function BillingPage() {
  const { tenant } = await requireRole("owner", "manager");
  const trialDays = daysLeftInTrial(tenant);
  const serving = isServing(tenant);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Подписка</h1>

      <section className="rounded-2xl border border-line bg-white p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-lg font-medium">
            {tenant.plan === "marketing" ? "Лояльность + маркетинг" : "Лояльность"}
          </p>
          <span
            className={`rounded-full px-3 py-1 text-sm ${
              serving ? "bg-bean/10 text-bean-dark" : "bg-red-50 text-red-700"
            }`}
          >
            {STATUS_LABELS[tenant.subscription_status]}
          </span>
        </div>

        <p className="mt-2 text-sm text-ink-soft">
          {tenant.subscription_status === "trial"
            ? trialDays && trialDays > 0
              ? `Бесплатно ещё ${trialDays} дн. Карта работает полностью, включая рассылки.`
              : "Пробный период закончился — начисление штампов приостановлено."
            : tenant.subscription_until
              ? `Оплачено до ${new Date(tenant.subscription_until).toLocaleDateString("ru-RU", { timeZone: "Asia/Tashkent" })}`
              : "Бессрочная подписка."}
        </p>

        {!serving && (
          <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Пока подписка неактивна, новые штампы не начисляются. Всё, что гости уже накопили,
            сохраняется и вернётся сразу после оплаты.
          </p>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {PLANS.map((plan) => (
          <article
            key={plan.id}
            className={`rounded-2xl border p-4 ${
              tenant.plan === plan.id ? "border-bean bg-white" : "border-line bg-white"
            }`}
          >
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-medium">{plan.name}</h2>
              {tenant.plan === plan.id && (
                <span className="text-xs text-bean-dark">текущий</span>
              )}
            </div>
            <p className="mb-3 text-lg font-semibold">{plan.price}</p>
            <ul className="flex flex-col gap-1.5 text-sm text-ink-soft">
              {plan.features.map((feature) => (
                <li key={feature}>· {feature}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-line bg-white p-4">
        <h2 className="mb-2 font-medium">Как оплатить</h2>
        <p className="text-sm text-ink-soft">
          Напишите нам в Telegram — выставим счёт на юрлицо или примем перевод. После оплаты
          подписка продлевается в течение рабочего дня, ничего перенастраивать не нужно.
        </p>
        <a
          href="https://t.me/stampy_support"
          className="mt-3 inline-block rounded-2xl bg-bean px-5 py-3 text-sm font-medium text-white"
        >
          Написать в поддержку
        </a>
      </section>
    </div>
  );
}
