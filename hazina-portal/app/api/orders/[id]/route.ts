import { NextRequest, NextResponse } from "next/server";
import { backendBase } from "@/lib/backend";

type RouteContext = { params: { id: string } };

/** Proxy token-gated order tracking to FastAPI (same contract as the orders page). */
export async function GET(req: NextRequest, { params }: RouteContext) {
  const token = req.nextUrl.searchParams.get("token")?.trim() || "";
  if (!token) {
    return NextResponse.json({ detail: "Missing token" }, { status: 400 });
  }

  const base = backendBase();
  const orderId = encodeURIComponent(params.id.trim());
  const url = `${base}/api/public/orders/${orderId}?token=${encodeURIComponent(token)}`;

  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("content-type") || "application/json" },
    });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json(
      { detail: `Backend unreachable: ${err?.message || "unknown"}` },
      { status: 502 },
    );
  }
}
