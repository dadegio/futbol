export const STANDARD_REFEREE_FEE_CENTS = 1500;
export const SCOCCIMARRO_REFEREE_FEE_CENTS = 2000;

function normalizeRefereeName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * Tariffa informativa della singola gara.
 * Non entra nei conteggi economici del torneo: viene gestita direttamente
 * dalle squadre coinvolte.
 */
export function getRefereeMatchFeeCents(refereeName: string | null | undefined) {
  if (!refereeName) return STANDARD_REFEREE_FEE_CENTS;
  return normalizeRefereeName(refereeName).includes("scoccimarro")
    ? SCOCCIMARRO_REFEREE_FEE_CENTS
    : STANDARD_REFEREE_FEE_CENTS;
}
