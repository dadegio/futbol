import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { resolveLeagueBranding } from "@/modules/branding/domain/league-branding";

export const runtime = "nodejs";

export async function generateMetadata({ params }: { params: Promise<{ leagueId: string }> }): Promise<Metadata> {
  const { leagueId } = await params;
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: {
      name: true,
      themeMode: true,
      brandLogoUrl: true,
      brandCoverUrl: true,
      brandPrimaryColor: true,
      brandSecondaryColor: true,
      brandBackgroundColor: true,
    },
  });

  if (!league) return { title: "Torneo" };
  const brand = resolveLeagueBranding(league);
  return {
    title: league.name,
    description: `Risultati, squadre, calendario e statistiche di ${league.name}`,
    icons: brand.logoUrl ? { icon: brand.logoUrl, apple: brand.logoUrl } : undefined,
  };
}

export default function LeagueLayout({ children }: { children: React.ReactNode }) {
  return children;
}
