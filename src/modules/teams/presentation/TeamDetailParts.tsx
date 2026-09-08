"use client";

import Link from "next/link";
import { Crown, Trash2 } from "lucide-react";
import OptimizedPlayerImage from "src/app/_components/optimized-player-image";
import { FUTPOLI_RULES } from "@/lib/tournament-rules";

export type Player = {
  id: string;
  firstName: string;
  lastName: string;
  number: number;
  position?: string | null;
  photoUrl?: string | null;
  photoZoom?: number;
  photoPositionX?: number;
  photoPositionY?: number;
  isTeamCaptain?: boolean;
  goals?: number;
  assists?: number;
  appearances?: number;
  feeCents?: number;
  status?: string;
  documentSigned?: boolean;
  mediaConsent?: boolean;
  registrationStatus?: string;
  isEligibleForMatchSheet?: boolean;
  adminMissingItems?: string[];
};

export type Team = {
  id: string;
  name: string;
  badgeUrl?: string | null;
  description?: string | null;
  colorHex?: string | null;
  secondaryColorHex?: string | null;
  league: { id: string; name: string };
  players: Player[];
};

export const POSITIONS = ["Portiere", "Difensore", "Centrocampista", "Attaccante"];
export const MAX_PLAYERS_PER_TEAM = FUTPOLI_RULES.maxPlayersPerTeam;

export const ROLE_ORDER = ["Portiere", "Difensore", "Centrocampista", "Attaccante"];

function formatEuro(cents: number) {
  return (cents / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

function isAdminOk(player: Player) {
  return player.isEligibleForMatchSheet === true || Boolean(player.status === "AUTHORIZED" && player.documentSigned && player.mediaConsent);
}

function playerStatusLabel(player: Player) {
  if (isAdminOk(player)) return "Iscrizione OK";
  if (player.status === "SUSPENDED") return "Squalificato";
  if (player.status === "BLOCKED") return "Bloccato";
  if (player.status === "IN_REVIEW") return "In verifica";
  if (player.status === "RETIRED") return "Ritirato";
  return player.registrationStatus ?? "Da completare";
}

const SHORT_ROLE: Record<string, string> = {
  Portiere: "POR",
  Difensore: "DIF",
  Centrocampista: "CEN",
  Attaccante: "ATT",
};

export function PlayerRow({
  leagueId,
  player,
  role,
  canEdit,
  isAdmin,
  eagerPhoto = false,
  onDelete,
}: {
  leagueId: string;
  player: Player;
  role: string;
  canEdit: boolean;
  isAdmin: boolean;
  eagerPhoto?: boolean;
  onDelete: () => void;
}) {
  const shortRole = SHORT_ROLE[role] ?? "—";
  const fullName = `${player.firstName} ${player.lastName}`;

  return (
    <div className={[
      "grid grid-cols-[88px_minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--border)] px-4 py-4 last:border-b-0 sm:grid-cols-[104px_minmax(0,1fr)_auto]",
      isAdminOk(player) ? "" : "bg-amber-400/5",
    ].join(" ")}>
      <PlayerPhoto
        name={fullName}
        photoUrl={player.photoUrl ?? null}
        photoZoom={player.photoZoom ?? 1}
        photoPositionX={player.photoPositionX ?? 50}
        photoPositionY={player.photoPositionY ?? 50}
        eager={eagerPhoto}
      />

      <Link
        href={`/leagues/${leagueId}/players/${player.id}`}
        className="min-w-0"
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="break-words text-[16px] font-semibold text-[var(--foreground)]">
            {fullName}
          </div>
          {player.isTeamCaptain && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/35 bg-amber-400/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-amber-300">
              <Crown size={11} /> Capitano
            </span>
          )}
        </div>

        <div className="mt-1 flex items-center gap-2 text-sm text-[var(--muted)]">
          <span>#{player.number}</span>
          <span>·</span>
          <span>{shortRole}</span>
          <span>·</span>
          <span>{playerStatusLabel(player)}</span>
        </div>
        <div className="mt-1 text-xs text-[var(--muted)]">
          {player.appearances ?? 0} presenze
          {isAdmin && <> · {formatEuro(player.feeCents ?? 0)} quota</>}
        </div>
      </Link>

      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="font-mono text-base font-black text-[var(--foreground)]">
            {player.goals ?? 0}
          </div>
          <div className="text-xs text-[var(--muted)]">
            {player.assists ?? 0}a
          </div>
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={onDelete}
            className="grid h-9 w-9 place-items-center rounded-lg text-[var(--muted)] active:bg-red-50 active:text-amber-300"
            aria-label={`Elimina ${fullName}`}
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

export function TeamLogo({
  name,
  badgeUrl,
}: {
  name: string;
  badgeUrl: string | null;
}) {
  const initials = name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (badgeUrl) {
    return (
      <img
        src={badgeUrl}
        alt={`Logo ${name}`}
        className="h-36 w-36 shrink-0 rounded-[34px] object-contain xl:h-44 xl:w-44"
      />
    );
  }

  return (
    <span className="flex h-36 w-36 shrink-0 items-center justify-center rounded-[34px] bg-green-200 text-4xl font-black text-green-900 xl:h-44 xl:w-44">
      {initials}
    </span>
  );
}

function PlayerPhoto({
  name,
  photoUrl,
  photoZoom = 1,
  photoPositionX = 50,
  photoPositionY = 50,
  eager = false,
}: {
  name: string;
  photoUrl?: string | null;
  photoZoom?: number;
  photoPositionX?: number;
  photoPositionY?: number;
  eager?: boolean;
}) {
  const initials = name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (photoUrl) {
    return (
      <div className="relative h-[95px] w-[76px] shrink-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--background)] sm:h-[115px] sm:w-[92px]">
        <OptimizedPlayerImage
          src={photoUrl}
          alt={`Foto ${name}`}
          sizes="(max-width: 640px) 76px, 92px"
          eager={eager}
          className="absolute inset-0 h-full w-full object-contain"
          style={{
            objectPosition: `${photoPositionX}% ${photoPositionY}%`,
            transform: `scale(${photoZoom})`,
            transformOrigin: `${photoPositionX}% ${photoPositionY}%`,
          }}
        />
      </div>
    );
  }

  return (
    <div className="relative flex h-[95px] w-[76px] shrink-0 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--background)] text-lg font-black text-[var(--accent)] sm:h-[115px] sm:w-[92px]">
      {initials}
    </div>
  );
}
