import { NextRequest, NextResponse } from "next/server";
import {
  PARTNER_COOKIE,
  PARTNER_COOKIE_VALUE,
  partnerCredentialsValid,
  partnerPortalConfigured,
} from "@/lib/partner-session";

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
  }

  if (!partnerPortalConfigured()) {
    return NextResponse.json(
      { detail: "Partner portal is not configured. Contact concierge@hazina-nomads.com." },
      { status: 503 },
    );
  }

  const email = body.email || "";
  const password = body.password || "";
  if (!partnerCredentialsValid(email, password)) {
    return NextResponse.json({ detail: "Invalid email or password." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(PARTNER_COOKIE, PARTNER_COOKIE_VALUE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
