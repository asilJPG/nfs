import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Продлевает сессию Supabase на навигациях сотрудников.
 *
 * Раньше здесь был `auth.getUser()` — это ВСЕГДА сетевой поход в Auth (Токио),
 * плюс ещё один такой же внутри `requireStaff`. Два лишних round-trip на каждый
 * клик. `getSession()` читает куку локально и идёт в сеть только когда токен
 * реально протух — тогда же и переписывает куки. Подлинность JWT проверяет
 * `getClaims()` в lib/auth и RLS на стороне Postgres, так что доверие не теряем.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          for (const { name, value } of list) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of list) response.cookies.set(name, value, options);
        },
      },
    },
  );

  await supabase.auth.getSession();
  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/staff/:path*", "/admin/:path*", "/register"],
};
