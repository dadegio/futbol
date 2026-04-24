"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
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

async function postJSON<T>(url: string, body: any): Promise<T> {
  const res = await authFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
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

  const rounds = useMemo(() => {
    return [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b);
  }, [matches]);

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
    if (!hasSchedule) return;
    if (selectedRound !== "current") return;
    if (currentRound !== null) {
      setManualRound(String(currentRound));
    }
  }, [currentRound, hasSchedule, selectedRound]);

  const playedCount = useMemo(
    () => matches.filter(isPlayed).length,
    [matches]
  );

  const pendingCount = useMemo(
    () => matches.filter((m) => !isPlayed(m)).length,
    [matches]
  );

  const filteredMatches = useMemo(() => {
    let out = matches;

    if (filter === "played") {
      out = out.filter(isPlayed);
    } else if (filter === "pending") {
      out = out.filter((m) => !isPlayed(m));
    }

    const effectiveRound =
      selectedRound === "current" ? currentRound : Number(selectedRound);

    if (effectiveRound && Number.isInteger(effectiveRound)) {
      out = out.filter((m) => m.round === effectiveRound);
    }

    return out;
  }, [matches, filter, selectedRound, currentRound]);

  const grouped = useMemo(() => {
    const map = new Map<number, Match[]>();
    for (const m of filteredMatches) {
      map.set(m.round, [...(map.get(m.round) ?? []), m]);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [filteredMatches]);

  async function generateRandom() {
    setErr(null);
    try {
      await postJSON(`/api/leagues/${leagueId}/schedule`, { random: true });
      await load();
      setSelectedRound("current");
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function createManualMatch() {
    setErr(null);

    const round = Number(manualRound);

    if (!Number.isInteger(round) || round <= 0) {
      setErr("Inserisci una giornata valida");
      return;
    }

    if (!manualHomeTeamId || !manualAwayTeamId) {
      setErr("Seleziona entrambe le squadre");
      return;
    }

    if (manualHomeTeamId === manualAwayTeamId) {
      setErr("Le due squadre devono essere diverse");
      return;
    }

    try {
      setSubmittingManual(true);

      const res = await authFetch(`/api/leagues/${leagueId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "manual",
          round,
          homeTeamId: manualHomeTeamId,
          awayTeamId: manualAwayTeamId,
          date: manualDate || null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error ?? "Errore creazione partita");

      setManualHomeTeamId("");
      setManualAwayTeamId("");
      setManualDate("");
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
      <div className="space-y-6">
        <Card>
          <CardHeader
            tag="Calendar"
            title="Calendario"
            description="Mostra automaticamente la giornata corrente. Puoi consultare anche le altre dalla tendina."
          />
        </Card>

        <Card>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-3">
              {(["all", "played", "pending"] as const).map((f) => (
                <Button
                  key={f}
                  variant={filter === f ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setFilter(f)}
                >
                  {f === "all" ? "Tutte" : f === "played" ? "Giocate" : "Da giocare"}
                </Button>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Select
                value={selectedRound}
                onChange={(e) => setSelectedRound(e.target.value)}
                className="h-11"
              >
                <option value="current" className="text-black">
                  Giornata corrente
                </option>
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
                  {showCalendarTools ? "Nascondi gestione calendario" : "Gestisci calendario"}
                </Button>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Badge>Totali: <b className="text-[var(--foreground)]">{matches.length}</b></Badge>
            <Badge>Giocate: <b className="text-[var(--foreground)]">{playedCount}</b></Badge>
            <Badge>Da giocare: <b className="text-[var(--foreground)]">{pendingCount}</b></Badge>
            <Badge>
              Corrente:{" "}
              <b className="text-[var(--foreground)]">
                {currentRound ? `Giornata ${currentRound}` : "—"}
              </b>
            </Badge>
          </div>

          {isAdmin && showCalendarTools && (
            <div className="mt-6 space-y-6">
              <Card variant="inner">
                <div className="mb-3 text-lg font-black text-[var(--foreground)]">
                  Genera calendario automatico
                </div>
                <p className="mb-4 text-sm leading-6 text-[var(--foreground)]/60">
                  Crea un calendario round robin casuale. Le partite esistenti verranno sostituite.
                </p>
                <Button onClick={generateRandom} disabled={teams.length < 2}>
                  Genera calendario casuale
                </Button>

                {teams.length < 2 && (
                  <div className="mt-3 text-sm text-[var(--foreground)]/50">
                    Servono almeno 2 squadre.
                  </div>
                )}
              </Card>

              <Card variant="inner">
                <div className="mb-4 text-lg font-black text-[var(--foreground)]">
                  Inserisci partita manualmente
                </div>

                <div className="grid gap-3 lg:grid-cols-4">
                  <Input
                    value={manualRound}
                    onChange={(e) => setManualRound(e.target.value.replace(/[^\d]/g, ""))}
                    placeholder="Giornata"
                  />
                  <Select
                    value={manualHomeTeamId}
                    onChange={(e) => setManualHomeTeamId(e.target.value)}
                  >
                    <option value="" className="text-black">Squadra casa</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id} className="text-black">
                        {team.name}
                      </option>
                    ))}
                  </Select>
                  <Select
                    value={manualAwayTeamId}
                    onChange={(e) => setManualAwayTeamId(e.target.value)}
                  >
                    <option value="" className="text-black">Squadra ospite</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id} className="text-black">
                        {team.name}
                      </option>
                    ))}
                  </Select>
                  <Input
                    type="datetime-local"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                  />
                </div>

                <Button
                  onClick={createManualMatch}
                  disabled={submittingManual}
                  className="mt-4"
                >
                  {submittingManual ? "Creazione..." : "Aggiungi partita"}
                </Button>
              </Card>
            </div>
          )}

          {loading && <div className="mt-5 text-[var(--foreground)]/60">Caricamento…</div>}

          {err && <Badge variant="error" className="mt-5">{err}</Badge>}

          {!loading && !hasSchedule && (
            <Card variant="inner" className="mt-5">
              <div className="text-xl font-bold text-[var(--foreground)]">Nessuna partita trovata</div>
              <p className="mt-2 text-sm leading-6 text-[var(--foreground)]/60">
                Usa "Gestisci calendario" per generare o inserire partite.
              </p>
            </Card>
          )}

          {!loading && hasSchedule && (
            <div className="mt-5 space-y-4">
              {grouped.length === 0 && (
                <Card variant="flat">
                  <span className="text-[var(--foreground)]/55">Nessuna partita per questo filtro.</span>
                </Card>
              )}

              {grouped.map(([round, ms]) => (
                <Card key={round} variant="inner">
                  <div className="mb-4 text-xl font-black text-[var(--foreground)]">
                    Giornata {round}
                  </div>

                  <div className="space-y-3">
                    {ms.map((m) => {
                      const played = isPlayed(m);

                      return (
                        <div
                          key={m.id}
                          className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="break-words text-base font-bold text-[var(--foreground)] sm:text-lg">
                                {m.homeTeam.name}{" "}
                                <span className="text-[var(--foreground)]/35">vs</span>{" "}
                                {m.awayTeam.name}
                              </div>

                              {!played ? (
                                <div className="mt-1 text-sm text-[var(--foreground)]/55">
                                  Risultato non inserito
                                </div>
                              ) : (
                                <div className="mt-3">
                                  <Link
                                    href={`/leagues/${leagueId}/matches/${m.id}`}
                                    className="inline-flex rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-[var(--foreground)]/80 hover:bg-white/10"
                                  >
                                    Modifica risultato
                                  </Link>
                                </div>
                              )}
                            </div>

                            <div className="w-full shrink-0 sm:w-auto">
                              {played ? (
                                <Badge variant="accent" className="text-lg">
                                  {m.homeGoals} - {m.awayGoals}
                                </Badge>
                              ) : (
                                <Link
                                  href={`/leagues/${leagueId}/matches/${m.id}`}
                                  className="inline-flex w-full justify-center rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-black sm:w-auto"
                                >
                                  Inserisci risultato
                                </Link>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Card>
      </div>
    </DashboardShell>
  );
}
