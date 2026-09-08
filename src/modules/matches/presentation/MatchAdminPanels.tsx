"use client";

import Card from "src/app/_components/ui/card";
import Button from "src/app/_components/ui/button";
import type { AdminRefereeState } from "./MatchResultParts";

export function RefereeAssignmentPanel({
  isAdmin,
  selectedRefereeName,
  matchDate,
  refereeId,
  refereeChoice,
  setRefereeChoice,
  loadingReferees,
  savingReferee,
  saveRefereeChoice,
  adminRefereeState,
  refereeMsg,
  refereeErr,
}: {
  isAdmin: boolean;
  selectedRefereeName: string;
  matchDate: string | null;
  refereeId: string | null;
  refereeChoice: string;
  setRefereeChoice: (value: string) => void;
  loadingReferees: boolean;
  savingReferee: boolean;
  saveRefereeChoice: () => void | Promise<void>;
  adminRefereeState: AdminRefereeState | null;
  refereeMsg: string | null;
  refereeErr: string | null;
}) {
  const selectedManualReferee = refereeChoice.startsWith("manual:")
    ? adminRefereeState?.referees.find((referee) => `manual:${referee.id}` === refereeChoice) ?? null
    : null;

  return (
    <Card>
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent)]">Arbitro</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Direzione di gara: <b className="text-[var(--foreground)]">{selectedRefereeName}</b>
          </p>
        </div>

        {isAdmin ? (
          <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card-2)] p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-end">
              <label className="min-w-0 flex-1">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">Modalità assegnazione</span>
                <select
                  value={refereeChoice}
                  onChange={(event) => setRefereeChoice(event.target.value)}
                  disabled={loadingReferees || savingReferee}
                  className="h-11 w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm font-bold text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
                >
                  <option value="automatic">Automatico · scegli tra gli arbitri compatibili</option>
                  <option value="manual:none">Manuale · nessun arbitro</option>
                  {(adminRefereeState?.referees ?? []).map((referee) => (
                    <option key={referee.id} value={`manual:${referee.id}`}>
                      Manuale · {referee.name}{!referee.active ? " · disattivato" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <Button onClick={saveRefereeChoice} disabled={loadingReferees || savingReferee} size="sm">
                {savingReferee ? "…" : "Salva arbitro"}
              </Button>
            </div>

            {refereeChoice === "automatic" ? (
              <p className="text-xs text-[var(--muted)]">
                Il sistema esclude chi gioca nelle squadre coinvolte, chi non è disponibile e chi ha sovrapposizioni.
              </p>
            ) : selectedManualReferee?.warnings?.length ? (
              <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-200">
                Override manuale: {selectedManualReferee.warnings.join(" · ")}. La scelta verrà comunque mantenuta finché non torni su Automatico.
              </div>
            ) : (
              <p className="text-xs text-[var(--muted)]">
                L&apos;override manuale resta bloccato anche se cambiano slot o disponibilità.
              </p>
            )}

            {refereeMsg && <p className="text-xs font-semibold text-emerald-400">{refereeMsg}</p>}
            {refereeErr && <p className="text-xs font-semibold text-red-300">{refereeErr}</p>}
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card-2)] px-4 py-3 text-sm text-[var(--muted)]">
            {matchDate
              ? refereeId
                ? "Arbitro assegnato."
                : "Al momento non risulta un arbitro assegnato."
              : "L'arbitro verrà assegnato quando sarà definito lo slot della partita."}
          </div>
        )}
      </div>
    </Card>
  );
}

export function MatchDateOverridePanel({
  isAdmin,
  dateValue,
  setDateValue,
  saveDate,
  savingDate,
  dateMsg,
  dateErr,
}: {
  isAdmin: boolean;
  dateValue: string;
  setDateValue: (value: string) => void;
  saveDate: (clear?: boolean) => void | Promise<void>;
  savingDate: boolean;
  dateMsg: string | null;
  dateErr: string | null;
}) {
  if (!isAdmin) return null;

  return (
    <Card>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent)]">Data e ora</p>
          <p className="mt-1 text-sm text-[var(--muted)]">Override amministrativo: imposta una data libera fuori dagli slot standard.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="datetime-local"
            value={dateValue}
            onChange={(event) => setDateValue(event.target.value)}
            className="h-11 min-w-[220px] flex-1 rounded-2xl border border-[var(--border)] bg-[var(--card-2)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
          />
          <Button onClick={() => saveDate(false)} disabled={savingDate || !dateValue} size="sm">
            {savingDate ? "…" : "Salva data"}
          </Button>
          {dateValue && (
            <Button variant="secondary" onClick={() => saveDate(true)} disabled={savingDate} size="sm">
              Rimuovi
            </Button>
          )}
        </div>
      </div>
      {dateMsg && <p className="mt-2 text-xs font-semibold text-emerald-400">{dateMsg}</p>}
      {dateErr && <p className="mt-2 text-xs font-semibold text-red-300">{dateErr}</p>}
    </Card>
  );
}
