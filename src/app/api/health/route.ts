import { NextResponse } from "next/server";
import { getApplicationHealth } from "@/modules/core/application/health-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    return NextResponse.json(await getApplicationHealth(), { headers: NO_STORE });
  } catch {
    return NextResponse.json(
      {
        status: "degraded",
        database: "unavailable",
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: NO_STORE }
    );
  }
}
