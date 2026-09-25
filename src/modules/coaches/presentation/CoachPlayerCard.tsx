"use client";

type CardPlayer = {
  firstName: string;
  lastName: string;
  number: number;
  position: string | null;
  photoUrl: string | null;
  photoZoom: number;
  photoPositionX: number;
  photoPositionY: number;
  stats: {
    appearances: number;
    goals: number;
    assists: number;
    mvp: number;
  };
};

function safeColor(value: string | null | undefined, fallback: string) {
  return value && /^#[0-9A-Fa-f]{6}$/.test(value) ? value : fallback;
}

export default function CoachPlayerCard({
  player,
  primaryColor,
  secondaryColor,
  compact = false,
}: {
  player: CardPlayer;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  compact?: boolean;
}) {
  const primary = safeColor(primaryColor, "#F59E0B");
  const secondary = safeColor(secondaryColor, "#7C3AED");
  const ga = player.stats.goals + player.stats.assists;

  return (
    <div
      className={[
        "relative isolate overflow-hidden border border-white/15 shadow-2xl",
        compact
          ? "aspect-[.74] w-[104px] rounded-[18px]"
          : "aspect-[.72] w-full rounded-[28px]",
      ].join(" ")}
      style={{
        background: `
          radial-gradient(circle at 50% 15%, rgba(255,255,255,.28), transparent 24%),
          linear-gradient(145deg, ${primary} 0%, #b78a28 38%, ${secondary} 115%)
        `,
        boxShadow: `0 22px 55px ${primary}20`,
      }}
    >
      <div
        className="pointer-events-none absolute inset-[4%] rounded-[22px] border border-white/20"
        style={{
          background:
            "linear-gradient(155deg, rgba(255,255,255,.17), transparent 34%, rgba(0,0,0,.18) 78%)",
        }}
      />

      <div className={compact ? "absolute left-2 top-2 z-10" : "absolute left-4 top-4 z-10"}>
        <p className={compact ? "text-lg font-black leading-none text-white" : "text-3xl font-black leading-none text-white"}>
          {player.number}
        </p>
        <p className={compact ? "mt-0.5 text-[7px] font-black uppercase text-white/75" : "mt-1 text-[10px] font-black uppercase tracking-[.15em] text-white/75"}>
          {player.position ?? "PLAYER"}
        </p>
      </div>

      <div
        className={[
          "absolute left-1/2 -translate-x-1/2 overflow-hidden",
          compact
            ? "top-[14%] h-[56%] w-[78%]"
            : "top-[11%] h-[59%] w-[78%]",
        ].join(" ")}
      >
        {player.photoUrl ? (
          <img
            src={player.photoUrl}
            alt={`${player.firstName} ${player.lastName}`}
            draggable={false}
            className="h-full w-full object-contain drop-shadow-[0_18px_15px_rgba(0,0,0,.35)]"
            style={{
              objectPosition: `${player.photoPositionX}% ${player.photoPositionY}%`,
              transform: `scale(${player.photoZoom})`,
              transformOrigin: `${player.photoPositionX}% ${player.photoPositionY}%`,
            }}
          />
        ) : (
          <div className="grid h-full place-items-center text-4xl font-black text-white/60">
            {player.firstName[0]}{player.lastName[0]}
          </div>
        )}
      </div>

      <div
        className={[
          "absolute inset-x-[7%] bottom-[5%] z-10 rounded-2xl border border-white/15 bg-black/28 text-white backdrop-blur-sm",
          compact ? "px-2 py-1.5" : "px-3 py-3",
        ].join(" ")}
      >
        <p className={compact ? "truncate text-center text-[9px] font-black uppercase" : "truncate text-center text-sm font-black uppercase tracking-[.04em]"}>
          {player.lastName}
        </p>

        {!compact && (
          <div className="mt-2 grid grid-cols-4 divide-x divide-white/10 text-center">
            {[
              ["G", player.stats.goals],
              ["A", player.stats.assists],
              ["G+A", ga],
              ["MVP", player.stats.mvp],
            ].map(([label, value]) => (
              <div key={String(label)} className="px-1">
                <p className="text-sm font-black">{value}</p>
                <p className="text-[7px] font-black uppercase tracking-wider text-white/60">
                  {label}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        className="pointer-events-none absolute -right-[20%] -top-[5%] h-[55%] w-[60%] rotate-[28deg] opacity-20 blur-[1px]"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,.9), transparent)",
        }}
      />
    </div>
  );
}
