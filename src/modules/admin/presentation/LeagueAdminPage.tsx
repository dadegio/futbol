"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { Settings2 } from "lucide-react";
import DashboardShell from "src/app/_components/dashboard-shell";
import Badge from "src/app/_components/ui/badge";
import Card from "src/app/_components/ui/card";
import { authFetch, useAuth } from "@/lib/client-auth";
import AdminOverview from "./AdminOverview";
import AdminFinancePanel from "./AdminFinancePanel";
import AdminQuickSearch from "./AdminQuickSearch";
import AdminSectionNav, { ADMIN_SECTIONS, getAdminSection } from "./AdminSectionNav";
import PlayoffSettingsPanel from "./PlayoffSettingsPanel";
import type { AdminSection, AdminSummary, LeagueSettings } from "./admin-types";

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

const AdminOperationsPanel = dynamic(() => import("./AdminOperationsPanel"), {
  ssr: false,
  loading: () => <AdminModuleFallback title="Centro operativo partite" />,
});

const BrandingManager = dynamic(() => import("@/modules/branding/presentation/BrandingManager"), {
  ssr: false,
  loading: () => <AdminModuleFallback title="Identità torneo" />,
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
  loading: () => <AdminModuleFallback title="Media e creator" />,
});
const AuditLogPanel = dynamic(() => import("@/modules/audit/presentation/AuditLogPanel"), {
  ssr: false,
  loading: () => <AdminModuleFallback title="Registro attività" />,
});

function isAdminSection(value: string): value is AdminSection {
  return ADMIN_SECTIONS.some((section) => section.id === value);
}

export default function LeagueAdminPage() {
  const { user } = useAuth();
  const { leagueId } = useParams<{ leagueId: string }>();
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [settings, setSettings] = useState<LeagueSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<AdminSection>("overview");

  useEffect(() => {
    const fromHash = window.location.hash.replace(/^#/, "");
    if (isAdminSection(fromHash)) setActiveSection(fromHash);

    const onHashChange = () => {
      const next = window.location.hash.replace(/^#/, "");
      if (isAdminSection(next)) setActiveSection(next);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if (!leagueId) return;

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [summaryResponse, leagueResponse] = await Promise.all([
          authFetch(`/api/leagues/${leagueId}/admin/summary`, { cache: "no-store" }),
          fetch(`/api/leagues/${leagueId}`, { cache: "no-store" }),
        ]);
        const summaryData = await summaryResponse.json().catch(() => ({}));
        const leagueData = await leagueResponse.json().catch(() => ({}));
        if (!summaryResponse.ok) throw new Error(summaryData?.error ?? "Errore caricamento admin");
        if (!leagueResponse.ok) throw new Error(leagueData?.error ?? "Errore caricamento impostazioni");
        if (!cancelled) {
          setSummary(summaryData);
          setSettings(leagueData);
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Errore caricamento admin");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [leagueId]);

  const currentSection = useMemo(() => getAdminSection(activeSection), [activeSection]);

  function selectSection(section: AdminSection) {
    setActiveSection(section);
    if (typeof window !== "undefined") {
      const nextHash = `#${section}`;
      if (window.location.hash !== nextHash) {
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${nextHash}`);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function renderSection() {
    if (!leagueId) return null;

    if (activeSection === "overview") {
      if (!summary) return <AdminModuleFallback title="Panoramica" />;
      return <AdminOverview leagueId={leagueId} summary={summary} onNavigate={selectSection} />;
    }

    if (activeSection === "operations") return <AdminOperationsPanel leagueId={leagueId} />;

    if (activeSection === "finance") {
      if (!summary) return <AdminModuleFallback title="Economia" />;
      return <AdminFinancePanel summary={summary} />;
    }

    if (activeSection === "branding") {
      if (!settings) return <AdminModuleFallback title="Identità torneo" />;
      return <BrandingManager leagueId={leagueId} value={settings} onChange={setSettings} view="identity" />;
    }

    if (activeSection === "privacy") {
      if (!settings) return <AdminModuleFallback title="Privacy e annunci" />;
      return <BrandingManager leagueId={leagueId} value={settings} onChange={setSettings} view="privacy" />;
    }

    if (activeSection === "competition") {
      if (!settings) return <AdminModuleFallback title="Competizione" />;
      return <PlayoffSettingsPanel leagueId={leagueId} value={settings} onChange={setSettings} />;
    }

    if (activeSection === "fields") return <FieldManager leagueId={leagueId} />;
    if (activeSection === "referees") return <RefereeManager leagueId={leagueId} />;
    if (activeSection === "sponsors") return <SponsorManager leagueId={leagueId} />;
    if (activeSection === "media") return <CreatorManager leagueId={leagueId} />;
    if (activeSection === "audit") return <AuditLogPanel leagueId={leagueId} />;
    return null;
  }

  return (
    <DashboardShell leagueId={leagueId}>
      <div className="w-full space-y-5 pb-8">
        <header className="pt-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[var(--accent)]">
                <Settings2 size={15} />
                Impostazioni torneo
              </div>
              <h1 className="mt-2 text-[31px] font-black tracking-[-0.06em] text-[var(--foreground)] sm:text-[36px]">
                Impostazioni
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
                Ogni area è separata e immediata: niente menu annidati, apri solo la configurazione che ti serve.
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
              <AdminQuickSearch leagueId={leagueId} />
              {summary?.league.name && (
                <div className="hidden rounded-2xl border border-[var(--border)] bg-[var(--card-2)] px-4 py-2 text-right sm:block">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Torneo</p>
                  <p className="mt-0.5 max-w-[260px] truncate text-sm font-black text-[var(--foreground)]">{summary.league.name}</p>
                </div>
              )}
            </div>
          </div>
        </header>

        {error && <Badge variant="error">{error}</Badge>}
        {loading && !summary && !settings && <p className="text-sm text-[var(--muted)]">Caricamento centro di controllo…</p>}

        <div className="xl:grid xl:grid-cols-[250px_minmax(0,1fr)] xl:items-start xl:gap-5">
          <AdminSectionNav
            active={activeSection}
            onSelect={selectSection}
            summary={summary}
            isSuperAdmin={user?.role === "ADMIN"}
          />

          <div className="min-w-0 space-y-4">
            <div className="hidden items-center justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--card-2)] px-4 py-3 xl:flex">
              <div>
                <p className="text-sm font-black text-[var(--foreground)]">{currentSection.label}</p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">{currentSection.description}</p>
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--foreground)]/35">
                Impostazioni admin
              </span>
            </div>
            {renderSection()}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
