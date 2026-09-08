"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CalendarDays,
  ChevronLeft,
  MapPin,
  UsersRound,
} from "lucide-react";
import DashboardShell from "src/app/_components/dashboard-shell";
import Card from "src/app/_components/ui/card";
import Button from "src/app/_components/ui/button";
import Badge from "src/app/_components/ui/badge";
import SponsorBanner from "src/app/_components/sponsor-banner";
import { useAuth, authFetch } from "@/lib/client-auth";
import { FUTPOLI_RULES } from "@/lib/tournament-rules";
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

export default function MatchResultForm({ match }: { match: Match }) {
  const { user, loading: authLoading } = useAuth();
  const isAdmin = user?.role === "ADMIN" || (user?.role === "LEAGUE_ADMIN" && user.leagueId === match.leagueId);
  const isCaptainOfMatch =
    user?.role === "CAPTAIN" &&
    (user.teamId === match.homeTeam?.id || user.teamId === match.awayTeam?.id);
  const isAssignedReferee =
    user?.role === "REFEREE" &&
    Boolean(user.refereeId) &&
    user.refereeId === match.referee?.id;
  const canEditResult =
    !authLoading &&
    (isAdmin || isCaptainOfMatch || isAssignedReferee);
  const canBook =
    !authLoading && (isAdmin || isCaptainOfMatch);

  const router = useRouter();

  const [homeGoals, setHomeGoals] = useState<string>(match.homeGoals === null ? "" : String(match.homeGoals));
  const [awayGoals, setAwayGoals] = useState<string>(match.awayGoals === null ? "" : String(match.awayGoals));
  const [saving, setSaving] = useState(false);
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
    const m = new Map<string, { goals: number; assists: number }>();
    for (const s of match.stats) m.set(s.playerId, { goals: s.goals, assists: s.assists });
    return m;
  }, [match.stats]);

  const [stats, setStats] = useState<Record<string, { goals: string; assists: string }>>(() => {
    const out: Record<string, { goals: string; assists: string }> = {};
    for (const p of [...match.homeTeam.players, ...match.awayTeam.players]) {
      const s = initial.get(p.id);
      out[p.id] = { goals: s ? String(s.goals) : "", assists: s ? String(s.assists) : "" };
    }
    return out;
  });

  const [sheet, setSheet] = useState<Record<string, boolean>>(() => {
    const selected = new Set(match.sheetPlayers?.map((row) => row.playerId) ?? []);
    const out: Record<string, boolean> = {};
    for (const p of [...match.homeTeam.players, ...match.awayTeam.players]) out[p.id] = selected.has(p.id);
    return out;
  });

  const homePlayers = useMemo(() => match.homeTeam.players.slice().sort((a, b) => a.number - b.number), [match.homeTeam.players]);
  const awayPlayers = useMemo(() => match.awayTeam.players.slice().sort((a, b) => a.number - b.number), [match.awayTeam.players]);

  const totals = useMemo(() => {
    let goalsSum = 0;
    let assistsSum = 0;
    let homeSheetCount = 0;
    let awaySheetCount = 0;

    for (const p of homePlayers) {
      goalsSum += Number(stats[p.id]?.goals || 0);
      assistsSum += Number(stats[p.id]?.assists || 0);
      if (sheet[p.id]) homeSheetCount += 1;
    }

    for (const p of awayPlayers) {
      goalsSum += Number(stats[p.id]?.goals || 0);
      assistsSum += Number(stats[p.id]?.assists || 0);
      if (sheet[p.id]) awaySheetCount += 1;
    }

    return { goalsSum, assistsSum, homeSheetCount, awaySheetCount };
  }, [stats, sheet, homePlayers, awayPlayers]);

  const missingHome = Math.max(0, FUTPOLI_RULES.minPlayersInMatchSheet - totals.homeSheetCount);
  const missingAway = Math.max(0, FUTPOLI_RULES.minPlayersInMatchSheet - totals.awaySheetCount);

  function setPlayerStat(playerId: string, key: "goals" | "assists", value: string) {
    const cleaned = value.replace(/[^\d]/g, "");
    setStats((prev) => ({ ...prev, [playerId]: { ...prev[playerId], [key]: cleaned === "" ? "0" : cleaned } }));
  }

  function toggleSheet(playerId: string, checked: boolean) {
    setSheet((prev) => ({ ...prev, [playerId]: checked }));
  }

  async function loadAdminReferees() {
    if (!isAdmin) return;
    setLoadingReferees(true);
    setRefereeErr(null);
    try {
      const res = await authFetch(`/api/matches/${match.id}/officials`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error ?? "Errore caricamento arbitri");
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
      if (!res.ok) throw new Error((data as any)?.error ?? "Errore salvataggio arbitro");
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
      if (!res.ok) throw new Error((data as any)?.error ?? "Errore salvataggio data");
      if (clear) setDateValue("");
      setDateMsg(clear ? "Data rimossa" : "Data salvata");
      router.refresh();
    } catch (e: any) {
      setDateErr(e.message);
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

    const sheetPlayerIds = [...homePlayers, ...awayPlayers].filter((p) => sheet[p.id]).map((p) => p.id);
    const playerStats = [...homePlayers, ...awayPlayers]
      .map((p) => ({ playerId: p.id, goals: Number(stats[p.id]?.goals || 0), assists: Number(stats[p.id]?.assists || 0) }))
      .filter((s) => s.goals > 0 || s.assists > 0);

    setSaving(true);
    try {
      const res = await authFetch(`/api/matches/${match.id}/result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ homeGoals: hg === null ? undefined : hg, awayGoals: ag === null ? undefined : ag, playerStats, sheetPlayerIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error ?? "Errore salvataggio");
      setMsg("Salvato");
      router.refresh();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
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


  return (
    <DashboardShell leagueId={match.leagueId}>
      <div className="w-full space-y-5 pb-8">
        <div className="flex items-center gap-2 pt-1">
          <Link href={`/leagues/${match.leagueId}/calendar`} className="flex items-center gap-1 text-sm text-[var(--muted)] transition-colors hover:text-[var(--foreground)]">
            <ChevronLeft size={16} /> Calendario
          </Link>
          <span className="text-[var(--border-strong)]">·</span>
          <span className="text-sm text-[var(--muted)]">Giornata {match.round}</span>
        </div>

        {msg && <Badge variant="success">{msg}</Badge>}
        {err && <Badge variant="error">{err}</Badge>}

        <Card className="overflow-hidden !p-0">
          <div className="matchroom-hero p-5 sm:p-7">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--accent)]">Match Center</p>
                <h1 className="mt-1 text-2xl font-black tracking-[-0.06em] text-[var(--foreground)] sm:text-4xl">
                  {match.homeTeam.name} <span className="text-[var(--muted)]">vs</span> {match.awayTeam.name}
                </h1>
              </div>
              <div className="hidden rounded-full border border-[var(--border)] bg-black/20 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-[var(--muted)] sm:block">
                distinta / risultato
              </div>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
              <TeamScoreBlock team={match.homeTeam} faded={played && hg < ag} />
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-2 rounded-[28px] border border-white/10 bg-black/30 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                  <ScoreInput value={homeGoals} setValue={setHomeGoals} readOnly={!canEditResult} />
                  <span className="text-2xl font-black text-[var(--muted)]">:</span>
                  <ScoreInput value={awayGoals} setValue={setAwayGoals} readOnly={!canEditResult} />
                </div>
                {played && (
                  <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-black text-[var(--accent)]">
                    {hg > ag ? `${match.homeTeam.name} avanti` : hg < ag ? `${match.awayTeam.name} avanti` : "Pareggio"}
                  </span>
                )}
              </div>
              <TeamScoreBlock team={match.awayTeam} faded={played && ag < hg} />
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

        {!canEditResult && !authLoading && <p className="px-1 text-sm text-[var(--muted)]">Sola lettura — possono modificare distinta e risultato l&apos;admin, i capitani coinvolti e l&apos;arbitro assegnato.</p>}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <TeamStatsCard title={match.homeTeam.name} colorHex={match.homeTeam.colorHex} secondaryColorHex={match.homeTeam.secondaryColorHex} players={homePlayers} stats={stats} sheet={sheet} toggleSheet={toggleSheet} setPlayerStat={setPlayerStat} readOnly={!canEditResult} isAdmin={isAdmin} onPreviewPhoto={setPhotoPreview} />
          <TeamStatsCard title={match.awayTeam.name} colorHex={match.awayTeam.colorHex} secondaryColorHex={match.awayTeam.secondaryColorHex} players={awayPlayers} stats={stats} sheet={sheet} toggleSheet={toggleSheet} setPlayerStat={setPlayerStat} readOnly={!canEditResult} isAdmin={isAdmin} onPreviewPhoto={setPhotoPreview} />
        </div>

        {canEditResult && (
          <div className="sticky bottom-20 z-20 flex flex-col gap-3 rounded-[24px] border border-[var(--border)] bg-[var(--tabbar-bg)] px-4 py-3 shadow-[0_20px_70px_rgba(0,0,0,0.38)] backdrop-blur-xl lg:bottom-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-3 text-sm text-[var(--muted)]">
              <span><b className="text-[var(--foreground)]">{totals.goalsSum}</b> gol</span>
              <span><b className="text-[var(--foreground)]">{totals.assistsSum}</b> assist</span>
              <SheetCounter team={match.homeTeam.name} count={totals.homeSheetCount} missing={missingHome} />
              <SheetCounter team={match.awayTeam.name} count={totals.awaySheetCount} missing={missingAway} />
            </div>
            <Button onClick={save} disabled={saving}>{saving ? "Salvataggio…" : "Salva risultato"}</Button>
          </div>
        )}
      </div>

      <PlayerPhotoDialog
        player={photoPreview}
        onClose={() => setPhotoPreview(null)}
      />
    </DashboardShell>
  );
}
