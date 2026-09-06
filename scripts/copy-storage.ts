/**
 * Перелив бакета логотипов между проектами Supabase — storage не входит в
 * дамп базы, при переезде в другой регион файлы надо копировать отдельно.
 *
 * Запуск:
 *   OLD_SUPABASE_URL=... OLD_SERVICE_ROLE_KEY=... \
 *   NEW_SUPABASE_URL=... NEW_SERVICE_ROLE_KEY=... \
 *   npx tsx scripts/copy-storage.ts
 */
import { createClient } from "@supabase/supabase-js";

const BUCKET = "stampy-logos";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Не задана переменная ${name}`);
    process.exit(1);
  }
  return value;
}

const source = createClient(requireEnv("OLD_SUPABASE_URL"), requireEnv("OLD_SERVICE_ROLE_KEY"));
const target = createClient(requireEnv("NEW_SUPABASE_URL"), requireEnv("NEW_SERVICE_ROLE_KEY"));

/** Storage отдаёт по 100 объектов за раз и не рекурсивно — обходим папки сами. */
async function listAll(prefix = ""): Promise<string[]> {
  const paths: string[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await source.storage
      .from(BUCKET)
      .list(prefix, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`Не удалось прочитать ${prefix || "/"}: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      // у папок нет id — спускаемся внутрь
      if (entry.id === null) paths.push(...(await listAll(path)));
      else paths.push(path);
    }
    if (data.length < 100) break;
  }
  return paths;
}

async function main() {
  const { error: bucketError } = await target.storage.createBucket(BUCKET, { public: true });
  if (bucketError && !/already exists/i.test(bucketError.message)) {
    throw new Error(`Не удалось создать бакет: ${bucketError.message}`);
  }

  const paths = await listAll();
  console.log(`Файлов к переносу: ${paths.length}`);

  let copied = 0;
  const failed: string[] = [];

  for (const path of paths) {
    const { data, error } = await source.storage.from(BUCKET).download(path);
    if (error || !data) {
      failed.push(`${path} — скачивание: ${error?.message ?? "пусто"}`);
      continue;
    }
    const buffer = Buffer.from(await data.arrayBuffer());
    const { error: uploadError } = await target.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: data.type || "application/octet-stream", upsert: true });
    if (uploadError) {
      failed.push(`${path} — загрузка: ${uploadError.message}`);
      continue;
    }
    copied += 1;
    if (copied % 10 === 0) console.log(`  ${copied}/${paths.length}`);
  }

  console.log(`Перенесено: ${copied} из ${paths.length}`);
  if (failed.length > 0) {
    console.error("Не перенеслись:");
    for (const line of failed) console.error(`  ${line}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
