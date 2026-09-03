/**
 * Applies the migrations through Supabase's Management API — the same channel
 * the dashboard SQL editor uses. Needed here because the project's direct
 * database host is IPv6-only and this machine has no IPv6 route.
 *
 *   SUPABASE_ACCESS_TOKEN=sbp_… npx tsx scripts/db-push.ts
 *
 * The token comes from supabase.com/dashboard/account/tokens and is never
 * written to disk by this script. Migrations already applied are skipped by
 * their own `if not exists` guards where they have them; otherwise re-running
 * a migration will fail loudly rather than half-apply.
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnv } from "./env";

loadEnv();

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token?.startsWith("sbp_")) {
  throw new Error(
    "SUPABASE_ACCESS_TOKEN (sbp_…) не задан. Создайте токен на supabase.com/dashboard/account/tokens",
  );
}

const ref =
  process.env.SUPABASE_PROJECT_REF ??
  new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://x.supabase.co").hostname.split(".")[0];

const API = `https://api.supabase.com/v1/projects/${ref}/database/query`;

async function run(sql: string): Promise<unknown> {
  const response = await fetch(API, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });

  const text = await response.text();
  if (!response.ok) {
    let message = text;
    try {
      message = (JSON.parse(text) as { message?: string }).message ?? text;
    } catch {
      // keep the raw body
    }
    throw new Error(message);
  }
  return text ? JSON.parse(text) : null;
}

async function main() {
  console.log(`Проект: ${ref}\n`);

  const dir = resolve(process.cwd(), "supabase/migrations");
  const files = readdirSync(dir).filter((file) => file.endsWith(".sql")).sort();

  for (const file of files) {
    try {
      await run(readFileSync(resolve(dir, file), "utf8"));
      console.log(`  ok    ${file}`);
    } catch (error) {
      console.log(`  FAIL  ${file}`);
      console.log(`        ${(error as Error).message}`);
      process.exit(1);
    }
  }

  const summary = (await run(`
    select
      (select count(*) from pg_tables where schemaname = 'public') as tables,
      (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public') as functions,
      (select count(*) from pg_policies where schemaname = 'public') as policies,
      (select count(*) from storage.buckets where id = 'stampy-logos') as logo_bucket
  `)) as { tables: number; functions: number; policies: number; logo_bucket: number }[];

  const row = summary[0];
  console.log(
    `\nСхема на месте: ${row.tables} таблиц, ${row.functions} функций, ` +
      `${row.policies} политик, бакет logos ${row.logo_bucket ? "создан" : "НЕ создан"}.`,
  );
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
