"use client";

import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import Link from "next/link";
import { ArrowRight, CopyPlus, Plus, Search, Trash2 } from "lucide-react";
import Button from "src/app/_components/ui/button";
import Input from "src/app/_components/ui/input";
import Badge from "src/app/_components/ui/badge";
import { useIsSuperAdmin, authFetch } from "@/lib/client-auth";
import { resolveLeagueBranding } from "@/modules/branding/domain/league-branding";

type League = {
  id: string;
  name: string;
  themeMode?: string | null;
  brandLogoUrl?: string | null;
  brandCoverUrl?: string | null;
  brandPrimaryColor?: string | null;
  brandSecondaryColor?: string | null;
  brandBackgroundColor?: string | null;
  playoffFormat?: "SINGLE_ELIM" | "TWO_LEG" | null;
  teams?: Array<{
    id: string;
    name: string;
    badgeUrl?: string | null;
    players?: Array<{ firstName: string; lastName: string; number: number }>;
  }>;
};

type ExistingTeam = {
  id: string;
  name: string;
  badgeUrl?: string | null;
  description?: string | null;
  activeInLeague: boolean;
  playersCount: number;
  league: {
    id: string;
    name: string;
  };
};

async function getJSON<T>(url: string): Promise<T> {
  const res = await authFetch(url, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(getApiText(data, "error", "Errore"));
  return data as T;
}

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await authFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(getApiText(data, "error", "Errore"));
  return data as T;
}

function getApiText(data: unknown, key: "error" | "message", fallback: string) {
  if (typeof data !== "object" || data === null) return fallback;
  const value = (data as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function HomePage() {
  const isAdmin = useIsSuperAdmin();

  const [leagues, setLeagues] = useState<League[]>([]);
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingLeagues, setLoadingLeagues] = useState(true);
  const [leagueSearch, setLeagueSearch] = useState("");
  const [showCreateLeague, setShowCreateLeague] = useState(false);
  const [existingTeams, setExistingTeams] = useState<ExistingTeam[]>([]);
  const [loadingExistingTeams, setLoadingExistingTeams] = useState(false);
  const [teamIdsToCopy, setTeamIdsToCopy] = useState<string[]>([]);
  const [playoffEnabled, setPlayoffEnabled] = useState(false);
  const [playoffFormat, setPlayoffFormat] = useState<"SINGLE_ELIM" | "TWO_LEG">("SINGLE_ELIM");
  const [playoffTeamCount, setPlayoffTeamCount] = useState(8);
  const [playoffSeeded, setPlayoffSeeded] = useState(true);

  async function load() {
    setLoadingLeagues(true);
    try {
      setLeagues(await getJSON<League[]>("/api/leagues"));
    } finally {
      setLoadingLeagues(false);
    }
  }

  useEffect(() => {
    load().catch((error: unknown) =>
      setErr(getErrorMessage(error, "Errore caricamento tornei"))
    );
  }, []);

  async function loadExistingTeams() {
    setLoadingExistingTeams(true);
    try {
      const res = await authFetch("/api/teams", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(getApiText(data, "error", "Errore caricamento squadre salvate"));
      }
      setExistingTeams(Array.isArray(data) ? data : []);
    } finally {
      setLoadingExistingTeams(false);
    }
  }

  useEffect(() => {
    if (!isAdmin) return;
    loadExistingTeams().catch((error: unknown) =>
      setErr(getErrorMessage(error, "Errore caricamento squadre salvate"))
    );
  }, [isAdmin]);

  async function create() {
    setErr(null);
    const n = name.trim();
    if (!n) return setErr("Inserisci un nome torneo");

    try {
      setLoading(true);
      await postJSON("/api/leagues", {
        name: n,
        teamIdsToCopy,
        playoffEnabled,
        playoffFormat,
        playoffTeamCount,
        playoffSeeded,
      });
      setName("");
      setTeamIdsToCopy([]);
      setPlayoffEnabled(false);
      setPlayoffFormat("SINGLE_ELIM");
      setPlayoffTeamCount(8);
      setPlayoffSeeded(true);
      setShowCreateLeague(false);
      await Promise.all([load(), loadExistingTeams()]);
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Errore creazione torneo"));
    } finally {
      setLoading(false);
    }
  }

  async function removeLeague(id: string, leagueName: string) {
    setErr(null);
    if (
      !window.confirm(
        `Eliminare il torneo "${leagueName}"?\n\nVerranno cancellati anche squadre, giocatori, partite e statistiche.`
      )
    ) {
      return;
    }

    try {
      const res = await authFetch(`/api/leagues/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(getApiText(data, "error", "Errore eliminazione"));
      await load();
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Errore eliminazione torneo"));
    }
  }

  const totalTeams = leagues.reduce(
    (sum, league) => sum + (league.teams?.length ?? 0),
    0
  );
  const totalPlayers = leagues.reduce(
    (sum, league) =>
      sum +
      (league.teams?.reduce(
        (count, team) => count + (team.players?.length ?? 0),
        0
      ) ?? 0),
    0
  );

  const normalizedLeagueSearch = leagueSearch.trim().toLocaleLowerCase("it");
  const visibleLeagues = leagues.filter((league) => {
    if (!normalizedLeagueSearch) return true;
    const haystack = [
      league.name,
      ...(league.teams?.map((team) => team.name) ?? []),
    ]
      .join(" ")
      .toLocaleLowerCase("it");
    return haystack.includes(normalizedLeagueSearch);
  });

  return (
    <div className="tournament-hub min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-[var(--border-strong)]">
        <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-6 px-4 py-4 sm:px-6 lg:px-10">
          <Link href="/" className="flex items-baseline gap-3">
            <span className="scoreboard-figure text-3xl leading-none text-[var(--accent)]">
              FUTPOLI
            </span>
            <span className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)] sm:inline">
              piattaforma tornei
            </span>
          </Link>

          <div className="flex items-center gap-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            <span>{loadingLeagues ? "—" : leagues.length} tornei</span>
            <Link href="/login" className="text-[var(--foreground)] hover:text-[var(--accent)]">
              Area riservata
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1440px] px-4 pb-16 pt-10 sm:px-6 lg:px-10 lg:pt-14">
        {err && <Badge variant="error" className="mb-6 w-full">{err}</Badge>}

        <section className="border-b border-[var(--border-strong)] pb-9 lg:pb-12">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                Competizioni
              </p>
              <h1 className="scoreboard-figure mt-3 max-w-5xl text-[clamp(3.8rem,10vw,8.5rem)] font-semibold leading-[0.72] tracking-[-0.02em]">
                SCEGLI IL
                <br />
                TORNEO.
              </h1>
            </div>

            <div className="grid grid-cols-3 gap-5 border-t border-[var(--border)] pt-4 lg:min-w-[380px] lg:border-t-0 lg:pt-0">
              <HubMetric label="Tornei" value={loadingLeagues ? "—" : leagues.length} />
              <HubMetric label="Squadre" value={loadingLeagues ? "—" : totalTeams} />
              <HubMetric label="Giocatori" value={loadingLeagues ? "—" : totalPlayers} />
            </div>
          </div>
        </section>

        <div
          className={
            isAdmin && showCreateLeague
              ? "grid gap-10 pt-9 lg:grid-cols-[minmax(0,1fr)_390px] lg:gap-12"
              : "pt-9"
          }
        >
          <section className="min-w-0">
            <div className="mb-7 flex flex-col gap-4 border-b border-[var(--border)] pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                  Archivio attivo
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-[-0.025em]">
                  Tornei disponibili
                </h2>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="flex h-11 min-w-0 items-center gap-2 border-b border-[var(--border-strong)] px-1 sm:w-72">
                  <Search size={15} className="shrink-0 text-[var(--muted)]" />
                  <input
                    value={leagueSearch}
                    onChange={(event) => setLeagueSearch(event.target.value)}
                    placeholder="Cerca torneo o squadra"
                    className="min-w-0 flex-1 bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
                  />
                </label>

                {isAdmin && (
                  <Button onClick={() => setShowCreateLeague((value) => !value)}>
                    <Plus size={15} className="mr-2" />
                    {showCreateLeague ? "Chiudi" : "Nuovo torneo"}
                  </Button>
                )}
              </div>
            </div>

            {loadingLeagues ? (
              <div>
                <LeagueRowSkeleton />
                <LeagueRowSkeleton />
                <LeagueRowSkeleton />
              </div>
            ) : leagues.length === 0 ? (
              <div className="border-y border-[var(--border)] py-14">
                <p className="text-xl font-semibold">Nessun torneo disponibile.</p>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--muted)]">
                  {isAdmin
                    ? "Crea il primo torneo: branding, squadre, calendario e ruoli verranno poi gestiti dalla sua area dedicata."
                    : "Al momento non ci sono competizioni pubblicate."}
                </p>
                {isAdmin && (
                  <Button onClick={() => setShowCreateLeague(true)} className="mt-5">
                    Crea il primo torneo
                  </Button>
                )}
              </div>
            ) : visibleLeagues.length === 0 ? (
              <div className="border-y border-[var(--border)] py-12">
                <p className="font-semibold">Nessun risultato per “{leagueSearch}”.</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Prova con il nome del torneo o di una squadra.
                </p>
              </div>
            ) : (
              <div className="border-b border-[var(--border-strong)]">
                {visibleLeagues.map((league, index) => (
                  <LeagueSwitchRow
                    key={league.id}
                    league={league}
                    index={index}
                    isAdmin={isAdmin}
                    onDelete={() => removeLeague(league.id, league.name)}
                  />
                ))}
              </div>
            )}
          </section>

          {isAdmin && showCreateLeague && (
            <aside className="border-t border-[var(--border-strong)] pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
              <CreateLeaguePanel
                name={name}
                setName={setName}
                loading={loading}
                create={create}
                existingTeams={existingTeams}
                loadingExistingTeams={loadingExistingTeams}
                teamIdsToCopy={teamIdsToCopy}
                setTeamIdsToCopy={setTeamIdsToCopy}
                playoffEnabled={playoffEnabled}
                setPlayoffEnabled={setPlayoffEnabled}
                playoffFormat={playoffFormat}
                setPlayoffFormat={setPlayoffFormat}
                playoffTeamCount={playoffTeamCount}
                setPlayoffTeamCount={setPlayoffTeamCount}
                playoffSeeded={playoffSeeded}
                setPlayoffSeeded={setPlayoffSeeded}
              />
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}

function HubMetric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="border-l border-[var(--border)] pl-4 first:border-l-0 first:pl-0">
      <p className="scoreboard-figure text-4xl leading-none text-[var(--foreground)]">
        {value}
      </p>
      <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
        {label}
      </p>
    </div>
  );
}

function LeagueSwitchRow({
  league,
  index,
  isAdmin,
  onDelete,
}: {
  league: League;
  index: number;
  isAdmin: boolean;
  onDelete: () => void;
}) {
  const teams = league.teams?.length ?? 0;
  const players =
    league.teams?.reduce(
      (sum, team) => sum + (team.players?.length ?? 0),
      0
    ) ?? 0;
  const brand = resolveLeagueBranding(league);
  const logo = brand.logoUrl;

  return (
    <article className="group relative border-t border-[var(--border)] first:border-t-0">
      <div className="grid min-w-0 gap-4 py-5 sm:grid-cols-[42px_96px_minmax(0,1fr)_auto] sm:items-center sm:gap-5 lg:grid-cols-[52px_116px_minmax(0,1fr)_auto] lg:py-6">
        <div className="hidden font-mono text-[10px] tracking-[0.16em] text-[var(--muted)] sm:block">
          {String(index + 1).padStart(2, "0")}
        </div>

        <div
          className="relative h-20 w-20 overflow-hidden border border-[var(--border-strong)] sm:h-24 sm:w-24 lg:h-28 lg:w-28"
          style={{ backgroundColor: brand.background }}
        >
          {brand.coverUrl && (
            <img
              src={brand.coverUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-35"
            />
          )}
          <div
            className="absolute inset-x-0 top-0 h-[3px]"
            style={{ backgroundColor: brand.primary }}
          />
          <div className="absolute inset-0 grid place-items-center p-3">
            {logo ? (
              <img
                src={logo}
                alt=""
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <span
                className="scoreboard-figure text-4xl"
                style={{ color: brand.primary }}
              >
                {league.name.slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>
        </div>

        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            <span>{league.playoffFormat ? "Regular + playoff" : "Regular season"}</span>
            <span className="hidden h-1 w-1 rounded-full bg-[var(--border-strong)] sm:inline" />
            <span>{teams} squadre</span>
            <span>{players} giocatori</span>
          </div>

          <h3 className="max-w-3xl text-2xl font-semibold leading-tight tracking-[-0.035em] text-[var(--foreground)] sm:text-3xl">
            {league.name}
          </h3>

          <div className="mt-3 flex items-center gap-4">
            <Link
              href={`/leagues/${league.id}`}
              className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--accent)] transition group-hover:gap-3"
            >
              Entra nel torneo <ArrowRight size={14} />
            </Link>

            {isAdmin && (
              <button
                type="button"
                onClick={onDelete}
                className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--muted)] hover:text-[var(--danger)]"
              >
                <Trash2 size={12} />
                Elimina
              </button>
            )}
          </div>
        </div>

        <Link
          href={`/leagues/${league.id}`}
          aria-label={`Apri ${league.name}`}
          className="hidden h-14 w-14 place-items-center border-l border-[var(--border)] text-[var(--muted)] transition hover:text-[var(--accent)] sm:grid"
        >
          <ArrowRight size={22} />
        </Link>
      </div>
    </article>
  );
}

function CreateLeaguePanel(props: {
  name: string;
  setName: (value: string) => void;
  loading: boolean;
  create: () => void;
  existingTeams: ExistingTeam[];
  loadingExistingTeams: boolean;
  teamIdsToCopy: string[];
  setTeamIdsToCopy: Dispatch<SetStateAction<string[]>>;
  playoffEnabled: boolean;
  setPlayoffEnabled: (value: boolean) => void;
  playoffFormat: "SINGLE_ELIM" | "TWO_LEG";
  setPlayoffFormat: (value: "SINGLE_ELIM" | "TWO_LEG") => void;
  playoffTeamCount: number;
  setPlayoffTeamCount: (value: number) => void;
  playoffSeeded: boolean;
  setPlayoffSeeded: (value: boolean) => void;
}) {
  const [teamSearch, setTeamSearch] = useState("");
  const normalizedSearch = teamSearch.trim().toLocaleLowerCase("it");

  const filteredTeams = useMemo(
    () =>
      props.existingTeams.filter((team) => {
        if (!normalizedSearch) return true;
        return `${team.name} ${team.league.name}`
          .toLocaleLowerCase("it")
          .includes(normalizedSearch);
      }),
    [normalizedSearch, props.existingTeams]
  );

  function toggleExistingTeam(team: ExistingTeam) {
    const checked = props.teamIdsToCopy.includes(team.id);
    props.setTeamIdsToCopy((previous) => {
      if (checked) return previous.filter((id) => id !== team.id);

      const sameNameIds = new Set(
        props.existingTeams
          .filter(
            (candidate) =>
              candidate.name.trim().toLocaleLowerCase("it") ===
              team.name.trim().toLocaleLowerCase("it")
          )
          .map((candidate) => candidate.id)
      );

      return [...previous.filter((id) => !sameNameIds.has(id)), team.id];
    });
  }

  return (
    <div className="lg:sticky lg:top-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
            Amministrazione
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">
            Nuovo torneo
          </h2>
        </div>
        <Plus size={20} className="mt-1 text-[var(--muted)]" />
      </div>

      <div className="space-y-5">
        <div>
          <label className="mb-2 block text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            Nome torneo
          </label>
          <Input
            value={props.name}
            onChange={(event) => props.setName(event.target.value)}
            placeholder="Es. Cammino Imperiale 2026/27"
            className="w-full"
          />
        </div>

        <label className="flex items-start gap-3 border-y border-[var(--border)] py-4">
          <input
            type="checkbox"
            checked={props.playoffEnabled}
            onChange={(event) => props.setPlayoffEnabled(event.target.checked)}
            className="mt-1"
          />
          <span>
            <span className="block text-sm font-semibold">Fase playoff</span>
            <span className="mt-1 block text-xs leading-relaxed text-[var(--muted)]">
              Attiva la fase finale e la relativa voce di navigazione.
            </span>
          </span>
        </label>

        {props.playoffEnabled && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <select
              value={props.playoffFormat}
              onChange={(event) =>
                props.setPlayoffFormat(
                  event.target.value as "SINGLE_ELIM" | "TWO_LEG"
                )
              }
              className="h-10 border border-[var(--border)] bg-transparent px-3 text-sm text-[var(--foreground)] outline-none"
            >
              <option value="SINGLE_ELIM" className="text-black">
                Eliminazione diretta
              </option>
              <option value="TWO_LEG" className="text-black">
                Andata e ritorno
              </option>
            </select>

            <select
              value={props.playoffTeamCount}
              onChange={(event) =>
                props.setPlayoffTeamCount(Number(event.target.value))
              }
              className="h-10 border border-[var(--border)] bg-transparent px-3 text-sm text-[var(--foreground)] outline-none"
            >
              {[2, 4, 8, 16].map((count) => (
                <option key={count} value={count} className="text-black">
                  Top {count}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-2 border-b border-[var(--border)] py-2 text-sm">
              <input
                type="checkbox"
                checked={props.playoffSeeded}
                onChange={(event) => props.setPlayoffSeeded(event.target.checked)}
              />
              Seeding classifica
            </label>
          </div>
        )}

        <div className="border-t border-[var(--border-strong)] pt-5">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                Squadre esistenti
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
                Puoi copiare profilo, stemma e rosa già registrati.
              </p>
            </div>

            {props.teamIdsToCopy.length > 0 && (
              <button
                type="button"
                onClick={() => props.setTeamIdsToCopy([])}
                className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--accent)]"
              >
                Azzera {props.teamIdsToCopy.length}
              </button>
            )}
          </div>

          <Input
            value={teamSearch}
            onChange={(event) => setTeamSearch(event.target.value)}
            placeholder="Cerca squadra o torneo"
            className="w-full"
          />

          {props.loadingExistingTeams ? (
            <p className="py-4 text-sm text-[var(--muted)]">
              Caricamento squadre…
            </p>
          ) : filteredTeams.length === 0 ? (
            <p className="border-b border-[var(--border)] py-4 text-sm text-[var(--muted)]">
              {props.existingTeams.length === 0
                ? "Non ci sono ancora squadre registrate."
                : "Nessuna squadra corrisponde alla ricerca."}
            </p>
          ) : (
            <div className="mt-2 max-h-80 overflow-y-auto border-t border-[var(--border)]">
              {filteredTeams.map((team) => {
                const checked = props.teamIdsToCopy.includes(team.id);

                return (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => toggleExistingTeam(team)}
                    className={[
                      "flex w-full items-center gap-3 border-b border-[var(--border)] px-1 py-3 text-left transition-colors",
                      checked
                        ? "bg-[var(--accent-soft)] text-[var(--foreground)]"
                        : "text-[var(--foreground)] hover:bg-[var(--card-2)]",
                    ].join(" ")}
                  >
                    <CopyPlus
                      size={15}
                      className={checked ? "text-[var(--accent)]" : "text-[var(--muted)]"}
                    />

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {team.name}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">
                        {team.league.name} · {team.playersCount} giocatori
                        {!team.activeInLeague ? " · archiviata" : ""}
                      </span>
                    </span>

                    <span
                      className={[
                        "grid h-5 w-5 shrink-0 place-items-center border text-[10px]",
                        checked
                          ? "border-[var(--accent)] bg-[var(--accent)] text-black"
                          : "border-[var(--border-strong)] text-transparent",
                      ].join(" ")}
                    >
                      ✓
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <Button
          onClick={props.create}
          disabled={props.loading}
          className="w-full"
        >
          {props.loading ? "Creazione…" : "Crea torneo"}
        </Button>
      </div>
    </div>
  );
}

function LeagueRowSkeleton() {
  return (
    <div className="grid gap-4 border-t border-[var(--border)] py-6 first:border-t-0 sm:grid-cols-[42px_96px_minmax(0,1fr)_auto] sm:items-center sm:gap-5">
      <div className="hidden h-3 w-5 animate-pulse bg-[var(--card-2)] sm:block" />
      <div className="h-24 w-24 animate-pulse bg-[var(--card-2)]" />
      <div className="space-y-3">
        <div className="h-3 w-36 animate-pulse bg-[var(--card-2)]" />
        <div className="h-8 w-72 max-w-full animate-pulse bg-[var(--card-2)]" />
        <div className="h-3 w-28 animate-pulse bg-[var(--card-2)]" />
      </div>
      <div className="hidden h-12 w-12 animate-pulse border-l border-[var(--border)] sm:block" />
    </div>
  );
}
