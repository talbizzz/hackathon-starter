import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { landingSkipTarget, SKIP_COOKIE } from "@/lib/ad-traffic";

// Refreshes the Supabase session on every request and guards the (app) routes.
// Add new protected paths to PROTECTED.
const PROTECTED = ["/dashboard", "/stats", "/admin"];

export async function proxy(request: NextRequest) {
  // Ad / social visitors skip the landing page: a 302 before any HTML, so it never flashes.
  if (request.nextUrl.pathname === "/") {
    const skip = landingSkipTarget(request.nextUrl, request.headers.get("referer"));
    if (skip) {
      const url = request.nextUrl.clone();
      url.pathname = skip.path;
      url.search = skip.search;
      const redirect = NextResponse.redirect(url, 302);
      // The browser reads this once to fire "landing_skipped" (see providers.tsx), then deletes it.
      redirect.cookies.set(SKIP_COOKIE, JSON.stringify({ utm_source: skip.utmSource.slice(0, 100), referrer: skip.referrer.slice(0, 200) }), {
        path: "/",
        maxAge: 60,
        sameSite: "lax",
      });
      redirect.headers.set("Cache-Control", "private, no-store");
      return redirect;
    }
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(list) {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const signedIn = !!data?.claims;
  const path = request.nextUrl.pathname;

  if (!signedIn && PROTECTED.some((p) => path === p || path.startsWith(p + "/"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (signedIn && (path === "/login" || path === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
