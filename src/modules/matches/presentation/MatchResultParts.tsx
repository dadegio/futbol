"use client";

import { CircleDot, ShieldCheck, ZoomIn } from "lucide-react";
import Card from "src/app/_components/ui/card";
import { FUTPOLI_RULES } from "@/modules/players/domain/tournament-rules";

export type Player = {
  id: string;
  firstName: string;
  lastName: string;
  number: number;
  teamId: string;
  position?: string | null;
  photoUrl?: string | null;
  photoZoom?: number;
  photoPositionX?: number;
  photoPositionY?: number;
  registrationStatus?: string;
  isEligibleForMatchSheet?: boolean;
  adminMissingItems?: string[];
};

export type Team = {
  id: string;
  name: string;
  badgeUrl?: string | null;
  colorHex?: string | null;
  secondaryColorHex?: string | null;
  players: Player[];
};

type StatRow = {
  id: string;
  matchId: string;
  playerId: string;
  goals: number;
  assists: number;
};

type Referee = {
  id: string;
  name?: string | null;
  active?: boolean;
  teamId?: string | null;
  team?: { id: string; name: string } | null;
};

export type Match = {
  id: string;
  round: number;
  date: string | null;
  slotEnd: string | null;
  venueKey: string | null;
  venueName: string | null;
  venueAddress: string | null;
  refereeId: string | null;
  refereeManualOverride: boolean;
  referee: Referee | null;
  refereeFeeCents?: number | null;
  homeGoals: number | null;
  awayGoals: number | null;
  lifecycleStatus?: "SCHEDULED" | "POSTPONED" | "CANCELLED";
  originalDate?: string | null;
  resultStatus?: "DRAFT" | "FINAL" | null;
  finalizedAt?: string | null;
  homeSheetConfirmed?: boolean;
  awaySheetConfirmed?: boolean;
  mvpPlayerId?: string | null;
  mvpPlayer?: { id: string; firstName: string; lastName: string; number: number } | null;
  replayUrl?: string | null;
  highlightsUrl?: string | null;
  homeTeam: Team;
  awayTeam: Team;
  stats: StatRow[];
  sheetPlayers?: Array<{ playerId: string; teamId: string }>;
  leagueId: string;
};

type AdminRefereeOption = {
  id: string;
  name: string;
  active: boolean;
  warnings: string[];
  compatible: boolean;
};

export type AdminRefereeState = {
  mode: "automatic" | "manual";
  referee: { id: string; name: string; active?: boolean } | null;
  refereeId: string | null;
  completed: boolean;
  referees: AdminRefereeOption[];
};

function TeamCrest({
  name,
  badgeUrl,
  large = false,
}: {
  name: string;
  badgeUrl?: string | null;
  large?: boolean;
}) {
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const sizeClasses = large
    ? "h-[72px] w-[72px] rounded-[20px] sm:h-28 sm:w-28 sm:rounded-[30px]"
    : "h-11 w-11 rounded-xl";

  if (badgeUrl) {
    return (
      <img
        src={badgeUrl}
        alt={`Logo ${name}`}
        className={`shrink-0 object-contain ${sizeClasses}`}
      />
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center bg-[var(--card-2)] font-black text-[var(--accent)] ${sizeClasses} ${
        large ? "text-2xl sm:text-4xl" : "text-sm"
      }`}
    >
      {initials || "?"}
    </div>
  );
}

function isPlayerEligible(player: Player) {
  return player.isEligibleForMatchSheet === true;
}

function playerEligibilityLabel(player: Player, admin = false) {
  if (isPlayerEligible(player)) return "Iscrizione OK";
  if (admin && player.adminMissingItems?.length) {
    return `Da completare · ${player.adminMissingItems.join(", ")}`;
  }
  return player.registrationStatus ?? "Da completare";
}

function safeTeamColor(color?: string | null) {
  return color && /^#[0-9A-Fa-f]{6}$/.test(color) ? color : "#F97316";
}

export function TeamScoreBlock({ team, faded }: { team: Team; faded?: boolean }) {
  const primaryColor = safeTeamColor(team.colorHex);
  const secondaryColor = safeTeamColor(team.secondaryColorHex ?? team.colorHex);

  return (
    <div
      className={[
        "flex min-w-0 flex-col items-center gap-2 rounded-[24px] px-2 py-3 text-center sm:px-4",
        faded ? "opacity-55" : "",
      ].join(" ")}
      style={{
        borderTop: "4px solid transparent",
        borderImage: `linear-gradient(90deg, ${primaryColor} 0 50%, ${secondaryColor} 50% 100%) 1`,
        background: `linear-gradient(135deg, ${primaryColor}24 0 48%, ${secondaryColor}24 52% 100%)`,
      }}
    >
      <div
        className="rounded-[26px] p-2"
        style={{ boxShadow: `-8px 10px 28px ${primaryColor}1F, 8px 10px 28px ${secondaryColor}1F`, background: `linear-gradient(135deg, ${primaryColor}18 0 49%, ${secondaryColor}18 51% 100%)` }}
      >
        <TeamCrest name={team.name} badgeUrl={team.badgeUrl ?? null} large />
      </div>
      <span className="max-w-full truncate text-sm font-black text-[var(--foreground)] sm:text-base">{team.name}</span>
      <span
        className="h-1 w-12 rounded-full"
        style={{ background: `linear-gradient(90deg, ${primaryColor} 0 50%, ${secondaryColor} 50% 100%)` }}
      />
    </div>
  );
}

export function ScoreInput({ value, setValue, readOnly }: { value: string; setValue: (v: string) => void; readOnly?: boolean }) {
  return (
    <input
      value={value}
      onChange={(e) => !readOnly && setValue(e.target.value.replace(/[^\d]/g, ""))}
      placeholder="–"
      inputMode="numeric"
      readOnly={readOnly}
      className="h-16 w-16 rounded-2xl border border-white/10 bg-white/[0.05] text-center text-[42px] font-black leading-none text-[var(--foreground)] outline-none placeholder:text-[var(--border-strong)] focus:border-[var(--accent)] sm:h-20 sm:w-20 sm:text-[54px]"
    />
  );
}

export function SheetCounter({ team, count, missing }: { team: string; count: number; missing: number }) {
  return (
    <span className={missing ? "text-amber-300" : "text-[var(--muted)]"}>
      <b className="text-[var(--foreground)]">{count}</b>/{FUTPOLI_RULES.minPlayersInMatchSheet} {team.slice(0, 10)}
      {missing ? ` · -${missing}` : ""}
    </span>
  );
}

export function TeamStatsCard({
  title,
  colorHex,
  secondaryColorHex,
  players,
  stats,
  sheet,
  toggleSheet,
  setPlayerStat,
  readOnly,
  isAdmin,
  onPreviewPhoto,
  onSelectEligible,
}: {
  title: string;
  colorHex?: string | null;
  secondaryColorHex?: string | null;
  players: Player[];
  stats: Record<string, { goals: string; assists: string }>;
  sheet: Record<string, boolean>;
  toggleSheet: (playerId: string, checked: boolean) => void;
  setPlayerStat: (playerId: string, key: "goals" | "assists", value: string) => void;
  readOnly?: boolean;
  isAdmin?: boolean;
  onPreviewPhoto: (player: Player) => void;
  onSelectEligible?: (checked: boolean) => void;
}) {
  const eligibleCount = players.filter(isPlayerEligible).length;
  const teamColor = safeTeamColor(colorHex);
  const teamSecondaryColor = safeTeamColor(secondaryColorHex ?? colorHex);

  return (
    <Card className="overflow-hidden !p-0">
      <div
        className="flex items-center justify-between border-b border-[var(--border)] px-4 py-4"
        style={{
          borderTop: "4px solid transparent",
          borderImage: `linear-gradient(90deg, ${teamColor} 0 50%, ${teamSecondaryColor} 50% 100%) 1`,
          background: `linear-gradient(105deg, ${teamColor}1F 0 30%, ${teamSecondaryColor}1F 70% 100%)`,
        }}
      >
        <div>
          <h2 className="text-base font-black text-[var(--foreground)]">{title}</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">{eligibleCount} giocatori selezionabili</p>
        </div>
        <div className="flex items-center gap-2">
          {!readOnly && onSelectEligible && (
            <>
              <button type="button" onClick={() => onSelectEligible(true)} className="rounded-full bg-[var(--card-2)] px-2.5 py-1 text-[10px] font-black text-[var(--accent)]">Idonei</button>
              <button type="button" onClick={() => onSelectEligible(false)} className="rounded-full bg-[var(--card-2)] px-2.5 py-1 text-[10px] font-black text-[var(--muted)]">Azzera</button>
            </>
          )}
          <span className="rounded-full bg-[var(--card-2)] px-3 py-1 text-xs font-black text-[var(--muted)]">Distinta</span>
        </div>
      </div>

      {players.length === 0 ? (
        <p className="px-4 py-4 text-sm text-[var(--muted)]">Nessun giocatore.</p>
      ) : (
        <div>
          {players.map((p, i) => {
            const hasStats = Number(stats[p.id]?.goals || 0) > 0 || Number(stats[p.id]?.assists || 0) > 0;
            const eligible = isPlayerEligible(p);
            return (
              <div
                key={p.id}
                className={[
                  "grid items-center gap-3 px-4 py-3",
                  i < players.length - 1 ? "border-b border-[var(--border)]" : "",
                  hasStats ? "bg-[var(--accent-soft)]" : "",
                ].join(" ")}
                style={{ gridTemplateColumns: "32px 48px minmax(0,1fr) auto" }}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--card-2)] text-[11px] font-black text-[var(--muted)]">{p.number}</div>

                <PlayerSheetPhoto player={p} onPreview={onPreviewPhoto} />

                <div className="min-w-0">
                  <span className="block truncate text-[13px] font-black text-[var(--foreground)]">{p.firstName} {p.lastName}</span>
                  <span className={["mt-0.5 flex items-center gap-1 truncate text-[10px] font-bold", eligible ? "text-emerald-300" : "text-amber-300"].join(" ")}>
                    {eligible ? <ShieldCheck size={12} /> : <CircleDot size={12} />}
                    {playerEligibilityLabel(p, isAdmin)}
                  </span>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <label className="flex min-h-8 items-center gap-1 text-[10px] font-black text-[var(--muted)]">
                    <input type="checkbox" checked={sheet[p.id] ?? false} disabled={readOnly || !eligible} onChange={(event) => toggleSheet(p.id, event.target.checked)} />
                    Distinta
                  </label>
                  <div className="flex items-center gap-1.5">
                    <StatInput label="G" value={stats[p.id]?.goals ?? ""} onChange={(v) => setPlayerStat(p.id, "goals", v)} readOnly={readOnly} />
                    <StatInput label="A" value={stats[p.id]?.assists ?? ""} onChange={(v) => setPlayerStat(p.id, "assists", v)} readOnly={readOnly} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function PlayerSheetPhoto({ player, onPreview }: { player: Player; onPreview: (player: Player) => void }) {
  const initials = `${player.firstName?.[0] ?? ""}${player.lastName?.[0] ?? ""}`.toUpperCase() || "?";
  if (!player.photoUrl) {
    return (
      <div className="flex h-14 w-11 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card-2)] text-xs font-black text-[var(--muted)]">
        {initials}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onPreview(player)}
      className="group relative h-14 w-11 overflow-hidden rounded-xl border border-[var(--border)] bg-black/20 outline-none ring-[var(--accent)] focus-visible:ring-2"
      aria-label={`Ingrandisci foto di ${player.firstName} ${player.lastName}`}
      title="Tocca per controllare la foto"
    >
      <img
        src={player.photoUrl}
        alt={`Foto ${player.firstName} ${player.lastName}`}
        className="h-full w-full object-contain"
        style={{
          objectPosition: `${player.photoPositionX ?? 50}% ${player.photoPositionY ?? 50}%`,
          transform: `scale(${player.photoZoom ?? 1})`,
          transformOrigin: `${player.photoPositionX ?? 50}% ${player.photoPositionY ?? 50}%`,
        }}
      />
      <span className="absolute bottom-0 right-0 grid h-5 w-5 place-items-center rounded-tl-lg bg-black/65 text-white">
        <ZoomIn size={11} />
      </span>
    </button>
  );
}

function StatInput({ label, value, onChange, readOnly }: { label: string; value: string; onChange: (v: string) => void; readOnly?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      <span className="w-3 text-[10px] font-black text-[var(--muted)]">{label}</span>
      <input
        value={value === "0" ? "" : value}
        placeholder="0"
        onChange={(e) => !readOnly && onChange(e.target.value)}
        inputMode="numeric"
        readOnly={readOnly}
        className={["h-8 w-10 rounded-xl border text-center text-[13px] font-black text-[var(--foreground)] outline-none placeholder:text-[var(--border-strong)]", readOnly ? "cursor-default border-transparent bg-transparent" : "border-[var(--border)] bg-[var(--card-2)] focus:border-[var(--accent)]"].join(" ")}
      />
    </div>
  );
}
