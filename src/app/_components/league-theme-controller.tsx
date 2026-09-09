"use client";

import { useEffect } from "react";
import { hexToRgba, resolveLeagueBranding, type LeagueBranding } from "@/modules/branding/domain/league-branding";

const managedProperties = [
  "--background",
  "--foreground",
  "--card",
  "--card-2",
  "--muted",
  "--border",
  "--border-strong",
  "--accent",
  "--accent-2",
  "--accent-soft",
  "--imperial-black",
  "--imperial-panel",
  "--imperial-panel-strong",
  "--imperial-green",
  "--imperial-green-2",
  "--imperial-gold",
  "--imperial-gold-2",
  "--imperial-red",
  "--imperial-text",
  "--matchroom-bg",
  "--matchroom-panel",
  "--matchroom-panel-strong",
  "--matchroom-lime",
  "--matchroom-cyan",
  "--matchroom-violet",
  "--league-cover-image",
  "--league-watermark-image",
] as const;

export default function LeagueThemeController({ league }: { league?: LeagueBranding | null }) {
  useEffect(() => {
    if (!league) return;

    const root = document.documentElement;
    const previous = new Map<string, string>();
    for (const property of managedProperties) previous.set(property, root.style.getPropertyValue(property));

    const brand = resolveLeagueBranding(league);
    const primary = brand.primary;
    const secondary = brand.secondary;
    const background = brand.background;

    const values: Record<string, string> = {
      "--background": background,
      "--foreground": "#f6f7fb",
      "--card": hexToRgba(background, 0.90),
      "--card-2": hexToRgba(primary, 0.075),
      "--muted": "rgba(246,247,251,0.60)",
      "--border": hexToRgba(primary, 0.20),
      "--border-strong": hexToRgba(primary, 0.38),
      "--accent": primary,
      "--accent-2": secondary,
      "--accent-soft": hexToRgba(primary, 0.14),
      "--imperial-black": background,
      "--imperial-panel": hexToRgba(background, 0.90),
      "--imperial-panel-strong": hexToRgba(background, 0.96),
      "--imperial-green": secondary,
      "--imperial-green-2": secondary,
      "--imperial-gold": primary,
      "--imperial-gold-2": primary,
      "--imperial-red": secondary,
      "--imperial-text": "#f6f7fb",
      "--matchroom-bg": background,
      "--matchroom-panel": hexToRgba(background, 0.80),
      "--matchroom-panel-strong": hexToRgba(background, 0.96),
      "--matchroom-lime": primary,
      "--matchroom-cyan": secondary,
      "--matchroom-violet": secondary,
      "--league-cover-image": brand.coverUrl ? `url(${JSON.stringify(brand.coverUrl)})` : "none",
      "--league-watermark-image": brand.logoUrl ? `url(${JSON.stringify(brand.logoUrl)})` : "none",
    };

    for (const [property, value] of Object.entries(values)) root.style.setProperty(property, value);
    document.body.dataset.leagueTheme = brand.mode.toLowerCase();

    return () => {
      for (const property of managedProperties) {
        const value = previous.get(property) || "";
        if (value) root.style.setProperty(property, value);
        else root.style.removeProperty(property);
      }
      delete document.body.dataset.leagueTheme;
    };
  }, [league]);

  return null;
}
