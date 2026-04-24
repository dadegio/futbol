export default function HeroBanner() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/8 via-transparent to-transparent" />
      <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[var(--accent)]/5 blur-3xl" />
      <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-[var(--accent)]/4 blur-3xl" />

      <div className="relative px-8 py-12 md:px-12 md:py-16">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--accent)]/70">
          League Manager
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-[var(--foreground)] md:text-5xl">
          FUTBOL
        </h1>
        <p className="mt-3 max-w-sm text-sm text-[var(--foreground)]/50">
          Gestisci tornei, squadre, calendari e statistiche in un unico posto.
        </p>
      </div>
    </section>
  );
}
