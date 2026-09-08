"use client";

import { X } from "lucide-react";
import type { Player } from "./MatchResultParts";

export function PlayerPhotoDialog({
  player,
  onClose,
}: {
  player: Player | null;
  onClose: () => void;
}) {
  if (!player?.photoUrl) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Foto di ${player.firstName} ${player.lastName}`}
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] border border-white/15 bg-black shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-white">
          <div className="min-w-0">
            <p className="truncate text-base font-black">{player.firstName} {player.lastName}</p>
            <p className="text-xs text-white/60">#{player.number} · foto originale</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 text-white active:bg-white/20"
            aria-label="Chiudi foto"
          >
            <X size={22} />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-2 sm:p-4">
          <img
            src={player.photoUrl}
            alt={`Foto di ${player.firstName} ${player.lastName}`}
            className="max-h-[78vh] max-w-full object-contain"
          />
        </div>
      </div>
    </div>
  );
}
