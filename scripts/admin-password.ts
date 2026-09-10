/**
 * Меняет пароль платформенному админу и сразу проверяет вход.
 *
 *   npx tsx scripts/admin-password.ts <логин> <пароль>
 *
 * Работает служебным ключом — запускать осознанно.
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./env";
import { loginToAuthEmail } from "../lib/login";

loadEnv();

async function main() {
  const [login, password] = process.argv.slice(2);
  if (!login || !password) throw new Error("использование: admin-password.ts <логин> <пароль>");

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const email = loginToAuthEmail(login);
  const { data: users, error } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;

  const user = users.users.find((u) => u.email === email);
  if (!user) throw new Error(`пользователя ${email} нет`);

  const { error: updateErr } = await db.auth.admin.updateUserById(user.id, { password });
  if (updateErr) throw updateErr;
  console.log(`пароль для ${email} обновлён`);

  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  const { error: signInErr } = await anon.auth.signInWithPassword({ email, password });
  console.log(signInErr ? `проверка входа: ОШИБКА ${signInErr.message}` : "проверка входа: успешно");
}

main().catch((e) => {
  console.error("ошибка:", e.message);
  process.exit(1);
});
