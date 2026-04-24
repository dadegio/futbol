import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-auth";

export async function GET() {
  const user = await getServerSession();
  return NextResponse.json({ user: user ?? null });
}
