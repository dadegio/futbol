"use client";

import Link from "next/link";
import { ArrowRight, Trash2 } from "lucide-react";
import { useIsAdmin } from "@/lib/client-auth";

type LeagueCardProps = {
  id: string;
  name: string;
  onDelete: () => void;
};

export default function HomeLeagueCard({ id, name, onDelete }: LeagueCardProps) {
  const isAdmin = useIsAdmin();

  return (
    <div className="group rounded-[24px] border border-white/8 bg-[#17171a] p-5 transition hover:-translate-y-0.5 hover:border-[var(--accent)]/30 hover:bg-[#1b1b1f]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex rounded-full bg-[var(--accent)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
            League
          </div>
          <h3 className="text-xl font-bold text-white">{name}</h3>
          <p className="mt-2 text-sm text-white/45">{id}</p>
        </div>

        {isAdmin && (
          <button
            onClick={onDelete}
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/70 transition hover:border-red-400/30 hover:bg-red-500/10 hover:text-red-300"
            aria-label={`Elimina ${name}`}
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>

      <div className="mt-5">
        <Link
          href={`/leagues/${id}/calendar`}
          className="inline-flex items-center gap-2 rounded-2xl bg-[var(--accent)] px-4 py-3 font-semibold text-black transition hover:bg-[var(--accent-2)]"
        >
          Apri torneo
          <ArrowRight size={18} />
        </Link>
      </div>
    </div>
  );
}
