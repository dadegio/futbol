import { prisma } from "@/lib/prisma";
import { AppError } from "@/modules/core/errors";
import { FUTPOLI_RULES } from "@/modules/players/domain/tournament-rules";

export async function recordTeamFeePayment(leagueId: string, input: { teamId?: unknown; amountCents?: unknown; note?: unknown }) {
  const teamId = String(input.teamId ?? "").trim();
  const amountCents = Math.round(Number(input.amountCents));
  const note = String(input.note ?? "").trim().slice(0, 240) || null;
  if (!teamId || !Number.isInteger(amountCents) || amountCents <= 0) {
    throw new AppError(400, "Squadra o importo non valido", "INVALID_PAYMENT");
  }

  const team = await prisma.team.findFirst({ where: { id: teamId, leagueId, activeInLeague: true }, select: { id: true, name: true } });
  if (!team) throw new AppError(404, "Squadra non trovata", "TEAM_NOT_FOUND");

  const [appearances, paid] = await Promise.all([
    prisma.matchSheetPlayer.count({ where: { teamId, match: { leagueId, resultStatus: "FINAL" } } }),
    prisma.teamFeePayment.aggregate({ where: { leagueId, teamId }, _sum: { amountCents: true } }),
  ]);
  const due = appearances * FUTPOLI_RULES.playerFeeCentsPerAppearance;
  const alreadyPaid = paid._sum.amountCents ?? 0;
  const outstanding = Math.max(0, due - alreadyPaid);
  if (amountCents > outstanding) {
    throw new AppError(400, `L'importo supera il residuo di ${(outstanding / 100).toFixed(2)} €`, "PAYMENT_EXCEEDS_OUTSTANDING");
  }

  const payment = await prisma.teamFeePayment.create({ data: { leagueId, teamId, amountCents, note } });
  return { ok: true, payment, teamName: team.name, dueCents: due, paidCents: alreadyPaid + amountCents, outstandingCents: outstanding - amountCents };
}
