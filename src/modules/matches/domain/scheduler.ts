export type Pairing = {
  homeTeamId: string;
  awayTeamId: string;
  round: number;
};

function shuffle<T>(arr: T[], seed?: number): T[] {
  const a = [...arr];
  let x = seed ?? Math.floor(Math.random() * 1e9);

  const rand = () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };

  for (let i = a.length - 1; i > 0; i -= 1) {
    const randomValue = seed !== undefined ? rand() : Math.random();
    const j = Math.floor(randomValue * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }

  return a;
}

/**
 * Genera un calendario round-robin.
 *
 * - Se doubleRound=false genera solo andata.
 * - Se doubleRound=true genera andata e ritorno.
 * - Se il numero di squadre è dispari aggiunge un BYE interno.
 * - La lista passata dal chiamante non viene mai mutata.
 */
export function generateRoundRobin(
  teamIds: string[],
  opts?: {
    random?: boolean;
    seed?: number;
    alternateHomeAway?: boolean;
    doubleRound?: boolean;
  }
): Pairing[] {
  const {
    random = true,
    seed,
    alternateHomeAway = true,
    doubleRound = true,
  } = opts ?? {};

  let teams = random ? shuffle(teamIds, seed) : [...teamIds];
  const BYE = "__BYE__";

  if (teams.length < 2) return [];
  if (teams.length % 2 === 1) teams = [...teams, BYE];

  const n = teams.length;
  const rounds = n - 1;
  const half = n / 2;
  const pairings: Pairing[] = [];
  let arr = [...teams];

  for (let round = 1; round <= rounds; round += 1) {
    const left = arr.slice(0, half);
    const right = arr.slice(half).reverse();

    for (let index = 0; index < half; index += 1) {
      const a = left[index];
      const b = right[index];

      if (a === BYE || b === BYE) continue;

      const flip = alternateHomeAway ? (round + index) % 2 === 0 : false;
      pairings.push({
        round,
        homeTeamId: flip ? b : a,
        awayTeamId: flip ? a : b,
      });
    }

    const fixed = arr[0];
    const rest = arr.slice(1);
    rest.unshift(rest.pop()!);
    arr = [fixed, ...rest];
  }

  if (!doubleRound) return pairings;

  const returnLeg = pairings.map((pairing) => ({
    round: pairing.round + rounds,
    homeTeamId: pairing.awayTeamId,
    awayTeamId: pairing.homeTeamId,
  }));

  return [...pairings, ...returnLeg];
}