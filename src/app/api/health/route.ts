import { NextResponse } from "next/server";
import { getApplicationHealth } from "@/modules/core/application/health-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    const health = await getApplicationHealth();
    return NextResponse.json(health, {
      status: health.status === "ok" ? 200 : 503,
      headers: NO_STORE,
    });
  } catch (error) {
    console.error("[health] Database probe failed:", error);
    return NextResponse.json(
      {
        status: "degraded",
        database: "unavailable",
        schema: "unknown",
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: NO_STORE }
    );
  }
}
