/**
 * Runs every migration against a real Postgres (PGlite, Postgres compiled to
 * WASM) so syntax and logic errors surface here instead of on the first
 * `supabase db push`.
 *
 *   npx tsx scripts/verify-sql.ts
 *
 * Supabase supplies `auth`, `storage` and the anon/authenticated/service_role
 * roles; PGlite does not, so we stand up just enough of them to compile
 * against. Behaviour that depends on a real session (auth.uid()) is exercised
 * separately in scripts/verify-flow.ts.
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { SUPABASE_STUBS } from "./supabase-stubs";

const MIGRATIONS_DIR = resolve(process.cwd(), "supabase/migrations");

async function main() {
  const db = new PGlite();
  await db.exec(SUPABASE_STUBS);

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  let failed = 0;

  for (const file of files) {
    const sql = readFileSync(resolve(MIGRATIONS_DIR, file), "utf8");
    try {
      await db.exec(sql);
      console.log(`  ok    ${file}`);
    } catch (error) {
      failed += 1;
      console.log(`  FAIL  ${file}`);
      console.log(`        ${(error as Error).message.split("\n").join("\n        ")}`);
    }
  }

  if (failed > 0) {
    console.log(`\n${failed} из ${files.length} миграций не применились.`);
    process.exit(1);
  }

  const { rows } = await db.query<{ tables: number; functions: number; policies: number }>(`
    select
      (select count(*) from pg_tables where schemaname = 'public') as tables,
      (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public') as functions,
      (select count(*) from pg_policies where schemaname = 'public') as policies
  `);

  const summary = rows[0];
  console.log(
    `\nВсе ${files.length} миграций применились: ` +
      `${summary.tables} таблиц, ${summary.functions} функций, ${summary.policies} политик.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
