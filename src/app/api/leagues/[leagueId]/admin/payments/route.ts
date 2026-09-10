export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { apiErrorResponse, readJsonBody } from "@/modules/core/api";
import { getServerSession, requireLeagueAdmin } from "@/modules/permissions/server-guards";
import { recordTeamFeePayment } from "@/modules/admin/application/team-fee-payment-service";
import { writeAuditLog } from "@/modules/audit/application/audit-service";

export async function POST(req: Request, ctx: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await ctx.params;
  const authErr = await requireLeagueAdmin(leagueId); if (authErr) return authErr;
  try {
    const input = await readJsonBody<{ teamId?: unknown; amountCents?: unknown; note?: unknown }>(req);
    const session = await getServerSession();
    const result = await recordTeamFeePayment(leagueId, input);
    await writeAuditLog({ leagueId, actor: session, action: "team.fee_payment", entityType: "team", entityId: String(input.teamId ?? ""), summary: `Registrato pagamento quota ${result.teamName}`, metadata: { amountCents: result.payment.amountCents } });
    return NextResponse.json(result);
  } catch (error) { return apiErrorResponse(error, "Registrazione pagamento non riuscita"); }
}
