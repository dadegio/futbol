export const FUTPOLI_RULES = {
  maxPlayersPerTeam: 14,
  minPlayersInMatchSheet: 8,
  playerFeeCentsPerAppearance: 50,
  refereeCostCentsPerMatch: 2000,
  refereeCostCentsPerTeam: 1000,
} as const;

export const AUTHORIZED_PLAYER_STATUS = "AUTHORIZED" as const;

export type PlayerRegistrationStatus =
  | "Iscrizione OK"
  | "Squalificato"
  | "Bloccato"
  | "Ritirato"
  | "In verifica"
  | "Da completare";

export type PlayerEligibilityInput = {
  status?: string | null;
  documentSigned?: boolean | null;
  mediaConsent?: boolean | null;
};

export function isPlayerEligibleForMatchSheet(player: PlayerEligibilityInput) {
  return Boolean(
    player.status === AUTHORIZED_PLAYER_STATUS &&
      player.documentSigned &&
      player.mediaConsent
  );
}

export function getPlayerRegistrationStatus(player: PlayerEligibilityInput): PlayerRegistrationStatus {
  if (isPlayerEligibleForMatchSheet(player)) return "Iscrizione OK";
  if (player.status === "SUSPENDED") return "Squalificato";
  if (player.status === "BLOCKED") return "Bloccato";
  if (player.status === "RETIRED") return "Ritirato";
  if (player.status === "IN_REVIEW") return "In verifica";
  return "Da completare";
}

export function getPlayerAdminMissingItems(player: PlayerEligibilityInput) {
  const missing: string[] = [];

  if (player.status !== AUTHORIZED_PLAYER_STATUS) {
    missing.push("stato non autorizzato");
  }
  if (!player.documentSigned) missing.push("modulo firmato");
  if (!player.mediaConsent) missing.push("liberatoria video/foto");

  return missing;
}

export function centsToEuro(cents: number) {
  return cents / 100;
}