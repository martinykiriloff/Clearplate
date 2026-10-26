import { NextResponse, type NextRequest } from "next/server";

/**
 * Fast, optimistic redirect for signed-out visitors. The API is still the
 * source of truth: it validates the session on every request.
 */
const APP_PATHS = ["/today", "/diary", "/recipes", "/progress", "/settings", "/onboarding"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has("cp_session");

  if (!hasSession && APP_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (hasSession && (pathname === "/login" || pathname === "/register")) {
    const url = request.nextUrl.clone();
    url.pathname = "/today";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/today/:path*", "/diary/:path*", "/recipes/:path*", "/progress/:path*", "/settings/:path*", "/onboarding/:path*", "/login", "/register"],
};
