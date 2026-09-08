"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import DashboardShell from "src/app/_components/dashboard-shell";
import Card from "src/app/_components/ui/card";
import Button from "src/app/_components/ui/button";
import Input from "src/app/_components/ui/input";
import Badge from "src/app/_components/ui/badge";
import { authFetch, useCanAdminLeague } from "@/lib/client-auth";
import { FUTPOLI_RULES } from "@/lib/tournament-rules";

type TeamRow = {
  id: string;
  name: string;
  badgeUrl?: string | null;
  description?: string | null;
  colorHex?: string | null;
  secondaryColorHex?: string | null;
  players?: Array<{ id: string }>;
  _count?: { players: number };
};

function getApiText(data: unknown, key: "error" | "message", fallback: string) {
  if (typeof data !== "object" || data === null) return fallback;
  const value = (data as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function TeamsPage({
  leagueId,
  initialTeams,
}: {
  leagueId: string;
  initialTeams: TeamRow[];
}) {
  const isAdmin = useCanAdminLeague(leagueId);

  const [teams, setTeams] = useState<TeamRow[]>(initialTeams);
  const [name, setName] = useState("");
  const [badgeUrl, setBadgeUrl] = useState("");
  const [description, setDescription] = useState("");
  const [colorHex, setColorHex] = useState("#F97316");
  const [secondaryColorHex, setSecondaryColorHex] = useState("#F97316");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [removingTeamId, setRemovingTeamId] = useState<string | null>(null);

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
          getApiText(data, "error", "Errore caricamento squadre")
        );
      }

      setTeams(Array.isArray(data) ? (data as TeamRow[]) : []);
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Errore caricamento squadre"));
    } finally {
      setLoading(false);
    }
  }

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
          description: description.trim() || null,
          colorHex,
          secondaryColorHex,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(getApiText(data, "error", "Errore creazione squadra"));
      }

      setName("");
      setBadgeUrl("");
      setDescription("");
      setColorHex("#F97316");
      setSecondaryColorHex("#F97316");
      setMsg("Squadra creata");
      setShowCreateTeam(false);
      await load();
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Errore creazione squadra"));
    }
  }

  async function removeTeam(team: TeamRow) {
    setErr(null);
    setMsg(null);

    const confirmed = window.confirm(
      `Rimuovere "${team.name}" dal torneo?\n\n` +
        "Se la squadra è vuota verrà eliminata definitivamente. Se contiene rosa, profilo o storico, i dati resteranno salvati e riutilizzabili."
    );
    if (!confirmed) return;

    try {
      setRemovingTeamId(team.id);
      const res = await authFetch(
        `/api/teams/${team.id}?leagueId=${encodeURIComponent(leagueId)}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(getApiText(data, "error", "Errore rimozione squadra"));
      }

      setMsg(getApiText(data, "message", "Squadra rimossa dal torneo"));
      await load();
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Errore rimozione squadra"));
    } finally {
      setRemovingTeamId(null);
    }
  }

  const totalPlayers = useMemo(() => {
    return teams.reduce((sum, team) => {
      return sum + (team.players?.length ?? team._count?.players ?? 0);
    }, 0);
  }, [teams]);

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

            {isAdmin && (
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
            )}
          </div>
        </header>

        {msg && <Badge variant="success">{msg}</Badge>}
        {err && <Badge variant="error">{err}</Badge>}

        {isAdmin && showCreateTeam && (
          <Card className="space-y-4">
            <div>
              <h2 className="text-lg font-black tracking-[-0.04em] text-[var(--foreground)]">
                Nuova squadra
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Aggiungi nome, stemma e i due colori della maglia.
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

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1.5 text-xs font-bold text-[var(--muted)]">
                  <span>Colore 1</span>
                  <input
                    type="color"
                    value={colorHex}
                    onChange={(e) => setColorHex(e.target.value.toUpperCase())}
                    className="h-11 w-full cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--card-2)] p-1"
                  />
                </label>
                <label className="space-y-1.5 text-xs font-bold text-[var(--muted)]">
                  <span>Colore 2</span>
                  <input
                    type="color"
                    value={secondaryColorHex}
                    onChange={(e) => setSecondaryColorHex(e.target.value.toUpperCase())}
                    className="h-11 w-full cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--card-2)] p-1"
                  />
                </label>
              </div>

              <div
                className="h-8 rounded-xl border border-[var(--border)]"
                style={{ background: `linear-gradient(90deg, ${colorHex} 0 50%, ${secondaryColorHex} 50% 100%)` }}
              />

              <textarea
                aria-label="Descrizione squadra"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Racconta identità, stile o motto della squadra"
                rows={3}
                className="min-h-24 w-full resize-none rounded-2xl border border-[var(--border)] bg-white/[0.04] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:bg-white/[0.07]"
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
                isAdmin={isAdmin}
                removing={removingTeamId === team.id}
                onRemove={() => removeTeam(team)}
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
  isAdmin,
  removing,
  onRemove,
}: {
  leagueId: string;
  team: TeamRow;
  isAdmin: boolean;
  removing: boolean;
  onRemove: () => void;
}) {
  const playersCount = team.players?.length ?? team._count?.players ?? 0;

  return (
    <div
      className={[
        "items-center border-b border-[var(--border)] last:border-b-0",
        isAdmin ? "grid grid-cols-[minmax(0,1fr)_44px]" : "block",
      ].join(" ")}
    >
      <Link
        href={`/leagues/${leagueId}/teams/${team.id}`}
        className="grid grid-cols-[44px_minmax(0,1fr)_18px] items-center gap-3 px-4 py-4 active:bg-black/[0.02]"
      >
        <TeamLogo name={team.name} badgeUrl={team.badgeUrl ?? null} />

        <div className="min-w-0">
          <div className="break-words text-[16px] font-semibold text-[var(--foreground)]">
            {team.name}
          </div>

          <div className="mt-0.5 flex items-center gap-2 text-sm text-[var(--muted)]">
            <span>Rosa {playersCount}/{FUTPOLI_RULES.maxPlayersPerTeam}</span>
            {team.colorHex && (
              <span
                className="h-2.5 w-7 rounded-full border border-[var(--border)]"
                style={{
                  background: `linear-gradient(90deg, ${team.colorHex} 0 50%, ${team.secondaryColorHex ?? team.colorHex} 50% 100%)`,
                }}
                aria-label="Colori maglia"
              />
            )}
          </div>
        </div>

        <span className="text-xl text-[var(--muted)]">›</span>
      </Link>

      {isAdmin && (
        <button
          type="button"
          onClick={onRemove}
          disabled={removing}
          className="mr-3 grid h-9 w-9 place-items-center rounded-xl border border-red-400/20 bg-red-500/10 text-red-300 transition hover:bg-red-500/20 disabled:cursor-wait disabled:opacity-50"
          aria-label={`Rimuovi ${team.name} dal torneo`}
          title="Rimuovi dal torneo"
        >
          {removing ? <span className="text-xs font-black">…</span> : <Trash2 size={16} />}
        </button>
      )}
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
