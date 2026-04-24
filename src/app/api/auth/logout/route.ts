import { NextResponse } from "next/server";

// Token lives in localStorage — nothing to do server-side.
export async function POST() {
  return NextResponse.json({ ok: true });
}
