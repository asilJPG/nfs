import type { Tenant, TenantPlan } from "@/types/db";

export type Feature = "broadcasts" | "advanced_analytics" | "extra_venues";

const PLAN_FEATURES: Record<string, Feature[]> = {
  loyalty: [],
  marketing: ["broadcasts", "advanced_analytics", "extra_venues"],
};

// на триале доступно всё — чтобы кофейня видела за что платит
export function can(
  tenant: Pick<Tenant, "plan" | "subscription_status" | "trial_ends_at" | "subscription_until">,
  feature: Feature,
): boolean {
  if (!isServing(tenant)) return false;
  if (tenant.subscription_status === "trial") return true;
  return PLAN_FEATURES[tenant.plan]?.includes(feature) ?? false;
}

// зеркало public.tenant_is_serving() из SQL — держать в синке
export function isServing(
  tenant: Pick<Tenant, "subscription_status" | "trial_ends_at" | "subscription_until">,
): boolean {
  const now = Date.now();
  switch (tenant.subscription_status) {
    case "trial":
      return new Date(tenant.trial_ends_at).getTime() > now;
    case "active":
      return !tenant.subscription_until || new Date(tenant.subscription_until).getTime() > now;
    default:
      return false;
  }
}

export function daysLeftInTrial(tenant: Pick<Tenant, "subscription_status" | "trial_ends_at">): number | null {
  if (tenant.subscription_status !== "trial") return null;
  const ms = new Date(tenant.trial_ends_at).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export const MAX_VENUES_WITHOUT_UPGRADE = 1;

// Прайс тарифов, сум/мес. Зеркало public.admin_plan_price_uzs() из SQL — держать в синке.
export const PLAN_PRICE_UZS: Record<string, number> = {
  loyalty: 290_000,
  marketing: 490_000,
};

export function formatUzs(amount: number): string {
  return `${Math.round(amount).toLocaleString("ru-RU")} сум`;
}

/**
 * Единственный прайс-лист продукта: его показывают и лендинг, и кабинет.
 * Перечисляем только то, что реально работает в коде — обещание на витрине,
 * которого нет в приложении, дороже недосказанности.
 */
export type PlanCard = {
  id: TenantPlan;
  name: string;
  tagline: string;
  price: string;
  features: string[];
  missing?: string[];
};

export const PLAN_CARDS: PlanCard[] = [
  {
    id: "loyalty",
    name: "Лояльность",
    tagline: "Одна точка. Без лимита гостей и штампов.",
    price: `${formatUzs(PLAN_PRICE_UZS.loyalty)} / мес`,
    features: [
      "Карта в Telegram без установки приложений",
      "NFC-стенд и QR для стойки",
      "Своё оформление: цвета, логотип, награда",
      "Панель бариста и ручное начисление",
      "Статистика по дням и награды",
    ],
    missing: ["Рассылки по сегментам", "Тепловая карта и когорты", "Несколько точек"],
  },
  {
    id: "marketing",
    name: "Лояльность + маркетинг",
    tagline: "Сеть точек и работа с базой гостей.",
    price: `${formatUzs(PLAN_PRICE_UZS.marketing)} / мес`,
    features: [
      "Всё из тарифа «Лояльность»",
      "Рассылки по сегментам гостей",
      "Тепловая карта посещений и когорты",
      "Несколько точек под одной картой",
      "Приоритетная поддержка",
    ],
  },
];
