import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { clearImpersonation } from "@/lib/impersonate";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = await supabaseServer();
  // Иначе после выхода админ, зашедший под тем же браузером, автоматически
  // окажется в дашборде подмены — cookie переживает Supabase-сессию.
  await clearImpersonation();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
