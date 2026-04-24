"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Plus, Shuffle, ChevronDown } from "lucide-react";
import DashboardShell from "src/app/_components/dashboard-shell";
import Card, { CardHeader } from "src/app/_components/ui/card";
import Button from "src/app/_components/ui/button";
import Input from "src/app/_components/ui/input";
import Select from "src/app/_components/ui/select";
import Badge from "src/app/_components/ui/badge";
import { useIsAdmin, authFetch } from "@/lib/client-auth";

type Team = { id: string; name: string };

type Match = {
  id: string;
  leagueId: string;
  round: number;
  date: string | null;
  homeGoals: number | null;
  awayGoals: number | null;
  homeTeam: Team;
  awayTeam: Team;
};

type Filter = "all" | "played" | "pending";

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error ?? "Errore");
  return data as T;
}

function isPlayed(match: Match) {
  return match.homeGoals !== null && match.awayGoals !== null;
}

export default function CalendarPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const isAdmin = useIsAdmin();

  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [filter, setFilter] = useState<Filter>("all");
  const [selectedRound, setSelectedRound] = useState<string>("current");
  const [showCalendarTools, setShowCalendarTools] = useState(false);

  const [manualRound, setManualRound] = useState("1");
  const [manualHomeTeamId, setManualHomeTeamId] = useState("");
  const [manualAwayTeamId, setManualAwayTeamId] = useState("");
  const [manualDate, setManualDate] = useState("");
  const [submittingManual, setSubmittingManual] = useState(false);

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const t = await getJSON<any[]>(`/api/leagues/${leagueId}/teams`);
      setTeams(t.map((x) => ({ id: x.id, name: x.name })));
      const m = await getJSON<Match[]>(`/api/leagues/${leagueId}/schedule`);
      setMatches(m);
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

  const hasSchedule = matches.length > 0;

  const rounds = useMemo(
    () => [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b),
    [matches]
  );

  const currentRound = useMemo(() => {
    if (rounds.length === 0) return null;
    for (const round of rounds) {
      const roundMatches = matches.filter((m) => m.round === round);
      const allPlayed = roundMatches.length > 0 && roundMatches.every(isPlayed);
      if (!allPlayed) return round;
    }
    return rounds[rounds.length - 1] ?? null;
  }, [matches, rounds]);

  useEffect(() => {
    if (!hasSchedule || selectedRound !== "current" || currentRound === null) return;
    setManualRound(String(currentRound));
  }, [currentRound, hasSchedule, selectedRound]);

  const playedCount = useMemo(() => matches.filter(isPlayed).length, [matches]);
  const pendingCount = useMemo(() => matches.filter((m) => !isPlayed(m)).length, [matches]);

  const filteredMatches = useMemo(() => {
    let out = matches;
    if (filter === "played") out = out.filter(isPlayed);
    else if (filter === "pending") out = out.filter((m) => !isPlayed(m));
    const effectiveRound =
      selectedRound === "current" ? currentRound : Number(selectedRound);
    if (effectiveRound && Number.isInteger(effectiveRound)) {
      out = out.filter((m) => m.round === effectiveRound);
    }
    return out;
  }, [matches, filter, selectedRound, currentRound]);

  const grouped = useMemo(() => {
    const map = new Map<number, Match[]>();
    for (const m of filteredMatches) map.set(m.round, [...(map.get(m.round) ?? []), m]);
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [filteredMatches]);

  async function generateRandom() {
    setErr(null);
    try {
      const res = await authFetch(`/api/leagues/${leagueId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ random: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error ?? "Errore");
      await load();
      setSelectedRound("current");
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function createManualMatch() {
    setErr(null);
    const round = Number(manualRound);
    if (!Number.isInteger(round) || round <= 0) { setErr("Inserisci una giornata valida"); return; }
    if (!manualHomeTeamId || !manualAwayTeamId) { setErr("Seleziona entrambe le squadre"); return; }
    if (manualHomeTeamId === manualAwayTeamId) { setErr("Le due squadre devono essere diverse"); return; }
    try {
      setSubmittingManual(true);
      const res = await authFetch(`/api/leagues/${leagueId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "manual", round,
          homeTeamId: manualHomeTeamId,
          awayTeamId: manualAwayTeamId,
          date: manualDate || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error ?? "Errore creazione partita");
      setManualHomeTeamId(""); setManualAwayTeamId(""); setManualDate("");
      await load();
      setSelectedRound(String(round));
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSubmittingManual(false);
    }
  }

  if (!leagueId) return <div>Caricamento…</div>;

  return (
    <DashboardShell leagueId={leagueId}>
      <div className="space-y-5">

        <Card>
          <CardHeader
            tag="Calendario"
            title="Partite"
            description="Mostra automaticamente la giornata corrente."
          />
        </Card>

        {err && <Badge variant="error">{err}</Badge>}

        {/* Controls */}
        <Card>
          {/* Row 1: filter toggles + round selector + admin toggle */}
          <div className="flex flex-wrap items-center gap-2">
            {(["all", "played", "pending"] as const).map((f) => (
              <Button
                key={f}
                variant={filter === f ? "primary" : "secondary"}
                size="sm"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
              >
                {f === "all" ? "Tutte" : f === "played" ? "Giocate" : "Da giocare"}
              </Button>
            ))}

            <div className="ml-auto flex items-center gap-2">
              <Select value={selectedRound} onChange={(e) => setSelectedRound(e.target.value)}>
                <option value="current" className="text-black">Giornata corrente</option>
                {rounds.map((round) => (
                  <option key={round} value={String(round)} className="text-black">
                    Giornata {round}
                  </option>
                ))}
              </Select>

              {isAdmin && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowCalendarTools((v) => !v)}
                >
                  <span className="flex items-center gap-1.5">
                    Gestisci
                    <ChevronDown size={13} className={`transition-transform ${showCalendarTools ? "rotate-180" : ""}`} />
                  </span>
                </Button>
              )}
            </div>
          </div>

          {/* Stats pills */}
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge>Totali: <b className="ml-1 text-[var(--foreground)]">{matches.length}</b></Badge>
            <Badge>Giocate: <b className="ml-1 text-[var(--foreground)]">{playedCount}</b></Badge>
            <Badge>Da giocare: <b className="ml-1 text-[var(--foreground)]">{pendingCount}</b></Badge>
            <Badge>Giornata: <b className="ml-1 text-[var(--foreground)]">{currentRound ?? "—"}</b></Badge>
          </div>

          {/* Admin tools */}
          {isAdmin && showCalendarTools && (
            <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
              {/* Generate random */}
              <div className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--card-2)] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--foreground)]">Genera calendario automatico</p>
                  <p className="mt-0.5 text-xs text-[var(--foreground)]/50">
                    Round robin casuale. Sostituisce le partite esistenti.
                  </p>
                </div>
                <Button size="sm" variant="secondary" onClick={generateRandom} disabled={teams.length < 2}>
                  <span className="flex items-center gap-1.5"><Shuffle size={13} /> Genera</span>
                </Button>
              </div>

              {/* Manual match */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card-2)] p-4">
                <p className="mb-3 text-sm font-medium text-[var(--foreground)]">Aggiungi partita manualmente</p>
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                  <Input
                    aria-label="Numero giornata"
                    value={manualRound}
                    onChange={(e) => setManualRound(e.target.value.replace(/[^\d]/g, ""))}
                    placeholder="Giornata"
                  />
                  <Select aria-label="Squadra di casa" value={manualHomeTeamId} onChange={(e) => setManualHomeTeamId(e.target.value)}>
                    <option value="" className="text-black">Casa</option>
                    {teams.map((t) => <option key={t.id} value={t.id} className="text-black">{t.name}</option>)}
                  </Select>
                  <Select aria-label="Squadra ospite" value={manualAwayTeamId} onChange={(e) => setManualAwayTeamId(e.target.value)}>
                    <option value="" className="text-black">Ospite</option>
                    {teams.map((t) => <option key={t.id} value={t.id} className="text-black">{t.name}</option>)}
                  </Select>
                  <Input aria-label="Data e ora partita" type="datetime-local" value={manualDate} onChange={(e) => setManualDate(e.target.value)} />
                </div>
                <Button size="sm" onClick={createManualMatch} disabled={submittingManual} className="mt-3">
                  <span className="flex items-center gap-1.5">
                    <Plus size={13} />
                    {submittingManual ? "Creazione…" : "Aggiungi partita"}
                  </span>
                </Button>
              </div>
            </div>
          )}
        </Card>

        {loading && <p className="text-sm text-[var(--foreground)]/50">Caricamento…</p>}

        {!loading && !hasSchedule && (
          <Card>
            <p className="font-medium text-[var(--foreground)]">Nessuna partita</p>
            <p className="mt-1 text-sm text-[var(--foreground)]/50">
              {isAdmin ? 'Usa "Gestisci" per generare o inserire partite.' : "Il calendario non è ancora disponibile."}
            </p>
          </Card>
        )}

        {/* Match list */}
        {!loading && hasSchedule && (
          <div className="space-y-4">
            {grouped.length === 0 && (
              <Card>
                <p className="text-sm text-[var(--foreground)]/50">Nessuna partita per questo filtro.</p>
              </Card>
            )}

            {grouped.map(([round, ms]) => (
              <Card key={round}>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--foreground)]/40">
                  Giornata {round}
                </h2>

                <div className="space-y-2">
                  {ms.map((m) => {
                    const played = isPlayed(m);
                    return (
                      <div
                        key={m.id}
                        className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card-2)] p-3.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-[var(--foreground)]">
                            {m.homeTeam.name}
                            <span className="mx-2 text-[var(--foreground)]/30">vs</span>
                            {m.awayTeam.name}
                          </p>
                          {!played && (
                            <p className="mt-0.5 text-xs text-[var(--foreground)]/40">Risultato non inserito</p>
                          )}
                        </div>

                        {/* Score / CTA — always anchored right */}
                        {played ? (
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="rounded-lg bg-[var(--accent)] px-2.5 py-1 text-sm font-bold text-black">
                              {m.homeGoals} – {m.awayGoals}
                            </span>
                            <Link
                              href={`/leagues/${leagueId}/matches/${m.id}`}
                              className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--foreground)]/60 hover:text-[var(--foreground)]"
                            >
                              Modifica
                            </Link>
                          </div>
                        ) : (
                          <Link
                            href={`/leagues/${leagueId}/matches/${m.id}`}
                            className="shrink-0 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-[var(--accent-2)]"
                          >
                            Inserisci
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
