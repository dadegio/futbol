"use client";

type SponsorBannerProps = {
  compact?: boolean;
  className?: string;
};

const sponsorName =
  process.env.NEXT_PUBLIC_SPONSOR_NAME?.trim() || "Sponsor ufficiale";
const sponsorLogo =
  process.env.NEXT_PUBLIC_SPONSOR_LOGO_URL?.trim() || "/sponsor-logo.png";
const sponsorUrl =
  process.env.NEXT_PUBLIC_SPONSOR_URL?.trim() || "https://campingbar.it/";

export default function SponsorBanner({
  compact = false,
  className = "",
}: SponsorBannerProps) {
  const content = (
    <div
      className={[
        "sponsor-banner flex min-w-0 items-center justify-center gap-4 rounded-[6px] border border-[var(--border)] px-4 text-center",
        compact
          ? "min-h-[104px] py-4 sm:px-6"
          : "min-h-[132px] py-5 sm:px-8 sm:py-6",
        className,
      ].join(" ")}
    >
      <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)] sm:text-[10px]">
        Sponsor
        <span className="block">ufficiale</span>
      </span>
      <span className="h-10 w-px shrink-0 bg-[var(--border)]" />
      <img
        src={sponsorLogo}
        alt={sponsorName}
        loading="lazy"
        decoding="async"
        className={[
          "w-full min-w-0 object-contain",
          compact
            ? "h-16 max-w-[260px] sm:h-20 sm:max-w-[320px]"
            : "h-20 max-w-[300px] sm:h-24 sm:max-w-[380px]",
        ].join(" ")}
        onError={(event) => {
          event.currentTarget.onerror = null;
          event.currentTarget.src = "/sponsor-logo-placeholder.svg";
        }}
      />
    </div>
  );

  if (!sponsorUrl) return content;

  return (
    <a
      href={sponsorUrl}
      target="_blank"
      rel="noreferrer sponsored"
      aria-label={`Visita il sito di ${sponsorName}`}
      className="block"
    >
      {content}
    </a>
  );
}
