/**
 * Fills a fresh database with a believable coffee shop so every screen has
 * something to show: 45 days of visits, guests at different stages, a reward
 * waiting to be redeemed, and a tag you can "tap" from the terminal.
 *
 *   npx tsx scripts/seed.ts --email you@example.com
 *   npx tsx scripts/seed.ts --email you@example.com --reset
 *
 * Uses the service role key, so run it against dev/staging — never blindly
 * against a database with real shops in it.
 */
import { createClient } from "@supabase/supabase-js";
import { deriveMetaKey, deriveTagMacKey } from "../lib/nfc/sun";
import { arg, loadEnv, masterKey } from "./env";
import type { Database } from "../types/db";

loadEnv();

const SLUG = "test-coffee";
const TAG_UID = "04A1B2C3D4E580";
/** Fake Telegram ids live in their own range so --reset can find them again. */
const TELEGRAM_BASE = 900_000_000;
const GUESTS = 14;
const DAYS = 45;
const STAMPS_REQUIRED = 6;

const email = arg("email");
const reset = process.argv.includes("--reset");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
}

const db = createClient<Database>(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const code = (length: number) =>
  Array.from({ length }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join("");

const daysAgo = (days: number, hour: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  // Tashkent is UTC+5; store the UTC instant for that local hour.
  date.setUTCHours(hour - 5, Math.floor(Math.random() * 60), 0, 0);
  return date.toISOString();
};

const NAMES = [
  "Азиз", "Малика", "Дилшод", "Нигора", "Тимур", "Севара", "Жасур",
  "Камила", "Рустам", "Зухра", "Бекзод", "Гулнора", "Шохрух", "Мадина",
];

async function reseed() {
  if (reset) {
    console.log("Удаляю прошлый тестовый набор…");
    await db.from("tenants").delete().eq("slug", SLUG);
    await db.from("customers").delete().gte("telegram_id", TELEGRAM_BASE).lt("telegram_id", TELEGRAM_BASE + 1000);
    await db.from("nfc_tags").delete().eq("uid", TAG_UID);
  }

  const { data: tenant, error: tenantError } = await db
    .from("tenants")
    .insert({
      slug: SLUG,
      name: "Кофе Тест",
      // marketing plan so broadcasts and the heatmap are visible while testing
      plan: "marketing",
      subscription_status: "active",
      subscription_until: new Date(Date.now() + 365 * 86_400_000).toISOString(),
      daily_broadcast_cap: 5,
    })
    .select()
    .single();
  if (tenantError || !tenant) throw tenantError ?? new Error("tenant insert failed");

  const { data: venue } = await db
    .from("venues")
    .insert({ tenant_id: tenant.id, name: "На Амире Темура", address: "ул. Амира Темура, 12" })
    .select()
    .single();

  const { data: program } = await db
    .from("loyalty_programs")
    .insert({
      tenant_id: tenant.id,
      stamps_required: STAMPS_REQUIRED,
      reward_title: "Бесплатный капучино",
      reward_description: "Любой напиток объёмом до 400 мл",
      stamp_cooldown_minutes: 15,
    })
    .select()
    .single();
  if (!program || !venue) throw new Error("venue or program insert failed");

  await db.from("staff_users").insert({
    tenant_id: tenant.id,
    email: email.toLowerCase(),
    role: "owner",
    name: "Владелец",
  });

  await db.from("nfc_tags").insert({
    uid: TAG_UID,
    tenant_id: tenant.id,
    venue_id: venue.id,
    label: "у кассы",
  });

  // The dev guest is index 0, so DEV_TELEGRAM_ID always lands on a real card.
  let totalStamps = 0;
  let totalRewards = 0;

  for (let index = 0; index < GUESTS; index++) {
    const telegramId = TELEGRAM_BASE + index;

    const { data: customer } = await db
      .from("customers")
      .insert({
        telegram_id: telegramId,
        first_name: NAMES[index % NAMES.length],
        username: `guest${index}`,
        language_code: "ru",
      })
      .select()
      .single();
    if (!customer) continue;

    // A spread of behaviours: regulars, occasional visitors, one who vanished.
    const visits = index === 0 ? 10 : Math.floor(Math.random() * 14) + 1;
    const lapsed = index % 5 === 0;
    const firstDay = Math.min(DAYS, visits * 2 + Math.floor(Math.random() * 10));

    const visitDays: number[] = [];
    for (let visit = 0; visit < visits; visit++) {
      const day = lapsed
        ? Math.floor(firstDay - (visit / visits) * (firstDay - 20))
        : Math.floor(firstDay - (visit / visits) * firstDay);
      visitDays.push(Math.max(0, day));
    }
    visitDays.sort((a, b) => b - a);

    const { data: membership } = await db
      .from("memberships")
      .insert({
        tenant_id: tenant.id,
        customer_id: customer.id,
        public_code: code(6),
        stamps_count: visits % STAMPS_REQUIRED,
        lifetime_stamps: visits,
        first_seen_at: daysAgo(visitDays[0], 9),
        last_stamp_at: daysAgo(visitDays[visitDays.length - 1], 10),
      })
      .select()
      .single();
    if (!membership) continue;

    await db.from("stamps").insert(
      visitDays.map((day) => ({
        tenant_id: tenant.id,
        membership_id: membership.id,
        venue_id: venue.id,
        source: "nfc" as const,
        created_at: daysAgo(day, 8 + Math.floor(Math.random() * 11)),
      })),
    );
    totalStamps += visitDays.length;

    // Every completed lap is a reward; most were collected, one is still open.
    const earned = Math.floor(visits / STAMPS_REQUIRED);
    for (let lap = 0; lap < earned; lap++) {
      const keepOpen = index === 0 && lap === earned - 1;
      await db.from("rewards").insert({
        tenant_id: tenant.id,
        membership_id: membership.id,
        program_id: program.id,
        title: program.reward_title,
        status: keepOpen ? "earned" : "redeemed",
        earned_at: daysAgo(Math.max(1, visitDays[0] - lap * 7), 11),
        redeemed_at: keepOpen ? null : daysAgo(Math.max(0, visitDays[0] - lap * 7 - 1), 12),
        redeemed_venue_id: keepOpen ? null : venue.id,
      });
      totalRewards += 1;
    }
  }

  // Guest 0 should always have a reward ready, whatever the random visits gave.
  const { data: devMembership } = await db
    .from("memberships")
    .select("id, customers!inner(telegram_id)")
    .eq("tenant_id", tenant.id)
    .eq("customers.telegram_id", TELEGRAM_BASE)
    .maybeSingle();

  if (devMembership) {
    const { count } = await db
      .from("rewards")
      .select("id", { count: "exact", head: true })
      .eq("membership_id", devMembership.id)
      .eq("status", "earned");

    if (!count) {
      await db.from("rewards").insert({
        tenant_id: tenant.id,
        membership_id: devMembership.id,
        program_id: program.id,
        title: program.reward_title,
        status: "earned",
      });
      totalRewards += 1;
    }
  }

  return { tenant, totalStamps, totalRewards };
}

async function main() {
  const { tenant, totalStamps, totalRewards } = await reseed();

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const master = masterKey();

  console.log(
    [
      ``,
      `Готово. Кофейня «${tenant.name}» (/${tenant.slug})`,
      `  ${GUESTS} гостей · ${totalStamps} штампов за ${DAYS} дней · ${totalRewards} наград`,
      ``,
      `Вход в кабинет`,
      `  ${appUrl}/login  →  ${email}  (роль owner уже привязана к этой почте)`,
      ``,
      `Мини-апп без Telegram — добавьте в .env.local:`,
      `  DEV_TELEGRAM_ID=${TELEGRAM_BASE}`,
      `  NEXT_PUBLIC_DEV_MINIAPP=1`,
      `  затем откройте ${appUrl}/card?startapp=t_${tenant.slug}`,
      ``,
      `Тестовое касание метки`,
      `  npm run mock-tag -- --uid ${TAG_UID} --counter 1`,
      `  (следующий запуск — с бо́льшим --counter, иначе сработает защита от повтора)`,
      ``,
      `Ключи для прошивки чипа с UID ${TAG_UID}`,
      `  K_meta: ${deriveMetaKey(master).toString("hex").toUpperCase()}`,
      `  K_mac:  ${deriveTagMacKey(master, TAG_UID).toString("hex").toUpperCase()}`,
      ``,
    ].join("\n"),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
