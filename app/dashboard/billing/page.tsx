import { requireRole } from "@/lib/auth";
import { supportTelegramUrl } from "@/lib/contact";
import { daysLeftInTrial, isServing, PLAN_CARDS } from "@/lib/plan";

export const dynamic = "force-dynamic";

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
      <header className="border-b border-line pb-5">
        <h1 className="page-title">Тариф и оплата</h1>
        <p className="page-subtitle">Что подключено сейчас и что даёт следующий тариф</p>
      </header>

      <section className="card p-5 md:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-lg font-bold tracking-tight text-white">
            {tenant.plan === "marketing" ? "Лояльность + маркетинг" : "Лояльность"}
          </p>
          <span className={`badge ${serving ? "badge-ok" : "badge-bad"}`}>
            {STATUS_LABELS[tenant.subscription_status]}
          </span>
        </div>

        <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
          {tenant.subscription_status === "trial"
            ? trialDays && trialDays > 0
              ? `Бесплатно ещё ${trialDays} дн. Карта работает полностью, включая рассылки.`
              : "Пробный период закончился — начисление штампов приостановлено."
            : tenant.subscription_until
              ? `Оплачено до ${new Date(tenant.subscription_until).toLocaleDateString("ru-RU", { timeZone: "Asia/Tashkent" })}`
              : "Бессрочная подписка."}
        </p>

        {!serving && (
          <p className="note note-warn mt-4">
            Пока подписка неактивна, новые штампы не начисляются. Всё, что гости уже накопили,
            сохраняется и вернётся сразу после оплаты.
          </p>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {PLAN_CARDS.map((plan) => (
          <article
            key={plan.id}
            className={`card p-5 ${
              tenant.plan === plan.id ? "border-violet-500/40 bg-violet-500/[0.04]" : ""
            }`}
          >
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h2 className="card-title">{plan.name}</h2>
              {tenant.plan === plan.id && <span className="badge badge-accent">текущий</span>}
            </div>
            <p className="mb-4 text-xl font-bold tracking-tight text-white">{plan.price}</p>
            <p className="mb-4 text-[13px] leading-relaxed text-ink-soft">{plan.tagline}</p>
            <ul className="flex flex-col gap-2 text-[13px] text-ink-soft">
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-2">
                  <span className="mt-[7px] size-1 shrink-0 rounded-full bg-violet-400" />
                  <span className="leading-relaxed">{feature}</span>
                </li>
              ))}
              {plan.missing?.map((feature) => (
                <li key={feature} className="flex gap-2 text-ink-faint">
                  <span className="mt-[7px] size-1 shrink-0 rounded-full bg-white/20" />
                  <span className="leading-relaxed line-through">{feature}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="card p-5 md:p-6">
        <h2 className="card-title mb-2">Как оплатить</h2>
        <p className="text-[13px] leading-relaxed text-ink-soft">
          Напишите нам в Telegram — выставим счёт на юрлицо или примем перевод. После оплаты
          подписка продлевается в течение рабочего дня, ничего перенастраивать не нужно.
        </p>
        {supportTelegramUrl && (
          <a href={supportTelegramUrl} target="_blank" rel="noreferrer" className="btn btn-primary mt-4">
            Написать в поддержку
          </a>
        )}
      </section>
    </div>
  );
}
