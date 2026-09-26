export type MatchKitTeam = {
  colorHex?: string | null;
  secondaryColorHex?: string | null;
  kitHomeUrl?: string | null;
  kitAwayUrl?: string | null;
};

export type MatchKitChoice = {
  url: string | null;
  kind: "home" | "away";
};

function normalizeHex(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized : null;
}

function rgb(value: string | null | undefined) {
  const color = normalizeHex(value);
  if (!color) return null;
  return {
    r: Number.parseInt(color.slice(1, 3), 16),
    g: Number.parseInt(color.slice(3, 5), 16),
    b: Number.parseInt(color.slice(5, 7), 16),
  };
}

export function kitColorsLikelyClash(
  first: string | null | undefined,
  second: string | null | undefined
) {
  const a = rgb(first);
  const b = rgb(second);
  if (!a || !b) return false;

  // Distanza RGB pesata: sufficiente per evitare le collisioni cromatiche
  // più evidenti senza introdurre metadati aggiuntivi sulle divise.
  const distance = Math.sqrt(
    2 * (a.r - b.r) ** 2 +
      4 * (a.g - b.g) ** 2 +
      3 * (a.b - b.b) ** 2
  );

  return distance < 245;
}

function firstAvailableKit(team: MatchKitTeam): MatchKitChoice {
  if (team.kitHomeUrl?.trim()) {
    return { url: team.kitHomeUrl.trim(), kind: "home" };
  }
  if (team.kitAwayUrl?.trim()) {
    return { url: team.kitAwayUrl.trim(), kind: "away" };
  }
  return { url: null, kind: "home" };
}

export function selectMatchKits(
  homeTeam: MatchKitTeam,
  awayTeam: MatchKitTeam
): { home: MatchKitChoice; away: MatchKitChoice } {
  const home = firstAvailableKit(homeTeam);

  const awayHome = awayTeam.kitHomeUrl?.trim() || null;
  const awayAway = awayTeam.kitAwayUrl?.trim() || null;
  const clash = kitColorsLikelyClash(homeTeam.colorHex, awayTeam.colorHex);

  // Entrambe le squadre usano la prima divisa quando possibile. Solo in caso
  // di probabile collisione cromatica la squadra ospite passa alla seconda.
  const away: MatchKitChoice = clash && awayAway
    ? { url: awayAway, kind: "away" }
    : awayHome
      ? { url: awayHome, kind: "home" }
      : awayAway
        ? { url: awayAway, kind: "away" }
        : { url: null, kind: "home" };

  return { home, away };
}
