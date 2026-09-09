export type LeagueBranding = {
  id?: string;
  name?: string;
  themeMode?: string | null;
  brandLogoUrl?: string | null;
  brandCoverUrl?: string | null;
  brandPrimaryColor?: string | null;
  brandSecondaryColor?: string | null;
  brandBackgroundColor?: string | null;
  cookieBannerEnabled?: boolean | null;
  privacyPolicyUrl?: string | null;
  cookiePolicyUrl?: string | null;
  adsEnabled?: boolean | null;
  adProvider?: string | null;
  adClientId?: string | null;
  adHomeSlot?: string | null;
  adLeagueSlot?: string | null;
  playoffFormat?: string | null;
  playoffTeamCount?: number | null;
  playoffSeeded?: boolean | null;
};

export const GENERIC_BRAND = {
  primary: "#66e3ff",
  secondary: "#6c63ff",
  background: "#071018",
};

export const IMPERIAL_BRAND = {
  primary: "#c9a766",
  secondary: "#28563b",
  background: "#050806",
  logoUrl: "/cammino-imperiale-logo.png",
};

export function normalizeThemeMode(value?: string | null): "IMPERIAL" | "GENERIC" | "CUSTOM" {
  return value === "IMPERIAL" || value === "CUSTOM" ? value : "GENERIC";
}

export function isHexColor(value?: string | null) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value.trim());
}

export function resolveLeagueBranding(league?: LeagueBranding | null) {
  const mode = normalizeThemeMode(league?.themeMode);
  if (mode === "IMPERIAL") {
    return {
      mode,
      primary: IMPERIAL_BRAND.primary,
      secondary: IMPERIAL_BRAND.secondary,
      background: IMPERIAL_BRAND.background,
      logoUrl: IMPERIAL_BRAND.logoUrl,
      coverUrl: null,
      label: "Cammino Imperiale",
    };
  }

  if (mode === "GENERIC") {
    return {
      mode,
      primary: GENERIC_BRAND.primary,
      secondary: GENERIC_BRAND.secondary,
      background: GENERIC_BRAND.background,
      logoUrl: null,
      coverUrl: null,
      label: league?.name || "Torneo",
    };
  }

  return {
    mode,
    primary: isHexColor(league?.brandPrimaryColor) ? league!.brandPrimaryColor! : GENERIC_BRAND.primary,
    secondary: isHexColor(league?.brandSecondaryColor) ? league!.brandSecondaryColor! : GENERIC_BRAND.secondary,
    background: isHexColor(league?.brandBackgroundColor) ? league!.brandBackgroundColor! : GENERIC_BRAND.background,
    logoUrl: league?.brandLogoUrl || null,
    coverUrl: league?.brandCoverUrl || null,
    label: league?.name || "Torneo",
  };
}

export function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const parsed = Number.parseInt(normalized, 16);
  const r = (parsed >> 16) & 255;
  const g = (parsed >> 8) & 255;
  const b = parsed & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
