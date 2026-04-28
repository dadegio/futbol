"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import DashboardShell from "src/app/_components/dashboard-shell";
import Card from "src/app/_components/ui/card";
import Badge from "src/app/_components/ui/badge";
import Link from "next/link";

type Row = {
  playerId: string;
  firstName: string;
  lastName: string;
  photoUrl?: string | null;
  teamName: string;
  teamBadgeUrl?: string | null;
  value: number;
};

type TabKey = "scorers" | "assists";

export default function StatsPage() {
  const { leagueId } = useParams<{ leagueId: string }>();

  const [scorers, setScorers] = useState<Row[]>([]);
  const [assists, setAssists] = useState<Row[]>([]);
  const [tab, setTab] = useState<TabKey>("scorers");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!leagueId) return;

    (async () => {
      setErr(null);

      try {
        const res = await fetch(`/api/leagues/${leagueId}/stats`, {
          cache: "no-store",
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error ?? "Errore stats");
        }

        setScorers(data.scorers ?? []);
        setAssists(data.assists ?? []);
      } catch (e: any) {
        setErr(e.message);
      }
    })();
  }, [leagueId]);

  if (!leagueId) return <div>Caricamento…</div>;

  const rows = tab === "scorers" ? scorers : assists;

  const title = tab === "scorers" ? "Top 10 Marcatori" : "Top 10 Assistman";

  const valueLabel = tab === "scorers" ? "gol" : "assist";

  return (
    <DashboardShell leagueId={leagueId}>
      <div className="w-full space-y-6 pb-8">
        <header className="pt-2">
          <h1 className="text-[31px] font-black tracking-[-0.06em] text-[var(--foreground)]">
            Statistiche
          </h1>
        </header>

        {err && <Badge variant="error">{err}</Badge>}

        <div className="flex flex-wrap gap-2">
          <TabButton
            active={tab === "scorers"}
            onClick={() => setTab("scorers")}
            label="Marcatori"
          />

          <TabButton
            active={tab === "assists"}
            onClick={() => setTab("assists")}
            label="Assist"
          />
        </div>

        <section className="space-y-3">
          <div className="text-base font-semibold text-[var(--foreground)]">
            {title}
          </div>

          <StatList rows={rows} leagueId={leagueId} valueLabel={valueLabel} />
        </section>
      </div>
    </DashboardShell>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-2xl border px-4 py-2 text-sm font-semibold transition",
        active
          ? "border-[var(--accent)] bg-[var(--accent)] text-white"
          : "border-[var(--border)] bg-[var(--card-2)] text-[var(--foreground)] hover:bg-[var(--card)]",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function StatList({
  rows,
  leagueId,
  valueLabel,
}: {
  rows: Row[];
  leagueId: string;
  valueLabel: string;
}) {
  if (rows.length === 0) {
    return (
      <Card>
        <span className="text-sm text-[var(--muted)]">Nessun dato.</span>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden !p-0">
      {rows.map((r, i) => (
        <Link
          key={r.playerId}
          href={`/leagues/${leagueId}/players/${r.playerId}`}
          className="grid items-center gap-3 border-b border-[var(--border)] px-4 py-3 transition hover:bg-[var(--card-2)] last:border-b-0"
          style={{ gridTemplateColumns: "24px 52px minmax(0,1fr) auto" }}
        >
          <span
            className="text-xs tabular-nums text-[var(--muted)]"
            style={{ fontFamily: "var(--font-mono, ui-monospace)" }}
          >
            {i + 1}
          </span>

          <PlayerAvatar
            firstName={r.firstName}
            lastName={r.lastName}
            photoUrl={r.photoUrl ?? null}
          />

          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold text-[var(--foreground)]">
              {r.firstName} {r.lastName}
            </div>

            <div className="mt-1 flex items-center gap-2 truncate text-xs text-[var(--muted)]">
              <TeamLogo name={r.teamName} badgeUrl={r.teamBadgeUrl ?? null} />
              <span className="truncate">{r.teamName}</span>
            </div>
          </div>

          <div className="text-right">
            <div
              className="text-[22px] font-semibold tabular-nums leading-none text-[var(--foreground)]"
              style={{ fontFamily: "var(--font-mono, ui-monospace)" }}
            >
              {r.value}
            </div>

            <div className="mt-1 text-[10px] uppercase tracking-wide text-[var(--muted)]">
              {valueLabel}
            </div>
          </div>
        </Link>
      ))}
    </Card>
  );
}

function PlayerAvatar({
  firstName,
  lastName,
  photoUrl,
}: {
  firstName: string;
  lastName: string;
  photoUrl: string | null;
}) {
  const initials = `${firstName} ${lastName}`
    .trim()
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={`${firstName} ${lastName}`}
        className="h-12 w-12 rounded-2xl border border-[var(--border)] object-cover"
      />
    );
  }

  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card-2)] text-sm font-black text-[var(--accent)]">
      {initials || "?"}
    </div>
  );
}

function TeamLogo({
  name,
  badgeUrl,
}: {
  name: string;
  badgeUrl: string | null;
}) {
  if (badgeUrl) {
    return (
      <img
        src={badgeUrl}
        alt={name}
        className="h-5 w-5 shrink-0 rounded-md object-contain"
      />
    );
  }

  return (
    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[var(--card-2)] text-[9px] font-black text-[var(--muted)]">
      {(name.match(/\b\w/g) || []).slice(0, 2).join("").toUpperCase() || "TM"}
    </div>
  );
}