"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DashboardShell from "src/app/_components/dashboard-shell";
import Card, { CardHeader } from "src/app/_components/ui/card";
import Button from "src/app/_components/ui/button";
import Badge from "src/app/_components/ui/badge";
import Input from "src/app/_components/ui/input";
import Select from "src/app/_components/ui/select";
import { useIsSuperAdmin, authFetch } from "@/lib/client-auth";
import { readApiError } from "@/modules/core/client-error";

type UserRow = {
  id: string;
  username: string;
  role: "ADMIN" | "LEAGUE_ADMIN" | "CAPTAIN" | "COACH" | "REFEREE" | "CREATOR";
  teamId: string | null;
  refereeId: string | null;
  leagueId: string | null;
  captainAssignments?: Array<{
    id: string;
    leagueId: string;
    teamId: string;
    league: { name: string };
    team: { name: string };
  }>;
  coachAssignments?: Array<{
    id: string;
    leagueId: string;
    teamId: string;
    league: { name: string };
    team: { name: string };
  }>;
  adminLeague?: { name: string } | null;
  team: { name: string } | null;
  referee: {
    name: string;
    league: { name: string };
  } | null;
  creatorProfile?: {
    displayName: string;
    roleLabel: string | null;
    league: { name: string };
  } | null;
  createdAt: string;
};

type Team = { id: string; name: string; leagueId: string; leagueName: string };
type Referee = { id: string; name: string };
type LeagueApiRow = { id: string; name: string };
type TeamApiRow = { id: string; name: string };
type RefereeApiRow = { id: string; name: string };

export default function AdminUsersPage({ returnLeagueId }: { returnLeagueId?: string }) {
  const isAdmin = useIsSuperAdmin();
  const router = useRouter();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [leagues, setLeagues] = useState<Array<{ id: string; name: string }>>([]);
  const [referees, setReferees] = useState<Referee[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [changingPwdId, setChangingPwdId] = useState<string | null>(null);
  const [newPwd, setNewPwd] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdErr, setPwdErr] = useState<string | null>(null);
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);
  const [assignmentTeamByUser, setAssignmentTeamByUser] = useState<Record<string, string>>({});
  const [assignmentBusyId, setAssignmentBusyId] = useState<string | null>(null);

  // New user form
  const [showForm, setShowForm] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] =
    useState<"ADMIN" | "LEAGUE_ADMIN" | "CAPTAIN" | "COACH" | "REFEREE" | "CREATOR">("CAPTAIN");
  const [newTeamId, setNewTeamId] = useState("");
  const [newLeagueId, setNewLeagueId] = useState("");
  const [newRefereeId, setNewRefereeId] = useState("");
  const [creating, setCreating] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const [usersRes, leaguesRes] = await Promise.all([
        authFetch("/api/users"),
        authFetch("/api/leagues"),
      ]);

      const usersData: unknown = await usersRes.json();
      const leaguesData: unknown = await leaguesRes.json();
      if (!usersRes.ok) throw new Error(readApiError(usersData, "Errore caricamento utenti"));
      if (!leaguesRes.ok) throw new Error(readApiError(leaguesData, "Errore caricamento tornei"));

      const leagueRows = (Array.isArray(leaguesData) ? leaguesData : []) as LeagueApiRow[];
      setLeagues(leagueRows.map((league) => ({ id: league.id, name: league.name })));
      const [teamGroups, refereeGroups] = await Promise.all([
        Promise.all(
          leagueRows.map(async (league) => {
            const response = await fetch(`/api/leagues/${league.id}/teams`, {
              cache: "no-store",
            });
            const data = await response.json();
            return Array.isArray(data)
              ? (data as TeamApiRow[]).map((team) => ({
                  id: team.id,
                  name: `${team.name} (${league.name})`,
                  leagueId: league.id,
                  leagueName: league.name,
                }))
              : [];
          })
        ),
        Promise.all(
          leagueRows.map(async (league) => {
            const response = await authFetch(
              `/api/leagues/${league.id}/referees`,
              { cache: "no-store" }
            );
            const data = await response.json();
            return Array.isArray(data)
              ? (data as RefereeApiRow[]).map((referee) => ({
                  id: referee.id,
                  name: `${referee.name} (${league.name})`,
                }))
              : [];
          })
        ),
      ]);

      setUsers((Array.isArray(usersData) ? usersData : []) as UserRow[]);
      setTeams(teamGroups.flat());
      setReferees(refereeGroups.flat());
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Errore caricamento utenti");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Redirect non-admins
  useEffect(() => {
    if (!loading && !isAdmin) {
      router.replace("/");
    }
  }, [isAdmin, loading, router]);

  async function handleDelete(user: UserRow) {
    if (!confirm(`Eliminare l'utente "${user.username}"?`)) return;
    setDeletingId(user.id);
    setErr(null);
    try {
      const res = await authFetch(`/api/users?id=${user.id}`, { method: "DELETE" });
      const d: unknown = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(readApiError(d, "Errore eliminazione"));
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Errore eliminazione");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleAddAssignment(user: UserRow) {
    const teamId = assignmentTeamByUser[user.id];
    if (!teamId) return;
    setAssignmentBusyId(user.id);
    setErr(null);
    try {
      const res = await authFetch(`/api/users/${user.id}/captain-assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId }),
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(readApiError(data, "Errore associazione squadra"));
      setAssignmentTeamByUser((current) => ({ ...current, [user.id]: "" }));
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Errore associazione squadra");
    } finally {
      setAssignmentBusyId(null);
    }
  }

  async function handleRemoveAssignment(user: UserRow, assignmentId: string) {
    if (!confirm("Rimuovere questa squadra dall'account capitano?")) return;
    setAssignmentBusyId(user.id);
    setErr(null);
    try {
      const res = await authFetch(
        `/api/users/${user.id}/captain-assignments?assignmentId=${encodeURIComponent(assignmentId)}`,
        { method: "DELETE" }
      );
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(readApiError(data, "Errore rimozione associazione"));
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Errore rimozione associazione");
    } finally {
      setAssignmentBusyId(null);
    }
  }

  function openChangePwd(id: string) {
    setChangingPwdId(id);
    setNewPwd("");
    setPwdErr(null);
    setPwdMsg(null);
  }

  async function handleChangePwd(id: string) {
    setPwdErr(null);
    setPwdMsg(null);
    if (newPwd.length < 8) { setPwdErr("Password minimo 8 caratteri"); return; }
    setPwdSaving(true);
    try {
      const res = await authFetch(`/api/users?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPwd }),
      });
      const d: unknown = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(readApiError(d, "Errore"));
      setPwdMsg("Password aggiornata");
      setNewPwd("");
      setTimeout(() => { setChangingPwdId(null); setPwdMsg(null); }, 1500);
    } catch (e: unknown) {
      setPwdErr(e instanceof Error ? e.message : "Errore aggiornamento password");
    } finally {
      setPwdSaving(false);
    }
  }

  async function handleCreate() {
    setFormErr(null);
    if (!newUsername.trim()) { setFormErr("Username obbligatorio"); return; }
    if (newPassword.length < 8) { setFormErr("Password minimo 8 caratteri"); return; }
    if ((newRole === "LEAGUE_ADMIN" || newRole === "CREATOR") && !newLeagueId) { setFormErr(newRole === "CREATOR" ? "Seleziona il torneo del creator" : "Seleziona un torneo"); return; }
    if ((newRole === "CAPTAIN" || newRole === "COACH") && !newTeamId) { setFormErr("Seleziona una squadra"); return; }
    if (newRole === "REFEREE" && !newRefereeId) { setFormErr("Seleziona un arbitro"); return; }

    setCreating(true);
    try {
      const res = await authFetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword,
          role: newRole,
          leagueId: newRole === "LEAGUE_ADMIN" || newRole === "CREATOR" ? newLeagueId : null,
          teamId: newRole === "CAPTAIN" || newRole === "COACH" ? newTeamId : null,
          refereeId: newRole === "REFEREE" ? newRefereeId : null,
        }),
      });
      const d: unknown = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(readApiError(d, "Errore creazione"));
      setNewUsername("");
      setNewPassword("");
      setNewRole("CAPTAIN");
      setNewTeamId("");
      setNewLeagueId("");
      setNewRefereeId("");
      setShowForm(false);
      await load();
    } catch (e: unknown) {
      setFormErr(e instanceof Error ? e.message : "Errore creazione utente");
    } finally {
      setCreating(false);
    }
  }

  if (!isAdmin && !loading) return null;

  return (
    <DashboardShell leagueId={returnLeagueId}>
      <div className="space-y-6">
        <Card>
          <CardHeader
            tag="Admin"
            title="Gestione utenti"
            description="Gestisci Super Admin, Admin torneo, capitani, allenatori, arbitri e creator."
          />
        </Card>

        {err && <Badge variant="error">{err}</Badge>}

        {/* Toolbar */}
        <Card>
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm text-[var(--foreground)]/60">
              {users.length} account registrati
            </div>
            <Button size="sm" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Annulla" : "+ Nuovo utente"}
            </Button>
          </div>

          {/* Create form */}
          {showForm && (
            <div className="mt-5 space-y-3">
              <div className="text-base font-bold text-[var(--foreground)]">Nuovo utente</div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Input
                  placeholder="Username"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                />
                <Input
                  placeholder="Password"
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <Select
                  value={newRole}
                  onChange={(e) =>
                    setNewRole(
                      e.target.value as "ADMIN" | "LEAGUE_ADMIN" | "CAPTAIN" | "COACH" | "REFEREE" | "CREATOR"
                    )
                  }
                >
                  <option value="CAPTAIN" className="text-black">Capitano</option>
                  <option value="COACH" className="text-black">Allenatore</option>
                  <option value="REFEREE" className="text-black">Arbitro</option>
                  <option value="ADMIN" className="text-black">Super Admin</option>
                  <option value="LEAGUE_ADMIN" className="text-black">Admin torneo</option>
                  <option value="CREATOR" className="text-black">Creator</option>
                </Select>
                {(newRole === "LEAGUE_ADMIN" || newRole === "CREATOR") && (
                  <Select value={newLeagueId} onChange={(e) => setNewLeagueId(e.target.value)}>
                    <option value="" className="text-black">{newRole === "CREATOR" ? "Torneo creator…" : "Seleziona torneo…"}</option>
                    {leagues.map((league) => (
                      <option key={league.id} value={league.id} className="text-black">{league.name}</option>
                    ))}
                  </Select>
                )}
                {(newRole === "CAPTAIN" || newRole === "COACH") && (
                  <Select value={newTeamId} onChange={(e) => setNewTeamId(e.target.value)}>
                    <option value="" className="text-black">{newRole === "COACH" ? "Squadra allenata…" : "Seleziona squadra"}</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id} className="text-black">{t.name}</option>
                    ))}
                  </Select>
                )}
                {newRole === "REFEREE" && (
                  <Select
                    value={newRefereeId}
                    onChange={(e) => setNewRefereeId(e.target.value)}
                  >
                    <option value="" className="text-black">Seleziona arbitro</option>
                    {referees.map((referee) => (
                      <option
                        key={referee.id}
                        value={referee.id}
                        className="text-black"
                      >
                        {referee.name}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
              {formErr && <Badge variant="error">{formErr}</Badge>}
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? "Creazione..." : "Crea utente"}
              </Button>
            </div>
          )}
        </Card>

        {/* Users table */}
        {loading ? (
          <div className="text-[var(--foreground)]/60">Caricamento...</div>
        ) : (
          <Card>
            {users.length === 0 ? (
              <div className="text-[var(--foreground)]/55">Nessun utente trovato.</div>
            ) : (
              <div className="space-y-3">
                {users.map((u) => (
                  <div
                    key={u.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--card-2)] p-4"
                  >
                    {/* Row 1: info + action buttons */}
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-[var(--foreground)]">{u.username}</span>
                          <span
                            className={[
                              "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                              u.role === "ADMIN"
                                ? "bg-[var(--accent)]/20 text-[var(--accent)]"
                                : u.role === "LEAGUE_ADMIN"
                                  ? "bg-blue-500/15 text-blue-600"
                                  : u.role === "REFEREE"
                                    ? "bg-emerald-500/15 text-emerald-600"
                                    : u.role === "CREATOR"
                                      ? "bg-fuchsia-500/15 text-fuchsia-500"
                                      : "bg-white/10 text-[var(--foreground)]/70",
                            ].join(" ")}
                          >
                            {u.role === "ADMIN"
                              ? "Super Admin"
                              : u.role === "LEAGUE_ADMIN"
                                ? "Admin torneo"
                                : u.role === "REFEREE"
                                  ? "Arbitro"
                                  : u.role === "CREATOR"
                                    ? "Creator"
                                    : u.role === "COACH"
                                      ? "Allenatore"
                                      : "Capitano"}
                          </span>
                        </div>
                        <div className="mt-1 text-sm text-[var(--foreground)]/50">
                          {u.role === "LEAGUE_ADMIN" && u.adminLeague
                            ? `Torneo amministrato: ${u.adminLeague.name}`
                            : u.role === "CREATOR" && u.creatorProfile
                              ? `Creator: ${u.creatorProfile.displayName} (${u.creatorProfile.league.name})`
                              : u.role === "CAPTAIN"
                                ? `${u.captainAssignments?.length ?? (u.team ? 1 : 0)} squadre associate`
                                : u.role === "COACH"
                                  ? u.coachAssignments?.[0]
                                    ? `Allenatore: ${u.coachAssignments[0].team.name} (${u.coachAssignments[0].league.name})`
                                    : "Allenatore senza squadra"
                                : u.team
                                  ? `Squadra: ${u.team.name}`
                                  : u.referee
                                  ? `Arbitro: ${u.referee.name} (${u.referee.league.name})`
                                  : u.role === "ADMIN"
                                    ? "Accesso globale"
                                    : "Nessuna associazione"}
                        </div>
                      </div>

                      <div className="flex shrink-0 gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            changingPwdId === u.id ? setChangingPwdId(null) : openChangePwd(u.id)
                          }
                        >
                          {changingPwdId === u.id ? "Annulla" : "Cambia password"}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(u)}
                          disabled={deletingId === u.id}
                        >
                          {deletingId === u.id ? "..." : "Elimina"}
                        </Button>
                      </div>
                    </div>

                    {u.role === "CAPTAIN" && (
                      <div className="mt-4 border-t border-[var(--border)] pt-4">
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--muted)]">
                          Squadre e tornei
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(u.captainAssignments ?? []).length === 0 ? (
                            <span className="text-sm text-[var(--muted)]">Nessuna squadra associata.</span>
                          ) : (
                            u.captainAssignments?.map((assignment) => (
                              <div key={assignment.id} className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs">
                                <span className="font-bold text-[var(--foreground)]">{assignment.team.name}</span>
                                <span className="text-[var(--muted)]">· {assignment.league.name}</span>
                                <button type="button" onClick={() => handleRemoveAssignment(u, assignment.id)} disabled={assignmentBusyId === u.id} className="ml-1 rounded-lg px-1.5 py-0.5 font-black text-red-400 hover:bg-red-500/10">×</button>
                              </div>
                            ))
                          )}
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                          <Select
                            value={assignmentTeamByUser[u.id] ?? ""}
                            onChange={(e) => setAssignmentTeamByUser((current) => ({ ...current, [u.id]: e.target.value }))}
                          >
                            <option value="" className="text-black">Aggiungi squadra…</option>
                            {teams
                              .filter((team) => !(u.captainAssignments ?? []).some((assignment) => assignment.leagueId === team.leagueId))
                              .map((team) => (
                                <option key={team.id} value={team.id} className="text-black">{team.name}</option>
                              ))}
                          </Select>
                          <Button size="sm" onClick={() => handleAddAssignment(u)} disabled={!assignmentTeamByUser[u.id] || assignmentBusyId === u.id}>
                            {assignmentBusyId === u.id ? "…" : "Aggiungi"}
                          </Button>
                        </div>
                        <p className="mt-2 text-[11px] text-[var(--muted)]">
                          Lo stesso account può gestire una squadra diversa in più tornei; una sola squadra per torneo.
                        </p>
                      </div>
                    )}

                    {/* Row 2: inline change-password form */}
                    {changingPwdId === u.id && (
                      <div className="mt-3 flex flex-col gap-2 border-t border-[var(--border)] pt-3">
                        <div className="flex flex-wrap gap-2">
                          <Input
                            type="text"
                            placeholder="Nuova password (min 8 caratteri)"
                            value={newPwd}
                            onChange={(e) => setNewPwd(e.target.value)}
                            className="flex-1"
                            aria-label={`Nuova password per ${u.username}`}
                          />
                          <Button
                            size="sm"
                            onClick={() => handleChangePwd(u.id)}
                            disabled={pwdSaving}
                          >
                            {pwdSaving ? "Salvataggio…" : "Salva"}
                          </Button>
                        </div>
                        {pwdErr && <Badge variant="error">{pwdErr}</Badge>}
                        {pwdMsg && <Badge variant="success">{pwdMsg}</Badge>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        <div className="text-sm text-[var(--foreground)]/40">
          <Link href="/" className="underline underline-offset-2 hover:text-[var(--foreground)]/70">
            ← Torna alla home
          </Link>
        </div>
      </div>
    </DashboardShell>
  );
}
