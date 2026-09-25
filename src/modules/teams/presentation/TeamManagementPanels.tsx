"use client";

import Card from "src/app/_components/ui/card";
import Button from "src/app/_components/ui/button";
import Input from "src/app/_components/ui/input";
import Select from "src/app/_components/ui/select";
import { POSITIONS } from "./TeamDetailParts";

export function TeamEditPanel({
  visible,
  name,
  setName,
  badgePreview,
  setBadgeFile,
  setBadgeUrl,
  setRemoveBadge,
  colorHex,
  setColorHex,
  secondaryColorHex,
  setSecondaryColorHex,
  kitHomePreview,
  kitAwayPreview,
  kitGoalkeeperPreview,
  setKitHomeFile,
  setKitAwayFile,
  setKitGoalkeeperFile,
  removeKitHome,
  removeKitAway,
  removeKitGoalkeeper,
  description,
  setDescription,
  saveTeam,
  savingTeam,
  close,
}: {
  visible: boolean;
  name: string;
  setName: (value: string) => void;
  badgePreview: string;
  setBadgeFile: (file: File | null) => void;
  setBadgeUrl: (value: string) => void;
  setRemoveBadge: (value: boolean) => void;
  colorHex: string;
  setColorHex: (value: string) => void;
  secondaryColorHex: string;
  setSecondaryColorHex: (value: string) => void;
  kitHomePreview: string;
  kitAwayPreview: string;
  kitGoalkeeperPreview: string;
  setKitHomeFile: (file: File | null) => void;
  setKitAwayFile: (file: File | null) => void;
  setKitGoalkeeperFile: (file: File | null) => void;
  removeKitHome: () => void;
  removeKitAway: () => void;
  removeKitGoalkeeper: () => void;
  description: string;
  setDescription: (value: string) => void;
  saveTeam: () => void | Promise<void>;
  savingTeam: boolean;
  close: () => void;
}) {
  if (!visible) return null;

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-lg font-black tracking-[-0.04em] text-[var(--foreground)]">Modifica squadra</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Aggiorna nome e logo della squadra.</p>
      </div>

      <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome squadra" className="w-full" />

      <div className="flex items-start gap-4">
        {badgePreview ? (
          <img src={badgePreview} alt="Preview logo" className="h-28 w-28 shrink-0 rounded-xl border border-[var(--border)] object-contain" />
        ) : (
          <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[#eef0ec] text-xs text-[var(--muted)]">Logo</div>
        )}

        <div className="min-w-0 flex-1 space-y-2">
          <input
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setBadgeFile(file);
              if (file) setRemoveBadge(false);
            }}
            className="block w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--accent)] file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white"
          />
          <p className="text-xs text-[var(--muted)]">Max 5 MB.</p>
          {badgePreview && (
            <button
              type="button"
              onClick={() => {
                setBadgeFile(null);
                setBadgeUrl("");
                setRemoveBadge(true);
              }}
              className="text-xs font-semibold text-amber-300"
            >
              Rimuovi logo
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-xs font-black uppercase tracking-wider text-[var(--muted)]">Colori maglia</label>
        <div className="grid gap-3 sm:grid-cols-2">
          <ColorInput label="Colore 1" value={colorHex} fallback="#F97316" setValue={setColorHex} />
          <ColorInput label="Colore 2" value={secondaryColorHex} fallback="#F97316" setValue={setSecondaryColorHex} />
        </div>

        <div
          className="h-10 w-full rounded-xl border border-[var(--border)]"
          style={{
            background:
              /^#[0-9A-F]{6}$/.test(colorHex) && /^#[0-9A-F]{6}$/.test(secondaryColorHex)
                ? `linear-gradient(90deg, ${colorHex} 0 50%, ${secondaryColorHex} 50% 100%)`
                : "transparent",
          }}
          aria-label="Anteprima colori maglia"
        />
        <p className="text-xs text-[var(--muted)]">I due colori vengono mostrati insieme nel Match Center e restano modificabili dall&apos;app.</p>
      </div>

      <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--card-2)] p-4">
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-[var(--muted)]">
            Divise Coach Mode
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
            Carica preferibilmente immagini PNG/WebP con sfondo trasparente e la sola maglia.
            Verranno usate sul campo della formazione. Max 5 MB ciascuna.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <KitUploadField
            label="Prima divisa"
            preview={kitHomePreview}
            requiredLabel="Usata come divisa principale"
            setFile={setKitHomeFile}
            remove={removeKitHome}
          />
          <KitUploadField
            label="Portiere"
            preview={kitGoalkeeperPreview}
            requiredLabel="Usata per il POR"
            setFile={setKitGoalkeeperFile}
            remove={removeKitGoalkeeper}
          />
          <KitUploadField
            label="Trasferta"
            preview={kitAwayPreview}
            requiredLabel="Opzionale"
            setFile={setKitAwayFile}
            remove={removeKitAway}
          />
        </div>
      </div>

      <div className="space-y-3">
        <textarea
          aria-label="Descrizione squadra"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Racconta identità, stile o motto della squadra"
          rows={4}
          className="min-h-28 w-full resize-none rounded-2xl border border-[var(--border)] bg-white/[0.04] px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:bg-white/[0.07]"
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={saveTeam} disabled={savingTeam}>{savingTeam ? "Salvataggio…" : "Salva"}</Button>
          <Button variant="secondary" onClick={close}>Annulla</Button>
        </div>
      </div>
    </Card>
  );
}

function KitUploadField({
  label,
  preview,
  requiredLabel,
  setFile,
  remove,
}: {
  label: string;
  preview: string;
  requiredLabel: string;
  setFile: (file: File | null) => void;
  remove: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-black text-[var(--foreground)]">{label}</p>
        <span className="text-[9px] font-bold uppercase text-[var(--muted)]">
          {requiredLabel}
        </span>
      </div>

      <div className="mt-3 grid h-36 place-items-center overflow-hidden rounded-2xl border border-dashed border-[var(--border)] bg-black/10 p-3">
        {preview ? (
          <img
            src={preview}
            alt={`Anteprima ${label}`}
            className="h-full w-full object-contain"
          />
        ) : (
          <span className="text-xs font-bold text-[var(--muted)]">
            Nessuna immagine
          </span>
        )}
      </div>

      <input
        type="file"
        accept="image/png,image/webp,image/jpeg"
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        className="mt-3 block w-full text-xs text-[var(--muted)] file:mr-2 file:rounded-lg file:border-0 file:bg-[var(--accent)] file:px-2.5 file:py-1.5 file:text-[10px] file:font-black file:text-black"
      />

      {preview && (
        <button
          type="button"
          onClick={remove}
          className="mt-2 text-xs font-semibold text-amber-300"
        >
          Rimuovi
        </button>
      )}
    </div>
  );
}

function ColorInput({
  label,
  value,
  fallback,
  setValue,
}: {
  label: string;
  value: string;
  fallback: string;
  setValue: (value: string) => void;
}) {
  return (
    <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--card-2)] p-3">
      <span className="text-xs font-bold text-[var(--muted)]">{label}</span>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={/^#[0-9A-F]{6}$/.test(value) ? value : fallback}
          onChange={(event) => setValue(event.target.value.toUpperCase())}
          className="h-11 w-14 cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--card)] p-1"
          aria-label={label}
        />
        <Input
          value={value}
          onChange={(event) => {
            const next = event.target.value.toUpperCase();
            if (/^#[0-9A-F]{0,6}$/.test(next)) setValue(next);
          }}
          placeholder={fallback}
          className="min-w-0 flex-1 font-mono"
        />
      </div>
    </div>
  );
}

export function AddPlayerPanel({
  visible,
  allowPhoto,
  firstName,
  setFirstName,
  lastName,
  setLastName,
  number,
  setNumber,
  position,
  setPosition,
  photoUrl,
  setPhotoUrl,
  addPlayer,
  close,
}: {
  visible: boolean;
  allowPhoto: boolean;
  firstName: string;
  setFirstName: (value: string) => void;
  lastName: string;
  setLastName: (value: string) => void;
  number: string;
  setNumber: (value: string) => void;
  position: string;
  setPosition: (value: string) => void;
  photoUrl: string;
  setPhotoUrl: (value: string) => void;
  addPlayer: () => void | Promise<void>;
  close: () => void;
}) {
  if (!visible) return null;

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-lg font-black tracking-[-0.04em] text-[var(--foreground)]">Nuovo giocatore</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Aggiungi un giocatore alla rosa.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input aria-label="Nome" value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="Nome" />
        <Input aria-label="Cognome" value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="Cognome" />
        <Input
          aria-label="Numero maglia"
          value={number}
          onChange={(event) => setNumber(event.target.value.replace(/[^\d]/g, ""))}
          placeholder="Numero"
          inputMode="numeric"
        />
        <Select aria-label="Ruolo" value={position} onChange={(event) => setPosition(event.target.value)}>
          <option value="" className="text-black">Ruolo</option>
          {POSITIONS.map((item) => (
            <option key={item} value={item} className="text-black">{item}</option>
          ))}
        </Select>
      </div>

      {allowPhoto ? (
        <Input aria-label="URL foto giocatore" value={photoUrl} onChange={(event) => setPhotoUrl(event.target.value)} placeholder="URL foto opzionale" />
      ) : (
        <p className="rounded-xl border border-[var(--border)] bg-white/[0.03] px-3 py-2 text-xs text-[var(--muted)]">La foto profilo verrà inserita dall&apos;admin.</p>
      )}

      <div className="flex gap-2">
        <Button onClick={addPlayer}>Aggiungi</Button>
        <Button variant="secondary" onClick={close}>Annulla</Button>
      </div>
    </Card>
  );
}
