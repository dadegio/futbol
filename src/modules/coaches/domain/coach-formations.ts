export type FormationPoint = {
  x: number;
  y: number;
};

export const COACH_FORMATIONS = {
  "3-3-1": [
    { x: 50, y: 91 },
    { x: 22, y: 72 }, { x: 50, y: 68 }, { x: 78, y: 72 },
    { x: 22, y: 46 }, { x: 50, y: 42 }, { x: 78, y: 46 },
    { x: 50, y: 17 },
  ],
  "2-3-2": [
    { x: 50, y: 91 },
    { x: 34, y: 70 }, { x: 66, y: 70 },
    { x: 20, y: 46 }, { x: 50, y: 42 }, { x: 80, y: 46 },
    { x: 35, y: 19 }, { x: 65, y: 19 },
  ],
  "3-2-2": [
    { x: 50, y: 91 },
    { x: 22, y: 72 }, { x: 50, y: 68 }, { x: 78, y: 72 },
    { x: 35, y: 44 }, { x: 65, y: 44 },
    { x: 35, y: 19 }, { x: 65, y: 19 },
  ],
  "2-4-1": [
    { x: 50, y: 91 },
    { x: 34, y: 70 }, { x: 66, y: 70 },
    { x: 14, y: 46 }, { x: 38, y: 42 }, { x: 62, y: 42 }, { x: 86, y: 46 },
    { x: 50, y: 17 },
  ],
  "4-2-1": [
    { x: 50, y: 91 },
    { x: 14, y: 70 }, { x: 38, y: 66 }, { x: 62, y: 66 }, { x: 86, y: 70 },
    { x: 35, y: 42 }, { x: 65, y: 42 },
    { x: 50, y: 17 },
  ],
  "3-1-3": [
    { x: 50, y: 91 },
    { x: 22, y: 72 }, { x: 50, y: 68 }, { x: 78, y: 72 },
    { x: 50, y: 47 },
    { x: 20, y: 20 }, { x: 50, y: 16 }, { x: 80, y: 20 },
  ],
  "2-2-3": [
    { x: 50, y: 91 },
    { x: 34, y: 70 }, { x: 66, y: 70 },
    { x: 35, y: 46 }, { x: 65, y: 46 },
    { x: 18, y: 20 }, { x: 50, y: 16 }, { x: 82, y: 20 },
  ],
} as const satisfies Record<string, readonly FormationPoint[]>;

export type CoachFormation = keyof typeof COACH_FORMATIONS | "MANUAL";

export const COACH_FORMATION_OPTIONS: CoachFormation[] = [
  "3-3-1",
  "2-3-2",
  "3-2-2",
  "2-4-1",
  "4-2-1",
  "3-1-3",
  "2-2-3",
  "MANUAL",
];

export const COACH_LINEUP_LOCK_MINUTES = 30;

export function isCoachFormation(value: string): value is CoachFormation {
  return COACH_FORMATION_OPTIONS.includes(value as CoachFormation);
}

export function lineupDeadline(date: Date | null) {
  return date
    ? new Date(date.getTime() - COACH_LINEUP_LOCK_MINUTES * 60_000)
    : null;
}
