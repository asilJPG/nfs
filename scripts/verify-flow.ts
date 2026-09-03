/**
 * Integration test for the SQL layer, run on a real Postgres (PGlite).
 * Covers the paths that are easy to get wrong and expensive to get wrong:
 * replay, cooldown, reward issue/redeem, suspended tenants, and tenant
 * isolation under RLS.
 *
 *   npx tsx scripts/verify-flow.ts
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { SUPABASE_STUBS } from "./supabase-stubs";

const GUEST = 900_000_001;
const OTHER_GUEST = 900_000_002;

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed += 1;
    console.log(`  ok    ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}`);
    if (detail !== undefined) console.log(`        ${JSON.stringify(detail)}`);
  }
}

async function main() {
  const db = new PGlite();
  await db.exec(SUPABASE_STUBS);

  for (const file of readdirSync(resolve(process.cwd(), "supabase/migrations")).sort()) {
    await db.exec(readFileSync(resolve(process.cwd(), "supabase/migrations", file), "utf8"));
  }

  const one = async <T>(sql: string, params: unknown[] = []): Promise<T> => {
    const { rows } = await db.query<T>(sql, params);
    return rows[0];
  };

  // ---------------------------------------------------------------- setup ---

  const shopA = await one<{ id: string }>(
    `insert into tenants (slug, name, subscription_status, subscription_until)
     values ('shop-a', 'Кофейня A', 'active', now() + interval '1 year') returning id`,
  );
  const shopB = await one<{ id: string }>(
    `insert into tenants (slug, name, subscription_status, subscription_until)
     values ('shop-b', 'Кофейня B', 'active', now() + interval '1 year') returning id`,
  );

  const venueA = await one<{ id: string }>(
    `insert into venues (tenant_id, name) values ($1, 'Точка A') returning id`,
    [shopA.id],
  );

  const programA = await one<{ id: string }>(
    `insert into loyalty_programs (tenant_id, stamps_required, reward_title, stamp_cooldown_minutes)
     values ($1, 3, 'Бесплатный кофе', 0) returning id`,
    [shopA.id],
  );
  await db.query(
    `insert into loyalty_programs (tenant_id, stamps_required, reward_title) values ($1, 5, 'Кофе B')`,
    [shopB.id],
  );

  const tagA = await one<{ id: string }>(
    `insert into nfc_tags (uid, tenant_id, venue_id) values ('04A1B2C3D4E580', $1, $2) returning id`,
    [shopA.id, venueA.id],
  );

  const ownerA = await one<{ id: string }>(
    `insert into auth.users (email) values ('a@example.com') returning id`,
  );
  const ownerB = await one<{ id: string }>(
    `insert into auth.users (email) values ('b@example.com') returning id`,
  );
  await db.query(
    `insert into staff_users (tenant_id, auth_user_id, email, role) values ($1, $2, 'a@example.com', 'owner')`,
    [shopA.id, ownerA.id],
  );
  await db.query(
    `insert into staff_users (tenant_id, auth_user_id, email, role) values ($1, $2, 'b@example.com', 'owner')`,
    [shopB.id, ownerB.id],
  );

  let tokenCounter = 0;
  const mintToken = async (): Promise<string> => {
    tokenCounter += 1;
    const token = `token-${tokenCounter}`;
    await db.query(
      `insert into stamp_tokens (token, tenant_id, tag_id, venue_id, tap_counter, expires_at)
       values ($1, $2, $3, $4, $5, now() + interval '3 minutes')`,
      [token, shopA.id, tagA.id, venueA.id, tokenCounter],
    );
    return token;
  };

  const claim = (token: string, telegramId = GUEST) =>
    one<{ claim_stamp: Record<string, unknown> }>(`select public.claim_stamp($1, $2, '{}'::jsonb)`, [
      token,
      telegramId,
    ]).then((row) => row.claim_stamp);

  /** Runs as a signed-in staff member, so RLS and the role checks apply. */
  const asStaff = async (authUserId: string) => {
    await db.exec(`set role authenticated`);
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [authUserId]);
  };
  const asService = () => db.exec(`reset role`);

  console.log("\nШтампы");

  // ------------------------------------------------------------- stamping ---

  const first = await claim(await mintToken());
  check("первый штамп начисляется", first.ok === true && first.stamps_count === 1, first);

  const replayToken = await mintToken();
  await claim(replayToken);
  const replay = await claim(replayToken);
  check("повторное использование токена отклоняется", replay.code === "token_used", replay);

  const third = await claim(await mintToken());
  check(
    "третий штамп закрывает карту и выдаёт награду",
    third.ok === true && third.stamps_count === 0 && third.reward !== null,
    { ok: third.ok, stamps_count: third.stamps_count, reward: third.reward !== null },
  );

  const rewardCount = await one<{ count: number | string }>(
    `select count(*) from rewards where tenant_id = $1 and status = 'earned'`,
    [shopA.id],
  );
  check("награда одна, не больше", Number(rewardCount.count) === 1, rewardCount);

  const expired = await one<{ token: string }>(
    `insert into stamp_tokens (token, tenant_id, tag_id, tap_counter, expires_at)
     values ('token-expired', $1, $2, 99, now() - interval '1 minute') returning token`,
    [shopA.id, tagA.id],
  );
  const expiredResult = await claim(expired.token);
  check("просроченный токен отклоняется", expiredResult.code === "token_expired", expiredResult);

  await db.query(`update loyalty_programs set stamp_cooldown_minutes = 15 where id = $1`, [
    programA.id,
  ]);
  const cooled = await claim(await mintToken());
  check(
    "пауза между штампами соблюдается",
    cooled.ok === false && cooled.code === "cooldown" && Number(cooled.retry_after_seconds) > 0,
    cooled,
  );

  const cooledToken = await one<{ consumed_at: string | null }>(
    `select consumed_at from stamp_tokens order by created_at desc limit 1`,
  );
  check("токен гасится даже при отказе по паузе", cooledToken.consumed_at !== null, cooledToken);

  await db.query(`update loyalty_programs set stamp_cooldown_minutes = 0 where id = $1`, [
    programA.id,
  ]);

  console.log("\nНаграды");

  // -------------------------------------------------------------- rewards ---

  const reward = await one<{ id: string }>(
    `select id from rewards where tenant_id = $1 and status = 'earned' limit 1`,
    [shopA.id],
  );

  const issued = await one<{ issue_redeem_code: Record<string, unknown> }>(
    `select public.issue_redeem_code($1, $2, 5)`,
    [reward.id, GUEST],
  ).then((row) => row.issue_redeem_code);
  check(
    "код погашения выдан, 4 цифры",
    issued.ok === true && /^\d{4}$/.test(String(issued.code_value)),
    issued,
  );

  const stolen = await one<{ issue_redeem_code: Record<string, unknown> }>(
    `select public.issue_redeem_code($1, $2, 5)`,
    [reward.id, OTHER_GUEST],
  ).then((row) => row.issue_redeem_code);
  check("чужую награду забрать нельзя", stolen.code === "not_yours", stolen);

  const reissued = await one<{ issue_redeem_code: Record<string, unknown> }>(
    `select public.issue_redeem_code($1, $2, 5)`,
    [reward.id, GUEST],
  ).then((row) => row.issue_redeem_code);
  check("повторный запрос возвращает тот же живой код", reissued.code_value === issued.code_value, {
    first: issued.code_value,
    second: reissued.code_value,
  });

  await asStaff(ownerA.id);
  const redeemed = await one<{ redeem_reward: Record<string, unknown> }>(
    `select public.redeem_reward($1, $2, $3)`,
    [shopA.id, String(issued.code_value), venueA.id],
  ).then((row) => row.redeem_reward);
  check("бариста гасит награду по коду", redeemed.ok === true, redeemed);

  const redeemedTwice = await one<{ redeem_reward: Record<string, unknown> }>(
    `select public.redeem_reward($1, $2, $3)`,
    [shopA.id, String(issued.code_value), venueA.id],
  ).then((row) => row.redeem_reward);
  check("повторное погашение отклоняется", redeemedTwice.code === "not_found", redeemedTwice);

  console.log("\nРучное начисление и доступы");

  // ------------------------------------------------------------ manual ------

  await asService();
  const card = await one<{ public_code: string }>(
    `select public_code from memberships where tenant_id = $1 limit 1`,
    [shopA.id],
  );

  await asStaff(ownerA.id);
  const manual = await one<{ add_manual_stamp: Record<string, unknown> }>(
    `select public.add_manual_stamp($1, $2, $3)`,
    [shopA.id, card.public_code, venueA.id],
  ).then((row) => row.add_manual_stamp);
  check("ручной штамп по коду карты начисляется", manual.ok === true, manual);

  let crossTenantBlocked = false;
  try {
    await db.query(`select public.add_manual_stamp($1, $2, null)`, [shopB.id, card.public_code]);
  } catch {
    crossTenantBlocked = true;
  }
  check("штамп в чужой кофейне запрещён", crossTenantBlocked);

  const visibleA = await one<{ count: number | string }>(`select count(*) from memberships`);
  check("владелец A видит только свои карты", Number(visibleA.count) === 1, visibleA);

  await asStaff(ownerB.id);
  const visibleB = await one<{ count: number | string }>(`select count(*) from memberships`);
  check("владелец B не видит карты A", Number(visibleB.count) === 0, visibleB);

  const stampsB = await one<{ count: number | string }>(`select count(*) from stamps`);
  check("владелец B не видит штампы A", Number(stampsB.count) === 0, stampsB);

  await asStaff(ownerA.id);
  let planLocked = false;
  try {
    await db.query(`update tenants set plan = 'marketing' where id = $1`, [shopA.id]);
  } catch {
    planLocked = true;
  }
  check("кофейня не может сама сменить тариф", planLocked);

  const renamed = await db
    .query(`update tenants set name = 'Кофейня A+' where id = $1`, [shopA.id])
    .then(() => true)
    .catch(() => false);
  check("но может переименоваться и сменить оформление", renamed);

  console.log("\nПодписка и аналитика");

  // ------------------------------------------------------- subscription ----

  await asService();
  await db.query(`update tenants set subscription_status = 'suspended' where id = $1`, [shopA.id]);
  const suspended = await claim(await mintToken());
  check("при неактивной подписке штамп не начисляется", suspended.code === "tenant_inactive", suspended);

  const survived = await one<{ lifetime_stamps: number }>(
    `select lifetime_stamps from memberships where tenant_id = $1`,
    [shopA.id],
  );
  check("накопленное при этом не пропадает", survived.lifetime_stamps > 0, survived);

  await db.query(`update tenants set subscription_status = 'active' where id = $1`, [shopA.id]);

  await asStaff(ownerA.id);
  const overview = await one<{ analytics_overview: Record<string, number> }>(
    `select public.analytics_overview($1, now() - interval '30 days', now() + interval '1 day')`,
    [shopA.id],
  ).then((row) => row.analytics_overview);
  check(
    "аналитика считает штампы и награды",
    overview.stamps === 4 && overview.rewards_earned === 1 && overview.rewards_redeemed === 1,
    overview,
  );

  const daily = await db.query(
    `select * from public.analytics_daily($1, now() - interval '7 days', now() + interval '1 day', 'Asia/Tashkent')`,
    [shopA.id],
  );
  check("дневной график возвращает строки", daily.rows.length === 8, { days: daily.rows.length });

  const heatmap = await db.query(
    `select * from public.analytics_heatmap($1, now() - interval '30 days', now() + interval '1 day', 'Asia/Tashkent')`,
    [shopA.id],
  );
  check("тепловая карта строится", heatmap.rows.length > 0, { cells: heatmap.rows.length });

  await db.query(`select * from public.analytics_cohorts($1, 6, 'Asia/Tashkent')`, [shopA.id]);
  check("когорты считаются без ошибок", true);

  const segment = await db.query(
    `select * from public.segment_customers($1, '{"type":"all"}'::jsonb)`,
    [shopA.id],
  );
  check("сегмент «все» находит гостя", segment.rows.length === 1, { rows: segment.rows.length });

  const foreignSegment = await db
    .query(`select * from public.segment_customers($1, '{"type":"all"}'::jsonb)`, [shopB.id])
    .then(() => false)
    .catch(() => true);
  check("сегмент чужой кофейни недоступен", foreignSegment);

  console.log("\nСверка счётчиков");

  // ------------------------------------------------------------ integrity --

  await asService();
  const ledger = await one<{ stamps_count: number; ledger: number | string; rewards: number | string; required: number }>(
    `select m.stamps_count,
            (select count(*) from stamps s where s.membership_id = m.id) as ledger,
            (select count(*) from rewards r where r.membership_id = m.id) as rewards,
            p.stamps_required as required
     from memberships m
     join loyalty_programs p on p.tenant_id = m.tenant_id and p.active
     where m.tenant_id = $1`,
    [shopA.id],
  );
  const expectedCount = Number(ledger.ledger) - Number(ledger.rewards) * ledger.required;
  check(
    "stamps_count совпадает с пересчётом по леджеру",
    ledger.stamps_count === expectedCount,
    { stored: ledger.stamps_count, recomputed: expectedCount, ...ledger },
  );

  console.log(
    `\n${passed} проверок пройдено, ${failed} провалено.` +
      (failed === 0 ? " Логика SQL работает как задумано." : ""),
  );
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
