export default function HeroBanner() {
  return (
    <section className="relative overflow-hidden rounded-[18px] bg-[var(--foreground)] p-8 md:px-12 md:py-14">
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent" />
      <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/5 blur-3xl" />

      <div className="relative">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/40">
          League Manager
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
          FUTBOL
        </h1>
        <p className="mt-3 max-w-sm text-sm text-white/50">
          Gestisci tornei, squadre, calendari e statistiche in un unico posto.
        </p>
      </div>
    </section>
  );
}
