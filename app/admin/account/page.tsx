import { requirePlatformAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PasswordForm } from "./PasswordForm";

export const dynamic = "force-dynamic";

export default async function AdminAccountPage() {
  const { userId } = await requirePlatformAdmin();
  const { data: userRow } = await supabaseAdmin().auth.admin.getUserById(userId);
  const email = userRow.user?.email ?? "";
  // Логин — часть до @stampy.local (мы храним в такой форме служебно).
  const login = email.replace(/@stampy\.local$/, "");

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <div>
        <h1 className="page-title">Аккаунт</h1>
        <p className="text-sm text-ink-soft mt-1">Платформенный администратор</p>
      </div>

      <section className="card p-5 md:p-6">
        <h2 className="card-title mb-1">Ваш вход</h2>
        <p className="text-xs text-ink-label mb-5">
          Этот логин используется на странице входа.
        </p>
        <div>
          <div className="field-label mb-1">Логин</div>
          <div className="text-sm font-mono text-white">{login || "—"}</div>
        </div>
      </section>

      <section className="card p-5 md:p-6">
        <h2 className="card-title mb-1">Сменить пароль</h2>
        <p className="text-xs text-ink-label mb-5">
          Понадобится текущий пароль. После смены не забудьте перезайти
          на других устройствах.
        </p>
        <PasswordForm />
      </section>
    </div>
  );
}
