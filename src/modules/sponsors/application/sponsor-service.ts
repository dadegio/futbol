import { prisma } from "@/lib/prisma";
import { AppError } from "@/modules/core/errors";
import {
  parseSponsorCreateInput,
  parseSponsorPatchInput,
} from "@/modules/sponsors/domain/sponsor-input";

export async function listSponsors({
  leagueId,
  includeHidden,
}: {
  leagueId: string;
  includeHidden: boolean;
}) {
  return prisma.sponsor.findMany({
    where: {
      leagueId,
      ...(includeHidden ? {} : { active: true }),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function createSponsor({
  leagueId,
  input,
}: {
  leagueId: string;
  input: Record<string, unknown>;
}) {
  const parsed = parseSponsorCreateInput(input);
  if ("error" in parsed) throw new AppError(400, parsed.error);

  return prisma.sponsor.create({
    data: { ...parsed.data, leagueId },
  });
}

export async function updateSponsor({
  sponsorId,
  input,
}: {
  sponsorId: string;
  input: Record<string, unknown>;
}) {
  const parsed = parseSponsorPatchInput(input);
  if ("error" in parsed) throw new AppError(400, parsed.error);

  return prisma.sponsor.update({
    where: { id: sponsorId },
    data: parsed.data,
  });
}

export async function deleteSponsor({ sponsorId }: { sponsorId: string }) {
  await prisma.sponsor.delete({ where: { id: sponsorId } });
  return { ok: true };
}

export async function getSponsorLeagueId(sponsorId: string) {
  const sponsor = await prisma.sponsor.findUnique({
    where: { id: sponsorId },
    select: { leagueId: true },
  });

  if (!sponsor) throw new AppError(404, "Sponsor non trovato");
  return sponsor.leagueId;
}
