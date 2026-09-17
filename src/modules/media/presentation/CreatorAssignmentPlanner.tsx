"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Heart,
  RefreshCw,
  Save,
  UserRound,
} from "lucide-react";
import Card, { CardHeader } from "src/app/_components/ui/card";
import Badge from "src/app/_components/ui/badge";
import Button from "src/app/_components/ui/button";
import Select from "src/app/_components/ui/select";
import { authFetch } from "@/lib/client-auth";

type Team = {
  id: string;
  name: string;
  badgeUrl: string | null;
};

type Creator = {
  id: string;
  displayName: string;
  roleLabel: string | null;
  avatarUrl: string | null;
  active: boolean;
  preferredTeamId: string | null;
  preferredTeam: Team | null;
};

type Match = {
  id: string;
  round: number;
  date: string | null;
  slotEnd: string | null;
  slotWeekStart: string | null;
  lifecycleStatus: string;
  homeTeam: Team;
  awayTeam: Team;
  creatorAssignments: Array<{ creatorId: string }>;
};

type AssignmentBoard = {
  creators: Creator[];
  teams: Team[];
  matches: Match[];
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function matchDateLabel(match: Match) {
  if (!match.date) return "Data da definire";
  const date = new Date(match.date);
  if (Number.isNaN(date.getTime())) return "Data da definire";
  return new Intl.DateTimeFormat("it-IT", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}


function roundWeekLabel(matches: Match[], round: number) {
  const weekStart = matches.find(
    (match) => match.round === round && match.slotWeekStart
  )?.slotWeekStart;
  if (!weekStart) return `Giornata ${round}`;
  const date = new Date(weekStart);
  if (Number.isNaN(date.getTime())) return `Giornata ${round}`;
  const formatted = new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
  return `Giornata ${round} · settimana dal ${formatted}`;
}

function preferenceMatches(creator: Creator, match: Match) {
  return Boolean(
    creator.preferredTeamId &&
      (creator.preferredTeamId === match.homeTeam.id ||
        creator.preferredTeamId === match.awayTeam.id)
  );
}

export default function CreatorAssignmentPlanner({ leagueId }: { leagueId: string }) {
  const [board, setBoard] = useState<AssignmentBoard | null>(null);
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingCreatorId, setUpdatingCreatorId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await authFetch(`/api/leagues/${leagueId}/creator-assignments`, {
        cache: "no-store",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error ?? "Errore caricamento piano creator");
      }
      const nextBoard = body as AssignmentBoard;
      setBoard(nextBoard);
      setDraft(
        Object.fromEntries(
          nextBoard.matches.map((match) => [
            match.id,
            match.creatorAssignments.map((assignment) => assignment.creatorId),
          ])
        )
      );
      const nextRounds = Array.from(
        new Set(nextBoard.matches.map((match) => match.round))
      ).sort((a, b) => a - b);
      setSelectedRound((current) =>
        current && nextRounds.includes(current) ? current : nextRounds[0] ?? null
      );
    } catch (error) {
      setErr(getErrorMessage(error, "Errore caricamento piano creator"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [leagueId]);

  const rounds = useMemo(
    () =>
      Array.from(new Set(board?.matches.map((match) => match.round) ?? [])).sort(
        (a, b) => a - b
      ),
    [board?.matches]
  );

  const matches = useMemo(
    () =>
      board?.matches.filter((match) => match.round === selectedRound) ?? [],
    [board?.matches, selectedRound]
  );

  const activeCreators = useMemo(
    () => board?.creators.filter((creator) => creator.active) ?? [],
    [board?.creators]
  );

  function toggleCreator(matchId: string, creatorId: string) {
    setMsg(null);
    setDraft((current) => {
      const existing = current[matchId] ?? [];
      const next = existing.includes(creatorId)
        ? existing.filter((id) => id !== creatorId)
        : [...existing, creatorId];
      return { ...current, [matchId]: next };
    });
  }

  async function saveRound() {
    if (!selectedRound) return;
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await authFetch(`/api/leagues/${leagueId}/creator-assignments`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          round: selectedRound,
          assignments: matches.map((match) => ({
            matchId: match.id,
            creatorIds: draft[match.id] ?? [],
          })),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error ?? "Errore salvataggio assegnazioni");
      }
      setMsg(
        `Giornata ${selectedRound} salvata: ${body.assignments ?? 0} assegnazioni creator`
      );
      await load();
    } catch (error) {
      setErr(getErrorMessage(error, "Errore salvataggio assegnazioni"));
    } finally {
      setSaving(false);
    }
  }

  async function updatePreference(creatorId: string, preferredTeamId: string) {
    setUpdatingCreatorId(creatorId);
    setErr(null);
    setMsg(null);
    try {
      const res = await authFetch(
        `/api/leagues/${leagueId}/creators/${creatorId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preferredTeamId: preferredTeamId || null }),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error ?? "Errore aggiornamento preferenza");
      }
      setMsg(`Preferenza aggiornata per ${body.displayName ?? "creator"}`);
      await load();
    } catch (error) {
      setErr(getErrorMessage(error, "Errore aggiornamento preferenza"));
    } finally {
      setUpdatingCreatorId(null);
    }
  }

  return (
    <Card variant="inner" className="mt-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <CardHeader
          tag="Copertura settimanale"
          title="Assegnazione creator alle partite"
          description="Organizza fotografi, videomaker e social creator giornata per giornata. Le preferenze di squadra sono informative e restano visibili mentre assegni le partite."
        />
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={selectedRound ?? ""}
            onChange={(event) => setSelectedRound(Number(event.target.value))}
            disabled={loading || rounds.length === 0}
            className="min-w-[150px]"
          >
            {rounds.length === 0 && (
              <option value="" className="text-black">
                Nessuna giornata
              </option>
            )}
            {rounds.map((round) => (
              <option key={round} value={round} className="text-black">
                {roundWeekLabel(board?.matches ?? [], round)}
              </option>
            ))}
          </Select>
          <Button type="button" size="sm" variant="secondary" onClick={load} disabled={loading}>
            <RefreshCw size={15} className="mr-1" /> Aggiorna
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={saveRound}
            disabled={saving || loading || !selectedRound || matches.length === 0}
          >
            <Save size={15} className="mr-1" />
            {saving ? "Salvataggio…" : "Salva giornata"}
          </Button>
        </div>
      </div>

      {err && (
        <div className="mt-4">
          <Badge variant="error">{err}</Badge>
        </div>
      )}
      {msg && (
        <div className="mt-4">
          <Badge variant="success">
            <CheckCircle2 size={14} /> {msg}
          </Badge>
        </div>
      )}

      <div className="mt-5 grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="flex items-center gap-2">
            <Heart size={16} className="text-[var(--accent)]" />
            <h3 className="text-sm font-black uppercase tracking-[0.14em] text-[var(--foreground)]">
              Preferenze creator
            </h3>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
            Una preferenza non forza l'assegnazione: serve come indicazione organizzativa.
          </p>

          <div className="mt-4 space-y-2">
            {board?.creators.length === 0 && !loading && (
              <p className="text-sm text-[var(--muted)]">Nessun creator configurato.</p>
            )}
            {board?.creators.map((creator) => (
              <div
                key={creator.id}
                className="rounded-2xl border border-[var(--border)] bg-[var(--card-2)] p-3"
              >
                <div className="flex items-center gap-3">
                  {creator.avatarUrl ? (
                    <img
                      src={creator.avatarUrl}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-10 w-10 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                      <UserRound size={18} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-[var(--foreground)]">
                      {creator.displayName}
                    </p>
                    <p className="truncate text-xs text-[var(--muted)]">
                      {creator.roleLabel || "Creator"}
                      {!creator.active ? " · disattivato" : ""}
                    </p>
                  </div>
                </div>
                <Select
                  value={creator.preferredTeamId ?? ""}
                  onChange={(event) =>
                    void updatePreference(creator.id, event.target.value)
                  }
                  disabled={updatingCreatorId === creator.id}
                  className="mt-3 w-full"
                >
                  <option value="" className="text-black">
                    Nessuna squadra preferita
                  </option>
                  {board?.teams.map((team) => (
                    <option key={team.id} value={team.id} className="text-black">
                      {team.name}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-[var(--accent)]" />
            <h3 className="text-sm font-black uppercase tracking-[0.14em] text-[var(--foreground)]">
              {selectedRound ? `Giornata ${selectedRound}` : "Partite"}
            </h3>
          </div>

          {loading ? (
            <p className="mt-4 text-sm text-[var(--muted)]">Caricamento piano creator…</p>
          ) : matches.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--muted)]">
              Nessuna partita nella giornata selezionata.
            </p>
          ) : activeCreators.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--muted)]">
              Crea almeno un utente Creator attivo prima di assegnare la copertura.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {matches.map((match) => (
                <article
                  key={match.id}
                  className="rounded-3xl border border-[var(--border)] bg-[var(--card-2)] p-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-base font-black text-[var(--foreground)]">
                        {match.homeTeam.name} <span className="text-[var(--muted)]">vs</span>{" "}
                        {match.awayTeam.name}
                      </p>
                      <p className="mt-1 text-xs font-bold text-[var(--muted)]">
                        {matchDateLabel(match)}
                        {match.lifecycleStatus !== "SCHEDULED"
                          ? ` · ${match.lifecycleStatus.toLowerCase()}`
                          : ""}
                      </p>
                    </div>
                    <Badge variant="default">
                      {(draft[match.id] ?? []).length} creator
                    </Badge>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {activeCreators.map((creator) => {
                      const checked = (draft[match.id] ?? []).includes(creator.id);
                      const preferred = preferenceMatches(creator, match);
                      return (
                        <label
                          key={creator.id}
                          className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition ${
                            checked
                              ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                              : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--border-strong)]"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleCreator(match.id, creator.id)}
                            className="h-4 w-4"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-black text-[var(--foreground)]">
                              {creator.displayName}
                            </p>
                            <p className="truncate text-[11px] text-[var(--muted)]">
                              {creator.roleLabel || "Creator"}
                            </p>
                          </div>
                          {preferred && (
                            <span
                              title={`Preferisce ${creator.preferredTeam?.name ?? "questa squadra"}`}
                              className="inline-flex items-center gap-1 rounded-full bg-pink-500/10 px-2 py-1 text-[10px] font-black text-pink-300"
                            >
                              <Heart size={11} fill="currentColor" /> preferenza
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </Card>
  );
}
