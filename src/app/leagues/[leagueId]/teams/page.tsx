"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { useParams } from "next/navigation";
import DashboardShell from "src/app/_components/dashboard-shell";
import Card from "src/app/_components/ui/card";
import Button from "src/app/_components/ui/button";
import Input from "src/app/_components/ui/input";
import Badge from "src/app/_components/ui/badge";
import { authFetch } from "@/lib/client-auth";

type TeamRow = {
  id: string;
  name: string;
  badgeUrl?: string | null;
  players?: Array<{ id: string }>;
  _count?: { players: number };
};

export default function TeamsPage() {
  const { leagueId } = useParams<{ leagueId: string }>();

  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [name, setName] = useState("");
  const [badgeUrl, setBadgeUrl] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateTeam, setShowCreateTeam] = useState(false);

  async function load() {
    setErr(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/leagues/${leagueId}/teams`, {
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          (data as any)?.error ?? "Errore caricamento squadre"
        );
      }

      setTeams(data);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!leagueId) return;
    load();
  }, [leagueId]);

  async function createTeam() {
    setErr(null);
    setMsg(null);

    const teamName = name.trim();

    if (!teamName) {
      setErr("Inserisci il nome squadra");
      return;
    }

    try {

      const res = await authFetch(`/api/leagues/${leagueId}/teams`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: teamName,
        badgeUrl: badgeUrl.trim() ? badgeUrl.trim() : null,
      }),
    });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error((data as any)?.error ?? "Errore creazione squadra");
      }

      setName("");
      setBadgeUrl("");
      setMsg("Squadra creata");
      setShowCreateTeam(false);
      await load();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  const totalPlayers = useMemo(() => {
    return teams.reduce((sum, team) => {
      return sum + (team.players?.length ?? team._count?.players ?? 0);
    }, 0);
  }, [teams]);

  if (!leagueId) return <div>Caricamento…</div>;

  return (
    <DashboardShell leagueId={leagueId}>
      <div className="w-full space-y-5 pb-8">
        <header className="pt-2">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-[31px] font-black tracking-[-0.06em] text-[var(--foreground)]">
                Squadre
              </h1>

              <p className="mt-1 text-sm text-[var(--muted)]">
                {teams.length} squadre · {totalPlayers} giocatori
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowCreateTeam((value) => !value)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--accent)] text-white shadow-[0_1px_3px_rgba(0,0,0,0.1)] active:opacity-80"
              aria-label={
                showCreateTeam
                  ? "Nascondi creazione squadra"
                  : "Crea nuova squadra"
              }
            >
              {showCreateTeam ? <X size={19} /> : <Plus size={19} />}
            </button>
          </div>
        </header>

        {msg && <Badge variant="success">{msg}</Badge>}
        {err && <Badge variant="error">{err}</Badge>}

        {showCreateTeam && (
          <Card className="space-y-4">
            <div>
              <h2 className="text-lg font-black tracking-[-0.04em] text-[var(--foreground)]">
                Nuova squadra
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Aggiungi nome e stemma opzionale.
              </p>
            </div>

            <div className="space-y-3">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome squadra"
              />

              <Input
                value={badgeUrl}
                onChange={(e) => setBadgeUrl(e.target.value)}
                placeholder="Logo squadra URL"
              />

              <Button onClick={createTeam} className="w-full">
                Crea squadra
              </Button>
            </div>
          </Card>
        )}

        {loading && (
          <p className="text-sm text-[var(--muted)]">Caricamento squadre…</p>
        )}

        {!loading && teams.length === 0 && (
          <Card>
            <p className="font-medium text-[var(--foreground)]">
              Nessuna squadra presente.
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Crea la prima squadra per iniziare.
            </p>
          </Card>
        )}

        {!loading && teams.length > 0 && (
          <Card className="overflow-hidden !p-0">
            {teams.map((team) => (
              <TeamListItem
                key={team.id}
                leagueId={leagueId}
                team={team}
              />
            ))}
          </Card>
        )}
      </div>
    </DashboardShell>
  );
}

function TeamListItem({
  leagueId,
  team,
}: {
  leagueId: string;
  team: TeamRow;
}) {
  const playersCount = team.players?.length ?? team._count?.players ?? 0;

  return (
    <Link
      href={`/leagues/${leagueId}/teams/${team.id}`}
      className="grid grid-cols-[44px_minmax(0,1fr)_auto_18px] items-center gap-3 border-b border-[var(--border)] px-4 py-4 last:border-b-0 active:bg-black/[0.02]"
    >
      <TeamLogo name={team.name} badgeUrl={team.badgeUrl ?? null} />

      <div className="min-w-0">
        <div className="truncate text-[16px] font-semibold text-[var(--foreground)]">
          {team.name}
        </div>

        <div className="mt-0.5 text-sm text-[var(--muted)]">
          Rosa {playersCount}/16
        </div>
      </div>

      <div className="rounded-full bg-[#eef0ec] px-3 py-1 text-xs font-bold text-[var(--muted)]">
        {playersCount}
      </div>

      <span className="text-xl text-[var(--muted)]">›</span>
    </Link>
  );
}

function TeamLogo({
  name,
  badgeUrl,
}: {
  name: string;
  badgeUrl: string | null;
}) {
  const initials = name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (badgeUrl) {
    return (
      <img
        src={badgeUrl}
        alt={`Logo ${name}`}
        className="h-11 w-11 shrink-0 rounded-[14px] object-contain"
        onError={(event) => {
          event.currentTarget.style.display = "none";
        }}
      />
    );
  }

  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#eef0ec] text-xs font-black text-[var(--foreground)]">
      {initials}
    </span>
  );
}