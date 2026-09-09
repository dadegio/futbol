"use client";

import { useMemo, useState } from "react";
import {
  ImagePlus,
  Megaphone,
  Palette,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import Card from "src/app/_components/ui/card";
import Button from "src/app/_components/ui/button";
import { authFetch } from "@/lib/client-auth";
import { GENERIC_BRAND, resolveLeagueBranding } from "@/modules/branding/domain/league-branding";
import { clearJsonCache } from "@/modules/core/client-cache";

export type BrandingSettings = {
  id: string;
  name: string;
  themeMode?: string | null;
  brandLogoUrl?: string | null;
  brandCoverUrl?: string | null;
  brandPrimaryColor?: string | null;
  brandSecondaryColor?: string | null;
  brandBackgroundColor?: string | null;
  cookieBannerEnabled?: boolean | null;
  privacyPolicyUrl?: string | null;
  cookiePolicyUrl?: string | null;
  adsEnabled?: boolean | null;
  adProvider?: string | null;
  adClientId?: string | null;
  adHomeSlot?: string | null;
  adLeagueSlot?: string | null;
};

async function uploadImage(file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await authFetch("/api/upload", { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? "Errore caricamento immagine");
  return String(data.url ?? "");
}

export default function BrandingManager({
  leagueId,
  value,
  onChange,
  view = "all",
}: {
  leagueId: string;
  value: BrandingSettings;
  onChange: (next: BrandingSettings) => void;
  view?: "all" | "identity" | "privacy";
}) {
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "cover" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resolved = useMemo(() => resolveLeagueBranding(value), [value]);
  const mode =
    value.themeMode === "IMPERIAL" || value.themeMode === "CUSTOM"
      ? value.themeMode
      : "GENERIC";

  function setMode(nextMode: "IMPERIAL" | "GENERIC" | "CUSTOM") {
    if (nextMode === "IMPERIAL") {
      onChange({
        ...value,
        themeMode: nextMode,
        brandPrimaryColor: null,
        brandSecondaryColor: null,
        brandBackgroundColor: null,
      });
      return;
    }
    if (nextMode === "GENERIC") {
      onChange({
        ...value,
        themeMode: nextMode,
        brandPrimaryColor: null,
        brandSecondaryColor: null,
        brandBackgroundColor: null,
      });
      return;
    }
    onChange({
      ...value,
      themeMode: nextMode,
      brandPrimaryColor: value.brandPrimaryColor || GENERIC_BRAND.primary,
      brandSecondaryColor: value.brandSecondaryColor || GENERIC_BRAND.secondary,
      brandBackgroundColor: value.brandBackgroundColor || GENERIC_BRAND.background,
    });
  }

  async function handleUpload(kind: "logo" | "cover", file?: File) {
    if (!file) return;
    setError(null);
    setMessage(null);
    setUploading(kind);
    try {
      const url = await uploadImage(file);
      onChange({
        ...value,
        ...(kind === "logo" ? { brandLogoUrl: url } : { brandCoverUrl: url }),
        themeMode: "CUSTOM",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore upload");
    } finally {
      setUploading(null);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await authFetch(`/api/leagues/${leagueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: value.name,
          themeMode: value.themeMode || "GENERIC",
          brandLogoUrl: value.brandLogoUrl || null,
          brandCoverUrl: value.brandCoverUrl || null,
          brandPrimaryColor: value.brandPrimaryColor || null,
          brandSecondaryColor: value.brandSecondaryColor || null,
          brandBackgroundColor: value.brandBackgroundColor || null,
          cookieBannerEnabled: value.cookieBannerEnabled !== false,
          privacyPolicyUrl: value.privacyPolicyUrl || null,
          cookiePolicyUrl: value.cookiePolicyUrl || null,
          adsEnabled: value.adsEnabled === true,
          adProvider: value.adProvider || null,
          adClientId: value.adClientId || null,
          adHomeSlot: value.adHomeSlot || null,
          adLeagueSlot: value.adLeagueSlot || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Errore salvataggio grafica");
      onChange({ ...value, ...data });
      clearJsonCache(`/api/leagues/${leagueId}`);
      setMessage("Impostazioni torneo aggiornate");
      window.dispatchEvent(new CustomEvent("league-branding-updated", { detail: data }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  }

  const previewLogo = resolved.logoUrl;
  const showIdentity = view !== "privacy";
  const showPrivacy = view !== "identity";

  return (
    <Card>
      <div className={showIdentity ? "grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start" : ""}>
        <div className="space-y-7">
          {showIdentity && (
          <section>
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <Sparkles size={19} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)]">
                  Identità torneo
                </p>
                <h2 className="mt-1 text-xl font-black tracking-[-0.04em]">
                  Nome, grafiche e colori
                </h2>
              </div>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
              Ogni torneo può avere nome, logo, copertina e palette proprie. I tornei già esistenti restano sul tema Cammino Imperiale finché non li modifichi.
            </p>

            <label className="mt-5 block rounded-2xl border border-[var(--border)] bg-[var(--card-2)] p-4">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                Nome torneo
              </span>
              <input
                value={value.name}
                onChange={(e) => onChange({ ...value, name: e.target.value })}
                placeholder="Nome visualizzato nell'app"
                className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-black/15 px-3 text-base font-bold text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
              />
            </label>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                ["IMPERIAL", "Cammino Imperiale", "Grafica storica attuale"],
                ["GENERIC", "Neutro", "Tema pulito per nuovi tornei"],
                ["CUSTOM", "Personalizzato", "Colori e grafiche del torneo"],
              ].map(([id, title, subtitle]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMode(id as "IMPERIAL" | "GENERIC" | "CUSTOM")}
                  className={[
                    "rounded-2xl border p-4 text-left transition",
                    mode === id
                      ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                      : "border-[var(--border)] bg-[var(--card-2)]",
                  ].join(" ")}
                >
                  <span className="block text-sm font-black">{title}</span>
                  <span className="mt-1 block text-xs text-[var(--muted)]">{subtitle}</span>
                </button>
              ))}
            </div>

            {showIdentity && mode === "CUSTOM" && (
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <ColorField
                  label="Colore principale"
                  value={value.brandPrimaryColor || GENERIC_BRAND.primary}
                  onChange={(color) => onChange({ ...value, brandPrimaryColor: color })}
                />
                <ColorField
                  label="Colore secondario"
                  value={value.brandSecondaryColor || GENERIC_BRAND.secondary}
                  onChange={(color) => onChange({ ...value, brandSecondaryColor: color })}
                />
                <ColorField
                  label="Sfondo"
                  value={value.brandBackgroundColor || GENERIC_BRAND.background}
                  onChange={(color) => onChange({ ...value, brandBackgroundColor: color })}
                />
              </div>
            )}

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <UploadField
                label="Logo torneo"
                hint="PNG/WebP trasparente consigliato"
                busy={uploading === "logo"}
                onFile={(file) => handleUpload("logo", file)}
                onClear={() => onChange({ ...value, brandLogoUrl: null })}
                hasValue={Boolean(value.brandLogoUrl)}
              />
              <UploadField
                label="Copertina / hero"
                hint="Immagine orizzontale, ideale 1600×700"
                busy={uploading === "cover"}
                onFile={(file) => handleUpload("cover", file)}
                onClear={() => onChange({ ...value, brandCoverUrl: null })}
                hasValue={Boolean(value.brandCoverUrl)}
              />
            </div>
          </section>
          )}

          {showPrivacy && (
          <>
          <section className="rounded-3xl border border-[var(--border)] bg-[var(--card-2)] p-4">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <ShieldCheck size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black">Cookie e privacy</p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
                  Attiva il banner di consenso e collega le tue policy. I cookie pubblicitari restano disattivati finché l'utente non accetta la categoria marketing.
                </p>
              </div>
            </div>

            <label className="mt-4 flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-black/10 p-3 text-sm font-semibold">
              <input
                type="checkbox"
                checked={value.cookieBannerEnabled !== false}
                onChange={(e) => onChange({ ...value, cookieBannerEnabled: e.target.checked })}
                className="mt-1"
              />
              Mostra banner consenso cookie
            </label>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <TextField
                label="Link privacy policy"
                value={value.privacyPolicyUrl || ""}
                placeholder="https://… oppure /privacy"
                onChange={(next) => onChange({ ...value, privacyPolicyUrl: next })}
              />
              <TextField
                label="Link cookie policy"
                value={value.cookiePolicyUrl || ""}
                placeholder="https://… oppure /cookie"
                onChange={(next) => onChange({ ...value, cookiePolicyUrl: next })}
              />
            </div>
          </section>

          <section className="rounded-3xl border border-[var(--border)] bg-[var(--card-2)] p-4">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <Megaphone size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black">Pubblicità</p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
                  Configurazione base per banner pubblicitari. Per Google AdSense inserisci publisher ID e slot; l'app mostra gli annunci solo dopo consenso marketing.
                </p>
              </div>
            </div>

            <label className="mt-4 flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-black/10 p-3 text-sm font-semibold">
              <input
                type="checkbox"
                checked={value.adsEnabled === true}
                onChange={(e) => onChange({ ...value, adsEnabled: e.target.checked, adProvider: e.target.checked ? value.adProvider || "ADSENSE" : value.adProvider })}
                className="mt-1"
              />
              Abilita spazi pubblicitari per questo torneo
            </label>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <TextField
                label="Provider"
                value={value.adProvider || "ADSENSE"}
                placeholder="ADSENSE"
                onChange={(next) => onChange({ ...value, adProvider: next })}
              />
              <TextField
                label="AdSense client ID"
                value={value.adClientId || ""}
                placeholder="ca-pub-xxxxxxxxxxxxxxxx"
                onChange={(next) => onChange({ ...value, adClientId: next })}
              />
              <TextField
                label="Slot home torneo"
                value={value.adLeagueSlot || ""}
                placeholder="1234567890"
                onChange={(next) => onChange({ ...value, adLeagueSlot: next })}
              />
              <TextField
                label="Slot selezione tornei"
                value={value.adHomeSlot || ""}
                placeholder="opzionale"
                onChange={(next) => onChange({ ...value, adHomeSlot: next })}
              />
            </div>
          </section>
          </>
          )}

          {(error || message) && (
            <p className={`text-sm font-semibold ${error ? "text-red-300" : "text-emerald-300"}`}>
              {error || message}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={saving || uploading !== null}>
              {saving ? "Salvataggio…" : "Salva impostazioni torneo"}
            </Button>
            {showIdentity && mode === "CUSTOM" && (
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...value,
                    brandPrimaryColor: GENERIC_BRAND.primary,
                    brandSecondaryColor: GENERIC_BRAND.secondary,
                    brandBackgroundColor: GENERIC_BRAND.background,
                  })
                }
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-bold text-[var(--muted)]"
              >
                <RotateCcw size={15} /> Reimposta colori
              </button>
            )}
          </div>
        </div>

        {showIdentity && (
        <div
          className="relative min-h-[320px] overflow-hidden rounded-[28px] border border-white/10 p-5"
          style={{
            backgroundColor: resolved.background,
            backgroundImage: value.brandCoverUrl
              ? `linear-gradient(rgba(0,0,0,.24), rgba(0,0,0,.72)), url(${JSON.stringify(value.brandCoverUrl)})`
              : `radial-gradient(circle at top left, ${resolved.primary}44, transparent 55%), linear-gradient(145deg, ${resolved.background}, #05070a)`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="flex h-full min-h-[280px] flex-col justify-between">
            <div className="flex items-start justify-between gap-4">
              {previewLogo ? (
                <img src={previewLogo} alt="" loading="lazy" decoding="async" className="h-16 w-16 rounded-2xl object-contain" />
              ) : (
                <div className="grid h-16 w-16 place-items-center rounded-2xl border border-white/15 bg-black/20">
                  <ImagePlus size={24} />
                </div>
              )}
              <span className="rounded-full border border-white/15 bg-black/25 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]">
                Anteprima
              </span>
            </div>
            <div>
              <div className="mb-3 flex items-center gap-2">
                <div className="h-1.5 w-20 rounded-full" style={{ background: resolved.primary }} />
                <Palette size={16} className="text-white/50" />
              </div>
              <p className="text-3xl font-black tracking-[-0.05em] text-white">{value.name}</p>
              <p className="mt-1 text-sm text-white/65">Identità grafica del torneo</p>
              <div className="mt-5 grid grid-cols-2 gap-2 text-[11px] font-bold text-white/70">
                <span className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                  Cookie: {value.cookieBannerEnabled === false ? "off" : "on"}
                </span>
                <span className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                  Ads: {value.adsEnabled ? "on" : "off"}
                </span>
              </div>
            </div>
          </div>
        </div>
        )}
      </div>
    </Card>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="rounded-2xl border border-[var(--border)] bg-[var(--card-2)] p-3">
      <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
        {label}
      </span>
      <span className="mt-2 flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 cursor-pointer rounded-lg border-0 bg-transparent p-0"
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={7}
          className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-black/15 px-3 py-2 text-sm uppercase"
        />
      </span>
    </label>
  );
}

function TextField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block rounded-2xl border border-[var(--border)] bg-black/10 p-3">
      <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 h-10 w-full rounded-xl border border-[var(--border)] bg-black/15 px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
      />
    </label>
  );
}

function UploadField({
  label,
  hint,
  busy,
  onFile,
  onClear,
  hasValue,
}: {
  label: string;
  hint: string;
  busy: boolean;
  onFile: (file?: File) => void;
  onClear: () => void;
  hasValue: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-2)] p-4">
      <p className="text-sm font-black">{label}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-black">
          <Upload size={14} /> {busy ? "Caricamento…" : "Carica"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={busy}
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>
        {hasValue && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-black text-red-300"
          >
            Rimuovi
          </button>
        )}
      </div>
    </div>
  );
}
