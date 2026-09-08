"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import DashboardShell from "src/app/_components/dashboard-shell";
import Card from "src/app/_components/ui/card";
import Badge from "src/app/_components/ui/badge";
import Button from "src/app/_components/ui/button";
import { authFetch } from "@/lib/client-auth";


function AdminModuleFallback({ title = "Modulo admin" }: { title?: string }) {
  return (
    <Card variant="inner">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--accent)]">{title}</p>
      <div className="mt-4 h-8 w-2/3 animate-pulse rounded-full bg-white/10" />
      <div className="mt-3 h-4 w-full animate-pulse rounded-full bg-white/10" />
      <div className="mt-2 h-4 w-5/6 animate-pulse rounded-full bg-white/10" />
    </Card>
  );
}

const BrandingManager = dynamic(() => import("@/modules/branding/presentation/BrandingManager"), {
  ssr: false,
  loading: () => <AdminModuleFallback title="Branding" />,
});
const FieldManager = dynamic(() => import("@/modules/fields/presentation/FieldManager"), {
  ssr: false,
  loading: () => <AdminModuleFallback title="Campi" />,
});
const RefereeManager = dynamic(() => import("@/modules/referees/presentation/RefereeManager"), {
  ssr: false,
  loading: () => <AdminModuleFallback title="Arbitri" />,
});
const SponsorManager = dynamic(() => import("@/modules/sponsors/presentation/SponsorManager"), {
  ssr: false,
  loading: () => <AdminModuleFallback title="Sponsor" />,
});
const CreatorManager = dynamic(() => import("@/modules/media/presentation/CreatorManager"), {
  ssr: false,
  loading: () => <AdminModuleFallback title="Creator" />,
});

const AuditLogPanel = dynamic(() => import("@/modules/audit/presentation/AuditLogPanel"), {
  ssr: false,
  loading: () => <AdminModuleFallback title="Audit log" />,
});

type LeagueSettings = {
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
  playoffFormat?: "SINGLE_ELIM" | "TWO_LEG" | null;
  playoffTeamCount?: number | null;
  playoffSeeded?: boolean;
};

type Summary = {
  league: { id: string; name: string };
  totals: {
    teams: number;
    players: number;
    authorized: number;
    blocked: number;
    wildcards: number;
    sheetAppearances: number;
    playerFeesCents: number;
    matches: number;
    playedMatches: number;
    refereeFeesCents: number;
  };
  byTeam: Array<{
    teamId: string;
    teamName: string;
    players: number;
    authorized: number;
    blocked: number;
    wildcards: number;
  }>;
};

function formatEuro(cents: number) {
  return (cents / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

export default function LeagueAdminPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<LeagueSettings | null>(null);
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (!leagueId) return;

    async function load() {
      setLoading(true);
      setErr(null);

      try {
        const [summaryRes, leagueRes] = await Promise.all([
          authFetch(`/api/leagues/${leagueId}/admin/summary`, { cache: "no-store" }),
          fetch(`/api/leagues/${leagueId}`, { cache: "no-store" }),
        ]);
        const data = await summaryRes.json().catch(() => ({}));
        const leagueData = await leagueRes.json().catch(() => ({}));
        if (!summaryRes.ok) throw new Error(data?.error ?? "Errore caricamento admin");
        if (!leagueRes.ok) throw new Error(leagueData?.error ?? "Errore caricamento impostazioni");
        setSummary(data);
        setSettings(leagueData);
      } catch (error: any) {
        setErr(error.message ?? "Errore");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [leagueId]);

  async function savePlayoffSettings(next: LeagueSettings) {
    if (!leagueId) return;
    setErr(null);
    setSettingsMsg(null);
    setSavingSettings(true);

    try {
      const res = await authFetch(`/api/leagues/${leagueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playoffEnabled: Boolean(next.playoffFormat),
          playoffFormat: next.playoffFormat ?? "SINGLE_ELIM",
          playoffTeamCount: next.playoffTeamCount ?? 8,
          playoffSeeded: next.playoffSeeded !== false,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Errore salvataggio impostazioni");
      setSettings(data);
      setSettingsMsg("Impostazioni playoff aggiornate");
    } catch (error: any) {
      setErr(error.message ?? "Errore");
    } finally {
      setSavingSettings(false);
    }
  }

  return (
    <DashboardShell leagueId={leagueId}>
      <div className="w-full space-y-5 pb-8">
        <header className="pt-2">
          <h1 className="text-[31px] font-black tracking-[-0.06em] text-[var(--foreground)]">Admin torneo</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Documenti, autorizzazioni, quote e costi arbitro.</p>
        </header>

        {err && <Badge variant="error">{err}</Badge>}
        {loading && <p className="text-sm text-[var(--muted)]">Caricamento…</p>}
        {settingsMsg && <Badge variant="success">{settingsMsg}</Badge>}

        {settings && (
          <BrandingManager leagueId={leagueId} value={settings} onChange={setSettings} />
        )}

        {settings && (
          <Card>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)]">Impostazioni torneo</p>
                <h2 className="mt-1 text-xl font-black tracking-[-0.04em] text-[var(--foreground)]">Playoff</h2>
                <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
                  La sezione Playoff compare nella navigazione solo se il torneo prevede una fase finale. Il tabellone si genera nella pagina Playoff quando sei pronto.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[520px] lg:grid-cols-[1fr_110px_1fr]">
                <select
                  value={settings.playoffFormat ?? "NONE"}
                  onChange={(e) => {
                    const value = e.target.value as "NONE" | "SINGLE_ELIM" | "TWO_LEG";
                    const next = {
                      ...settings,
                      playoffFormat: value === "NONE" ? null : value,
                      playoffTeamCount: settings.playoffTeamCount ?? 8,
                      playoffSeeded: settings.playoffSeeded !== false,
                    };
                    setSettings(next);
                  }}
                  className="h-11 rounded-xl border border-[var(--border)] bg-[var(--card-2)] px-3 text-sm text-[var(--foreground)] outline-none"
                >
                  <option value="NONE" className="text-black">Nessun playoff</option>
                  <option value="SINGLE_ELIM" className="text-black">Eliminazione diretta</option>
                  <option value="TWO_LEG" className="text-black">Andata e ritorno</option>
                </select>

                <select
                  value={settings.playoffTeamCount ?? 8}
                  onChange={(e) => setSettings({ ...settings, playoffTeamCount: Number(e.target.value) })}
                  disabled={!settings.playoffFormat}
                  className="h-11 rounded-xl border border-[var(--border)] bg-[var(--card-2)] px-3 text-sm text-[var(--foreground)] outline-none disabled:opacity-50"
                >
                  {[2, 4, 8, 16].map((n) => (
                    <option key={n} value={n} className="text-black">Top {n}</option>
                  ))}
                </select>

                <div className="flex gap-2">
                  <label className="flex flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card-2)] px-3 text-sm font-semibold text-[var(--foreground)]">
                    <input
                      type="checkbox"
                      checked={settings.playoffSeeded !== false}
                      disabled={!settings.playoffFormat}
                      onChange={(e) => setSettings({ ...settings, playoffSeeded: e.target.checked })}
                    />
                    Seeding
                  </label>
                  <Button onClick={() => savePlayoffSettings(settings)} disabled={savingSettings} size="sm">
                    {savingSettings ? "..." : "Salva"}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}

        <div className="grid gap-5 xl:grid-cols-2">
          <FieldManager leagueId={leagueId} />
          <RefereeManager leagueId={leagueId} />
        </div>

        <SponsorManager leagueId={leagueId} />

        <CreatorManager leagueId={leagueId} />

        <AuditLogPanel leagueId={leagueId} />

        {summary && (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Stat label="Giocatori" value={`${summary.totals.authorized}/${summary.totals.players}`} note="autorizzati/totali" />
              <Stat label="Da sistemare" value={summary.totals.blocked} note="documenti o stato mancanti" />
              <Stat label="Quote giocatori" value={formatEuro(summary.totals.playerFeesCents)} note={`${summary.totals.sheetAppearances} presenze in distinta`} />
              <Stat label="Arbitri" value={formatEuro(summary.totals.refereeFeesCents)} note={`${summary.totals.playedMatches} partite concluse`} />
            </div>

            <Card className="overflow-hidden !p-0">
              <div className="grid grid-cols-[1fr_70px_90px_90px_80px] border-b border-[var(--border)] px-4 py-3 text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                <span>Squadra</span>
                <span className="text-right">Rosa</span>
                <span className="text-right">OK</span>
                <span className="text-right">Bloccati</span>
                <span className="text-right">Wildcard</span>
              </div>
              {summary.byTeam.map((team) => (
                <Link
                  key={team.teamId}
                  href={`/leagues/${leagueId}/teams/${team.teamId}`}
                  className="grid grid-cols-[1fr_70px_90px_90px_80px] border-b border-[var(--border)] px-4 py-3 text-sm last:border-b-0 hover:bg-white/[0.04]"
                >
                  <span className="font-semibold text-[var(--foreground)]">{team.teamName}</span>
                  <span className="text-right text-[var(--muted)]">{team.players}</span>
                  <span className="text-right text-emerald-700">{team.authorized}</span>
                  <span className="text-right text-red-600">{team.blocked}</span>
                  <span className="text-right text-[var(--muted)]">{team.wildcards}</span>
                </Link>
              ))}
            </Card>
          </>
        )}
      </div>
    </DashboardShell>
  );
}

function Stat({ label, value, note }: { label: string; value: string | number; note: string }) {
  return (
    <Card variant="inner">
      <p className="text-xs font-medium uppercase tracking-widest text-[var(--foreground)]/50">{label}</p>
      <p className="mt-3 text-2xl font-black text-[var(--foreground)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{note}</p>
    </Card>
  );
}
