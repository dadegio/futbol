"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

type BreadcrumbsProps = {
  leagueId?: string;
};

const SECTION_LABELS: Record<string, string> = {
  table: "Classifica",
  calendar: "Calendario",
  playoffs: "Playoff",
  teams: "Squadre",
  players: "Giocatori",
  stats: "Statistiche",
  matches: "Partita",
};

export default function Breadcrumbs({ leagueId }: BreadcrumbsProps) {
  const pathname = usePathname();

  if (!leagueId) return null;

  const base = `/leagues/${leagueId}`;
  const rest = pathname.slice(base.length).replace(/^\//, "");
  const segments = rest ? rest.split("/") : [];

  if (segments.length === 0) return null;

  const crumbs: { label: string; href?: string }[] = [
    { label: "Overview", href: base },
  ];

  let accumulated = base;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    accumulated += `/${seg}`;
    const label = SECTION_LABELS[seg] ?? seg;
    const isLast = i === segments.length - 1;
    crumbs.push({ label, href: isLast ? undefined : accumulated });
  }

  return (
    <nav className="mb-4 flex items-center gap-1.5 text-sm text-[var(--foreground)]/45">
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight size={14} className="shrink-0" />}
          {crumb.href ? (
            <Link
              href={crumb.href}
              className="transition hover:text-[var(--foreground)]/80"
            >
              {crumb.label}
            </Link>
          ) : (
            <span className="text-[var(--foreground)]/70 font-medium">
              {crumb.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
