export default function HeroBanner() {
  return (
    <section className="relative overflow-hidden rounded-[18px] border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_0_0_1px_rgba(0,0,0,0.04)] sm:p-8 md:px-12 md:py-10">
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/10 via-transparent to-transparent" />
      <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[var(--accent)]/10 blur-3xl" />

      <div className="relative">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--accent)]">
          League Manager
        </p>

        <h1 className="text-4xl font-black tracking-[-0.06em] text-[var(--foreground)] md:text-5xl">
          FUTBOL
        </h1>

        <p className="mt-3 max-w-sm text-sm leading-relaxed text-[var(--muted)]">
          Gestisci tornei, squadre, calendari e statistiche in un unico posto.
        </p>
      </div>
    </section>
  );
}