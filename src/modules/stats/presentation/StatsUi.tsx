import { BarChart3 } from "lucide-react";
import Link from "next/link";
import Card from "src/app/_components/ui/card";
import OptimizedPlayerImage from "src/app/_components/optimized-player-image";
import type { FormResult, PlayerStat, TeamStat } from "@/modules/stats/domain/league-stats";

export function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "min-h-10 border-b-2 px-3 py-2 text-sm font-semibold transition",
        active
          ? "border-[var(--accent)] text-[var(--foreground)]"
          : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

export function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="relative border-t border-[var(--border)] py-4">
      <div className="absolute right-0 top-4 text-[var(--accent)] opacity-70">{icon}</div>
      <div className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[var(--muted)]">{label}</div>
      <div className="scoreboard-figure mt-2 text-4xl font-semibold leading-none tabular-nums text-[var(--foreground)]">{value}</div>
    </div>
  );
}

export function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-4">
      <div className="text-[var(--accent)]">{icon}</div>
      <div>
        <div className="text-base font-black text-[var(--foreground)]">{title}</div>
        <div className="text-xs text-[var(--muted)]">{subtitle}</div>
      </div>
    </div>
  );
}

export function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <div className="text-base font-black text-[var(--foreground)]">{title}</div>
      <div className="mt-0.5 text-xs text-[var(--muted)]">{subtitle}</div>
    </div>
  );
}

export function LeaderCell({ label, player, value, suffix, leagueId }: { label: string; player: PlayerStat | null; value: number; suffix: string; leagueId: string }) {
  if (!player) return <div className="bg-[var(--card)] p-4 text-sm text-[var(--muted)]">Nessun dato</div>;
  return (
    <Link href={`/leagues/${leagueId}/players/${player.playerId}`} className="flex items-center gap-3 bg-[var(--card)] p-4 transition hover:bg-[var(--card-2)]">
      <PlayerAvatar player={player} />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-black uppercase tracking-[0.13em] text-[var(--muted)]">{label}</div>
        <div className="mt-1 truncate text-sm font-black text-[var(--foreground)]">{player.firstName} {player.lastName}</div>
        <div className="mt-0.5 truncate text-[11px] text-[var(--muted)]">{player.teamName}</div>
      </div>
      <div className="text-right">
        <div className="text-2xl font-black tabular-nums text-[var(--foreground)]">{value}</div>
        <div className="text-[10px] uppercase text-[var(--muted)]">{suffix}</div>
      </div>
    </Link>
  );
}

export function TeamBar({ team, value, max, label, leagueId }: { team: TeamStat; value: number; max: number; label: string; leagueId: string }) {
  const width = Math.max(6, Math.min(100, (value / Math.max(max, 1)) * 100));
  return (
    <Link href={`/leagues/${leagueId}/teams/${team.teamId}`} className="block">
      <div className="mb-1.5 flex items-center gap-2">
        <TeamLogo name={team.teamName} badgeUrl={team.badgeUrl} size="xs" />
        <div className="min-w-0 flex-1 truncate text-xs font-bold text-[var(--foreground)]">{team.teamName}</div>
        <div className="text-xs font-black tabular-nums text-[var(--muted)]">{label}</div>
      </div>
      <div className="h-1.5 overflow-hidden bg-[var(--card-2)]">
        <div className="h-full bg-[var(--accent)]" style={{ width: `${width}%` }} />
      </div>
    </Link>
  );
}

export function MiniRecord({ icon, label, title, detail }: { icon: React.ReactNode; label: string; title: string; detail: string }) {
  return (
    <Card variant="inner" className="!rounded-none !border-x-0 !border-b-0 !bg-transparent">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-[var(--accent)]">{icon}</div>
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--muted)]">{label}</div>
          <div className="mt-1 text-sm font-black leading-snug text-[var(--foreground)]">{title}</div>
          <div className="mt-1 text-xs text-[var(--muted)]">{detail}</div>
        </div>
      </div>
    </Card>
  );
}

export function RecordCard({ icon, eyebrow, title, value }: { icon: React.ReactNode; eyebrow: string; title: string; value: string }) {
  return (
    <Card className="h-full !rounded-none !border-x-0 !border-b-0 !bg-transparent">
      <div className="flex items-start justify-between gap-3">
        <div className="text-[var(--accent)]">{icon}</div>
        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--muted)]">{eyebrow}</div>
      </div>
      <div className="mt-6 text-xl font-black leading-tight tracking-[-0.04em] text-[var(--foreground)]">{title}</div>
      <div className="mt-2 text-sm font-semibold text-[var(--muted)]">{value}</div>
    </Card>
  );
}

export function SmallMetric({ label, value, muted = false }: { label: string; value: string | number; muted?: boolean }) {
  return (
    <div className="text-center">
      <div className={`text-base font-black tabular-nums ${muted ? "text-[var(--foreground)]" : "text-[var(--foreground)]"}`}>{value}</div>
      <div className="mt-0.5 text-[9px] font-black uppercase tracking-wide text-[var(--muted)]">{label}</div>
    </div>
  );
}

export function MetricNumber({ value, strong = false }: { value: number; strong?: boolean }) {
  return <div className={`text-center text-sm tabular-nums ${strong ? "font-black text-[var(--foreground)]" : "font-semibold text-[var(--muted)]"}`}>{value}</div>;
}

export function FormDots({ form }: { form: FormResult[] }) {
  if (form.length === 0) return <span className="text-[10px] text-[var(--muted)]">—</span>;
  return (
    <div className="flex items-center gap-1" aria-label={`Forma: ${form.join(" ")}`}>
      {form.map((result, index) => (
        <span
          key={`${result}-${index}`}
          className={[
            "flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-black text-white",
            result === "W" ? "bg-emerald-600" : result === "D" ? "bg-slate-500" : "bg-red-500",
          ].join(" ")}
        >
          {result === "W" ? "V" : result === "D" ? "N" : "P"}
        </span>
      ))}
    </div>
  );
}

export function TeamLogo({ name, badgeUrl, size = "sm" }: { name: string; badgeUrl: string | null; size?: "xs" | "sm" | "lg" }) {
  const classes = size === "xs" ? "h-5 w-5 rounded-[2px]" : size === "lg" ? "h-14 w-14 rounded-[6px]" : "h-9 w-9 rounded-[4px]";
  if (badgeUrl) return <img src={badgeUrl} alt={name} className={`${classes} shrink-0 object-contain`} />;
  return (
    <div className={`${classes} flex shrink-0 items-center justify-center bg-[var(--card-2)] text-[10px] font-black text-[var(--muted)]`}>
      {(name.match(/\b\w/g) || []).slice(0, 2).join("").toUpperCase() || "TM"}
    </div>
  );
}

export function PlayerAvatar({ player }: { player: PlayerStat }) {
  const initials = `${player.firstName} ${player.lastName}`.trim().split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  if (!player.photoUrl) {
    return <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[5px] border border-[var(--border)] bg-[var(--card-2)] text-sm font-black text-[var(--accent)]">{initials || "?"}</div>;
  }
  return (
    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[5px] border border-[var(--border)] bg-[var(--card-2)]">
      <OptimizedPlayerImage
        src={player.photoUrl}
        alt={`${player.firstName} ${player.lastName}`}
        sizes="48px"
        className="absolute inset-0 h-full w-full object-contain"
        style={{
          objectPosition: `${player.photoPositionX}% ${player.photoPositionY}%`,
          transform: `scale(${Math.min(player.photoZoom, 1)})`,
          transformOrigin: `${player.photoPositionX}% ${player.photoPositionY}%`,
        }}
      />
    </div>
  );
}

export function CompareSelect({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="min-h-12 w-full rounded-[5px] border border-[var(--border)] bg-transparent px-3 text-sm font-semibold text-[var(--foreground)] outline-none"
    >
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  );
}

export function TeamCompareHeader({ team, leagueId }: { team: TeamStat; leagueId: string }) {
  return (
    <Link href={`/leagues/${leagueId}/teams/${team.teamId}`} className="flex flex-col items-center text-center">
      <TeamLogo name={team.teamName} badgeUrl={team.badgeUrl} size="lg" />
      <div className="mt-2 text-sm font-black text-[var(--foreground)]">{team.teamName}</div>
      <div className="mt-2"><FormDots form={team.form} /></div>
    </Link>
  );
}

export function PlayerCompareHeader({ player, leagueId }: { player: PlayerStat; leagueId: string }) {
  return (
    <Link href={`/leagues/${leagueId}/players/${player.playerId}`} className="flex flex-col items-center text-center">
      <PlayerAvatar player={player} />
      <div className="mt-2 text-sm font-black text-[var(--foreground)]">{player.firstName} {player.lastName}</div>
      <div className="mt-1 text-[11px] text-[var(--muted)]">{player.teamName}</div>
    </Link>
  );
}

export function EmptyState() {
  return (
    <Card className="py-12 text-center">
      <BarChart3 size={32} className="mx-auto text-[var(--accent)]" />
      <div className="mt-4 text-lg font-black text-[var(--foreground)]">Le statistiche partiranno dal primo risultato</div>
      <div className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--muted)]">
        Inserisci il risultato di una partita e questa sezione calcolerà automaticamente classifiche, medie, forma e record.
      </div>
    </Card>
  );
}

export function formScore(form: FormResult[]) {
  return form.reduce((score, result) => score + (result === "W" ? 3 : result === "D" ? 1 : 0), 0);
}

export function formatMetric(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
