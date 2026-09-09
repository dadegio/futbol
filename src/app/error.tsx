"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("APP_ROUTE_ERROR", {
      message: error.message,
      digest: error.digest ?? null,
    });
  }, [error]);

  return (
    <main className="grid min-h-[70vh] place-items-center px-4 py-10">
      <section className="w-full max-w-xl rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-xl sm:p-8">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-red-500/10 text-red-400">
          <AlertTriangle size={22} />
        </span>
        <p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-red-400">Errore applicativo</p>
        <h1 className="mt-1 text-2xl font-black tracking-[-0.05em] text-[var(--foreground)]">
          Questa sezione non è stata caricata correttamente
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          Puoi riprovare senza perdere la sessione. Se il problema continua, torna alla home del torneo e riapri la sezione.
        </p>
        {error.digest && (
          <p className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--card-2)] px-3 py-2 font-mono text-[10px] text-[var(--muted)]">
            Riferimento: {error.digest}
          </p>
        )}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-4 text-sm font-black text-white transition hover:opacity-90"
          >
            <RotateCcw size={16} /> Riprova
          </button>
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card-2)] px-4 text-sm font-black text-[var(--foreground)]"
          >
            <Home size={16} /> Torna alla home
          </Link>
        </div>
      </section>
    </main>
  );
}
