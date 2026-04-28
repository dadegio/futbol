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
    <div className="group flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--card-2)] p-5 transition-colors hover:border-[var(--accent)]/25">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-block rounded-md bg-[var(--accent)]/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--accent)]">
            Torneo
          </span>

          <h3 className="mt-2.5 truncate text-lg font-black tracking-[-0.03em] text-[var(--foreground)]">
            {name}
          </h3>
        </div>

        {isAdmin && (
          <button
            onClick={onDelete}
            className="shrink-0 rounded-lg border border-[var(--border)] bg-[var(--card)] p-2 text-[var(--muted)] transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            aria-label={`Elimina ${name}`}
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>

      <Link
        href={`/leagues/${id}`}
        className="inline-flex w-fit items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-2)]"
      >
        Apri torneo
        <ArrowRight size={15} />
      </Link>
    </div>
  );
}