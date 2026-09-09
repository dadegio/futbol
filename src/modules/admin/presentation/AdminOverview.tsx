"use client";

import Link from "next/link";
import {
  AlertTriangle,
  WalletCards,
  CalendarCheck2,
  ChevronRight,
  CheckCircle2,
  MapPin,
  Palette,
  ShieldCheck,
  Store,
  Trophy,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import Card from "src/app/_components/ui/card";
import type { AdminSection, AdminSummary } from "./admin-types";

function formatEuro(cents: number) {
  return (cents / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

function clampPercentage(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export default function AdminOverview({
  leagueId,
  summary,
  onNavigate,
}: {
  leagueId: string;
  summary: AdminSummary;
  onNavigate: (section: AdminSection) => void;
}) {
  const { totals } = summary;
  const registrationProgress = totals.players > 0 ? clampPercentage((totals.authorized / totals.players) * 100) : 100;
  const seasonProgress = totals.matches > 0 ? clampPercentage((totals.playedMatches / totals.matches) * 100) : 0;
  const teamsWithIssues = summary.byTeam.filter((team) => team.blocked > 0);

  return (
    <div className="space-y-5">
      {totals.blocked > 0 ? (
        <Card className="border-amber-500/25 bg-amber-500/[0.06]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-500/15 text-amber-500">
                <AlertTriangle size={20} />
              </span>
              <div>
                <p className="font-black text-[var(--foreground)]">
                  {totals.blocked} giocator{totals.blocked === 1 ? "e richiede" : "i richiedono"} attenzione
                </p>
                <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
                  Mancano autorizzazioni, documenti o requisiti per essere inseriti in distinta.
                </p>
              </div>
            </div>
            <Link
              href={`/leagues/${leagueId}/teams`}
              className="inline-flex shrink-0 items-center gap-1.5 text-sm font-black text-amber-500 hover:underline"
            >
              Apri le squadre <ChevronRight size={15} />
            </Link>
          </div>
        </Card>
      ) : (
        <Card className="border-emerald-500/20 bg-emerald-500/[0.05]">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500/12 text-emerald-500">
              <CheckCircle2 size={20} />
            </span>
            <div>
              <p className="font-black text-[var(--foreground)]">Rose amministrativamente in ordine</p>
              <p className="mt-1 text-sm text-[var(--muted)]">Tutti i giocatori censiti risultano utilizzabili in distinta.</p>
            </div>
          </div>
        </Card>
      )}

      {totals.operationalAttention > 0 && (
        <button
          type="button"
          onClick={() => onNavigate("operations")}
          className="flex w-full items-center gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.05] p-4 text-left transition hover:border-amber-400/60"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-500/15 text-amber-400"><CalendarCheck2 size={20} /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-black text-[var(--foreground)]">{totals.operationalAttention} partit{totals.operationalAttention === 1 ? "a richiede" : "e richiedono"} attenzione</span>
            <span className="mt-1 block text-sm text-[var(--muted)]">Slot, campo, arbitro o risultato da completare.</span>
          </span>
          <ChevronRight size={17} className="shrink-0 text-amber-400" />
        </button>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <OverviewStat
          icon={UsersRound}
          label="Giocatori autorizzati"
          value={`${totals.authorized}/${totals.players}`}
          note={`${registrationProgress}% delle rose`}
          progress={registrationProgress}
        />
        <OverviewStat
          icon={Trophy}
          label="Campionato"
          value={`${totals.playedMatches}/${totals.matches}`}
          note={`${seasonProgress}% delle partite concluse`}
          progress={seasonProgress}
        />
        <OverviewStat
          icon={WalletCards}
          label="Quote presenze"
          value={formatEuro(totals.playerFeesCents)}
          note={`${totals.sheetAppearances} presenze in distinta`}
        />
        <OverviewStat
          icon={CalendarCheck2}
          label="Partite da sistemare"
          value={totals.operationalAttention}
          note={totals.operationalAttention > 0 ? "richiedono attenzione operativa" : "nessuna criticità aperta"}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]">
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)]">Controllo rose</p>
              <h2 className="mt-1 text-xl font-black tracking-[-0.04em] text-[var(--foreground)]">Stato per squadra</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Le squadre con problemi amministrativi sono mostrate per prime.
              </p>
            </div>
            <Link href={`/leagues/${leagueId}/teams`} className="hidden text-xs font-black text-[var(--accent)] hover:underline sm:block">
              Tutte le squadre
            </Link>
          </div>

          <div className="mt-4 space-y-2">
            {[...summary.byTeam]
              .sort((a, b) => b.blocked - a.blocked || a.teamName.localeCompare(b.teamName, "it"))
              .map((team) => (
                <Link
                  key={team.teamId}
                  href={`/leagues/${leagueId}/teams/${team.teamId}`}
                  className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card-2)] px-3 py-3 transition hover:border-[var(--accent)]"
                >
                  <span
                    className={[
                      "grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-black",
                      team.blocked > 0
                        ? "bg-amber-500/12 text-amber-500"
                        : "bg-emerald-500/10 text-emerald-500",
                    ].join(" ")}
                  >
                    {team.blocked > 0 ? team.blocked : <CheckCircle2 size={16} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black text-[var(--foreground)]">{team.teamName}</span>
                    <span className="mt-0.5 block text-xs text-[var(--muted)]">
                      {team.authorized}/{team.players} autorizzati
                      {team.wildcards > 0 ? ` · ${team.wildcards} wildcard` : ""}
                    </span>
                  </span>
                  <span className={team.blocked > 0 ? "text-xs font-black text-amber-500" : "text-xs font-black text-emerald-500"}>
                    {team.blocked > 0 ? "Da verificare" : "OK"}
                  </span>
                </Link>
              ))}
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)]">Azioni rapide</p>
            <div className="mt-3 space-y-2">
              <QuickAction icon={CalendarCheck2} label="Apri centro partite" detail="Criticità, slot e risultati" onClick={() => onNavigate("operations")} />
              <QuickAction icon={WalletCards} label="Apri economia" detail="Quote presenze ed export CSV" onClick={() => onNavigate("finance")} />
              <QuickAction icon={Palette} label="Aggiorna identità" detail="Logo, colori e privacy" onClick={() => onNavigate("branding")} />
              <QuickAction icon={MapPin} label="Gestisci campi" detail="Impianti e slot" onClick={() => onNavigate("fields")} />
              <QuickAction icon={ShieldCheck} label="Gestisci arbitri" detail="Disponibilità e account" onClick={() => onNavigate("referees")} />
              <QuickAction icon={Store} label="Gestisci sponsor" detail="Partner e visibilità" onClick={() => onNavigate("sponsors")} />
            </div>
          </Card>

          <Card variant="inner">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)]">Quote presenze</p>
            <p className="mt-3 text-3xl font-black tracking-[-0.05em] text-[var(--foreground)]">{formatEuro(totals.playerFeesCents)}</p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
              Conteggio delle sole quote giocatore maturate dalle presenze in distinta. I costi arbitro restano fuori dal bilancio del torneo.
            </p>
          </Card>
        </div>
      </div>

      {teamsWithIssues.length > 0 && teamsWithIssues.length < summary.byTeam.length && (
        <p className="text-center text-xs text-[var(--muted)]">
          {teamsWithIssues.length} squadr{teamsWithIssues.length === 1 ? "a ha" : "e hanno"} almeno un giocatore da verificare.
        </p>
      )}
    </div>
  );
}

function OverviewStat({
  icon: Icon,
  label,
  value,
  note,
  progress,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  note: string;
  progress?: number;
}) {
  return (
    <Card variant="inner">
      <div className="flex items-center justify-between gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
          <Icon size={17} />
        </span>
        {progress !== undefined && <span className="text-xs font-black text-[var(--muted)]">{progress}%</span>}
      </div>
      <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-2xl font-black tracking-[-0.04em] text-[var(--foreground)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{note}</p>
      {progress !== undefined && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/15">
          <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${progress}%` }} />
        </div>
      )}
    </Card>
  );
}

function QuickAction({
  icon: Icon,
  label,
  detail,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card-2)] px-3 py-3 text-left transition hover:border-[var(--accent)]"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
        <Icon size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black text-[var(--foreground)]">{label}</span>
        <span className="mt-0.5 block text-xs text-[var(--muted)]">{detail}</span>
      </span>
      <ChevronRight size={16} className="text-[var(--muted)]" />
    </button>
  );
}
