import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { PARTNER_COOKIE, PARTNER_COOKIE_VALUE } from "@/lib/partner-session";

export function middleware(request: NextRequest) {
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
  matcher: ["/partners/login", "/partners/dashboard"],
};
