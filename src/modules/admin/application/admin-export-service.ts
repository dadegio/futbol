import { prisma } from "@/lib/prisma";
import { AppError } from "@/modules/core/errors";
import { FUTPOLI_RULES } from "@/modules/players/domain/tournament-rules";

export type AdminExportKind = "calendar" | "results" | "scorers" | "fees" | "players";

function cell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function csv(rows: unknown[][]) {
  return `\uFEFF${rows.map((row) => row.map(cell).join(";")).join("\n")}`;
}

function dateTime(value: Date | null) {
  return value
    ? value.toLocaleString("it-IT", { timeZone: "Europe/Rome", dateStyle: "short", timeStyle: "short" })
    : "";
}

function slug(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function getAdminExport(leagueId: string, kind: AdminExportKind) {
  const league = await prisma.league.findUnique({ where: { id: leagueId }, select: { name: true } });
  if (!league) throw new AppError(404, "Torneo non trovato", "LEAGUE_NOT_FOUND");

  let rows: unknown[][];
  if (kind === "calendar") {
    const matches = await prisma.match.findMany({
      where: { leagueId },
      orderBy: [{ date: "asc" }, { round: "asc" }],
      select: {
        round: true,
        date: true,
        venueName: true,
        lifecycleStatus: true,
        resultStatus: true,
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
        referee: { select: { name: true } },
      },
    });
    rows = [
      ["Giornata", "Data", "Casa", "Ospite", "Campo", "Arbitro", "Stato gara", "Stato risultato"],
      ...matches.map((match) => [
        match.round,
        dateTime(match.date),
        match.homeTeam.name,
        match.awayTeam.name,
        match.venueName ?? "",
        match.referee?.name ?? "",
        match.lifecycleStatus,
        match.resultStatus ?? "",
      ]),
    ];
  } else if (kind === "results") {
    const matches = await prisma.match.findMany({
      where: { leagueId, resultStatus: "FINAL" },
      orderBy: [{ date: "asc" }, { round: "asc" }],
      select: {
        round: true,
        date: true,
        homeGoals: true,
        awayGoals: true,
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
        mvpPlayer: { select: { firstName: true, lastName: true } },
      },
    });
    rows = [
      ["Giornata", "Data", "Casa", "Gol casa", "Gol ospite", "Ospite", "MVP"],
      ...matches.map((match) => [
        match.round,
        dateTime(match.date),
        match.homeTeam.name,
        match.homeGoals ?? 0,
        match.awayGoals ?? 0,
        match.awayTeam.name,
        match.mvpPlayer ? `${match.mvpPlayer.firstName} ${match.mvpPlayer.lastName}` : "",
      ]),
    ];
  } else if (kind === "scorers") {
    const stats = await prisma.matchPlayerStat.findMany({
      where: { match: { leagueId, resultStatus: "FINAL" }, goals: { gt: 0 } },
      orderBy: [{ match: { date: "asc" } }, { goals: "desc" }],
      select: {
        goals: true,
        assists: true,
        player: { select: { firstName: true, lastName: true, number: true, team: { select: { name: true } } } },
        match: { select: { round: true, date: true, homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } } },
      },
    });
    rows = [
      ["Giornata", "Data", "Partita", "Giocatore", "Squadra", "Numero", "Gol", "Assist"],
      ...stats.map((stat) => [
        stat.match.round,
        dateTime(stat.match.date),
        `${stat.match.homeTeam.name} - ${stat.match.awayTeam.name}`,
        `${stat.player.firstName} ${stat.player.lastName}`,
        stat.player.team.name,
        stat.player.number,
        stat.goals,
        stat.assists,
      ]),
    ];
  } else if (kind === "fees") {
    const [teams, appearances, payments] = await Promise.all([
      prisma.team.findMany({ where: { leagueId, activeInLeague: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      prisma.matchSheetPlayer.groupBy({
        by: ["teamId"],
        _count: { _all: true },
        where: { match: { leagueId, resultStatus: "FINAL" } },
      }),
      prisma.teamFeePayment.groupBy({ by: ["teamId"], _sum: { amountCents: true }, where: { leagueId } }),
    ]);
    const appearancesByTeam = new Map(appearances.map((row) => [row.teamId, row._count._all]));
    const paidByTeam = new Map(payments.map((row) => [row.teamId, row._sum.amountCents ?? 0]));
    rows = [
      ["Squadra", "Presenze", "Maturato EUR", "Pagato EUR", "Residuo EUR"],
      ...teams.map((team) => {
        const count = appearancesByTeam.get(team.id) ?? 0;
        const due = count * FUTPOLI_RULES.playerFeeCentsPerAppearance;
        const paid = paidByTeam.get(team.id) ?? 0;
        return [team.name, count, (due / 100).toFixed(2), (paid / 100).toFixed(2), (Math.max(0, due - paid) / 100).toFixed(2)];
      }),
    ];
  } else if (kind === "players") {
    const players = await prisma.player.findMany({
      where: { team: { leagueId, activeInLeague: true } },
      orderBy: [{ team: { name: "asc" } }, { lastName: "asc" }, { firstName: "asc" }],
      select: {
        firstName: true,
        lastName: true,
        number: true,
        position: true,
        status: true,
        wildcardUsed: true,
        documentSigned: true,
        mediaConsent: true,
        team: { select: { name: true } },
      },
    });
    rows = [
      ["Squadra", "Nome", "Cognome", "Numero", "Ruolo", "Stato", "Wildcard", "Modulo", "Liberatoria media"],
      ...players.map((player) => [
        player.team.name,
        player.firstName,
        player.lastName,
        player.number,
        player.position ?? "",
        player.status,
        player.wildcardUsed ? "Sì" : "No",
        player.documentSigned ? "Sì" : "No",
        player.mediaConsent ? "Sì" : "No",
      ]),
    ];
  } else {
    throw new AppError(400, "Tipo export non supportato", "INVALID_EXPORT_KIND");
  }

  return {
    filename: `${kind}-${slug(league.name) || "torneo"}.csv`,
    content: csv(rows),
  };
}
