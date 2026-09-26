"use client";

import { CircleDot, ShieldCheck, Shirt, Star, ZoomIn } from "lucide-react";
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
  kitHomeUrl?: string | null;
  kitAwayUrl?: string | null;
  kitGoalkeeperUrl?: string | null;
  players: Player[];
};

type StatRow = {
  id: string;
  matchId: string;
  playerId: string;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
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
  coachSuggestedLineup?: Array<{
    playerId: string;
    teamId: string;
    status: "STARTER" | "BENCH";
  }>;
  publishedLineups?: Array<{
    teamId: string;
    formation: string;
    updatedAt: string;
    players: Array<{
      playerId: string;
      status: "STARTER" | "BENCH";
      positionX: number | null;
      positionY: number | null;
      sortOrder: number;
    }>;
  }>;
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
    ? "h-[60px] w-[60px] rounded-[10px] sm:h-24 sm:w-24 sm:rounded-[16px] lg:h-28 lg:w-28"
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

function TeamKitThumb({
  url,
  primary,
  secondary,
  large = false,
}: {
  url?: string | null;
  primary: string;
  secondary: string;
  large?: boolean;
}) {
  const size = large
    ? "h-11 w-11 sm:h-16 sm:w-16 lg:h-20 lg:w-20"
    : "h-10 w-10";

  if (url?.trim()) {
    return (
      <img
        src={url.trim()}
        alt="Divisa squadra"
        className={`${size} shrink-0 object-contain drop-shadow-[0_8px_8px_rgba(0,0,0,.35)]`}
      />
    );
  }

  return (
    <div
      className={`${size} grid shrink-0 place-items-center rounded-2xl border border-white/10`}
      style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
      aria-label="Divisa squadra"
    >
      <Shirt className="h-1/2 w-1/2 text-white/90" />
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

export function TeamScoreBlock({
  team,
  faded,
  kitUrl,
  kitLabel,
}: {
  team: Team;
  faded?: boolean;
  kitUrl?: string | null;
  kitLabel?: string;
}) {
  const primaryColor = safeTeamColor(team.colorHex);
  const secondaryColor = safeTeamColor(team.secondaryColorHex ?? team.colorHex);

  return (
    <div
      className={[
        "flex min-w-0 flex-col items-center gap-2 rounded-[8px] px-1 py-2 text-center sm:px-4 sm:py-3",
        faded ? "opacity-55" : "",
      ].join(" ")}
      style={{
        borderTop: "4px solid transparent",
        borderImage: `linear-gradient(90deg, ${primaryColor} 0 50%, ${secondaryColor} 50% 100%) 1`,
        background: `linear-gradient(135deg, ${primaryColor}24 0 48%, ${secondaryColor}24 52% 100%)`,
      }}
    >
      <div className="flex w-full min-w-0 flex-col items-center justify-center gap-1 sm:flex-row sm:items-end sm:gap-5 lg:gap-8">
        <div
          className="rounded-[10px] p-1 sm:p-2"
          style={{ boxShadow: `-8px 10px 28px ${primaryColor}1F, 8px 10px 28px ${secondaryColor}1F`, background: `linear-gradient(135deg, ${primaryColor}18 0 49%, ${secondaryColor}18 51% 100%)` }}
        >
          <TeamCrest name={team.name} badgeUrl={team.badgeUrl ?? null} large />
        </div>
        <div className="flex w-full shrink-0 flex-col items-center sm:w-auto">
          <TeamKitThumb
            url={kitUrl}
            primary={primaryColor}
            secondary={secondaryColor}
            large
          />
          {kitLabel && (
            <span className="-mt-1 rounded-full bg-black/45 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wider text-white/75 sm:px-2 sm:text-[9px]">
              {kitLabel}
            </span>
          )}
        </div>
      </div>
      <span className="max-w-full truncate text-[11px] font-black leading-tight text-[var(--foreground)] sm:text-base">{team.name}</span>
      <span
        className="h-1 w-12 rounded-full"
        style={{ background: `linear-gradient(90deg, ${primaryColor} 0 50%, ${secondaryColor} 50% 100%)` }}
      />
    </div>
  );
}

export function TeamFormationCard({
  team,
  lineup,
  outfieldKitUrl,
  kitLabel,
}: {
  team: Team;
  lineup: NonNullable<Match["publishedLineups"]>[number];
  outfieldKitUrl?: string | null;
  kitLabel?: string;
}) {
  const primary = safeTeamColor(team.colorHex);
  const secondary = safeTeamColor(team.secondaryColorHex ?? team.colorHex);
  const playerById = new Map(team.players.map((player) => [player.id, player]));
  const starters = lineup.players.filter((entry) => entry.status === "STARTER");
  const bench = lineup.players.filter((entry) => entry.status === "BENCH");

  return (
    <Card className="overflow-hidden !p-0">
      <div
        className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3"
        style={{
          borderTop: "4px solid transparent",
          borderImage: `linear-gradient(90deg, ${primary} 0 50%, ${secondary} 50% 100%) 1`,
          background: `linear-gradient(105deg, ${primary}1F 0 30%, ${secondary}1F 70% 100%)`,
        }}
      >
        <div className="min-w-0">
          <h2 className="truncate text-base font-black text-[var(--foreground)]">{team.name}</h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">Formazione · {lineup.formation}</p>
        </div>
        <div className="flex items-center gap-2">
          <TeamKitThumb url={outfieldKitUrl} primary={primary} secondary={secondary} />
          {kitLabel && <span className="hidden text-[9px] font-black uppercase text-[var(--muted)] sm:block">{kitLabel}</span>}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div
          className="relative mx-auto aspect-[4/5] w-full overflow-hidden rounded-[18px] border border-[#d7efb8]/70 bg-[#79b94d] sm:aspect-[6/5]"
          style={{
            backgroundImage: "repeating-linear-gradient(180deg, rgba(255,255,255,.075) 0 12.5%, rgba(20,92,31,.055) 12.5% 25%)",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,.12), inset 0 0 55px rgba(25,77,30,.16)",
          }}
        >
          <div className="pointer-events-none absolute inset-[3.2%] rounded-[10px] border border-white/75" />
          <div className="pointer-events-none absolute left-[3.2%] right-[3.2%] top-1/2 h-px -translate-y-1/2 bg-white/65" />
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/75 sm:h-20 sm:w-20" />
          <div className="pointer-events-none absolute inset-x-[24%] top-[3.2%] h-[18%] border border-white/75" />
          <div className="pointer-events-none absolute inset-x-[24%] bottom-[3.2%] h-[18%] border border-white/75" />

          {starters.map((entry, index) => {
            const player = playerById.get(entry.playerId);
            if (!player) return null;
            const x = entry.positionX ?? 50;
            const y = entry.positionY ?? Math.min(90, 14 + index * 9);
            const isGoalkeeper = y >= 82;
            const renderedY = isGoalkeeper ? Math.min(y, 84) : y;
            return (
              <div
                key={entry.playerId}
                className={`absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center ${isGoalkeeper ? "w-[82px] sm:w-[108px]" : "w-[64px] sm:w-[86px]"}`}
                style={{ left: `${x}%`, top: `${renderedY}%` }}
              >
                <TeamKitThumb
                  url={isGoalkeeper ? team.kitGoalkeeperUrl ?? outfieldKitUrl : outfieldKitUrl}
                  primary={isGoalkeeper ? secondary : primary}
                  secondary={isGoalkeeper ? primary : secondary}
                  large
                />
                <span className="mt-0.5 flex w-full max-w-full items-center justify-center gap-1 overflow-hidden rounded-[3px] bg-[#173b18]/90 px-1.5 py-1 text-[8px] font-black leading-none text-white shadow sm:text-[10px]">
                  <span className="shrink-0 text-white/75">#{player.number}</span>
                  <span className="min-w-0 truncate">{player.lastName}</span>
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-3">
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--muted)]">Panchina</p>
          {bench.length === 0 ? (
            <p className="text-xs text-[var(--muted)]">Nessun giocatore in panchina.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {bench.map((entry) => {
                const player = playerById.get(entry.playerId);
                if (!player) return null;
                return (
                  <div
                    key={entry.playerId}
                    className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-[#080b09]"
                  >
                    <div className="bg-[linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,0))] px-2 pt-2">
                      {player.photoUrl ? (
                        <div className="relative h-20 w-full overflow-hidden sm:h-24 lg:h-28">
                          <img
                            src={player.photoUrl}
                            alt={`${player.firstName} ${player.lastName}`}
                            className="h-full w-full object-contain object-bottom drop-shadow-[0_8px_8px_rgba(0,0,0,.45)]"
                            style={{
                              objectPosition: `${player.photoPositionX ?? 50}% ${player.photoPositionY ?? 50}%`,
                              transform: `scale(${player.photoZoom ?? 1})`,
                              transformOrigin: `${player.photoPositionX ?? 50}% ${player.photoPositionY ?? 50}%`,
                            }}
                          />
                        </div>
                      ) : (
                        <div className="grid h-20 w-full place-items-center text-xl font-black text-white/35 sm:h-24 lg:h-28">
                          {(player.firstName?.[0] ?? "")}{(player.lastName?.[0] ?? "")}
                        </div>
                      )}
                    </div>

                    <div className="border-t border-white/10 bg-black/35 px-2.5 py-2">
                      <div className="flex items-center justify-between gap-2 text-[9px] font-black uppercase tracking-[0.08em] sm:text-[10px]">
                        <span className="truncate text-emerald-400">{player.position ?? "—"}</span>
                        <span className="shrink-0 text-white/55">#{player.number}</span>
                      </div>
                      <p className="mt-1 truncate text-center text-xs font-black text-white sm:text-sm">
                        {player.lastName}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Card>
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
      className="h-12 w-12 rounded-[6px] border border-white/10 bg-white/[0.05] text-center text-[32px] font-black leading-none text-[var(--foreground)] outline-none placeholder:text-[var(--border-strong)] focus:border-[var(--accent)] sm:h-20 sm:w-20 sm:text-[54px]"
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
  mvpPlayerId,
  setMvpPlayerId,
  showMvpSelection = false,
  coachSuggestedStatuses,
  toggleSheet,
  setPlayerStat,
  readOnly,
  isAdmin,
  showEligibility = false,
  onPreviewPhoto,
  onSelectEligible,
  onlySheet = false,
}: {
  title: string;
  colorHex?: string | null;
  secondaryColorHex?: string | null;
  players: Player[];
  stats: Record<string, { goals: string; assists: string; yellowCards: string; redCards: string }>;
  sheet: Record<string, boolean>;
  mvpPlayerId?: string;
  setMvpPlayerId?: (playerId: string) => void;
  showMvpSelection?: boolean;
  coachSuggestedStatuses?: Record<string, "STARTER" | "BENCH">;
  toggleSheet: (playerId: string, checked: boolean) => void;
  setPlayerStat: (playerId: string, key: "goals" | "assists" | "yellowCards" | "redCards", value: string) => void;
  readOnly?: boolean;
  isAdmin?: boolean;
  showEligibility?: boolean;
  onPreviewPhoto: (player: Player) => void;
  onSelectEligible?: (checked: boolean) => void;
  onlySheet?: boolean;
}) {
  const eligibleCount = players.filter(isPlayerEligible).length;
  const hasPublishedSheet = !showEligibility && players.some((player) => sheet[player.id]);
  const displayedPlayers = onlySheet
    ? players.filter((player) => sheet[player.id])
    : hasPublishedSheet
      ? players.filter((player) => sheet[player.id])
      : players;
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
          <p className="mt-1 text-xs text-[var(--muted)]">
            {showEligibility
              ? `${eligibleCount} giocatori selezionabili`
              : onlySheet
                ? "Distinta gara"
                : "Distinta e statistiche gara"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {showEligibility && !readOnly && onSelectEligible && (
            <>
              <button type="button" onClick={() => onSelectEligible(true)} className="rounded-full bg-[var(--card-2)] px-2.5 py-1 text-[10px] font-black text-[var(--accent)]">Idonei</button>
              <button type="button" onClick={() => onSelectEligible(false)} className="rounded-full bg-[var(--card-2)] px-2.5 py-1 text-[10px] font-black text-[var(--muted)]">Azzera</button>
            </>
          )}
          <span className="rounded-full bg-[var(--card-2)] px-3 py-1 text-xs font-black text-[var(--muted)]">Distinta</span>
        </div>
      </div>

      {displayedPlayers.length === 0 ? (
        <p className="px-4 py-4 text-sm text-[var(--muted)]">
          {onlySheet ? "Distinta non ancora disponibile." : "Nessun giocatore."}
        </p>
      ) : (
        <div>
          {displayedPlayers.map((p, i) => {
            const hasStats =
              Number(stats[p.id]?.goals || 0) > 0 ||
              Number(stats[p.id]?.assists || 0) > 0 ||
              Number(stats[p.id]?.yellowCards || 0) > 0 ||
              Number(stats[p.id]?.redCards || 0) > 0;
            const eligible = isPlayerEligible(p);
            return (
              <div
                key={p.id}
                className={[
                  "grid grid-cols-[32px_48px_minmax(0,1fr)] items-center gap-3 px-4 py-3 sm:grid-cols-[32px_48px_minmax(0,1fr)_auto]",
                  i < displayedPlayers.length - 1 ? "border-b border-[var(--border)]" : "",
                  mvpPlayerId === p.id
                    ? "bg-amber-400/[0.07]"
                    : hasStats
                      ? "bg-[var(--accent-soft)]"
                      : "",
].join(" ")}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--card-2)] text-[11px] font-black text-[var(--muted)]">{p.number}</div>

                <PlayerSheetPhoto player={p} onPreview={onPreviewPhoto} />

                <div className="min-w-0">
                  <span className="block truncate text-[13px] font-black text-[var(--foreground)]">{p.firstName} {p.lastName}</span>
                  {showEligibility && (
                    <span className={["mt-0.5 flex items-center gap-1 truncate text-[10px] font-bold", eligible ? "text-emerald-300" : "text-amber-300"].join(" ")}>
                      {eligible ? <ShieldCheck size={12} /> : <CircleDot size={12} />}
                      {playerEligibilityLabel(p, isAdmin)}
                    </span>
                  )}
                  {coachSuggestedStatuses?.[p.id] && (
                    <span className="mt-1 inline-flex rounded-full bg-sky-400/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-sky-300">
                      Coach · {coachSuggestedStatuses[p.id] === "STARTER" ? "Titolare" : "Panchina"}
                    </span>
                  )}
                </div>

                <div className="col-span-3 flex flex-col items-end gap-2 border-t border-[var(--border)]/60 pt-2 sm:col-span-1 sm:border-t-0 sm:pt-0">
                  {onlySheet ? (
                    <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[10px] font-black text-emerald-300">In distinta</span>
                  ) : (
                    <>
                      {showEligibility ? (
                        <div className="flex min-h-8 flex-wrap items-center justify-end gap-2">
                          <label className="flex items-center gap-1 text-[10px] font-black text-[var(--muted)]">
                            <input
                              type="checkbox"
                              checked={sheet[p.id] ?? false}
                              disabled={readOnly || !eligible}
                              onChange={(event) => toggleSheet(p.id, event.target.checked)}
                            />
                            Distinta
                          </label>
                          {showMvpSelection && setMvpPlayerId && (
                            <label
                              className={[
                                "flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-black transition",
                                mvpPlayerId === p.id
                                  ? "bg-amber-400/15 text-amber-300"
                                  : "text-[var(--muted)]",
                                !sheet[p.id] ? "opacity-45" : "",
                              ].join(" ")}
                              title={sheet[p.id] ? "Seleziona come MVP" : "Inserisci prima il giocatore in distinta"}
                            >
                              <input
                                type="checkbox"
                                checked={mvpPlayerId === p.id}
                                disabled={readOnly || !eligible || !sheet[p.id]}
                                onChange={() => setMvpPlayerId(mvpPlayerId === p.id ? "" : p.id)}
                              />
                              <Star size={11} />
                              MVP
                            </label>
                          )}
                        </div>
                      ) : sheet[p.id] ? (
                        <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[10px] font-black text-emerald-300">In distinta</span>
                      ) : null}
                      <div className="flex items-center gap-1.5">
                        <StatInput label="G" value={stats[p.id]?.goals ?? ""} onChange={(v) => setPlayerStat(p.id, "goals", v)} readOnly={readOnly} />
                        <StatInput label="A" value={stats[p.id]?.assists ?? ""} onChange={(v) => setPlayerStat(p.id, "assists", v)} readOnly={readOnly} />
                        <CardStatInput tone="yellow" value={stats[p.id]?.yellowCards ?? ""} onChange={(v) => setPlayerStat(p.id, "yellowCards", v)} readOnly={readOnly} />
                        <CardStatInput tone="red" value={stats[p.id]?.redCards ?? ""} onChange={(v) => setPlayerStat(p.id, "redCards", v)} readOnly={readOnly} />
                      </div>
                    </>
                  )}
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

function CardStatInput({
  tone,
  value,
  onChange,
  readOnly,
}: {
  tone: "yellow" | "red";
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
}) {
  const label = tone === "yellow" ? "Gialli" : "Rossi";
  const swatch = tone === "yellow" ? "bg-yellow-300" : "bg-red-500";
  return (
    <div className="flex items-center gap-1" title={label}>
      <span className={`h-4 w-2.5 shrink-0 rounded-[2px] ${swatch}`} aria-label={label} />
      <input
        value={value === "0" ? "" : value}
        placeholder="0"
        onChange={(e) => !readOnly && onChange(e.target.value)}
        inputMode="numeric"
        readOnly={readOnly}
        aria-label={label}
        className={[
          "h-8 w-9 rounded-xl border text-center text-[13px] font-black text-[var(--foreground)] outline-none placeholder:text-[var(--border-strong)]",
          readOnly
            ? "cursor-default border-transparent bg-transparent"
            : "border-[var(--border)] bg-[var(--card-2)] focus:border-[var(--accent)]",
        ].join(" ")}
      />
    </div>
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
