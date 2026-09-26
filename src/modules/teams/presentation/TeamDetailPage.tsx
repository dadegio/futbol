"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  CalendarClock,
  CircleAlert,
  MapPin,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Target,
  Trophy,
  UsersRound,
  X,
} from "lucide-react";
import DashboardShell from "src/app/_components/dashboard-shell";
import Card from "src/app/_components/ui/card";
import Badge from "src/app/_components/ui/badge";
import { useAuth, useCanEditTeam, authFetch } from "@/lib/client-auth";
import {
  MAX_PLAYERS_PER_TEAM,
  ROLE_ORDER,
  PlayerRow,
  TeamLogo,
  type Player,
  type Team,
} from "./TeamDetailParts";
import { AddPlayerPanel, TeamEditPanel } from "./TeamManagementPanels";
import TeamChangeRequestsPanel from "./TeamChangeRequestsPanel";

type RosterFilter = "all" | "eligible" | "attention";

async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await authFetch("/api/upload", { method: "POST", body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? "Errore upload immagine");
  return data.url as string;
}

function formatDate(value: string | null) {
  if (!value) return "Data da definire";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data da definire";
  return date.toLocaleString("it-IT", {
    timeZone: "Europe/Rome",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TeamPage({
  leagueId,
  teamId,
  initialTeam,
}: {
  leagueId: string;
  teamId: string;
  initialTeam: Team;
}) {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN" || (user?.role === "LEAGUE_ADMIN" && user.leagueId === leagueId);
  const canEdit = useCanEditTeam(teamId, leagueId);

  const [team, setTeam] = useState<Team>(initialTeam);
  const [name, setName] = useState(initialTeam.name ?? "");
  const [badgeUrl, setBadgeUrl] = useState(initialTeam.badgeUrl ?? "");
  const [description, setDescription] = useState(initialTeam.description ?? "");
  const [colorHex, setColorHex] = useState(initialTeam.colorHex ?? "#F97316");
  const [secondaryColorHex, setSecondaryColorHex] = useState(initialTeam.secondaryColorHex ?? initialTeam.colorHex ?? "#F97316");
  const [kitHomeUrl, setKitHomeUrl] = useState(initialTeam.kitHomeUrl ?? "");
  const [kitAwayUrl, setKitAwayUrl] = useState(initialTeam.kitAwayUrl ?? "");
  const [kitGoalkeeperUrl, setKitGoalkeeperUrl] = useState(initialTeam.kitGoalkeeperUrl ?? "");
  const [badgeFile, setBadgeFile] = useState<File | null>(null);
  const [removeBadge, setRemoveBadge] = useState(false);
  const [kitHomeFile, setKitHomeFile] = useState<File | null>(null);
  const [kitAwayFile, setKitAwayFile] = useState<File | null>(null);
  const [kitGoalkeeperFile, setKitGoalkeeperFile] = useState<File | null>(null);
  const [removeKitHome, setRemoveKitHome] = useState(false);
  const [removeKitAway, setRemoveKitAway] = useState(false);
  const [removeKitGoalkeeper, setRemoveKitGoalkeeper] = useState(false);
  const [editingTeam, setEditingTeam] = useState(false);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [savingTeam, setSavingTeam] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [rosterFilter, setRosterFilter] = useState<RosterFilter>("all");
  const [roleFilter, setRoleFilter] = useState("all");

  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newNumber, setNewNumber] = useState("");
  const [newPosition, setNewPosition] = useState("");
  const [newPhotoUrl, setNewPhotoUrl] = useState("");

  async function load() {
    setErr(null);
    const res = await authFetch(`/api/teams/${teamId}`, { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error ?? "Errore");
    setTeam(data);
    setName(data.name ?? "");
    setBadgeUrl(data.badgeUrl ?? "");
    setDescription(data.description ?? "");
    setColorHex(data.colorHex ?? "#F97316");
    setSecondaryColorHex(data.secondaryColorHex ?? data.colorHex ?? "#F97316");
    setKitHomeUrl(data.kitHomeUrl ?? "");
    setKitAwayUrl(data.kitAwayUrl ?? "");
    setKitGoalkeeperUrl(data.kitGoalkeeperUrl ?? "");
    setBadgeFile(null);
    setRemoveBadge(false);
    setKitHomeFile(null);
    setKitAwayFile(null);
    setKitGoalkeeperFile(null);
    setRemoveKitHome(false);
    setRemoveKitAway(false);
    setRemoveKitGoalkeeper(false);
  }

  const badgePreview = useMemo(() => {
    if (removeBadge) return "";
    if (badgeFile) return URL.createObjectURL(badgeFile);
    return badgeUrl || "";
  }, [badgeFile, badgeUrl, removeBadge]);

  const kitHomePreview = useMemo(() => {
    if (removeKitHome) return "";
    if (kitHomeFile) return URL.createObjectURL(kitHomeFile);
    return kitHomeUrl || "";
  }, [kitHomeFile, kitHomeUrl, removeKitHome]);

  const kitAwayPreview = useMemo(() => {
    if (removeKitAway) return "";
    if (kitAwayFile) return URL.createObjectURL(kitAwayFile);
    return kitAwayUrl || "";
  }, [kitAwayFile, kitAwayUrl, removeKitAway]);

  const kitGoalkeeperPreview = useMemo(() => {
    if (removeKitGoalkeeper) return "";
    if (kitGoalkeeperFile) return URL.createObjectURL(kitGoalkeeperFile);
    return kitGoalkeeperUrl || "";
  }, [kitGoalkeeperFile, kitGoalkeeperUrl, removeKitGoalkeeper]);

  async function uploadTeamAsset(file: File, label: string) {
    if (!file.type.startsWith("image/")) {
      throw new Error(`${label}: seleziona un'immagine valida`);
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Error(`${label}: massimo 5 MB`);
    }
    return uploadImage(file);
  }

  async function saveTeam() {
    setErr(null);
    setMsg(null);
    const trimmedName = name.trim();
    if (!trimmedName) return setErr("Inserisci il nome squadra");

    try {
      setSavingTeam(true);
      let finalBadgeUrl: string | null = removeBadge ? null : badgeUrl.trim() || null;
      if (badgeFile) {
        if (!badgeFile.type.startsWith("image/")) throw new Error("Seleziona un'immagine valida");
        if (badgeFile.size > 5 * 1024 * 1024) throw new Error("Il logo deve essere massimo 5 MB");
        finalBadgeUrl = await uploadImage(badgeFile);
      }

      let finalKitHomeUrl: string | null = removeKitHome ? null : kitHomeUrl.trim() || null;
      let finalKitAwayUrl: string | null = removeKitAway ? null : kitAwayUrl.trim() || null;
      let finalKitGoalkeeperUrl: string | null = removeKitGoalkeeper ? null : kitGoalkeeperUrl.trim() || null;

      if (kitHomeFile) {
        finalKitHomeUrl = await uploadTeamAsset(kitHomeFile, "Prima divisa");
      }
      if (kitAwayFile) {
        finalKitAwayUrl = await uploadTeamAsset(kitAwayFile, "Divisa trasferta");
      }
      if (kitGoalkeeperFile) {
        finalKitGoalkeeperUrl = await uploadTeamAsset(kitGoalkeeperFile, "Divisa portiere");
      }

      const payload: Record<string, unknown> = {};
      const finalDescription = description.trim() || null;
      const currentBadgeUrl = team.badgeUrl ?? null;
      const currentDescription = team.description ?? null;
      const currentColorHex = team.colorHex ?? null;
      const currentSecondaryColorHex = team.secondaryColorHex ?? null;
      const currentKitHomeUrl = team.kitHomeUrl ?? null;
      const currentKitAwayUrl = team.kitAwayUrl ?? null;
      const currentKitGoalkeeperUrl = team.kitGoalkeeperUrl ?? null;

      if (trimmedName !== team.name) payload.name = trimmedName;
      if (finalBadgeUrl !== currentBadgeUrl) payload.badgeUrl = finalBadgeUrl;
      if (finalDescription !== currentDescription) payload.description = finalDescription;
      if (colorHex !== currentColorHex) payload.colorHex = colorHex;
      if (secondaryColorHex !== currentSecondaryColorHex) payload.secondaryColorHex = secondaryColorHex;
      if (finalKitHomeUrl !== currentKitHomeUrl) payload.kitHomeUrl = finalKitHomeUrl;
      if (finalKitAwayUrl !== currentKitAwayUrl) payload.kitAwayUrl = finalKitAwayUrl;
      if (finalKitGoalkeeperUrl !== currentKitGoalkeeperUrl) {
        payload.kitGoalkeeperUrl = finalKitGoalkeeperUrl;
      }

      if (Object.keys(payload).length === 0) {
        setMsg("Nessuna modifica da salvare");
        setEditingTeam(false);
        return;
      }

      const res = await authFetch(`/api/teams/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Errore");
      if (data?.requestCreated) {
        setMsg("Rosa bloccata: richiesta di modifica inviata all'admin");
        setEditingTeam(false);
        return;
      }
      setMsg("Squadra aggiornata");
      setEditingTeam(false);
      await load();
    } catch (error: unknown) {
      setErr(error instanceof Error ? error.message : "Errore");
    } finally {
      setSavingTeam(false);
    }
  }

  async function addPlayer() {
    setErr(null);
    setMsg(null);
    const n = Number(newNumber);
    if (!newFirstName.trim() || !newLastName.trim()) return setErr("Inserisci nome e cognome");
    if (!Number.isInteger(n) || n <= 0) return setErr("Numero non valido");

    const playerInput: Record<string, unknown> = { firstName: newFirstName.trim(), lastName: newLastName.trim(), number: n, position: newPosition || null };
    if (isAdmin) playerInput.photoUrl = newPhotoUrl.trim() || null;
    const res = await authFetch(`/api/teams/${teamId}/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(playerInput),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setErr(data?.error ?? "Errore aggiunta giocatore");

    setNewFirstName(""); setNewLastName(""); setNewNumber(""); setNewPosition(""); setNewPhotoUrl("");
    if (data?.requestCreated) {
      setMsg("Rosa bloccata: richiesta di aggiunta inviata all'admin");
      setShowAddPlayer(false);
      return;
    }
    setMsg("Giocatore aggiunto");
    setShowAddPlayer(false);
    await load();
  }

  async function deletePlayer(playerId: string, label: string) {
    setErr(null); setMsg(null);
    if (!window.confirm(`Eliminare "${label}"?`)) return;
    const res = await authFetch(`/api/players/${playerId}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setErr(data?.error ?? "Errore eliminazione giocatore");
    if (data?.requestCreated) {
      setMsg("Rosa bloccata: richiesta di rimozione inviata all'admin");
      return;
    }
    setMsg("Giocatore eliminato");
    await load();
  }

  const eligibleCount = useMemo(() => team.players.filter((player) => player.isEligibleForMatchSheet === true).length, [team.players]);
  const attentionCount = team.players.length - eligibleCount;
  const totalGoals = useMemo(() => team.players.reduce((sum, player) => sum + (player.goals ?? 0), 0), [team.players]);
  const totalAppearances = useMemo(() => team.players.reduce((sum, player) => sum + (player.appearances ?? 0), 0), [team.players]);
  const competition = team.competitionSummary;

  const filteredPlayers = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("it");
    return [...team.players]
      .filter((player) => {
        if (q) {
          const fullName = `${player.firstName} ${player.lastName}`.toLocaleLowerCase("it");
          if (!fullName.includes(q) && !String(player.number).includes(q)) return false;
        }
        if (roleFilter !== "all" && player.position !== roleFilter) return false;
        if (rosterFilter === "eligible" && player.isEligibleForMatchSheet !== true) return false;
        if (rosterFilter === "attention" && player.isEligibleForMatchSheet === true) return false;
        return true;
      })
      .sort((a, b) => a.number - b.number);
  }, [query, roleFilter, rosterFilter, team.players]);

  const groupedPlayers = useMemo(() => {
    const unknown = filteredPlayers.filter((player) => !player.position || !ROLE_ORDER.includes(player.position));
    return [
      ...ROLE_ORDER.map((role) => ({ role, players: filteredPlayers.filter((player) => player.position === role) })).filter((group) => group.players.length > 0),
      ...(unknown.length ? [{ role: "Ruolo non impostato", players: unknown }] : []),
    ];
  }, [filteredPlayers]);

  const eagerPlayerIds = useMemo(() => new Set(filteredPlayers.slice(0, 4).map((player) => player.id)), [filteredPlayers]);

  return (
    <DashboardShell leagueId={leagueId}>
      <div className="w-full space-y-5 pb-8">
        <header className="pt-2">
          <Link href={`/leagues/${leagueId}/teams`} className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-[var(--muted)] hover:text-[var(--accent)]">‹ Tutte le squadre</Link>

          <Card className="relative overflow-hidden !rounded-none !border-x-0 !border-b !border-t-0 !bg-transparent !p-0">
            <div className="h-2" style={{ background: `linear-gradient(90deg, ${team.colorHex ?? "#F97316"}, ${team.secondaryColorHex ?? team.colorHex ?? "#F97316"})` }} />
            <div className="pointer-events-none absolute inset-0 opacity-30" style={{ background: `radial-gradient(circle at 88% 20%, ${team.secondaryColorHex ?? team.colorHex ?? "#F97316"}24, transparent 24rem), linear-gradient(115deg, ${team.colorHex ?? "#F97316"}12, transparent 45%)` }} />
            {team.badgeUrl && <img src={team.badgeUrl} alt="" aria-hidden="true" className="pointer-events-none absolute -right-16 top-1/2 h-72 w-72 -translate-y-1/2 rotate-[-9deg] object-contain opacity-[0.06] blur-[1px]" />}
            <div className="relative grid gap-5 p-5 lg:grid-cols-[160px_minmax(0,1fr)] lg:items-center lg:p-7">
              <TeamLogo name={team.name} badgeUrl={team.badgeUrl ?? null} />
              <div className="min-w-0">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent)]">Scheda squadra</p>
                    <h1 className="mt-1 break-words text-4xl font-black leading-[0.95] tracking-[-0.07em] text-[var(--foreground)] lg:text-5xl">{team.name}</h1>
                    {team.description && <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">{team.description}</p>}
                  </div>
                  {competition && competition.played > 0 && (
                    <div className="shrink-0 rounded-2xl border border-[var(--border)] bg-[var(--card-2)] px-4 py-3 text-right">
                      <p className="text-2xl font-black text-[var(--foreground)]">{competition.points} pt</p>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">{competition.wins}V · {competition.draws}N · {competition.losses}P</p>
                    </div>
                  )}
                </div>

                {canEdit && (
                  <div className="mt-5 flex flex-wrap gap-2">
                    <button type="button" onClick={() => { setEditingTeam((value) => !value); setShowAddPlayer(false); }} className={actionClass(editingTeam)}>
                      {editingTeam ? <X size={16} /> : <Pencil size={16} />} {editingTeam ? "Chiudi modifica" : "Modifica squadra"}
                    </button>
                    <button type="button" onClick={() => { setShowAddPlayer((value) => !value); setEditingTeam(false); }} disabled={team.players.length >= MAX_PLAYERS_PER_TEAM} className={actionClass(showAddPlayer)}>
                      {showAddPlayer ? <X size={16} /> : <Plus size={16} />} {showAddPlayer ? "Chiudi" : "Aggiungi giocatore"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </header>

        {msg && <Badge variant="success">{msg}</Badge>}
        {err && <Badge variant="error">{err}</Badge>}

        <div className="grid grid-cols-2 gap-x-4 gap-y-5 border-y border-[var(--border)] py-5 xl:grid-cols-4">
          <TeamMetric icon={UsersRound} label={isAdmin ? "Rosa" : "Giocatori"} value={isAdmin ? `${team.players.length}/${MAX_PLAYERS_PER_TEAM}` : String(team.players.length)} note={isAdmin ? `${eligibleCount} idonei` : undefined} />
          <TeamMetric icon={Trophy} label="Punti" value={String(competition?.points ?? 0)} note={`${competition?.played ?? 0} partite`} />
          <TeamMetric icon={Target} label="Gol" value={`${competition?.gf ?? 0}:${competition?.ga ?? 0}`} note={`Diff. ${signed(competition?.gd ?? 0)}`} />
          <TeamMetric icon={Activity} label="Forma" value={competition?.form?.length ? competition.form.join(" ") : "—"} note={`${totalGoals} gol individuali · ${totalAppearances} presenze`} />
        </div>

        {isAdmin && attentionCount > 0 && (
          <Card className="border-amber-400/20 bg-amber-400/[0.04]">
            <div className="flex items-start gap-3"><CircleAlert size={19} className="mt-0.5 shrink-0 text-amber-300" /><div><p className="font-black text-[var(--foreground)]">{attentionCount} giocator{attentionCount === 1 ? "e" : "i"} da completare</p><p className="mt-1 text-sm text-[var(--muted)]">Usa il filtro “Da completare” per vedere subito chi non è ancora idoneo alla distinta.</p></div></div>
          </Card>
        )}

        {competition?.nextMatch && (
          <Link href={`/leagues/${leagueId}/matches/${competition.nextMatch.id}`} className="group block">
            <article className="relative min-h-[170px] overflow-hidden rounded-[8px] border border-white/10 bg-black/35 p-5 transition-colors hover:border-[var(--border-strong)] sm:p-6">
              <div className="pointer-events-none absolute inset-0" style={{ background: `linear-gradient(115deg, ${team.colorHex ?? "#F97316"}45 0%, ${team.colorHex ?? "#F97316"}13 44%, ${team.secondaryColorHex ?? team.colorHex ?? "#F97316"}35 100%)` }} />
              {team.badgeUrl && <img src={team.badgeUrl} alt="" aria-hidden="true" className="pointer-events-none absolute -right-12 -top-16 h-64 w-64 rotate-[-10deg] object-contain opacity-[0.12] blur-[1px] transition duration-500 group-hover:scale-[1.03]" />}
              <div className="relative flex min-h-[120px] flex-col justify-between gap-6 sm:flex-row sm:items-end">
                <div>
                  <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/60"><CalendarClock size={14} /> Prossima partita</p>
                  <p className="mt-4 text-2xl font-black tracking-[-0.045em] text-white">{competition.nextMatch.home ? "vs" : "@"} {competition.nextMatch.opponent.name}</p>
                  <p className="mt-2 text-xs font-bold text-white/65">{competition.nextMatch.phase === "playoff" ? "Playoff" : `Giornata ${competition.nextMatch.round}`} · {formatDate(competition.nextMatch.date)}</p>
                </div>
                {competition.nextMatch.venueName && <p className="inline-flex items-center gap-1.5 text-xs font-bold text-white/60"><MapPin size={13} /> {competition.nextMatch.venueName}</p>}
              </div>
            </article>
          </Link>
        )}

        {canEdit && <TeamChangeRequestsPanel teamId={teamId} isAdmin={isAdmin} />}

        <TeamEditPanel
          visible={canEdit && editingTeam}
          name={name}
          setName={setName}
          badgePreview={badgePreview}
          setBadgeFile={setBadgeFile}
          setBadgeUrl={setBadgeUrl}
          setRemoveBadge={setRemoveBadge}
          colorHex={colorHex}
          setColorHex={setColorHex}
          secondaryColorHex={secondaryColorHex}
          setSecondaryColorHex={setSecondaryColorHex}
          kitHomePreview={kitHomePreview}
          kitAwayPreview={kitAwayPreview}
          kitGoalkeeperPreview={kitGoalkeeperPreview}
          setKitHomeFile={(file) => {
            setKitHomeFile(file);
            if (file) setRemoveKitHome(false);
          }}
          setKitAwayFile={(file) => {
            setKitAwayFile(file);
            if (file) setRemoveKitAway(false);
          }}
          setKitGoalkeeperFile={(file) => {
            setKitGoalkeeperFile(file);
            if (file) setRemoveKitGoalkeeper(false);
          }}
          removeKitHome={() => {
            setKitHomeFile(null);
            setKitHomeUrl("");
            setRemoveKitHome(true);
          }}
          removeKitAway={() => {
            setKitAwayFile(null);
            setKitAwayUrl("");
            setRemoveKitAway(true);
          }}
          removeKitGoalkeeper={() => {
            setKitGoalkeeperFile(null);
            setKitGoalkeeperUrl("");
            setRemoveKitGoalkeeper(true);
          }}
          description={description}
          setDescription={setDescription}
          saveTeam={saveTeam}
          savingTeam={savingTeam}
          close={() => setEditingTeam(false)}
        />
        <AddPlayerPanel visible={canEdit && showAddPlayer} allowPhoto={isAdmin} firstName={newFirstName} setFirstName={setNewFirstName} lastName={newLastName} setLastName={setNewLastName} number={newNumber} setNumber={setNewNumber} position={newPosition} setPosition={setNewPosition} photoUrl={newPhotoUrl} setPhotoUrl={setNewPhotoUrl} addPlayer={addPlayer} close={() => setShowAddPlayer(false)} />

        <Card className="!rounded-none !border-x-0 !bg-transparent !p-0 !py-4">
          <div className="relative">
            <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca per nome o numero…" className="h-11 w-full rounded-[5px] border border-[var(--border)] bg-transparent pl-11 pr-4 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]" />
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            <Chip active={rosterFilter === "all"} onClick={() => setRosterFilter("all")}>Tutti</Chip>
            {isAdmin && <Chip active={rosterFilter === "eligible"} onClick={() => setRosterFilter("eligible")}><ShieldCheck size={12} /> Idonei</Chip>}
            {isAdmin && <Chip active={rosterFilter === "attention"} onClick={() => setRosterFilter("attention")}><CircleAlert size={12} /> Da completare</Chip>}
            {isAdmin && <span className="mx-1 w-px shrink-0 bg-[var(--border)]" />}
            <Chip active={roleFilter === "all"} onClick={() => setRoleFilter("all")}>Tutti i ruoli</Chip>
            {ROLE_ORDER.map((role) => <Chip key={role} active={roleFilter === role} onClick={() => setRoleFilter(role)}>{role}</Chip>)}
          </div>
        </Card>

        {team.players.length === 0 ? (
          <Card><p className="font-medium text-[var(--foreground)]">Nessun giocatore.</p><p className="mt-1 text-sm text-[var(--muted)]">Aggiungi il primo giocatore alla rosa.</p></Card>
        ) : groupedPlayers.length === 0 ? (
          <Card><p className="text-sm text-[var(--muted)]">Nessun giocatore corrisponde ai filtri.</p></Card>
        ) : (
          <div className="space-y-5">
            {groupedPlayers.map(({ role, players }) => (
              <section key={role}>
                <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-black uppercase tracking-[0.12em] text-[var(--muted)]">{role}</h2><span className="text-xs font-bold text-[var(--muted)]">{players.length}</span></div>
                <Card className="overflow-hidden !p-0">
                  {players.map((player) => <PlayerRow key={player.id} leagueId={leagueId} player={player} role={role} canEdit={canEdit} isAdmin={isAdmin} eagerPhoto={eagerPlayerIds.has(player.id)} onDelete={() => deletePlayer(player.id, `${player.firstName} ${player.lastName}`)} />)}
                </Card>
              </section>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function actionClass(active: boolean) {
  return ["inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition disabled:opacity-40", active ? "border-[var(--accent)] bg-[var(--accent)] text-black" : "border-[var(--border-strong)] bg-[var(--card-2)] text-[var(--foreground)]"].join(" ");
}

function TeamMetric({ icon: Icon, label, value, note }: { icon: typeof Trophy; label: string; value: string; note?: string }) {
  return <div className="border-l border-[var(--border)] pl-4 first:border-l-0 first:pl-0"><span className="text-[var(--accent)]"><Icon size={15} /></span><p className="scoreboard-figure mt-2 text-3xl font-semibold leading-none text-[var(--foreground)]">{value}</p><p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">{label}</p>{note && <p className="mt-1 text-[10px] text-[var(--muted)]">{note}</p>}</div>;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={["inline-flex shrink-0 items-center gap-1 border-b-2 px-2 py-2 text-xs font-semibold transition", active ? "border-[var(--accent)] text-[var(--foreground)]" : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"].join(" ")}>{children}</button>;
}

function signed(value: number) { return value > 0 ? `+${value}` : String(value); }
