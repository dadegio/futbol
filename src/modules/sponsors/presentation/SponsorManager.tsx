"use client";

import { useEffect, useMemo, useState, type InputHTMLAttributes } from "react";
import { ExternalLink, ImagePlus, Mail, MapPin, Phone, Plus, RotateCcw, Store, Trash2 } from "lucide-react";
import Card from "src/app/_components/ui/card";
import Badge from "src/app/_components/ui/badge";
import Button from "src/app/_components/ui/button";
import Input from "src/app/_components/ui/input";
import { authFetch } from "@/lib/client-auth";

type Sponsor = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  logoUrl: string | null;
  websiteUrl: string | null;
  instagramUrl: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  contactName: string | null;
  sortOrder: number;
  active: boolean;
};

type SponsorForm = {
  name: string;
  category: string;
  description: string;
  logoUrl: string;
  websiteUrl: string;
  instagramUrl: string;
  phone: string;
  email: string;
  address: string;
  contactName: string;
  sortOrder: number;
  active: boolean;
};

const EMPTY_FORM: SponsorForm = {
  name: "",
  category: "",
  description: "",
  logoUrl: "",
  websiteUrl: "",
  instagramUrl: "",
  phone: "",
  email: "",
  address: "",
  contactName: "",
  sortOrder: 0,
  active: true,
};

function sponsorToForm(sponsor: Sponsor): SponsorForm {
  return {
    name: sponsor.name,
    category: sponsor.category || "",
    description: sponsor.description || "",
    logoUrl: sponsor.logoUrl || "",
    websiteUrl: sponsor.websiteUrl || "",
    instagramUrl: sponsor.instagramUrl || "",
    phone: sponsor.phone || "",
    email: sponsor.email || "",
    address: sponsor.address || "",
    contactName: sponsor.contactName || "",
    sortOrder: sponsor.sortOrder ?? 0,
    active: sponsor.active,
  };
}

function getApiText(data: unknown, fallback: string) {
  if (typeof data !== "object" || data === null) return fallback;
  const value = (data as Record<string, unknown>).error;
  return typeof value === "string" && value.trim() ? value : fallback;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function SponsorManager({ leagueId }: { leagueId: string }) {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [form, setForm] = useState<SponsorForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const activeCount = useMemo(() => sponsors.filter((s) => s.active).length, [sponsors]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const response = await authFetch(`/api/leagues/${leagueId}/sponsors`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(getApiText(data, "Errore caricamento sponsor"));
      setSponsors(Array.isArray(data) ? data : []);
    } catch (error) {
      setErr(getErrorMessage(error, "Errore caricamento sponsor"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId]);

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErr(null);
    setMsg(null);
  }

  function editSponsor(sponsor: Sponsor) {
    setEditingId(sponsor.id);
    setForm(sponsorToForm(sponsor));
    setErr(null);
    setMsg(null);
  }

  async function uploadLogo(file: File | null) {
    if (!file) return;
    setErr(null);
    setUploading(true);
    try {
      const payload = new FormData();
      payload.append("file", file);
      const response = await authFetch("/api/upload", { method: "POST", body: payload });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.url) throw new Error(getApiText(data, "Errore upload logo"));
      setForm((previous) => ({ ...previous, logoUrl: String(data.url) }));
      setMsg("Logo caricato");
    } catch (error) {
      setErr(getErrorMessage(error, "Errore upload logo"));
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setErr(null);
    setMsg(null);
    if (!form.name.trim()) {
      setErr("Inserisci il nome dello sponsor");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        sortOrder: Number(form.sortOrder) || 0,
      };
      const url = editingId ? `/api/sponsors/${editingId}` : `/api/leagues/${leagueId}/sponsors`;
      const method = editingId ? "PATCH" : "POST";
      const response = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(getApiText(data, "Errore salvataggio sponsor"));
      resetForm();
      setMsg(editingId ? "Sponsor aggiornato" : "Sponsor aggiunto");
      await load();
    } catch (error) {
      setErr(getErrorMessage(error, "Errore salvataggio sponsor"));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(sponsor: Sponsor) {
    setErr(null);
    try {
      const response = await authFetch(`/api/sponsors/${sponsor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !sponsor.active }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(getApiText(data, "Errore aggiornamento sponsor"));
      await load();
    } catch (error) {
      setErr(getErrorMessage(error, "Errore aggiornamento sponsor"));
    }
  }

  async function removeSponsor(sponsor: Sponsor) {
    if (!window.confirm(`Eliminare lo sponsor "${sponsor.name}"?`)) return;
    setErr(null);
    try {
      const response = await authFetch(`/api/sponsors/${sponsor.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(getApiText(data, "Errore eliminazione sponsor"));
      if (editingId === sponsor.id) resetForm();
      await load();
    } catch (error) {
      setErr(getErrorMessage(error, "Errore eliminazione sponsor"));
    }
  }

  return (
    <Card>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-[var(--accent)]">Sponsor</p>
          <h2 className="mt-1 text-xl font-black tracking-[-0.04em] text-[var(--foreground)]">Negozi e partner</h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            Aggiungi sponsor del torneo con link, contatti diretti e recapiti utili. La pagina pubblica mostra solo quelli attivi.
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-2)] px-4 py-3 text-sm">
          <span className="font-black text-[var(--foreground)]">{activeCount}</span>
          <span className="ml-1 text-[var(--muted)]">attivi / {sponsors.length} totali</span>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="space-y-3">
          {err && <Badge variant="error">{err}</Badge>}
          {msg && <Badge variant="success">{msg}</Badge>}
          {loading ? (
            <p className="rounded-2xl border border-[var(--border)] bg-[var(--card-2)] px-4 py-6 text-sm text-[var(--muted)]">Caricamento sponsor…</p>
          ) : sponsors.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card-2)] px-4 py-8 text-center text-sm text-[var(--muted)]">
              Nessuno sponsor inserito. Aggiungi il primo partner dal modulo a destra.
            </p>
          ) : (
            <div className="grid gap-3">
              {sponsors.map((sponsor) => (
                <article key={sponsor.id} className="rounded-3xl border border-[var(--border)] bg-[var(--card-2)] p-4">
                  <div className="flex gap-4">
                    <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-[var(--border)] bg-black/10">
                      {sponsor.logoUrl ? (
                        <img src={sponsor.logoUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain p-1.5" />
                      ) : (
                        <Store size={24} className="text-[var(--muted)]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-black text-[var(--foreground)]">{sponsor.name}</h3>
                        {!sponsor.active && <Badge variant="default">nascosto</Badge>}
                        {sponsor.category && <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[var(--accent)]">{sponsor.category}</span>}
                      </div>
                      {sponsor.description && <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">{sponsor.description}</p>}
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                        {sponsor.websiteUrl && <span className="inline-flex items-center gap-1"><ExternalLink size={13} /> sito</span>}
                        {sponsor.phone && <span className="inline-flex items-center gap-1"><Phone size={13} /> {sponsor.phone}</span>}
                        {sponsor.email && <span className="inline-flex items-center gap-1"><Mail size={13} /> {sponsor.email}</span>}
                        {sponsor.address && <span className="inline-flex items-center gap-1"><MapPin size={13} /> indirizzo</span>}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="secondary" onClick={() => editSponsor(sponsor)}>Modifica</Button>
                    <Button type="button" size="sm" variant="secondary" onClick={() => toggleActive(sponsor)}>
                      {sponsor.active ? "Nascondi" : "Mostra"}
                    </Button>
                    <Button type="button" size="sm" variant="destructive" onClick={() => removeSponsor(sponsor)}>
                      <Trash2 size={14} className="mr-1" /> Elimina
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-[var(--border)] bg-[var(--card-2)] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-[var(--muted)]">{editingId ? "Modifica" : "Nuovo"}</p>
              <h3 className="text-lg font-black text-[var(--foreground)]">{editingId ? "Modifica sponsor" : "Aggiungi sponsor"}</h3>
            </div>
            {editingId && (
              <button type="button" onClick={resetForm} className="inline-flex items-center gap-1 text-xs font-black text-[var(--accent)]">
                <RotateCcw size={14} /> Nuovo
              </button>
            )}
          </div>

          <div className="mt-4 space-y-3">
            <TextInput label="Nome negozio / sponsor" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Camping Bar" />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <TextInput label="Categoria" value={form.category} onChange={(v) => setForm({ ...form, category: v })} placeholder="Bar, palestra, abbigliamento…" />
              <TextInput label="Ordine" value={String(form.sortOrder)} onChange={(v) => setForm({ ...form, sortOrder: Number(v) || 0 })} type="number" min={0} max={999} />
            </div>

            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">Descrizione breve</span>
              <textarea
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                rows={3}
                placeholder="Breve testo che comparirà nella pagina sponsor"
                className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 py-3 text-sm font-medium text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
              />
            </label>

            <div className="rounded-2xl border border-[var(--border)] bg-black/10 p-3">
              <div className="mb-3 flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
                  {form.logoUrl ? <img src={form.logoUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain p-1" /> : <ImagePlus size={20} className="text-[var(--muted)]" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black">Logo</p>
                  <p className="text-xs text-[var(--muted)]">Caricalo o incolla un URL.</p>
                </div>
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => uploadLogo(event.target.files?.[0] ?? null)}
                disabled={uploading}
                className="block w-full text-xs text-[var(--muted)] file:mr-3 file:rounded-xl file:border-0 file:bg-[var(--accent-soft)] file:px-3 file:py-2 file:text-xs file:font-black file:text-[var(--accent)]"
              />
              <Input className="mt-3" value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} placeholder="https://… (URL del logo)" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <TextInput label="Sito / link principale" value={form.websiteUrl} onChange={(v) => setForm({ ...form, websiteUrl: v })} placeholder="https://…" />
              <TextInput label="Instagram" value={form.instagramUrl} onChange={(v) => setForm({ ...form, instagramUrl: v })} placeholder="@nomeprofilo" />
              <TextInput label="Telefono / WhatsApp" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="+39 …" />
              <TextInput label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" placeholder="info@…" />
              <TextInput label="Referente" value={form.contactName} onChange={(v) => setForm({ ...form, contactName: v })} placeholder="Nome contatto" />
              <TextInput label="Indirizzo" value={form.address} onChange={(v) => setForm({ ...form, address: v })} placeholder="Via, città" />
            </div>

            <label className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 py-3 text-sm font-bold text-[var(--foreground)]">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              Visibile nella pagina sponsor
            </label>

            <div className="flex gap-2">
              <Button type="button" onClick={save} disabled={saving || uploading} className="flex-1">
                <Plus size={16} className="mr-1" /> {saving ? "Salvataggio…" : editingId ? "Salva modifiche" : "Aggiungi sponsor"}
              </Button>
              <Button type="button" variant="secondary" onClick={resetForm}>Pulisci</Button>
            </div>
          </div>
        </section>
      </div>
    </Card>
  );
}

function TextInput({
  label,
  value,
  onChange,
  ...props
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <label className="block">
      <span className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">{label}</span>
      <Input className="mt-1 w-full" value={value} onChange={(event) => onChange(event.target.value)} {...props} />
    </label>
  );
}
