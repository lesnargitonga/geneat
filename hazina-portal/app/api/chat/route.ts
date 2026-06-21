// Backend proxy: forwards portal chat to FastAPI /mock/message.
// Configurable via NEXT_PUBLIC_BACKEND_URL (default http://localhost:8000).
// Note: also reachable via next.config rewrites for direct fetches.

import { NextRequest, NextResponse } from "next/server";
import { backendBase } from "@/lib/backend";

export async function POST(req: NextRequest) {
  const base = backendBase();
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const adminToken = process.env.ADMIN_API_TOKEN?.trim();
  if (adminToken) {
    headers.Authorization = `Bearer ${adminToken}`;
  }

  try {
    const r = await fetch(`${base}/mock/message`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      // Fail here before the browser's 35s guard so the client receives a
      // structured 502 and can preserve the checkout for a safe retry.
      signal: AbortSignal.timeout(32_000),
    });
    const body = await r.text();
    return new NextResponse(body, {
      status: r.status,
      headers: { "Content-Type": r.headers.get("content-type") || "application/json" },
    });
  } catch (e: any) {
    return NextResponse.json(
      { detail: `Backend unreachable: ${e?.message || "unknown"}` },
      { status: 502 },
    );
  }
}
