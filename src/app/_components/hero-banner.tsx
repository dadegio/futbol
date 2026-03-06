export default function HeroBanner() {
  return (
    <section className="overflow-hidden rounded-[30px] border border-white/8 bg-[#1a1a1d]">
      <div className="relative h-[320px] w-full">
        <img
          src="https://assets.fortnitecreativehq.com/wp-content/uploads/2024/02/10033037/landscape_comp-3273.jpeg"
          alt="Football hero"
          className="h-full w-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/20 to-black/40" />

        <div className="absolute inset-0 flex items-center justify-center">
          <h1 className="text-5xl font-black tracking-[0.18em] text-white md:text-7xl">
            FUTBOL
          </h1>
        </div>
      </div>
    </section>
  );
}