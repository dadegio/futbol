export const runtime = "nodejs";

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import DashboardShell from "src/app/_components/dashboard-shell";
import Link from "next/link";
import { CalendarDays, Trophy, Users, BarChart3, Swords } from "lucide-react";

export default async function LeagueHome({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: {
      id: true,
      name: true,
      playoffFormat: true,
      _count: {
        select: {
          teams: true,
          matches: true,
        },
      },
    },
  });

  if (!league) return notFound();

  const stats = [
    {
      label: "Squadre",
      value: league._count.teams,
      icon: <Users size={18} />,
      href: `/leagues/${leagueId}/teams`,
    },
    {
      label: "Partite",
      value: league._count.matches,
      icon: <CalendarDays size={18} />,
      href: `/leagues/${leagueId}/calendar`,
    },
    {
      label: "Classifica",
      value: "Live",
      icon: <Trophy size={18} />,
      href: `/leagues/${leagueId}/table`,
    },
    {
      label: "Statistiche",
      value: "Top 5",
      icon: <BarChart3 size={18} />,
      href: `/leagues/${leagueId}/stats`,
    },
    {
      label: "Playoff",
      value: league.playoffFormat
        ? league.playoffFormat === "TWO_LEG" ? "A/R" : "Diretta"
        : "—",
      icon: <Swords size={18} />,
      href: `/leagues/${leagueId}/playoffs`,
    },
  ];

  return (
    <DashboardShell leagueId={leagueId}>
      <div className="space-y-6">

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="rounded-[24px] border border-white/8 bg-[#121214]/95 p-5 shadow-xl shadow-black/15 transition hover:-translate-y-0.5 hover:border-[var(--accent)]/30"
            >
              <div className="mb-4 inline-flex rounded-2xl bg-[var(--accent)]/10 p-3 text-[var(--accent)]">
                {item.icon}
              </div>
              <div className="text-sm uppercase tracking-[0.18em] text-white/40">{item.label}</div>
              <div className="mt-2 text-3xl font-black text-white">{item.value}</div>
            </Link>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[28px] border border-white/8 bg-[#121214]/95 p-6 shadow-2xl shadow-black/20">
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--accent)]">
              Cosa puoi fare
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-white/[0.04] p-5">
                <div className="text-lg font-bold text-white">Calendario partite</div>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  Visualizza tutte le giornate, genera il calendario e inserisci i risultati delle partite.
                </p>
                <Link
                  href={`/leagues/${leagueId}/calendar`}
                  className="mt-4 inline-flex rounded-2xl bg-[var(--accent)] px-4 py-2 font-semibold text-black"
                >
                  Vai al calendario
                </Link>
              </div>

              <div className="rounded-2xl bg-white/[0.04] p-5">
                <div className="text-lg font-bold text-white">Gestione squadre</div>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  Crea nuove squadre, gestisci le rose e tieni organizzato il torneo.
                </p>
                <Link
                  href={`/leagues/${leagueId}/teams`}
                  className="mt-4 inline-flex rounded-2xl bg-[var(--accent)] px-4 py-2 font-semibold text-black"
                >
                  Vai alle squadre
                </Link>
              </div>

              <div className="rounded-2xl bg-white/[0.04] p-5">
                <div className="text-lg font-bold text-white">Classifica live</div>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  Controlla punti, vittorie, differenza reti e andamento del campionato.
                </p>
                <Link
                  href={`/leagues/${leagueId}/table`}
                  className="mt-4 inline-flex rounded-2xl bg-[var(--accent)] px-4 py-2 font-semibold text-black"
                >
                  Vai alla classifica
                </Link>
              </div>

              <div className="rounded-2xl bg-white/[0.04] p-5">
                <div className="text-lg font-bold text-white">Top stats</div>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  Guarda top marcatori e assistman del torneo in una vista più leggibile.
                </p>
                <Link
                  href={`/leagues/${leagueId}/stats`}
                  className="mt-4 inline-flex rounded-2xl bg-[var(--accent)] px-4 py-2 font-semibold text-black"
                >
                  Vai alle stats
                </Link>
              </div>

              <div className="rounded-2xl bg-white/[0.04] p-5">
                <div className="text-lg font-bold text-white">Playoff</div>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  {league.playoffFormat
                    ? "Gestisci il tabellone, inserisci risultati e avanza le squadre."
                    : "Configura la fase a eliminazione dopo il campionato."}
                </p>
                <Link
                  href={`/leagues/${leagueId}/playoffs`}
                  className="mt-4 inline-flex rounded-2xl bg-[var(--accent)] px-4 py-2 font-semibold text-black"
                >
                  {league.playoffFormat ? "Vai ai playoff" : "Configura playoff"}
                </Link>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/8 bg-[#121214]/95 p-6 shadow-2xl shadow-black/20">
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--accent)]">
              Snapshot
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-2xl bg-white/[0.04] p-4">
                <div className="text-sm text-white/45">Nome torneo</div>
                <div className="mt-1 text-xl font-bold text-white">{league.name}</div>
              </div>

              <div className="rounded-2xl bg-white/[0.04] p-4">
                <div className="text-sm text-white/45">Squadre registrate</div>
                <div className="mt-1 text-xl font-bold text-white">{league._count.teams}</div>
              </div>

              <div className="rounded-2xl bg-white/[0.04] p-4">
                <div className="text-sm text-white/45">Partite create</div>
                <div className="mt-1 text-xl font-bold text-white">{league._count.matches}</div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}