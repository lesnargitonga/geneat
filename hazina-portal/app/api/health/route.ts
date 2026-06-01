import { NextResponse } from "next/server";
import { backendBase } from "@/lib/backend";

export async function GET() {
  const base = backendBase();
  try {
    const res = await fetch(`${base}/healthz`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    const body = await res.json().catch(() => ({}));
    return NextResponse.json({
      ok: res.ok,
      backend: base,
      status: body?.status || (res.ok ? "ok" : "unknown"),
      orders_api: `${base}/api/public/orders/{ref}?token=…`,
    }, { status: res.ok ? 200 : 503 });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({
      ok: false,
      backend: base,
      status: "unreachable",
      detail: err?.message || "Backend health check failed",
    }, { status: 503 });
  }
}
