"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ClipboardCheck,
  Goal,
  MapPin,
  ReceiptText,
  RotateCcw,
  Save,
  Star,
  PlayCircle,
  Clapperboard,
  TriangleAlert,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import DashboardShell from "src/app/_components/dashboard-shell";
import Card from "src/app/_components/ui/card";
import Button from "src/app/_components/ui/button";
import Badge from "src/app/_components/ui/badge";
import SponsorBanner from "src/app/_components/sponsor-banner";
import { useAuth, authFetch } from "@/lib/client-auth";
import { FUTPOLI_RULES } from "@/modules/players/domain/tournament-rules";
import { getRefereeMatchFeeCents } from "@/modules/referees/domain/referee-cost";
import { readApiError } from "@/modules/core/client-error";
import MatchSlotBooking from "@/modules/bookings/presentation/MatchSlotBooking";
import {
  ScoreInput,
  SheetCounter,
  TeamScoreBlock,
  TeamStatsCard,
  type AdminRefereeState,
  type Match,
  type Player,
} from "./MatchResultParts";
import { MatchDateOverridePanel, RefereeAssignmentPanel } from "./MatchAdminPanels";
import { PlayerPhotoDialog } from "./PlayerPhotoDialog";
import MatchLifecyclePanel from "./MatchLifecyclePanel";

export default function MatchResultForm({ match }: { match: Match }) {
  const { user, loading: authLoading } = useAuth();
  const isAdmin = user?.role === "ADMIN" || (user?.role === "LEAGUE_ADMIN" && user.leagueId === match.leagueId);
  const captainTeamIds = new Set(
    user?.role === "CAPTAIN"
      ? [
          ...(user.captainAssignments?.map((assignment) => assignment.teamId) ?? []),
          ...(user.teamId ? [user.teamId] : []),
        ]
      : []
  );
  const isCaptainOfMatch =
    user?.role === "CAPTAIN" &&
    (captainTeamIds.has(match.homeTeam?.id) || captainTeamIds.has(match.awayTeam?.id));
  const isAssignedReferee =
    user?.role === "REFEREE" &&
    Boolean(user.refereeId) &&
    user.refereeId === match.referee?.id;
  const canManageDraft = !authLoading && (isAdmin || isAssignedReferee);
  const canEditResult = canManageDraft && match.resultStatus !== "FINAL" && match.lifecycleStatus !== "CANCELLED";
  const canBook = !authLoading && (isAdmin || isCaptainOfMatch) && match.lifecycleStatus !== "CANCELLED";

  const router = useRouter();

  const [homeGoals, setHomeGoals] = useState<string>(match.homeGoals === null ? "" : String(match.homeGoals));
  const [awayGoals, setAwayGoals] = useState<string>(match.awayGoals === null ? "" : String(match.awayGoals));
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<Player | null>(null);
  const [adminRefereeState, setAdminRefereeState] = useState<AdminRefereeState | null>(null);
  const [refereeChoice, setRefereeChoice] = useState("automatic");
  const [loadingReferees, setLoadingReferees] = useState(false);
  const [savingReferee, setSavingReferee] = useState(false);
  const [refereeMsg, setRefereeMsg] = useState<string | null>(null);
  const [refereeErr, setRefereeErr] = useState<string | null>(null);

  const toLocalDatetimeValue = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [dateValue, setDateValue] = useState(() => toLocalDatetimeValue(match.date));
  const [savingDate, setSavingDate] = useState(false);
  const [dateMsg, setDateMsg] = useState<string | null>(null);
  const [dateErr, setDateErr] = useState<string | null>(null);

  const initial = useMemo(() => {
    const m = new Map<string, { goals: number; assists: number; yellowCards: number; redCards: number }>();
    for (const s of match.stats) {
      m.set(s.playerId, {
        goals: s.goals,
        assists: s.assists,
        yellowCards: s.yellowCards ?? 0,
        redCards: s.redCards ?? 0,
      });
    }
    return m;
  }, [match.stats]);

  const [stats, setStats] = useState<Record<string, { goals: string; assists: string; yellowCards: string; redCards: string }>>(() => {
    const out: Record<string, { goals: string; assists: string; yellowCards: string; redCards: string }> = {};
    for (const p of [...match.homeTeam.players, ...match.awayTeam.players]) {
      const s = initial.get(p.id);
      out[p.id] = {
        goals: s ? String(s.goals) : "",
        assists: s ? String(s.assists) : "",
        yellowCards: s ? String(s.yellowCards) : "",
        redCards: s ? String(s.redCards) : "",
      };
    }
    return out;
  });

  const [sheet, setSheet] = useState<Record<string, boolean>>(() => {
    const selected = new Set(match.sheetPlayers?.map((row) => row.playerId) ?? []);
    const out: Record<string, boolean> = {};
    for (const p of [...match.homeTeam.players, ...match.awayTeam.players]) out[p.id] = selected.has(p.id);
    return out;
  });
  const [mvpPlayerId, setMvpPlayerId] = useState(match.mvpPlayerId ?? "");

  const coachSuggestedStatuses = useMemo(
    () =>
      Object.fromEntries(
        (match.coachSuggestedLineup ?? []).map((player) => [player.playerId, player.status])
      ) as Record<string, "STARTER" | "BENCH">,
    [match.coachSuggestedLineup]
  );

  const homePlayers = useMemo(() => match.homeTeam.players.slice().sort((a, b) => a.number - b.number), [match.homeTeam.players]);
  const awayPlayers = useMemo(() => match.awayTeam.players.slice().sort((a, b) => a.number - b.number), [match.awayTeam.players]);

  const totals = useMemo(() => {
    let goalsSum = 0;
    let assistsSum = 0;
    let yellowCardsSum = 0;
    let redCardsSum = 0;
    let homeGoalsSum = 0;
    let awayGoalsSum = 0;
    let homeSheetCount = 0;
    let awaySheetCount = 0;

    for (const p of homePlayers) {
      const goals = Number(stats[p.id]?.goals || 0);
      goalsSum += goals;
      homeGoalsSum += goals;
      assistsSum += Number(stats[p.id]?.assists || 0);
      yellowCardsSum += Number(stats[p.id]?.yellowCards || 0);
      redCardsSum += Number(stats[p.id]?.redCards || 0);
      if (sheet[p.id]) homeSheetCount += 1;
    }

    for (const p of awayPlayers) {
      const goals = Number(stats[p.id]?.goals || 0);
      goalsSum += goals;
      awayGoalsSum += goals;
      assistsSum += Number(stats[p.id]?.assists || 0);
      yellowCardsSum += Number(stats[p.id]?.yellowCards || 0);
      redCardsSum += Number(stats[p.id]?.redCards || 0);
      if (sheet[p.id]) awaySheetCount += 1;
    }

    return { goalsSum, assistsSum, yellowCardsSum, redCardsSum, homeGoalsSum, awayGoalsSum, homeSheetCount, awaySheetCount };
  }, [stats, sheet, homePlayers, awayPlayers]);

  const missingHome = Math.max(0, FUTPOLI_RULES.minPlayersInMatchSheet - totals.homeSheetCount);
  const missingAway = Math.max(0, FUTPOLI_RULES.minPlayersInMatchSheet - totals.awaySheetCount);

  function setPlayerStat(playerId: string, key: "goals" | "assists" | "yellowCards" | "redCards", value: string) {
    const cleaned = value.replace(/[^\d]/g, "");
    setStats((prev) => ({ ...prev, [playerId]: { ...prev[playerId], [key]: cleaned === "" ? "0" : cleaned } }));
  }

  function toggleSheet(playerId: string, checked: boolean) {
    setSheet((prev) => ({ ...prev, [playerId]: checked }));
    if (!checked && mvpPlayerId === playerId) setMvpPlayerId("");
  }

  function setEligibleTeamSheet(players: Player[], checked: boolean) {
    setSheet((prev) => {
      const next = { ...prev };
      for (const player of players) {
        if (player.isEligibleForMatchSheet === true) next[player.id] = checked;
      }
      return next;
    });
  }

  function scrollToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function loadAdminReferees() {
    if (!isAdmin) return;
    setLoadingReferees(true);
    setRefereeErr(null);
    try {
      const res = await authFetch(`/api/matches/${match.id}/officials`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(readApiError(data, "Errore caricamento arbitri"));
      const state = data as AdminRefereeState;
      setAdminRefereeState(state);
      setRefereeChoice(
        state.mode === "automatic"
          ? "automatic"
          : state.refereeId
            ? `manual:${state.refereeId}`
            : "manual:none"
      );
    } catch (error) {
      setRefereeErr(error instanceof Error ? error.message : "Errore caricamento arbitri");
    } finally {
      setLoadingReferees(false);
    }
  }

  useEffect(() => {
    if (isAdmin) void loadAdminReferees();
  }, [isAdmin, match.id, match.date, match.slotEnd]);

  useEffect(() => {
    if (!photoPreview) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPhotoPreview(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [photoPreview]);

  async function saveRefereeChoice() {
    if (!isAdmin) return;
    setSavingReferee(true);
    setRefereeErr(null);
    setRefereeMsg(null);
    try {
      const automatic = refereeChoice === "automatic";
      const refereeId = refereeChoice.startsWith("manual:")
        ? refereeChoice.slice("manual:".length)
        : null;
      const res = await authFetch(`/api/matches/${match.id}/officials`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: automatic ? "automatic" : "manual",
          refereeId: !automatic && refereeId && refereeId !== "none" ? refereeId : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(readApiError(data, "Errore salvataggio arbitro"));
      const state = data as AdminRefereeState;
      setAdminRefereeState(state);
      setRefereeChoice(
        state.mode === "automatic"
          ? "automatic"
          : state.refereeId
            ? `manual:${state.refereeId}`
            : "manual:none"
      );
      setRefereeMsg(state.mode === "automatic" ? "Assegnazione automatica ripristinata" : "Override manuale salvato");
      router.refresh();
    } catch (error) {
      setRefereeErr(error instanceof Error ? error.message : "Errore salvataggio arbitro");
    } finally {
      setSavingReferee(false);
    }
  }

  async function saveDate(clear = false) {
    setDateErr(null);
    setDateMsg(null);
    setSavingDate(true);
    try {
      const res = await authFetch(`/api/matches/${match.id}/date`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: clear ? null : dateValue ? new Date(dateValue).toISOString() : null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(readApiError(data, "Errore salvataggio data"));
      if (clear) setDateValue("");
      setDateMsg(clear ? "Data rimossa" : "Data salvata");
      router.refresh();
    } catch (error) {
      setDateErr(error instanceof Error ? error.message : "Errore salvataggio data");
    } finally {
      setSavingDate(false);
    }
  }

  async function save() {
    setErr(null);
    setMsg(null);

    const hg = homeGoals.trim() === "" ? null : Number(homeGoals);
    const ag = awayGoals.trim() === "" ? null : Number(awayGoals);

    if (hg !== null && (!Number.isFinite(hg) || hg < 0)) {
      setErr("Gol squadra casa non valido");
      return;
    }

    if (ag !== null && (!Number.isFinite(ag) || ag < 0)) {
      setErr("Gol squadra ospite non valido");
      return;
    }

    if (missingHome > 0 || missingAway > 0) {
      const parts = [];
      if (missingHome > 0) parts.push(`mancano ${missingHome} giocatori nella distinta di ${match.homeTeam.name}`);
      if (missingAway > 0) parts.push(`mancano ${missingAway} giocatori nella distinta di ${match.awayTeam.name}`);
      setErr(parts.join("; "));
      return;
    }

    if (hg !== null && totals.homeGoalsSum !== hg) {
      setErr(`I marcatori di ${match.homeTeam.name} totalizzano ${totals.homeGoalsSum} gol, ma il risultato indica ${hg}.`);
      return;
    }
    if (ag !== null && totals.awayGoalsSum !== ag) {
      setErr(`I marcatori di ${match.awayTeam.name} totalizzano ${totals.awayGoalsSum} gol, ma il risultato indica ${ag}.`);
      return;
    }

    const sheetPlayerIds = [...homePlayers, ...awayPlayers].filter((p) => sheet[p.id]).map((p) => p.id);
    if (mvpPlayerId && !sheetPlayerIds.includes(mvpPlayerId)) {
      setErr("L'MVP deve essere un giocatore presente in distinta.");
      return;
    }

    const playerStats = [...homePlayers, ...awayPlayers]
      .map((p) => ({
        playerId: p.id,
        goals: Number(stats[p.id]?.goals || 0),
        assists: Number(stats[p.id]?.assists || 0),
        yellowCards: Number(stats[p.id]?.yellowCards || 0),
        redCards: Number(stats[p.id]?.redCards || 0),
      }))
      .filter((s) => s.goals > 0 || s.assists > 0 || s.yellowCards > 0 || s.redCards > 0);

    setSaving(true);
    try {
      const res = await authFetch(`/api/matches/${match.id}/result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          homeGoals: hg === null ? undefined : hg,
          awayGoals: ag === null ? undefined : ag,
          playerStats,
          sheetPlayerIds,
          mvpPlayerId: mvpPlayerId || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(readApiError(data, "Errore salvataggio"));
      setMsg("Bozza salvata");
      router.refresh();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  }


  async function resetRecordedData() {
    if (!isAdmin) return;
    const confirmed = window.confirm(
      "Resettare distinta, risultato, marcatori, assist e cartellini di questa partita? Data, campo, slot e arbitro resteranno invariati."
    );
    if (!confirmed) return;

    setResetting(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await authFetch(`/api/matches/${match.id}/result`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(readApiError(data, "Errore reset partita"));

      setHomeGoals("");
      setAwayGoals("");
      setStats(() => {
        const next: Record<string, { goals: string; assists: string; yellowCards: string; redCards: string }> = {};
        for (const player of [...homePlayers, ...awayPlayers]) {
          next[player.id] = { goals: "", assists: "", yellowCards: "", redCards: "" };
        }
        return next;
      });
      setSheet(() => {
        const next: Record<string, boolean> = {};
        for (const player of [...homePlayers, ...awayPlayers]) next[player.id] = false;
        return next;
      });
      setMvpPlayerId("");
      setMsg("Dati partita resettati");
      router.refresh();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Errore reset partita");
    } finally {
      setResetting(false);
    }
  }

  const played = homeGoals !== "" && awayGoals !== "";
  const hg = Number(homeGoals);
  const ag = Number(awayGoals);
  const adminRefereeName = adminRefereeState?.referee?.name ?? null;
  const selectedRefereeName = isAdmin
    ? adminRefereeName ?? (match.date ? "Nessun arbitro compatibile disponibile" : "In attesa dello slot")
    : match.refereeId
      ? "Arbitro assegnato"
      : match.date
        ? "Arbitro da assegnare"
        : "In attesa dello slot";
  const refereeFeeCents = match.venueKey
    ? adminRefereeName
      ? getRefereeMatchFeeCents(adminRefereeName)
      : match.refereeFeeCents ?? null
    : null;
  const publicFinal =
    match.resultStatus === "FINAL" && match.homeGoals !== null && match.awayGoals !== null;
  const heroPlayed = canEditResult ? played : publicFinal;
  const heroHomeGoals = canEditResult ? hg : (match.homeGoals ?? 0);
  const heroAwayGoals = canEditResult ? ag : (match.awayGoals ?? 0);
  const publicStatusLabel =
    match.lifecycleStatus === "CANCELLED"
      ? "Annullata"
      : match.lifecycleStatus === "POSTPONED"
        ? "Rinviata"
        : publicFinal
          ? "Finale"
          : "Programmata";
  const hasRecordedData =
    homeGoals !== "" ||
    awayGoals !== "" ||
    Object.values(sheet).some(Boolean) ||
    Object.values(stats).some((row) =>
      Number(row.goals || 0) > 0 ||
      Number(row.assists || 0) > 0 ||
      Number(row.yellowCards || 0) > 0 ||
      Number(row.redCards || 0) > 0
    );


  return (
    <DashboardShell leagueId={match.leagueId}>
      <div className="w-full space-y-5 pb-8">
        <div className="flex items-center gap-2 pt-1">
          <Link href={`/leagues/${match.leagueId}/calendar?round=${match.round}`} className="flex items-center gap-1 text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)]">
            <ChevronLeft size={16} /> Calendario
          </Link>
          <span className="text-[var(--border-strong)]">·</span>
          <span className="text-sm text-[var(--muted)]">Giornata {match.round}</span>
        </div>

        {msg && <Badge variant="success">{msg}</Badge>}
        {err && <Badge variant="error">{err}</Badge>}

        {canEditResult && (
          <div className="sticky top-2 z-30 grid grid-cols-4 gap-1 rounded-2xl border border-[var(--border)] bg-[var(--tabbar-bg)] p-1.5 shadow-lg backdrop-blur-xl lg:hidden">
            <WorkflowButton icon={ClipboardCheck} label="Distinte" done={missingHome === 0 && missingAway === 0} onClick={() => scrollToSection("match-sheets")} />
            <WorkflowButton icon={Goal} label="Risultato" done={played} onClick={() => scrollToSection("match-score")} />
            <WorkflowButton icon={UsersRound} label="Marcatori" done={played && totals.homeGoalsSum === hg && totals.awayGoalsSum === ag} onClick={() => scrollToSection("match-sheets")} />
            <WorkflowButton icon={Save} label="Conferma" done={Boolean(msg)} onClick={() => scrollToSection("match-save")} />
          </div>
        )}

        <Card id="match-score" className="scroll-mt-20 overflow-hidden !p-0">
          <div className="matchroom-hero p-5 sm:p-7">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--accent)]">Match Center</p>
                <h1 className="mt-1 text-2xl font-black tracking-[-0.06em] text-[var(--foreground)] sm:text-4xl">
                  {match.homeTeam.name} <span className="text-[var(--muted)]">vs</span> {match.awayTeam.name}
                </h1>
              </div>
              <div className="hidden rounded-full border border-[var(--border)] bg-black/20 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-[var(--muted)] sm:block">
                {canManageDraft ? "gestione gara" : publicStatusLabel}
              </div>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
              <TeamScoreBlock team={match.homeTeam} faded={heroPlayed && heroHomeGoals < heroAwayGoals} />
              <div className="flex flex-col items-center gap-3">
                {canEditResult ? (
                  <div className="flex items-center gap-2 rounded-[28px] border border-white/10 bg-black/30 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                    <ScoreInput value={homeGoals} setValue={setHomeGoals} />
                    <span className="text-2xl font-black text-[var(--muted)]">:</span>
                    <ScoreInput value={awayGoals} setValue={setAwayGoals} />
                  </div>
                ) : (
                  <div className="min-w-[116px] rounded-[28px] border border-white/10 bg-black/30 px-5 py-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:min-w-[150px]">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--muted)]">{publicStatusLabel}</p>
                    <p className="mt-1 text-4xl font-black tracking-[-0.06em] text-[var(--foreground)] sm:text-6xl">
                      {publicFinal ? `${match.homeGoals} : ${match.awayGoals}` : "VS"}
                    </p>
                  </div>
                )}
                {heroPlayed && (
                  <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-black text-[var(--accent)]">
                    {heroHomeGoals > heroAwayGoals
                      ? `${match.homeTeam.name} vincente`
                      : heroHomeGoals < heroAwayGoals
                        ? `${match.awayTeam.name} vincente`
                        : "Pareggio"}
                  </span>
                )}
              </div>
              <TeamScoreBlock team={match.awayTeam} faded={heroPlayed && heroAwayGoals < heroHomeGoals} />
            </div>
          </div>

          <div className="grid gap-3 border-t border-[var(--border)] bg-black/10 px-5 py-4 text-sm sm:grid-cols-3 sm:px-7">
            <div className="flex min-w-0 items-start gap-2">
              <CalendarDays size={16} className="mt-0.5 shrink-0 text-[var(--accent)]" />
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">Data</p>
                <p className="mt-0.5 truncate font-bold text-[var(--foreground)]">
                  {match.date
                    ? new Date(match.date).toLocaleString("it-IT", {
                        weekday: "short",
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Da prenotare"}
                </p>
              </div>
            </div>
            <div className="flex min-w-0 items-start gap-2">
              <MapPin size={16} className="mt-0.5 shrink-0 text-[var(--accent)]" />
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">Campo</p>
                <p className="mt-0.5 break-words font-bold text-[var(--foreground)]">
                  {match.venueName
                    ? `${match.venueName}${match.venueAddress ? ` · ${match.venueAddress}` : ""}`
                    : "Da prenotare"}
                </p>
              </div>
            </div>
            <div className="flex min-w-0 items-start gap-2">
              <UsersRound size={16} className="mt-0.5 shrink-0 text-[var(--accent)]" />
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">Arbitro</p>
                <p className="mt-0.5 break-words font-bold text-[var(--foreground)]">
                  {selectedRefereeName}
                </p>
              </div>
            </div>
          </div>
        </Card>

        <SponsorBanner compact />

        {canManageDraft && (
          <MatchLifecyclePanel
            matchId={match.id}
            isAdmin={isAdmin}
            canManageDraft={canManageDraft}
            lifecycleStatus={match.lifecycleStatus ?? "SCHEDULED"}
            resultStatus={match.resultStatus ?? null}
            homeSheetConfirmed={match.homeSheetConfirmed === true}
            awaySheetConfirmed={match.awaySheetConfirmed === true}
            homeTeamName={match.homeTeam.name}
            awayTeamName={match.awayTeam.name}
            players={[...homePlayers, ...awayPlayers]}
            mvpPlayerId={match.mvpPlayerId ?? null}
            replayUrl={match.replayUrl ?? null}
            highlightsUrl={match.highlightsUrl ?? null}
          />
        )}

        {match.resultStatus === "FINAL" && (match.mvpPlayer || match.replayUrl || match.highlightsUrl) && (
          <Card>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent)]">Dopo partita</p>
            <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div>
                {match.mvpPlayer && (
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-400/10 text-amber-300"><Star size={18} /></span>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">MVP partita</p>
                      <p className="mt-0.5 font-black text-[var(--foreground)]">#{match.mvpPlayer.number} {match.mvpPlayer.firstName} {match.mvpPlayer.lastName}</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {match.replayUrl && <a href={match.replayUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card-2)] px-4 text-sm font-black text-[var(--foreground)] hover:border-[var(--accent)]"><PlayCircle size={15} /> Replay</a>}
                {match.highlightsUrl && <a href={match.highlightsUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card-2)] px-4 text-sm font-black text-[var(--foreground)] hover:border-[var(--accent)]"><Clapperboard size={15} /> Highlights</a>}
              </div>
            </div>
          </Card>
        )}

        {canBook && (
          <div id="match-booking" className="scroll-mt-20">
            <MatchSlotBooking
              leagueId={match.leagueId}
              matchId={match.id}
              canBook={canBook}
              initialBooking={
                match.date && match.venueKey
                  ? {
                      startsAt: match.date,
                      endsAt: match.slotEnd,
                      venueKey: match.venueKey,
                      venueName: match.venueName,
                      address: match.venueAddress,
                    }
                  : null
              }
            />
          </div>
        )}

        {isAdmin && (
          <>
            <RefereeAssignmentPanel
              isAdmin={isAdmin}
              selectedRefereeName={selectedRefereeName}
              matchDate={match.date}
              refereeId={match.refereeId}
              refereeChoice={refereeChoice}
              setRefereeChoice={setRefereeChoice}
              loadingReferees={loadingReferees}
              savingReferee={savingReferee}
              saveRefereeChoice={saveRefereeChoice}
              adminRefereeState={adminRefereeState}
              refereeMsg={refereeMsg}
              refereeErr={refereeErr}
            />

            <MatchDateOverridePanel
              isAdmin={isAdmin}
              dateValue={dateValue}
              setDateValue={setDateValue}
              saveDate={saveDate}
              savingDate={savingDate}
              dateMsg={dateMsg}
              dateErr={dateErr}
            />
          </>
        )}

        {user && !canEditResult && !authLoading && (
          <p className="px-1 text-sm text-[var(--muted)]">
            {match.resultStatus === "FINAL"
              ? "Risultato definitivo — sola lettura."
              : match.lifecycleStatus === "CANCELLED"
                ? "Partita annullata — sola lettura."
                : isCaptainOfMatch
                  ? "Puoi gestire la prenotazione dello slot; distinta e risultato sono gestiti dagli ufficiali di gara."
                  : "Partita in sola lettura."}
          </p>
        )}

        {(isAdmin || isCaptainOfMatch) && match.venueKey && (
          <Card variant="inner" className="border-[var(--accent)]/20">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <ReceiptText size={18} />
              </span>
              <div>
                <p className="text-sm font-black text-[var(--foreground)]">Costo arbitro della gara</p>
                {refereeFeeCents !== null ? (
                  <>
                    <p className="mt-1 text-xl font-black text-[var(--accent)]">
                      {(refereeFeeCents / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
                      Informazione per le squadre: il costo viene gestito direttamente tra loro e non entra nei conteggi economici del torneo.
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
                    Il costo verrà indicato qui appena sarà assegnato l&apos;arbitro. Tariffa standard €15; Scoccimarro €20.
                  </p>
                )}
              </div>
            </div>
          </Card>
        )}

        <div id="match-sheets" className="scroll-mt-20 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <TeamStatsCard title={match.homeTeam.name} colorHex={match.homeTeam.colorHex} secondaryColorHex={match.homeTeam.secondaryColorHex} players={homePlayers} stats={stats} sheet={sheet} mvpPlayerId={mvpPlayerId} setMvpPlayerId={setMvpPlayerId} showMvpSelection={canEditResult} coachSuggestedStatuses={coachSuggestedStatuses} toggleSheet={toggleSheet} setPlayerStat={setPlayerStat} readOnly={!canEditResult} isAdmin={isAdmin} showEligibility={canManageDraft} onPreviewPhoto={setPhotoPreview} onSelectEligible={(checked) => setEligibleTeamSheet(homePlayers, checked)} />
          <TeamStatsCard title={match.awayTeam.name} colorHex={match.awayTeam.colorHex} secondaryColorHex={match.awayTeam.secondaryColorHex} players={awayPlayers} stats={stats} sheet={sheet} mvpPlayerId={mvpPlayerId} setMvpPlayerId={setMvpPlayerId} showMvpSelection={canEditResult} coachSuggestedStatuses={coachSuggestedStatuses} toggleSheet={toggleSheet} setPlayerStat={setPlayerStat} readOnly={!canEditResult} isAdmin={isAdmin} showEligibility={canManageDraft} onPreviewPhoto={setPhotoPreview} onSelectEligible={(checked) => setEligibleTeamSheet(awayPlayers, checked)} />
        </div>

        {canEditResult && (
          <div id="match-save" className="sticky bottom-20 z-20 scroll-mt-20 flex flex-col gap-3 rounded-[24px] border border-[var(--border)] bg-[var(--tabbar-bg)] px-4 py-3 shadow-[0_20px_70px_rgba(0,0,0,0.38)] backdrop-blur-xl lg:bottom-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
            <div className="flex flex-wrap gap-3 text-sm text-[var(--muted)]">
              <span><b className="text-[var(--foreground)]">{totals.goalsSum}</b> gol</span>
              <span><b className="text-[var(--foreground)]">{totals.assistsSum}</b> assist</span>
              <span className="inline-flex items-center gap-1"><i className="h-4 w-2.5 rounded-[2px] bg-yellow-300" /><b className="text-[var(--foreground)]">{totals.yellowCardsSum}</b></span>
              <span className="inline-flex items-center gap-1"><i className="h-4 w-2.5 rounded-[2px] bg-red-500" /><b className="text-[var(--foreground)]">{totals.redCardsSum}</b></span>
              <SheetCounter team={match.homeTeam.name} count={totals.homeSheetCount} missing={missingHome} />
              <SheetCounter team={match.awayTeam.name} count={totals.awaySheetCount} missing={missingAway} />
            </div>
            {played && (totals.homeGoalsSum !== hg || totals.awayGoalsSum !== ag) && (
              <p className="mt-1 text-xs font-bold text-amber-300">Marcatori da completare: {match.homeTeam.name} {totals.homeGoalsSum}/{hg} · {match.awayTeam.name} {totals.awayGoalsSum}/{ag}</p>
            )}
            </div>
            <Button onClick={save} disabled={saving}>{saving ? "Salvataggio…" : "Salva bozza"}</Button>
          </div>
        )}

        {isAdmin && hasRecordedData && (
          <Card className="border-red-500/25 bg-red-500/[0.05]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-500/10 text-red-300">
                  <TriangleAlert size={18} />
                </span>
                <div>
                  <p className="font-black text-[var(--foreground)]">Reset dati partita</p>
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
                    Elimina distinta, risultato, marcatori, assist e cartellini. Data, campo, slot e arbitro restano invariati. L&apos;operazione è registrata nell&apos;audit log.
                  </p>
                </div>
              </div>
              <Button variant="destructive" onClick={resetRecordedData} disabled={resetting || saving}>
                <RotateCcw size={15} /> {resetting ? "Reset…" : "Resetta partita"}
              </Button>
            </div>
          </Card>
        )}
      </div>

      <PlayerPhotoDialog
        player={photoPreview}
        onClose={() => setPhotoPreview(null)}
      />
    </DashboardShell>
  );
}


function WorkflowButton({ icon: Icon, label, done, onClick }: { icon: LucideIcon; label: string; done: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-black text-[var(--muted)] transition hover:bg-[var(--card-2)]">
      <span className={done ? "text-emerald-400" : "text-[var(--accent)]"}>{done ? <CheckCircle2 size={16} /> : <Icon size={16} />}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}
