import { NextRequest, NextResponse } from "next/server";
import { getServerSession, requireAdmin } from "@/modules/permissions/server-guards";
import { addCaptainAssignment, removeCaptainAssignment } from "@/modules/admin/application/user-service";
import { apiErrorResponse, readJsonBody } from "@/modules/core/api";

export async function POST(req: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const actor = await getServerSession();
    const { userId } = await ctx.params;
    const body = await readJsonBody<Record<string, unknown>>(req);
    return NextResponse.json(await addCaptainAssignment({ userId, teamId: String(body.teamId ?? ""), actor }), { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "Errore associazione capitano");
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const actor = await getServerSession();
    const { userId } = await ctx.params;
    const assignmentId = req.nextUrl.searchParams.get("assignmentId");
    if (!assignmentId) return NextResponse.json({ error: "assignmentId mancante" }, { status: 400 });
    return NextResponse.json(await removeCaptainAssignment({ userId, assignmentId, actor }));
  } catch (error) {
    return apiErrorResponse(error, "Errore rimozione associazione capitano");
  }
}
