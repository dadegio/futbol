"use client";

import Link from "next/link";
import {
  Activity,
  CalendarCheck2,
  Camera,
  Home,
  MapPin,
  Palette,
  Shield,
  ShieldCheck,
  Store,
  Trophy,
  UsersRound,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import Card from "src/app/_components/ui/card";
import type { AdminSection, AdminSummary } from "./admin-types";

type SectionDefinition = {
  id: AdminSection;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
  group: "Generali" | "Competizione" | "Organizzazione" | "Contenuti" | "Amministrazione";
};

export const ADMIN_SECTIONS: SectionDefinition[] = [
  {
    id: "overview",
    label: "Panoramica",
    shortLabel: "Home",
    description: "Stato del torneo, rose e quote",
    icon: Home,
    group: "Generali",
  },
  {
    id: "operations",
    label: "Partite",
    shortLabel: "Partite",
    description: "Criticità, slot, arbitri e risultati",
    icon: CalendarCheck2,
    group: "Organizzazione",
  },
  {
    id: "finance",
    label: "Economia",
    shortLabel: "Quote",
    description: "Presenze e quote per squadra",
    icon: WalletCards,
    group: "Amministrazione",
  },
  {
    id: "branding",
    label: "Identità grafica",
    shortLabel: "Identità",
    description: "Nome, logo, copertina e colori",
    icon: Palette,
    group: "Generali",
  },
  {
    id: "privacy",
    label: "Privacy e annunci",
    shortLabel: "Privacy",
    description: "Cookie, policy e spazi pubblicitari",
    icon: Shield,
    group: "Amministrazione",
  },
  {
    id: "competition",
    label: "Competizione",
    shortLabel: "Playoff",
    description: "Formato e accesso alla fase finale",
    icon: Trophy,
    group: "Competizione",
  },
  {
    id: "fields",
    label: "Campi e slot",
    shortLabel: "Campi",
    description: "Impianti, giorni e orari disponibili",
    icon: MapPin,
    group: "Organizzazione",
  },
  {
    id: "referees",
    label: "Arbitri",
    shortLabel: "Arbitri",
    description: "Disponibilità, account e assegnazioni",
    icon: ShieldCheck,
    group: "Organizzazione",
  },
  {
    id: "sponsors",
    label: "Sponsor",
    shortLabel: "Sponsor",
    description: "Partner, contatti e visibilità",
    icon: Store,
    group: "Contenuti",
  },
  {
    id: "media",
    label: "Media e creator",
    shortLabel: "Media",
    description: "Creator e contenuti da approvare",
    icon: Camera,
    group: "Contenuti",
  },
  {
    id: "audit",
    label: "Registro attività",
    shortLabel: "Audit",
    description: "Modifiche e operazioni amministrative",
    icon: Activity,
    group: "Amministrazione",
  },
];

export function getAdminSection(section: AdminSection) {
  return ADMIN_SECTIONS.find((item) => item.id === section) ?? ADMIN_SECTIONS[0];
}

export default function AdminSectionNav({
  active,
  onSelect,
  summary,
  isSuperAdmin,
}: {
  active: AdminSection;
  onSelect: (section: AdminSection) => void;
  summary: AdminSummary | null;
  isSuperAdmin: boolean;
}) {
  const groups = ["Generali", "Competizione", "Organizzazione", "Contenuti", "Amministrazione"] as const;

  return (
    <>
      <div className="space-y-3 xl:hidden">
        {groups.map((group) => (
          <Card key={group} className="!p-3">
            <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--foreground)]/45">{group}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ADMIN_SECTIONS.filter((section) => section.group === group).map((section) => {
                const Icon = section.icon;
                const selected = active === section.id;
                return (
                  <button key={section.id} type="button" onClick={() => onSelect(section.id)} className={[
                    "flex min-h-20 flex-col items-start justify-between rounded-2xl border p-3 text-left transition",
                    selected ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)] bg-[var(--card-2)]",
                  ].join(" ")}>
                    <Icon size={17} className={selected ? "text-[var(--accent)]" : "text-[var(--muted)]"} />
                    <span>
                      <span className="block text-xs font-black text-[var(--foreground)]">{section.shortLabel}</span>
                      <span className="mt-0.5 line-clamp-2 block text-[10px] leading-snug text-[var(--muted)]">{section.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
        ))}
      </div>

      <Card className="hidden h-fit !p-3 xl:sticky xl:top-5 xl:block">
        <div className="px-2 pb-3 pt-1">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--accent)]">
            Centro di controllo
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
            Scegli un'area: viene caricata solo la sezione che stai usando.
          </p>
        </div>

        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group}>
              <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--foreground)]/35">
                {group}
              </p>
              <div className="space-y-1">
                {ADMIN_SECTIONS.filter((section) => section.group === group).map((section) => {
                  const Icon = section.icon;
                  const selected = active === section.id;
                  const warningCount =
                    section.id === "overview"
                      ? summary?.totals.blocked ?? 0
                      : section.id === "operations"
                        ? summary?.totals.operationalAttention ?? 0
                        : 0;
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => onSelect(section.id)}
                      className={[
                        "flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition",
                        selected
                          ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                          : "border-transparent hover:border-[var(--border)] hover:bg-[var(--card-2)]",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
                          selected
                            ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                            : "bg-[var(--card-2)] text-[var(--muted)]",
                        ].join(" ")}
                      >
                        <Icon size={17} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-sm font-black text-[var(--foreground)]">
                          {section.label}
                          {warningCount > 0 && (
                            <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-500">
                              {warningCount}
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-[var(--muted)]">
                          {section.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {isSuperAdmin && (
          <div className="mt-4 border-t border-[var(--border)] pt-3">
            <Link
              href="/admin/users"
              className="flex items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 transition hover:border-[var(--border)] hover:bg-[var(--card-2)]"
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--card-2)] text-[var(--muted)]">
                <UsersRound size={17} />
              </span>
              <span>
                <span className="block text-sm font-black text-[var(--foreground)]">Utenti e accessi</span>
                <span className="mt-0.5 block text-[11px] text-[var(--muted)]">Gestione account globale</span>
              </span>
            </Link>
          </div>
        )}
      </Card>
    </>
  );
}
