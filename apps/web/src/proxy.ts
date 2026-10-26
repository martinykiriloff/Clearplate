import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, isLocale, negotiateLocale, splitLocale } from "@/i18n/config";

/**
 * 1. Every page lives under /en or /bg. Unprefixed URLs (/, /today, OAuth
 *    redirects from the API) are sent to the visitor's language: remembered
 *    cookie first, then the browser's Accept-Language.
 * 2. Fast, optimistic auth redirects by session cookie. The API still
 *    validates the session on every request.
 */
const APP_PATHS = ["/today", "/diary", "/recipes", "/progress", "/settings", "/onboarding", "/upgrade"];
const AUTH_PATHS = ["/login", "/register"];
const YEAR = 60 * 60 * 24 * 365;

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const { locale, rest } = splitLocale(pathname);

  if (!locale) {
    const remembered = request.cookies.get(LOCALE_COOKIE)?.value;
    const target = isLocale(remembered) ? remembered : negotiateLocale(request.headers.get("accept-language"));
    const url = request.nextUrl.clone();
    url.pathname = `/${target}${pathname === "/" ? "" : pathname}`;
    url.search = search;
    return NextResponse.redirect(url);
  }

  const hasSession = request.cookies.has("cp_session");
  let response: NextResponse;
  if (!hasSession && APP_PATHS.some((p) => rest === p || rest.startsWith(`${p}/`))) {
    response = NextResponse.redirect(new URL(`/${locale}/login`, request.url));
  } else if (hasSession && AUTH_PATHS.includes(rest) && !request.nextUrl.searchParams.has("error")) {
    response = NextResponse.redirect(new URL(`/${locale}/today`, request.url));
  } else {
    response = NextResponse.next();
  }

  // Remember the language the visitor is actually using.
  if (request.cookies.get(LOCALE_COOKIE)?.value !== locale) {
    response.cookies.set(LOCALE_COOKIE, locale, { path: "/", maxAge: YEAR, sameSite: "lax" });
  }
  return response;
}

export const config = {
  // Everything except the API proxy, Next internals and files with an extension.
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
