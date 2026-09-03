import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { RegisterForm } from "@/components/register/RegisterForm";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Уже вошедшему с привязанной кофейней здесь делать нечего.
  if (user) {
    const { data: staff } = await supabase
      .from("stampy_staff_users")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (staff) redirect("/dashboard");
  }

  return <RegisterForm />;
}
