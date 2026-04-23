export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateBracket } from "@/lib/bracket";

type Ctx = { params: Promise<{ leagueId: string }> };

export async function GET(_: Request, ctx: Ctx) {
  const { leagueId } = await ctx.params;

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: {
      id: true,
      playoffFormat: true,
      playoffTeamCount: true,
      playoffSeeded: true,
    },
  });

  if (!league) {
    return NextResponse.json({ error: "Lega non trovata" }, { status: 404 });
  }

  if (!league.playoffFormat) {
    return NextResponse.json({ configured: false });
  }

  const series = await prisma.playoffSeries.findMany({
    where: { leagueId },
    orderBy: [{ bracketRound: "desc" }, { position: "asc" }],
    include: {
      homeTeam: { select: { id: true, name: true, badgeUrl: true } },
      awayTeam: { select: { id: true, name: true, badgeUrl: true } },
      winner: { select: { id: true, name: true } },
      matches: {
        orderBy: { leg: "asc" },
        select: {
          id: true,
          leg: true,
          homeGoals: true,
          awayGoals: true,
          homeTeamId: true,
          awayTeamId: true,
          date: true,
        },
      },
    },
  });

  return NextResponse.json({
    configured: true,
    format: league.playoffFormat,
    teamCount: league.playoffTeamCount,
    seeded: league.playoffSeeded,
    series,
  });
}

export async function POST(req: Request, ctx: Ctx) {
  const { leagueId } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const format = body?.format;
  if (format !== "SINGLE_ELIM" && format !== "TWO_LEG") {
    return NextResponse.json({ error: "Formato non valido (SINGLE_ELIM o TWO_LEG)" }, { status: 400 });
  }

  const teamCount = Number(body?.teamCount);
  if (![2, 4, 8, 16].includes(teamCount)) {
    return NextResponse.json({ error: "Numero squadre non valido (2, 4, 8 o 16)" }, { status: 400 });
  }

  const autoSeed = body?.autoSeed !== false;

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { id: true, playoffFormat: true },
  });

  if (!league) {
    return NextResponse.json({ error: "Lega non trovata" }, { status: 404 });
  }

  if (league.playoffFormat) {
    return NextResponse.json({ error: "Playoff già configurati. Eliminarli prima di crearne di nuovi." }, { status: 400 });
  }

  // Check there are enough teams
  const teamsInLeague = await prisma.team.count({ where: { leagueId } });
  if (teamsInLeague < teamCount) {
    return NextResponse.json(
      { error: `Servono almeno ${teamCount} squadre, ne hai ${teamsInLeague}` },
      { status: 400 }
    );
  }

  // Get seeding from standings if autoSeed
  let seedTeamIds: string[] | null = null;
  if (autoSeed) {
    seedTeamIds = await getStandingsTeamIds(leagueId, teamCount);
  }

  const bracket = generateBracket(teamCount);

  await prisma.$transaction(async (tx) => {
    // Update league with playoff config
    await tx.league.update({
      where: { id: leagueId },
      data: {
        playoffFormat: format,
        playoffTeamCount: teamCount,
        playoffSeeded: autoSeed,
      },
    });

    // Create series for later rounds first (no teams yet), so we have IDs for feedsInto
    // Work from final backward to first round
    const seriesIdMap = new Map<string, string>(); // "round-position" -> seriesId

    // Create all series without feedsInto first
    for (const s of bracket) {
      const created = await tx.playoffSeries.create({
        data: {
          leagueId,
          bracketRound: s.bracketRound,
          position: s.position,
          homeSeed: s.homeSeed,
          awaySeed: s.awaySeed,
          homeTeamId: s.homeSeed && seedTeamIds ? seedTeamIds[s.homeSeed - 1] ?? null : null,
          awayTeamId: s.awaySeed && seedTeamIds ? seedTeamIds[s.awaySeed - 1] ?? null : null,
        },
      });
      seriesIdMap.set(`${s.bracketRound}-${s.position}`, created.id);
    }

    // Set feedsInto links
    for (const s of bracket) {
      if (s.feedsIntoPosition !== null) {
        const nextRound = s.bracketRound / 2;
        const feedsIntoId = seriesIdMap.get(`${nextRound}-${s.feedsIntoPosition}`);
        if (feedsIntoId) {
          await tx.playoffSeries.update({
            where: { id: seriesIdMap.get(`${s.bracketRound}-${s.position}`)! },
            data: { feedsIntoSeriesId: feedsIntoId },
          });
        }
      }
    }

    // Create matches for first-round series that have both teams
    const firstRound = teamCount / 2;
    for (const s of bracket) {
      if (s.bracketRound !== firstRound) continue;
      const seriesId = seriesIdMap.get(`${s.bracketRound}-${s.position}`)!;
      const homeTeamId = s.homeSeed && seedTeamIds ? seedTeamIds[s.homeSeed - 1] : null;
      const awayTeamId = s.awaySeed && seedTeamIds ? seedTeamIds[s.awaySeed - 1] : null;

      if (homeTeamId && awayTeamId) {
        await tx.match.create({
          data: {
            leagueId,
            round: 0,
            homeTeamId,
            awayTeamId,
            seriesId,
            leg: 1,
          },
        });

        if (format === "TWO_LEG") {
          await tx.match.create({
            data: {
              leagueId,
              round: 0,
              homeTeamId: awayTeamId,
              awayTeamId: homeTeamId,
              seriesId,
              leg: 2,
            },
          });
        }
      }
    }
  });

  return NextResponse.json({ ok: true, format, teamCount });
}

export async function DELETE(_: Request, ctx: Ctx) {
  const { leagueId } = await ctx.params;

  await prisma.$transaction(async (tx) => {
    // Delete playoff matches (seriesId is not null)
    await tx.match.deleteMany({ where: { leagueId, seriesId: { not: null } } });

    // Delete all series
    // Must clear feedsInto references first to avoid FK constraint issues
    await tx.playoffSeries.updateMany({
      where: { leagueId },
      data: { feedsIntoSeriesId: null },
    });
    await tx.playoffSeries.deleteMany({ where: { leagueId } });

    // Reset league playoff config
    await tx.league.update({
      where: { id: leagueId },
      data: {
        playoffFormat: null,
        playoffTeamCount: null,
        playoffSeeded: true,
      },
    });
  });

  return NextResponse.json({ ok: true });
}

async function getStandingsTeamIds(leagueId: string, limit: number): Promise<string[]> {
  const teams = await prisma.team.findMany({
    where: { leagueId },
    select: { id: true, name: true },
  });

  const matches = await prisma.match.findMany({
    where: {
      leagueId,
      seriesId: null,
      homeGoals: { not: null },
      awayGoals: { not: null },
    },
    select: { homeTeamId: true, awayTeamId: true, homeGoals: true, awayGoals: true },
  });

  const stats = new Map<string, { points: number; gd: number; gf: number; ga: number; name: string }>();
  for (const t of teams) {
    stats.set(t.id, { points: 0, gd: 0, gf: 0, ga: 0, name: t.name });
  }

  for (const m of matches) {
    const hg = m.homeGoals ?? 0;
    const ag = m.awayGoals ?? 0;
    const home = stats.get(m.homeTeamId);
    const away = stats.get(m.awayTeamId);
    if (!home || !away) continue;

    home.gf += hg;
    home.ga += ag;
    away.gf += ag;
    away.ga += hg;

    if (hg > ag) {
      home.points += 3;
    } else if (hg < ag) {
      away.points += 3;
    } else {
      home.points += 1;
      away.points += 1;
    }
  }

  for (const s of stats.values()) {
    s.gd = s.gf - s.ga;
  }

  return Array.from(stats.entries())
    .sort(([, a], [, b]) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.gd !== a.gd) return b.gd - a.gd;
      if (b.gf !== a.gf) return b.gf - a.gf;
      if (a.ga !== b.ga) return a.ga - b.ga;
      return a.name.localeCompare(b.name);
    })
    .slice(0, limit)
    .map(([id]) => id);
}
