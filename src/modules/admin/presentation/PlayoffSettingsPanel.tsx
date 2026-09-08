"use client";

import { useState } from "react";
import { Check, Layers3, Swords, Trophy, X, type LucideIcon } from "lucide-react";
import Badge from "src/app/_components/ui/badge";
import Button from "src/app/_components/ui/button";
import Card from "src/app/_components/ui/card";
import { authFetch } from "@/lib/client-auth";
import type { LeagueSettings } from "./admin-types";

type PlayoffFormatChoice = "NONE" | "SINGLE_ELIM" | "TWO_LEG";

export default function PlayoffSettingsPanel({
  leagueId,
  value,
  onChange,
}: {
  leagueId: string;
  value: LeagueSettings;
  onChange: (next: LeagueSettings) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected: PlayoffFormatChoice = value.playoffFormat ?? "NONE";
  const enabled = selected !== "NONE";

  function chooseFormat(format: PlayoffFormatChoice) {
    onChange({
      ...value,
      playoffFormat: format === "NONE" ? null : format,
      playoffTeamCount: value.playoffTeamCount ?? 8,
      playoffSeeded: value.playoffSeeded !== false,
    });
    setMessage(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await authFetch(`/api/leagues/${leagueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playoffEnabled: Boolean(value.playoffFormat),
          playoffFormat: value.playoffFormat ?? "SINGLE_ELIM",
          playoffTeamCount: value.playoffTeamCount ?? 8,
          playoffSeeded: value.playoffSeeded !== false,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? "Errore salvataggio impostazioni");
      onChange(data);
      setMessage("Impostazioni playoff aggiornate");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Errore salvataggio impostazioni");
    } finally {
      setSaving(false);
    }
  }

  const formatLabel = selected === "SINGLE_ELIM" ? "eliminazione diretta" : selected === "TWO_LEG" ? "andata e ritorno" : "nessuna fase finale";

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <Trophy size={20} />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)]">Fase finale</p>
            <h2 className="mt-1 text-xl font-black tracking-[-0.04em] text-[var(--foreground)]">Formato playoff</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
              Decidi se il torneo termina con la regular season oppure prosegue con un tabellone finale. Il tabellone vero e proprio si genera dalla pagina Playoff.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <FormatChoice
            active={selected === "NONE"}
            icon={X}
            title="Nessun playoff"
            description="La classifica finale chiude il torneo."
            onClick={() => chooseFormat("NONE")}
          />
          <FormatChoice
            active={selected === "SINGLE_ELIM"}
            icon={Swords}
            title="Eliminazione diretta"
            description="Una partita per turno fino alla finale."
            onClick={() => chooseFormat("SINGLE_ELIM")}
          />
          <FormatChoice
            active={selected === "TWO_LEG"}
            icon={Layers3}
            title="Andata e ritorno"
            description="Doppio confronto con risultato aggregato."
            onClick={() => chooseFormat("TWO_LEG")}
          />
        </div>
      </Card>

      {enabled && (
        <Card>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,.7fr)] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)]">Accesso al tabellone</p>
              <h3 className="mt-1 text-lg font-black text-[var(--foreground)]">Squadre qualificate e seeding</h3>
              <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
                Scegli quante squadre avanzano e se gli accoppiamenti devono rispettare la posizione ottenuta nella regular season.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="rounded-2xl border border-[var(--border)] bg-[var(--card-2)] p-4">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">Qualificate</span>
                  <select
                    value={value.playoffTeamCount ?? 8}
                    onChange={(event) => onChange({ ...value, playoffTeamCount: Number(event.target.value) })}
                    className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-black/15 px-3 text-sm font-black text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
                  >
                    {[2, 4, 8, 16].map((count) => (
                      <option key={count} value={count} className="text-black">Top {count}</option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  onClick={() => onChange({ ...value, playoffSeeded: value.playoffSeeded === false })}
                  className={[
                    "rounded-2xl border p-4 text-left transition",
                    value.playoffSeeded !== false
                      ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                      : "border-[var(--border)] bg-[var(--card-2)]",
                  ].join(" ")}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span>
                      <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">Seeding</span>
                      <span className="mt-1 block text-sm font-black text-[var(--foreground)]">
                        {value.playoffSeeded !== false ? "Attivo" : "Disattivato"}
                      </span>
                    </span>
                    <span className={[
                      "grid h-8 w-8 place-items-center rounded-full",
                      value.playoffSeeded !== false ? "bg-[var(--accent)] text-[var(--imperial-text)]" : "bg-black/15 text-[var(--muted)]",
                    ].join(" ")}>
                      {value.playoffSeeded !== false && <Check size={15} />}
                    </span>
                  </span>
                </button>
              </div>
            </div>

            <Card variant="inner">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">Anteprima configurazione</p>
              <p className="mt-3 text-lg font-black text-[var(--foreground)]">
                Top {value.playoffTeamCount ?? 8}
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">{formatLabel}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {value.playoffSeeded !== false ? "Seeding dalla classifica attivo" : "Accoppiamenti senza seeding"}
              </p>
            </Card>
          </div>
        </Card>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {error && <Badge variant="error">{error}</Badge>}
          {message && <Badge variant="success">{message}</Badge>}
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? "Salvataggio…" : "Salva configurazione"}
        </Button>
      </div>
    </div>
  );
}

function FormatChoice({
  active,
  icon: Icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-2xl border p-4 text-left transition",
        active
          ? "border-[var(--accent)] bg-[var(--accent-soft)]"
          : "border-[var(--border)] bg-[var(--card-2)] hover:border-[var(--accent)]/50",
      ].join(" ")}
    >
      <span className={[
        "grid h-10 w-10 place-items-center rounded-xl",
        active ? "bg-[var(--accent)]/15 text-[var(--accent)]" : "bg-black/10 text-[var(--muted)]",
      ].join(" ")}>
        <Icon size={18} />
      </span>
      <span className="mt-3 block text-sm font-black text-[var(--foreground)]">{title}</span>
      <span className="mt-1 block text-xs leading-relaxed text-[var(--muted)]">{description}</span>
    </button>
  );
}
