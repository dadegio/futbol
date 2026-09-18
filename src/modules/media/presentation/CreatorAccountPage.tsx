"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Save, UserRound } from "lucide-react";
import DashboardShell from "src/app/_components/dashboard-shell";
import Card, { CardHeader } from "src/app/_components/ui/card";
import Badge from "src/app/_components/ui/badge";
import Button from "src/app/_components/ui/button";
import Input from "src/app/_components/ui/input";
import { authFetch, useAuth, useCanCreateMedia } from "@/lib/client-auth";

type Profile = {
  id: string;
  displayName: string;
  roleLabel: string | null;
  avatarUrl: string | null;
  bio: string | null;
  instagramUrl: string | null;
  tiktokUrl: string | null;
  youtubeUrl: string | null;
  email: string | null;
  phone: string | null;
  websiteUrl: string | null;
  primaryColor: string | null;
  showEmail: boolean;
  showInstagram: boolean;
  showTikTok: boolean;
  showYoutube: boolean;
  showPhone: boolean;
  active: boolean;
};

type Workspace = { profile: Profile | null };

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function normalizeSocialInput(value: string) {
  return value
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "@")
    .replace(/^https?:\/\/www\.tiktok\.com\/@?/i, "@");
}

export default function CreatorAccountPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const { loading: authLoading } = useAuth();
  const canCreate = useCanCreateMedia(leagueId);
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    if (!leagueId) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await authFetch(`/api/leagues/${leagueId}/creator/me`, { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as Workspace & { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Errore caricamento profilo creator");
      setProfile(body.profile ?? null);
    } catch (error) {
      setErr(getErrorMessage(error, "Errore caricamento profilo creator"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [leagueId]);

  useEffect(() => {
    if (!authLoading && !canCreate) router.replace(`/leagues/${leagueId}/media`);
  }, [authLoading, canCreate, leagueId, router]);

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0];
    if (!next || !profile) return;
    setUploadingAvatar(true);
    setErr(null);
    try {
      const form = new FormData();
      form.append("file", next);
      const res = await authFetch("/api/upload", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "Errore upload avatar");
      setProfile({ ...profile, avatarUrl: body.url });
    } catch (error) {
      setErr(getErrorMessage(error, "Errore upload avatar"));
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function saveProfile() {
    if (!profile) return;
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await authFetch(`/api/leagues/${leagueId}/creator/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "Errore salvataggio profilo");
      setProfile(body);
      setMsg("Profilo creator aggiornato");
    } catch (error) {
      setErr(getErrorMessage(error, "Errore salvataggio profilo"));
    } finally {
      setSaving(false);
    }
  }

  if (!canCreate && !authLoading) return null;

  return (
    <DashboardShell leagueId={leagueId}>
      <div className="space-y-5 pb-8">
        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <CardHeader
              tag="Account creator"
              title="Il mio profilo"
              description="Personalizza identità, contatti e crediti. Le informazioni operative delle partite restano nella pagina I miei incarichi."
              level={1}
            />
            <Link href={`/leagues/${leagueId}/creator`}>
              <Button type="button" variant="secondary">
                <ArrowLeft size={16} className="mr-2" /> I miei incarichi
              </Button>
            </Link>
          </div>
        </Card>

        {err && <Badge variant="error">{err}</Badge>}
        {msg && <Badge variant="success"><CheckCircle2 size={16} /> {msg}</Badge>}
        {loading && <p className="text-sm text-[var(--muted)]">Caricamento profilo…</p>}

        {profile && (
          <Card>
            <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
              <div
                className="rounded-[30px] border border-[var(--border)] bg-[var(--card-2)] p-5 text-center"
                style={{ borderColor: profile.primaryColor || undefined }}
              >
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="mx-auto h-36 w-36 rounded-[34px] object-cover"
                  />
                ) : (
                  <div className="mx-auto grid h-36 w-36 place-items-center rounded-[34px] bg-[var(--accent-soft)] text-[var(--accent)]">
                    <UserRound size={48} />
                  </div>
                )}
                <label className="mt-4 inline-flex cursor-pointer items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-xs font-black text-[var(--foreground)]">
                  {uploadingAvatar ? "Caricamento…" : "Cambia avatar"}
                  <input type="file" accept="image/*" onChange={uploadAvatar} className="sr-only" />
                </label>
                <p className="mt-4 text-xl font-black text-[var(--foreground)]">{profile.displayName}</p>
                <p className="text-sm text-[var(--muted)]">{profile.roleLabel || "Creator"}</p>
              </div>

              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <Input value={profile.displayName} onChange={(e) => setProfile({ ...profile, displayName: e.target.value })} placeholder="Nome pubblico" />
                  <Input value={profile.roleLabel ?? ""} onChange={(e) => setProfile({ ...profile, roleLabel: e.target.value })} placeholder="Ruolo: fotografo, videomaker…" />
                  <Input value={normalizeSocialInput(profile.instagramUrl ?? "")} onChange={(e) => setProfile({ ...profile, instagramUrl: e.target.value })} placeholder="Instagram, es. @nome" />
                  <Input value={profile.tiktokUrl ?? ""} onChange={(e) => setProfile({ ...profile, tiktokUrl: e.target.value })} placeholder="TikTok / profilo" />
                  <Input value={profile.youtubeUrl ?? ""} onChange={(e) => setProfile({ ...profile, youtubeUrl: e.target.value })} placeholder="YouTube / canale" />
                  <Input value={profile.websiteUrl ?? ""} onChange={(e) => setProfile({ ...profile, websiteUrl: e.target.value })} placeholder="Portfolio / sito" />
                  <Input value={profile.email ?? ""} onChange={(e) => setProfile({ ...profile, email: e.target.value })} placeholder="Email contatto" />
                  <Input value={profile.phone ?? ""} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="Telefono" />
                  <Input value={profile.primaryColor ?? ""} onChange={(e) => setProfile({ ...profile, primaryColor: e.target.value })} placeholder="Colore profilo #A855F7" />
                </div>

                <textarea
                  value={profile.bio ?? ""}
                  onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                  placeholder="Bio breve, stile contenuti, disponibilità…"
                  className="min-h-28 w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
                />

                <div className="grid gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card-2)] p-4 text-xs font-bold text-[var(--foreground)] sm:grid-cols-2">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={profile.showInstagram} onChange={(e) => setProfile({ ...profile, showInstagram: e.target.checked })} /> Mostra Instagram</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={profile.showTikTok} onChange={(e) => setProfile({ ...profile, showTikTok: e.target.checked })} /> Mostra TikTok</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={profile.showYoutube} onChange={(e) => setProfile({ ...profile, showYoutube: e.target.checked })} /> Mostra YouTube</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={profile.showEmail} onChange={(e) => setProfile({ ...profile, showEmail: e.target.checked })} /> Mostra email</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={profile.showPhone} onChange={(e) => setProfile({ ...profile, showPhone: e.target.checked })} /> Mostra telefono</label>
                </div>

                <Button type="button" onClick={saveProfile} disabled={saving}>
                  <Save size={16} className="mr-2" /> {saving ? "Salvataggio…" : "Salva profilo"}
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
}
