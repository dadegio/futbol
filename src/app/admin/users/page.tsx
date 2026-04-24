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
import { useIsAdmin, authFetch } from "@/lib/client-auth";

type UserRow = {
  id: string;
  username: string;
  role: "ADMIN" | "CAPTAIN";
  teamId: string | null;
  team: { name: string } | null;
  createdAt: string;
};

type Team = { id: string; name: string };

export default function AdminUsersPage() {
  const isAdmin = useIsAdmin();
  const router = useRouter();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [changingPwdId, setChangingPwdId] = useState<string | null>(null);
  const [newPwd, setNewPwd] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdErr, setPwdErr] = useState<string | null>(null);
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);

  // New user form
  const [showForm, setShowForm] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"ADMIN" | "CAPTAIN">("CAPTAIN");
  const [newTeamId, setNewTeamId] = useState("");
  const [creating, setCreating] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const [usersRes, teamsRes] = await Promise.all([
        authFetch("/api/users"),
        authFetch("/api/leagues").then((r) => r.json()).then(async (leagues: any[]) => {
          // Fetch teams from all leagues
          const allTeams: Team[] = [];
          for (const l of leagues) {
            const tr = await fetch(`/api/leagues/${l.id}/teams`, { cache: "no-store" });
            const ts = await tr.json();
            if (Array.isArray(ts)) allTeams.push(...ts.map((t: any) => ({ id: t.id, name: `${t.name} (${l.name})` })));
          }
          return allTeams;
        }),
      ]);

      const usersData = await usersRes.json();
      if (!usersRes.ok) throw new Error(usersData?.error ?? "Errore caricamento utenti");
      setUsers(usersData);
      setTeams(teamsRes);
    } catch (e: any) {
      setErr(e.message);
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
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error ?? "Errore eliminazione");
      await load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setDeletingId(null);
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
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error ?? "Errore");
      setPwdMsg("Password aggiornata");
      setNewPwd("");
      setTimeout(() => { setChangingPwdId(null); setPwdMsg(null); }, 1500);
    } catch (e: any) {
      setPwdErr(e.message);
    } finally {
      setPwdSaving(false);
    }
  }

  async function handleCreate() {
    setFormErr(null);
    if (!newUsername.trim()) { setFormErr("Username obbligatorio"); return; }
    if (newPassword.length < 4) { setFormErr("Password minimo 4 caratteri"); return; }
    if (newRole === "CAPTAIN" && !newTeamId) { setFormErr("Seleziona una squadra"); return; }

    setCreating(true);
    try {
      const res = await authFetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword,
          role: newRole,
          teamId: newRole === "CAPTAIN" ? newTeamId : null,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error ?? "Errore creazione");
      setNewUsername("");
      setNewPassword("");
      setNewRole("CAPTAIN");
      setNewTeamId("");
      setShowForm(false);
      await load();
    } catch (e: any) {
      setFormErr(e.message);
    } finally {
      setCreating(false);
    }
  }

  if (!isAdmin && !loading) return null;

  return (
    <DashboardShell>
      <div className="space-y-6">
        <Card>
          <CardHeader
            tag="Admin"
            title="Gestione utenti"
            description="Visualizza, crea ed elimina account admin e capitani."
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
                <Select value={newRole} onChange={(e) => setNewRole(e.target.value as "ADMIN" | "CAPTAIN")}>
                  <option value="CAPTAIN" className="text-black">Capitano</option>
                  <option value="ADMIN" className="text-black">Admin</option>
                </Select>
                {newRole === "CAPTAIN" && (
                  <Select value={newTeamId} onChange={(e) => setNewTeamId(e.target.value)}>
                    <option value="" className="text-black">Seleziona squadra</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id} className="text-black">{t.name}</option>
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
                                : "bg-white/10 text-[var(--foreground)]/70",
                            ].join(" ")}
                          >
                            {u.role === "ADMIN" ? "Admin" : "Capitano"}
                          </span>
                        </div>
                        <div className="mt-1 text-sm text-[var(--foreground)]/50">
                          {u.team ? `Squadra: ${u.team.name}` : "Nessuna squadra"}
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
