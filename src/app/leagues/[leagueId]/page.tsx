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
      <div className="space-y-5">

        {/* Stat cards */}
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {stats.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--accent)]/30"
            >
              <div className="mb-3 inline-flex rounded-xl bg-[var(--accent)]/10 p-2.5 text-[var(--accent)]">
                {item.icon}
              </div>
              <div className="text-xs font-medium uppercase tracking-widest text-[var(--foreground)]/45">
                {item.label}
              </div>
              <div className="mt-1 text-2xl font-black text-[var(--foreground)]">{item.value}</div>
            </Link>
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          {/* Quick links */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-widest text-[var(--accent)]/70">
              Cosa puoi fare
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {[
                {
                  title: "Calendario partite",
                  description: "Visualizza tutte le giornate, genera il calendario e inserisci i risultati.",
                  href: `/leagues/${leagueId}/calendar`,
                  cta: "Vai al calendario",
                },
                {
                  title: "Gestione squadre",
                  description: "Crea nuove squadre, gestisci le rose e tieni organizzato il torneo.",
                  href: `/leagues/${leagueId}/teams`,
                  cta: "Vai alle squadre",
                },
                {
                  title: "Classifica live",
                  description: "Controlla punti, vittorie, differenza reti e andamento del campionato.",
                  href: `/leagues/${leagueId}/table`,
                  cta: "Vai alla classifica",
                },
                {
                  title: "Top stats",
                  description: "Guarda top marcatori e assistman del torneo in una vista leggibile.",
                  href: `/leagues/${leagueId}/stats`,
                  cta: "Vai alle stats",
                },
                {
                  title: "Playoff",
                  description: league.playoffFormat
                    ? "Gestisci il tabellone, inserisci risultati e avanza le squadre."
                    : "Configura la fase a eliminazione dopo il campionato.",
                  href: `/leagues/${leagueId}/playoffs`,
                  cta: league.playoffFormat ? "Vai ai playoff" : "Configura playoff",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-[var(--border)] bg-[var(--card-2)] p-4"
                >
                  <p className="font-semibold text-[var(--foreground)]">{item.title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--foreground)]/55">
                    {item.description}
                  </p>
                  <Link
                    href={item.href}
                    className="mt-3 inline-flex rounded-xl bg-[var(--accent)] px-3.5 py-2 text-xs font-semibold text-black transition-colors hover:bg-[var(--accent-2)]"
                  >
                    {item.cta}
                  </Link>
                </div>
              ))}
            </div>
          </div>

          {/* Snapshot */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-widest text-[var(--accent)]/70">
              Snapshot
            </p>
            <div className="mt-4 space-y-3">
              {[
                { label: "Nome torneo", value: league.name },
                { label: "Squadre registrate", value: league._count.teams },
                { label: "Partite create", value: league._count.matches },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border border-[var(--border)] bg-[var(--card-2)] p-4"
                >
                  <p className="text-xs text-[var(--foreground)]/50">{s.label}</p>
                  <p className="mt-1 text-xl font-bold text-[var(--foreground)]">{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
