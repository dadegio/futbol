"use client";

import Script from "next/script";
import { useEffect, useMemo, useState } from "react";
import type { LeagueBranding } from "@/modules/branding/domain/league-branding";

type Props = {
  league?: LeagueBranding | null;
  placement: "home" | "league";
  className?: string;
};

type ConsentDetail = {
  marketing?: boolean;
};

function readMarketingConsent() {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem("futbol-cookie-consent-v1");
    if (!raw) return false;
    return JSON.parse(raw)?.marketing === true;
  } catch {
    return false;
  }
}

function openCookiePreferences() {
  window.dispatchEvent(new Event("futbol-open-cookie-preferences"));
}

export default function LeagueAdSlot({ league, placement, className = "" }: Props) {
  const [marketingConsent, setMarketingConsent] = useState(false);
  const rawSlot = placement === "home" ? league?.adHomeSlot : league?.adLeagueSlot;
  const rawClient = league?.adClientId?.trim();
  const slot = rawSlot || "";
  const client = rawClient || "";
  const provider = (league?.adProvider || "ADSENSE").trim().toUpperCase();
  const canUseAdsense = league?.adsEnabled === true && provider === "ADSENSE" && Boolean(client && slot);

  useEffect(() => {
    setMarketingConsent(readMarketingConsent());
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<ConsentDetail>).detail;
      if (typeof detail?.marketing === "boolean") setMarketingConsent(detail.marketing);
      else setMarketingConsent(readMarketingConsent());
    };
    window.addEventListener("futbol-cookie-consent-updated", handler);
    return () => window.removeEventListener("futbol-cookie-consent-updated", handler);
  }, []);

  useEffect(() => {
    if (!canUseAdsense || !marketingConsent) return;
    try {
      const ads = ((window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle ||= []);
      ads.push({});
    } catch {
      // Ad blockers or local development can prevent AdSense from initializing.
    }
  }, [canUseAdsense, marketingConsent, client, slot]);

  const label = useMemo(() => {
    if (!league?.adsEnabled) return null;
    if (!client || !slot) return "Spazio pubblicitario da configurare";
    if (!marketingConsent) return "Pubblicità disponibile dopo consenso marketing";
    return "Pubblicità";
  }, [client, league?.adsEnabled, marketingConsent, slot]);

  if (!league?.adsEnabled) return null;

  return (
    <section className={`no-print overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--card)] p-3 ${className}`} aria-label="Pubblicità">
      <div className="mb-2 flex items-center justify-between gap-3 px-1 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--muted)]">
        <span>{label}</span>
        {!marketingConsent && (
          <button type="button" onClick={openCookiePreferences} className="text-[var(--accent)]">
            Gestisci cookie
          </button>
        )}
      </div>

      {canUseAdsense && marketingConsent ? (
        <>
          <Script
            id={`adsense-${client}`}
            async
            strategy="afterInteractive"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`}
            crossOrigin="anonymous"
          />
          <ins
            className="adsbygoogle block min-h-[90px] w-full"
            style={{ display: "block" }}
            data-ad-client={client}
            data-ad-slot={slot}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        </>
      ) : (
        <div className="grid min-h-[90px] place-items-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card-2)] px-4 py-5 text-center text-xs text-[var(--muted)]">
          {client && slot
            ? "Gli annunci sono pronti: verranno caricati dopo il consenso marketing."
            : "Inserisci client ID e slot pubblicitario nelle impostazioni del torneo."}
        </div>
      )}
    </section>
  );
}
