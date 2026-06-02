import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { PARTNER_COOKIE, PARTNER_COOKIE_VALUE } from "@/lib/partner-session";

const APEX_HOST = "hazina.lesnarai.co.ke";
const WWW_HOST = `www.${APEX_HOST}`;

export function middleware(request: NextRequest) {
  const host = (request.headers.get("host") || "").toLowerCase();
  if (host === WWW_HOST) {
    const url = request.nextUrl.clone();
    url.host = APEX_HOST;
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }

  const { pathname } = request.nextUrl;
  const isPartnerAuthed =
    request.cookies.get(PARTNER_COOKIE)?.value === PARTNER_COOKIE_VALUE;

  if (pathname.startsWith("/partners/dashboard")) {
    if (!isPartnerAuthed) {
      const login = new URL("/partners/login", request.url);
      login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }
    return NextResponse.next();
  }

  if (pathname === "/partners/login" && isPartnerAuthed) {
    return NextResponse.redirect(new URL("/partners/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
