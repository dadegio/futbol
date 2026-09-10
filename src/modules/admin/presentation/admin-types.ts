export type AdminSection =
  | "overview"
  | "operations"
  | "finance"
  | "branding"
  | "privacy"
  | "competition"
  | "fields"
  | "referees"
  | "sponsors"
  | "media"
  | "audit";

export type LeagueSettings = {
  id: string;
  name: string;
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
  playoffFormat?: "SINGLE_ELIM" | "TWO_LEG" | null;
  playoffTeamCount?: number | null;
  playoffSeeded?: boolean;
};

export type AdminSummary = {
  league: { id: string; name: string };
  totals: {
    teams: number;
    players: number;
    authorized: number;
    blocked: number;
    wildcards: number;
    sheetAppearances: number;
    playerFeesCents: number;
    paidCents: number;
    outstandingCents: number;
    matches: number;
    playedMatches: number;
    operationalAttention: number;
  };
  byTeam: Array<{
    teamId: string;
    teamName: string;
    players: number;
    authorized: number;
    blocked: number;
    wildcards: number;
    appearances: number;
    playerFeesCents: number;
    paidCents: number;
    outstandingCents: number;
  }>;
};
