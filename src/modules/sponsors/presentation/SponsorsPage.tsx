"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ExternalLink, Instagram, Mail, MapPin, Phone, Settings, Store } from "lucide-react";
import DashboardShell from "src/app/_components/dashboard-shell";
import Card, { CardHeader } from "src/app/_components/ui/card";
import Badge from "src/app/_components/ui/badge";
import Button from "src/app/_components/ui/button";
import { authFetch, useCanAdminLeague } from "@/lib/client-auth";
import { cachedJson } from "@/modules/core/client-cache";

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

type League = { id: string; name: string };

function getApiText(data: unknown, fallback: string) {
  if (typeof data !== "object" || data === null) return fallback;
  const value = (data as Record<string, unknown>).error;
  return typeof value === "string" && value.trim() ? value : fallback;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function getHost(url: string) {
  try {
    return new URL(url, typeof window !== "undefined" ? window.location.origin : "https://example.com").hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/^www\./, "");
  }
}

export default function SponsorsPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const canAdmin = useCanAdminLeague(leagueId);
  const [league, setLeague] = useState<League | null>(null);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!leagueId) return;
    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const [leagueData, sponsorsRes] = await Promise.all([
          cachedJson<League>(`/api/leagues/${leagueId}`, { ttlMs: 30_000, fallbackMessage: "Errore caricamento torneo" }),
          authFetch(`/api/leagues/${leagueId}/sponsors`, { cache: "no-store" }),
        ]);
        const sponsorData = await sponsorsRes.json().catch(() => ({}));
        if (!sponsorsRes.ok) throw new Error(getApiText(sponsorData, "Errore caricamento sponsor"));
        setLeague(leagueData);
        setSponsors(Array.isArray(sponsorData) ? sponsorData : []);
      } catch (error) {
        setErr(getErrorMessage(error, "Errore caricamento sponsor"));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [leagueId]);

  const categories = useMemo(() => {
    const values = new Set(sponsors.map((s) => s.category).filter(Boolean) as string[]);
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [sponsors]);

  return (
    <DashboardShell leagueId={leagueId}>
      <div className="space-y-5 pb-8">
        <Card>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <CardHeader
              tag="Partner"
              title="Sponsor"
              description={league ? `Negozi, attività e partner che sostengono ${league.name}.` : "Negozi, attività e partner del torneo."}
            />
            {canAdmin && (
              <Link href={`/leagues/${leagueId}/admin`}>
                <Button type="button" variant="secondary" size="sm">
                  <Settings size={16} className="mr-1" /> Gestisci sponsor
                </Button>
              </Link>
            )}
          </div>
        </Card>

        {err && <Badge variant="error">{err}</Badge>}

        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--muted)]">
            {categories.map((category) => (
              <span key={category} className="rounded-full border border-[var(--border)] bg-[var(--card-2)] px-3 py-1.5">
                {category}
              </span>
            ))}
          </div>
        )}

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <SponsorSkeleton />
            <SponsorSkeleton />
            <SponsorSkeleton />
          </div>
        ) : sponsors.length === 0 ? (
          <Card className="py-12 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl border border-[var(--border)] bg-[var(--card-2)] text-[var(--muted)]">
              <Store size={28} />
            </div>
            <h2 className="mt-4 text-xl font-black text-[var(--foreground)]">Nessuno sponsor pubblicato</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">
              I partner ufficiali del torneo verranno pubblicati qui con link e contatti utili.
            </p>
            {canAdmin && <Link href={`/leagues/${leagueId}/admin`} className="mt-5 inline-block"><Button>Vai alle impostazioni</Button></Link>}
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sponsors.map((sponsor) => (
              <SponsorCard key={sponsor.id} sponsor={sponsor} />
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function SponsorCard({ sponsor }: { sponsor: Sponsor }) {
  return (
    <article className="group flex min-h-[310px] flex-col overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--card)] shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
      <div className="relative grid min-h-[132px] place-items-center border-b border-[var(--border)] bg-[radial-gradient(circle_at_20%_0%,var(--accent-soft),transparent_22rem),var(--card-2)] p-5">
        {sponsor.category && (
          <span className="absolute left-4 top-4 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[var(--accent)]">
            {sponsor.category}
          </span>
        )}
        {sponsor.logoUrl ? (
          <img src={sponsor.logoUrl} alt={`Logo ${sponsor.name}`} loading="lazy" decoding="async" className="max-h-20 max-w-[76%] object-contain" />
        ) : (
          <div className="grid h-20 w-20 place-items-center rounded-3xl border border-[var(--border)] bg-[var(--card)] text-2xl font-black text-[var(--accent)]">
            {sponsor.name.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h2 className="text-xl font-black tracking-[-0.04em] text-[var(--foreground)]">{sponsor.name}</h2>
        {sponsor.description && <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-[var(--muted)]">{sponsor.description}</p>}

        <div className="mt-4 space-y-2 text-sm text-[var(--muted)]">
          {sponsor.contactName && <p><span className="font-bold text-[var(--foreground)]">Referente:</span> {sponsor.contactName}</p>}
          {sponsor.address && <p className="flex gap-2"><MapPin size={16} className="mt-0.5 shrink-0 text-[var(--accent)]" /> <span>{sponsor.address}</span></p>}
        </div>

        <div className="mt-auto pt-5">
          <div className="grid gap-2">
            {sponsor.websiteUrl && (
              <a href={sponsor.websiteUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-4 text-sm font-black text-black transition hover:brightness-110">
                <ExternalLink size={16} /> Apri sito · {getHost(sponsor.websiteUrl)}
              </a>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              {sponsor.phone && (
                <a href={`tel:${sponsor.phone.replace(/\s+/g, "")}`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card-2)] px-3 text-xs font-black text-[var(--foreground)]">
                  <Phone size={15} /> Chiama
                </a>
              )}
              {sponsor.email && (
                <a href={`mailto:${sponsor.email}`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card-2)] px-3 text-xs font-black text-[var(--foreground)]">
                  <Mail size={15} /> Email
                </a>
              )}
              {sponsor.instagramUrl && (
                <a href={sponsor.instagramUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card-2)] px-3 text-xs font-black text-[var(--foreground)] sm:col-span-2">
                  <Instagram size={15} /> Instagram
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function SponsorSkeleton() {
  return (
    <div className="rounded-[28px] border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="animate-pulse space-y-4">
        <div className="h-24 rounded-3xl bg-white/10" />
        <div className="h-6 w-2/3 rounded bg-white/10" />
        <div className="h-4 rounded bg-white/10" />
        <div className="h-4 w-3/4 rounded bg-white/10" />
      </div>
    </div>
  );
}
