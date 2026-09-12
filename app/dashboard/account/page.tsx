import { requireRole } from "@/lib/auth";
import { PasswordForm } from "./PasswordForm";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
  owner: "Владелец",
  manager: "Управляющий",
};

export default async function AccountPage() {
  // Бариста сюда не пускается — свой пароль ему выдаёт руководитель.
  const { staff, tenant } = await requireRole("owner", "manager");

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <div>
        <h1 className="page-title">Аккаунт</h1>
        <p className="text-sm text-ink-soft mt-1">
          {ROLE_LABELS[staff.role] ?? staff.role} · {tenant.name}
        </p>
      </div>

      <section className="card p-5 md:p-6">
        <h2 className="card-title mb-1">Ваш вход</h2>
        <p className="text-xs text-ink-label mb-5">
          Логин используется на странице входа и в мобильных приложениях сотрудников.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 mb-6">
          <div>
            <div className="field-label mb-1">Логин</div>
            <div className="text-sm font-mono text-white">{staff.username}</div>
          </div>
          {staff.name && (
            <div>
              <div className="field-label mb-1">Имя</div>
              <div className="text-sm text-white">{staff.name}</div>
            </div>
          )}
        </div>
      </section>

      <section className="card p-5 md:p-6">
        <h2 className="card-title mb-1">Сменить пароль</h2>
        <p className="text-xs text-ink-label mb-5">
          Понадобится текущий пароль. После смены не забудьте войти заново
          на других устройствах.
        </p>
        <PasswordForm />
      </section>

      {staff.role === "owner" && (
        <p className="text-[11px] text-ink-label">
          Пароли сотрудников (управляющих и бариста) назначаются на странице{" "}
          <span className="text-ink-body">Точки и сотрудники</span>. Бариста сам сменить его не может — обратитесь к владельцу.
        </p>
      )}
    </div>
  );
}
